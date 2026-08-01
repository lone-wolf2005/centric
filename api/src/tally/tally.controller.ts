import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  listValuedDocuments,
  valueMovement,
} from '../common/document-value';

/**
 * Tally integration — orders + valued DC/GRN documents.
 * Live ERP push/pull remains stubbed under /tally/*.
 */
@Controller('tally-orders')
@UseGuards(JwtAuthGuard)
export class TallyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  index() {
    return this.prisma.tallyOrder.findMany({
      include: {
        movements: {
          where: { status: 'completed' },
          select: {
            id: true,
            type: true,
            dcNumber: true,
            grnNumber: true,
            completedAt: true,
          },
          orderBy: { completedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('sync')
  async sync() {
    const samples = [
      {
        orderNo: 'TO-RENT-TIRU-001',
        type: 'rental',
        customerName: 'Sakthi Constructions',
        siteName: 'TNSCB Tiruttani',
        status: 'in_progress',
      },
      {
        orderNo: 'TO-RENT-SAIRAM-002',
        type: 'rental',
        customerName: 'Sairam Engineering College',
        siteName: 'Sairam Engg',
        status: 'open',
      },
      {
        orderNo: 'TO-PROJ-MEPZ-003',
        type: 'project',
        customerName: 'RR Groups Internal',
        siteName: 'MEPZ TFC Tambaram',
        status: 'in_progress',
      },
      {
        orderNo: 'TO-RENT-PALANI-004',
        type: 'rental',
        customerName: 'Palani Municipality Works',
        siteName: 'Palani Municipality',
        status: 'open',
      },
      {
        orderNo: 'TO-RENT-UPSC-005',
        type: 'rental',
        customerName: 'CPWD Prayagraj Circle',
        siteName: 'UPSC Building Prayagraj',
        status: 'completed',
      },
    ];

    const orders = [];
    for (const sample of samples) {
      orders.push(
        await this.prisma.tallyOrder.upsert({
          where: { orderNo: sample.orderNo },
          update: {
            customerName: sample.customerName,
            siteName: sample.siteName,
            type: sample.type,
            status: sample.status,
            syncedAt: new Date(),
          },
          create: { ...sample, syncedAt: new Date() },
        }),
      );
    }

    // Remove accidental random Sync duplicates from earlier builds
    await this.prisma.tallyOrder.deleteMany({
      where: {
        orderNo: { startsWith: 'TO-2026' },
        NOT: {
          orderNo: { in: samples.map((s) => s.orderNo) },
        },
      },
    });

    return {
      message: `Synced ${orders.length} Tally orders (upserted fixed demo masters — no duplicates)`,
      orders,
    };
  }

  @Get(':id')
  async show(@Param('id', ParseIntPipe) id: number) {
    const order = await this.prisma.tallyOrder.findUniqueOrThrow({
      where: { id },
      include: {
        movements: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          select: { id: true },
        },
      },
    });

    const documents = [];
    for (const m of order.movements) {
      const doc = await valueMovement(this.prisma, m.id);
      if (doc) documents.push(doc);
    }

    return {
      ...order,
      documents,
      dc_value: documents
        .filter((d) => d.doc_type === 'DC')
        .reduce((s, d) => s + d.monthly_value, 0),
      grn_value: documents
        .filter((d) => d.doc_type === 'GRN')
        .reduce((s, d) => s + d.monthly_value, 0),
    };
  }
}

@Controller('tally')
@UseGuards(JwtAuthGuard)
export class TallyContractController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('documents')
  documents(@Query('type') type?: 'DC' | 'GRN') {
    return listValuedDocuments(this.prisma, {
      type: type === 'DC' || type === 'GRN' ? type : undefined,
      take: 100,
    });
  }

  @Get('documents/:id')
  async document(@Param('id', ParseIntPipe) id: number) {
    const doc = await valueMovement(this.prisma, id);
    if (!doc) {
      return { message: 'Document not found or movement not completed' };
    }
    return doc;
  }

  @Post('documents/:id/push')
  async pushDocument(@Param('id', ParseIntPipe) id: number) {
    const doc = await valueMovement(this.prisma, id);
    if (!doc) {
      return { status: 'error', message: 'Document not found' };
    }
    return {
      status: 'queued',
      direction: 'Cloud → Tally',
      doc_type: doc.doc_type,
      reference: doc.reference,
      monthly_value: doc.monthly_value,
      message: `${doc.doc_type} ${doc.reference} queued for Tally sync (stub)`,
    };
  }

  @Get('items/pull')
  pullItems() {
    return {
      status: 'stub',
      direction: 'Tally → Cloud',
      message: 'Item master pull not connected to live Tally ERP',
    };
  }

  @Post('dc/push')
  pushDc() {
    return {
      status: 'stub',
      direction: 'Cloud → Tally',
      message: 'DC push not connected to live Tally ERP',
    };
  }

  @Post('grn/push')
  pushGrn() {
    return {
      status: 'stub',
      direction: 'Cloud → Tally',
      message: 'GRN push not connected to live Tally ERP',
    };
  }

  @Get('invoices/pull')
  pullInvoices() {
    return {
      status: 'stub',
      direction: 'Tally → Cloud',
      message: 'Invoice pull not connected to live Tally ERP',
    };
  }
}
