import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CENTERING_MATERIALS,
  inclusiveDays,
  keysToCamel,
  randomCode,
} from '../common/utils';

type Authed = Request & { user: { id: number } };

@Controller()
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('billing')
  index(@Req() req: Request) {
    const q = req.query as { location_id?: string; status?: string };
    return this.prisma.rentalBill.findMany({
      where: {
        locationId: q.location_id ? Number(q.location_id) : undefined,
        status: q.status,
      },
      include: { location: true, generatedBy: true },
      orderBy: { periodEnd: 'desc' },
    });
  }

  @Get('billing/:id')
  show(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.rentalBill.findUniqueOrThrow({
      where: { id },
      include: {
        location: true,
        generatedBy: true,
        lines: { include: { material: true, materialSize: true } },
      },
    });
  }

  @Post('billing/generate')
  async generate(@Body() body: Record<string, unknown>, @Req() req: Authed) {
    const data = keysToCamel(body) as {
      locationId: number;
      periodStart: string;
      periodEnd: string;
      lines: Array<{
        materialSizeId: number;
        quantity: number;
        startDate: string;
        endDate: string;
        ratePerMonth?: number;
      }>;
    };

    const location = await this.prisma.location.findUniqueOrThrow({
      where: { id: data.locationId },
    });

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    const existing = await this.prisma.rentalBill.findFirst({
      where: {
        locationId: location.id,
        periodStart,
        periodEnd,
      },
    });

    const bill =
      existing ??
      (await this.prisma.rentalBill.create({
        data: {
          billNo: randomCode('RB'),
          locationId: location.id,
          siteName: location.name,
          periodStart,
          periodEnd,
          status: 'draft',
          generatedById: req.user.id,
        },
      }));

    if (existing) {
      await this.prisma.rentalBillLine.deleteMany({
        where: { rentalBillId: bill.id },
      });
      await this.prisma.rentalBill.update({
        where: { id: bill.id },
        data: { status: 'draft', generatedById: req.user.id },
      });
    }

    let centering = 0;
    let scaffolding = 0;

    for (const line of data.lines) {
      const size = await this.prisma.materialSize.findUniqueOrThrow({
        where: { id: line.materialSizeId },
        include: { material: true },
      });
      const start = new Date(line.startDate);
      const end = new Date(line.endDate);
      const days = inclusiveDays(start, end);
      const qty = line.quantity;
      const rateMonth = line.ratePerMonth ?? size.ratePerMonth ?? 0;
      const rateDay = rateMonth / 30;
      const consumed = days * qty;
      const amount = Math.round(consumed * rateDay * 100) / 100;
      const group = CENTERING_MATERIALS.includes(size.material.name)
        ? 'centering'
        : 'scaffolding';

      await this.prisma.rentalBillLine.create({
        data: {
          rentalBillId: bill.id,
          materialId: size.materialId,
          materialSizeId: size.id,
          particulars: size.label,
          categoryGroup: group,
          unit: size.unit,
          quantity: qty,
          startDate: start,
          endDate: end,
          days,
          totalConsumed: consumed,
          ratePerMonth: rateMonth,
          ratePerDay: rateDay,
          amount,
        },
      });

      if (group === 'centering') centering += amount;
      else scaffolding += amount;
    }

    return this.prisma.rentalBill.update({
      where: { id: bill.id },
      data: {
        centeringTotal: Math.round(centering * 100) / 100,
        scaffoldingTotal: Math.round(scaffolding * 100) / 100,
        grandTotal: Math.round((centering + scaffolding) * 100) / 100,
      },
      include: {
        location: true,
        generatedBy: true,
        lines: { include: { material: true, materialSize: true } },
      },
    });
  }

  @Post('billing/:id/raise')
  raise(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.rentalBill.update({
      where: { id },
      data: { status: 'raised', raisedAt: new Date() },
      include: { location: true, lines: true },
    });
  }

  @Get('notifications')
  async notifications(@Req() req: Authed) {
    await this.refreshReminders(req.user.id);
    return this.prisma.appNotification.findMany({
      where: {
        OR: [{ userId: null }, { userId: req.user.id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post('notifications/:id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.appNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  private async refreshReminders(userId: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sites = await this.prisma.location.findMany({
      where: {
        type: { not: 'godown' },
        isActive: true,
        bills: {
          none: {
            periodStart: { gte: startOfMonth },
            status: { in: ['raised', 'synced'] },
          },
        },
      },
      take: 10,
    });

    for (const site of sites) {
      const exists = await this.prisma.appNotification.findFirst({
        where: {
          type: 'billing_reminder',
          title: `Billing pending: ${site.name}`,
          userId,
        },
      });
      if (!exists) {
        await this.prisma.appNotification.create({
          data: {
            type: 'billing_reminder',
            title: `Billing pending: ${site.name}`,
            body: `Monthly rental bill has not been raised for ${site.name} this period.`,
            meta: JSON.stringify({ location_id: site.id }),
            userId,
          },
        });
      }
    }

    const overdue = await this.prisma.materialMovement.findMany({
      where: {
        type: 'outward',
        status: 'completed',
        dueDate: { lte: new Date() },
        dcNumber: { not: null },
      },
      take: 20,
    });

    for (const movement of overdue) {
      const returned = await this.prisma.materialMovement.findFirst({
        where: {
          type: 'inward',
          linkedDcNumber: movement.dcNumber ?? undefined,
          status: 'completed',
        },
      });
      if (returned || !movement.dcNumber) continue;

      const exists = await this.prisma.appNotification.findFirst({
        where: {
          type: 'return_due',
          title: `Return due: ${movement.dcNumber}`,
          userId,
        },
      });
      if (!exists) {
        await this.prisma.appNotification.create({
          data: {
            type: 'return_due',
            title: `Return due: ${movement.dcNumber}`,
            body: `Material return is due/overdue for DC ${movement.dcNumber}.`,
            meta: JSON.stringify({
              movement_id: movement.id,
              dc_number: movement.dcNumber,
            }),
            userId,
          },
        });
      }
    }
  }
}
