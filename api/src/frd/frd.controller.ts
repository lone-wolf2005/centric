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
import { keysToCamel, randomCode } from '../common/utils';
import { StockService } from '../stock/stock.service';

type Authed = Request & { user: { id: number } };

@Controller()
@UseGuards(JwtAuthGuard)
export class FrdController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  @Get('locations')
  locations() {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('quotations')
  quotations() {
    return this.prisma.quotation.findMany({
      include: {
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('quotations')
  async storeQuotation(@Body() body: Record<string, unknown>, @Req() req: Authed) {
    const data = keysToCamel(body) as {
      customerName: string;
      siteName?: string;
      estimatedAmount?: number;
      validUntil?: string;
      items?: Array<{
        materialId: number;
        materialSizeId?: number;
        quantity: number;
        ratePerMonth?: number;
      }>;
    };

    return this.prisma.quotation.create({
      data: {
        quoteNo: randomCode('QT'),
        customerName: data.customerName,
        siteName: data.siteName,
        estimatedAmount: data.estimatedAmount,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: 'draft',
        createdById: req.user.id,
        items: data.items?.length
          ? {
              create: data.items.map((item) => ({
                materialId: item.materialId,
                materialSizeId: item.materialSizeId ?? null,
                quantity: item.quantity,
                ratePerMonth: item.ratePerMonth,
              })),
            }
          : undefined,
      },
      include: {
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
    });
  }

  @Post('quotations/:id/revise')
  async reviseQuotation(@Param('id', ParseIntPipe) id: number) {
    const q = await this.prisma.quotation.findUniqueOrThrow({ where: { id } });
    return this.prisma.quotation.update({
      where: { id },
      data: { revision: q.revision + 1, status: 'revised' },
      include: { createdBy: true, items: true },
    });
  }

  @Post('quotations/:id/confirm')
  async confirmQuotation(@Param('id', ParseIntPipe) id: number) {
    const q = await this.prisma.quotation.update({
      where: { id },
      data: { status: 'confirmed' },
      include: { items: true },
    });

    const order = await this.prisma.tallyOrder.create({
      data: {
        orderNo: randomCode('TO'),
        type: 'rental',
        customerName: q.customerName,
        siteName: q.siteName,
        status: 'open',
        syncedAt: new Date(),
      },
    });

    return { quotation: q, tally_order: order };
  }

  @Get('indents')
  indents() {
    return this.prisma.indent.findMany({
      include: {
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('indents')
  async storeIndent(@Body() body: Record<string, unknown>, @Req() req: Authed) {
    const data = keysToCamel(body) as {
      projectName: string;
      siteName?: string;
      items?: Array<{
        materialId: number;
        materialSizeId?: number;
        quantity: number;
      }>;
    };

    return this.prisma.indent.create({
      data: {
        indentNo: randomCode('IND'),
        projectName: data.projectName,
        siteName: data.siteName,
        status: 'open',
        createdById: req.user.id,
        items: data.items?.length
          ? {
              create: data.items.map((item) => ({
                materialId: item.materialId,
                materialSizeId: item.materialSizeId ?? null,
                quantity: item.quantity,
              })),
            }
          : undefined,
      },
      include: {
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
    });
  }

  @Get('site-transfers')
  siteTransfers() {
    return this.prisma.siteTransfer.findMany({
      include: {
        fromLocation: true,
        toLocation: true,
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('site-transfers')
  async storeSiteTransfer(@Body() body: Record<string, unknown>, @Req() req: Authed) {
    const data = keysToCamel(body) as {
      fromLocationId: number;
      toLocationId: number;
      notes?: string;
      items?: Array<{
        materialId: number;
        materialSizeId?: number;
        quantity: number;
      }>;
    };

    const transfer = await this.prisma.siteTransfer.create({
      data: {
        transferNo: randomCode('ST'),
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        notes: data.notes,
        createdById: req.user.id,
        items: data.items?.length
          ? {
              create: data.items.map((item) => ({
                materialId: item.materialId,
                materialSizeId: item.materialSizeId ?? null,
                quantity: item.quantity,
              })),
            }
          : undefined,
      },
      include: {
        fromLocation: true,
        toLocation: true,
        createdBy: true,
        items: { include: { material: true, materialSize: true } },
      },
    });

    await this.prisma.approval.create({
      data: {
        approvableType: 'SiteTransfer',
        approvableId: transfer.id,
        type: 'transfer',
        requestedById: req.user.id,
      },
    });

    return transfer;
  }

  @Post('site-transfers/:id/approve')
  async approveSiteTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Authed,
  ) {
    const data = keysToCamel(body) as {
      role: 'sender' | 'receiver' | 'authority';
      decision: 'approved' | 'rejected';
      notes?: string;
    };

    const field =
      data.role === 'sender'
        ? 'senderApproval'
        : data.role === 'receiver'
          ? 'receiverApproval'
          : 'authorityApproval';

    let transfer = await this.prisma.siteTransfer.update({
      where: { id },
      data: { [field]: data.decision },
      include: { items: true },
    });

    if (
      transfer.senderApproval === 'approved' &&
      transfer.receiverApproval === 'approved' &&
      transfer.authorityApproval === 'approved'
    ) {
      for (const item of transfer.items) {
        await this.stockService.adjust(
          transfer.fromLocationId,
          item.materialId,
          item.materialSizeId,
          -item.quantity,
        );
        await this.stockService.adjust(
          transfer.toLocationId,
          item.materialId,
          item.materialSizeId,
          item.quantity,
        );
      }
      transfer = await this.prisma.siteTransfer.update({
        where: { id },
        data: { status: 'completed' },
        include: {
          fromLocation: true,
          toLocation: true,
          items: { include: { material: true, materialSize: true } },
        },
      });
    }

    await this.prisma.approval.create({
      data: {
        approvableType: 'SiteTransfer',
        approvableId: id,
        type: 'transfer',
        status: data.decision,
        requestedById: req.user.id,
        approvedById: req.user.id,
        notes: data.notes,
        actedAt: new Date(),
      },
    });

    return transfer;
  }

  @Get('approvals')
  approvals() {
    return this.prisma.approval.findMany({
      include: { requester: true, approver: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('movements/:id/approve')
  async approveMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Authed,
  ) {
    const data = keysToCamel(body) as {
      decision: 'approved' | 'rejected';
      notes?: string;
    };

    const movement = await this.prisma.materialMovement.update({
      where: { id },
      data: {
        approvalStatus: data.decision,
        receiverConfirmedById: req.user.id,
        receiverConfirmedAt: new Date(),
      },
      include: { supervisor: true, receiver: true },
    });

    await this.prisma.approval.create({
      data: {
        approvableType: 'MaterialMovement',
        approvableId: id,
        type: movement.type === 'outward' ? 'delivery' : 'return',
        status: data.decision,
        requestedById: movement.supervisorId,
        approvedById: req.user.id,
        notes: data.notes,
        actedAt: new Date(),
      },
    });

    return movement;
  }

  @Get('stock')
  async stock() {
    const balances = await this.prisma.stockBalance.findMany({
      include: {
        location: true,
        material: true,
        materialSize: true,
      },
      orderBy: [{ locationId: 'asc' }, { materialId: 'asc' }],
    });

    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return { locations, balances };
  }

  @Get('scan-history')
  scanHistory() {
    return this.prisma.scanEvent.findMany({
      include: {
        detectedMaterial: true,
        expectedSize: true,
        session: {
          include: {
            material: true,
            materialSize: true,
            movement: { include: { supervisor: true } },
          },
        },
      },
      orderBy: { scannedAt: 'desc' },
      take: 200,
    });
  }
}
