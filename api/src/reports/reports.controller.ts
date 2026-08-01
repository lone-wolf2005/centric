import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  listValuedDocuments,
  type ValuedDocument,
} from '../common/document-value';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayInward,
      todayOutward,
      activeScans,
      mismatchesToday,
      materialCategories,
      pendingApprovals,
      openOrders,
      recentDocs,
      monthDocs,
    ] = await Promise.all([
      this.prisma.materialMovement.count({
        where: { type: 'inward', createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.materialMovement.count({
        where: { type: 'outward', createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.materialMovement.count({ where: { status: 'scanning' } }),
      this.prisma.scanEvent.count({
        where: { isMatch: false, createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.material.count({ where: { isActive: true } }),
      this.prisma.approval.count({ where: { status: 'pending' } }),
      this.prisma.tallyOrder.count({ where: { status: 'open' } }),
      listValuedDocuments(this.prisma, { take: 8 }),
      listValuedDocuments(this.prisma, { take: 200 }),
    ]);

    const todayDocs = monthDocs.filter((d: ValuedDocument) => {
      if (!d.completed_at) return false;
      const c = new Date(d.completed_at);
      return c >= today && c < tomorrow;
    });

    const dcToday = todayDocs.filter((d) => d.doc_type === 'DC');
    const grnToday = todayDocs.filter((d) => d.doc_type === 'GRN');
    const allDc = monthDocs.filter((d) => d.doc_type === 'DC');
    const allGrn = monthDocs.filter((d) => d.doc_type === 'GRN');

    const sum = (rows: ValuedDocument[]) =>
      Math.round(rows.reduce((s, d) => s + d.monthly_value, 0) * 100) / 100;

    return {
      today_inward: todayInward,
      today_outward: todayOutward,
      active_scans: activeScans,
      mismatches_today: mismatchesToday,
      material_categories: materialCategories,
      pending_approvals: pendingApprovals,
      open_tally_orders: openOrders,
      dc_today_count: dcToday.length,
      grn_today_count: grnToday.length,
      dc_today_value: sum(dcToday),
      grn_today_value: sum(grnToday),
      dc_total_value: sum(allDc),
      grn_total_value: sum(allGrn),
      recent_documents: recentDocs,
    };
  }

  @Get('inward')
  inward() {
    return this.movementReport('inward');
  }

  @Get('outward')
  outward() {
    return this.movementReport('outward');
  }

  @Get('item-summary')
  async itemSummary() {
    const materials = await this.prisma.material.findMany({
      include: { movementItems: { include: { movement: true } } },
      orderBy: { name: 'asc' },
    });

    return materials.map((m) => {
      const totalInward = m.movementItems
        .filter((i) => i.movement.type === 'inward')
        .reduce((s, i) => s + i.scannedCount, 0);
      const totalOutward = m.movementItems
        .filter((i) => i.movement.type === 'outward')
        .reduce((s, i) => s + i.scannedCount, 0);
      return {
        id: m.id,
        name: m.name,
        total_inward: totalInward,
        total_outward: totalOutward,
        balance: totalInward - totalOutward,
      };
    });
  }

  @Get('supervisor-summary')
  async supervisorSummary() {
    const users = await this.prisma.user.findMany({
      include: {
        movements: { include: { items: true } },
      },
    });

    return users
      .map((u) => ({
        id: u.id,
        supervisor_name: u.name,
        movement_count: u.movements.length,
        items_handled: u.movements.reduce(
          (s, m) => s + m.items.reduce((ss, i) => ss + i.scannedCount, 0),
          0,
        ),
      }))
      .sort((a, b) => b.items_handled - a.items_handled);
  }

  @Get('ai-accuracy')
  async aiAccuracy() {
    const [total, autoMatched, manual, mismatches] = await Promise.all([
      this.prisma.scanEvent.count(),
      this.prisma.scanEvent.count({
        where: { isMatch: true, manuallyVerified: false },
      }),
      this.prisma.scanEvent.count({ where: { manuallyVerified: true } }),
      this.prisma.scanEvent.count({ where: { isMatch: false } }),
    ]);

    return {
      total_scans: total,
      auto_matched: autoMatched,
      manually_verified: manual,
      mismatches,
      accuracy_percent: total > 0 ? Math.round((autoMatched / total) * 10000) / 100 : 0,
    };
  }

  @Get('exceptions')
  exceptions() {
    return this.prisma.scanEvent.findMany({
      where: { isMatch: false },
      include: {
        detectedMaterial: true,
        session: {
          include: {
            material: true,
            materialSize: true,
            movement: { include: { supervisor: true } },
          },
        },
      },
      orderBy: { scannedAt: 'desc' },
      take: 100,
    });
  }

  @Get('daily-activity')
  async dailyActivity(@Query('date') date?: string) {
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const movements = await this.prisma.materialMovement.findMany({
      where: { createdAt: { gte: day, lt: next } },
      include: {
        supervisor: true,
        items: { include: { material: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      date: day.toISOString().slice(0, 10),
      movements,
      totals: {
        inward: movements.filter((m) => m.type === 'inward').length,
        outward: movements.filter((m) => m.type === 'outward').length,
        items_scanned: movements.reduce(
          (s, m) => s + m.items.reduce((ss, i) => ss + i.scannedCount, 0),
          0,
        ),
      },
    };
  }

  @Get('daily-activity/export')
  @Header('Content-Type', 'text/csv')
  async dailyExport(@Query('date') date: string | undefined, @Res() res: Response) {
    const data = await this.dailyActivity(date);
    const rows = [
      'date,type,status,reference,supervisor,items_scanned',
      ...data.movements.map(
        (m) =>
          `${data.date},${m.type},${m.status},${m.dcNumber ?? m.grnNumber ?? ''},${m.supervisor?.name ?? ''},${m.items.reduce((s, i) => s + i.scannedCount, 0)}`,
      ),
    ];
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily-activity-${data.date}.csv"`,
    );
    res.send(rows.join('\n'));
  }

  @Get('pending-returns')
  pendingReturns() {
    return this.prisma.materialMovement.findMany({
      where: {
        type: 'outward',
        status: 'completed',
        OR: [{ dueDate: { lte: new Date() } }, { dueDate: null }],
      },
      include: {
        supervisor: true,
        destinationLocation: true,
        items: { include: { material: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });
  }

  @Get('damage-scrap')
  damageScrap() {
    return this.prisma.materialMovement.findMany({
      where: {
        type: 'inward',
        returnCondition: { in: ['damaged', 'scrap', 'repairable'] },
      },
      include: {
        supervisor: true,
        items: { include: { material: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('billing-pending')
  async billingPending() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sites = await this.prisma.location.findMany({
      where: {
        type: { not: 'godown' },
        bills: {
          none: {
            periodStart: { gte: startOfMonth },
            status: { in: ['raised', 'synced'] },
          },
        },
      },
    });

    return sites.map((s) => ({
      id: s.id,
      site_name: s.name,
      billing_status: 'pending',
    }));
  }

  @Get('rental-status')
  rentalStatus() {
    return this.prisma.materialMovement.findMany({
      where: { status: 'completed' },
      include: {
        quotation: true,
        indent: true,
        destinationLocation: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });
  }

  @Get('approval-status')
  approvalStatus() {
    return this.prisma.approval.findMany({
      include: { requester: true, approver: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('rent-statement')
  async rentStatement(@Query('location_id') locationId?: string, @Query('bill_id') billId?: string) {
    if (billId) {
      return this.prisma.rentalBill.findUniqueOrThrow({
        where: { id: Number(billId) },
        include: {
          location: true,
          lines: { include: { material: true, materialSize: true } },
        },
      });
    }

    return this.prisma.rentalBill.findMany({
      where: locationId ? { locationId: Number(locationId) } : undefined,
      include: {
        location: true,
        lines: { include: { material: true, materialSize: true } },
      },
      orderBy: { periodEnd: 'desc' },
    });
  }

  @Get('rent-statement/export')
  async rentExport(@Query('bill_id') billId: string, @Res() res: Response) {
    const bill = await this.prisma.rentalBill.findUniqueOrThrow({
      where: { id: Number(billId) },
      include: { lines: true },
    });

    const rows = [
      'particulars,unit,quantity,start_date,end_date,days,consumed,rate_month,rate_day,amount,group',
      ...bill.lines.map(
        (l) =>
          `"${l.particulars}",${l.unit},${l.quantity},${l.startDate.toISOString().slice(0, 10)},${l.endDate.toISOString().slice(0, 10)},${l.days},${l.totalConsumed},${l.ratePerMonth},${l.ratePerDay},${l.amount},${l.categoryGroup}`,
      ),
      `,,,,TOTALS,,,,,${bill.grandTotal},`,
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rent-statement-${bill.billNo}.csv"`,
    );
    res.send(rows.join('\n'));
  }

  @Get('asset-utilization')
  async assetUtilization() {
    const balances = await this.prisma.stockBalance.findMany({
      include: { location: true, material: true, materialSize: true },
    });

    const byMaterial = new Map<
      string,
      { material: string; at_godown: number; at_sites: number; total: number }
    >();

    for (const b of balances) {
      const key = b.material.name;
      const row = byMaterial.get(key) ?? {
        material: key,
        at_godown: 0,
        at_sites: 0,
        total: 0,
      };
      if (b.location.type === 'godown') row.at_godown += b.quantity;
      else row.at_sites += b.quantity;
      row.total += b.quantity;
      byMaterial.set(key, row);
    }

    return [...byMaterial.values()].map((r) => ({
      ...r,
      utilization_percent:
        r.total > 0 ? Math.round((r.at_sites / r.total) * 10000) / 100 : 0,
    }));
  }

  private async movementReport(type: string) {
    const movements = await this.prisma.materialMovement.findMany({
      where: { type },
      include: {
        supervisor: true,
        tallyOrder: true,
        items: { include: { material: true, materialSize: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return movements.map((m) => ({
      id: m.id,
      date: m.createdAt.toISOString().slice(0, 10),
      supervisor: m.supervisor?.name,
      reference: type === 'outward' ? m.dcNumber : m.grnNumber,
      destination: m.destination,
      customer: m.tallyOrder?.customerName,
      site: m.tallyOrder?.siteName,
      items: m.items.map((item) => ({
        material: item.material?.name,
        size: item.materialSize?.label,
        quantity: item.quantity,
        scanned_count: item.scannedCount,
      })),
    }));
  }
}
