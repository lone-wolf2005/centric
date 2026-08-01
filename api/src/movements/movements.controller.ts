import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import axios from 'axios';
import FormData = require('form-data');
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { keysToCamel, randomCode } from '../common/utils';
import { StockService } from '../stock/stock.service';

type Authed = Request & { user: { id: number } };

const movementInclude = {
  supervisor: true,
  tallyOrder: true,
  quotation: true,
  indent: true,
  sourceLocation: true,
  destinationLocation: true,
  items: { include: { material: true, materialSize: true } },
} as const;

@Controller()
@UseGuards(JwtAuthGuard)
export class MovementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly config: ConfigService,
  ) {}

  @Get('movements')
  index(@Req() req: Request) {
    const type = (req.query as { type?: string }).type;
    return this.prisma.materialMovement.findMany({
      where: type ? { type } : undefined,
      include: movementInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('movements')
  async store(@Body() body: Record<string, unknown>, @Req() req: Authed) {
    const data = keysToCamel(body) as {
      type: 'inward' | 'outward';
      tallyOrderId?: number;
      quotationId?: number;
      indentId?: number;
      sourceLocationId?: number;
      destinationLocationId?: number;
      returnCondition?: string;
      destination?: string;
      notes?: string;
      dueDate?: string;
      linkedDcNumber?: string;
      items: Array<{
        materialId: number;
        materialSizeId?: number;
        quantity: number;
      }>;
    };

    return this.prisma.materialMovement.create({
      data: {
        type: data.type,
        tallyOrderId: data.tallyOrderId,
        quotationId: data.quotationId,
        indentId: data.indentId,
        sourceLocationId: data.sourceLocationId,
        destinationLocationId: data.destinationLocationId,
        returnCondition:
          data.type === 'inward' ? (data.returnCondition ?? 'normal') : null,
        destination: data.destination,
        notes: data.notes,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        linkedDcNumber: data.linkedDcNumber,
        supervisorId: req.user.id,
        status: 'draft',
        approvalStatus: 'pending',
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            materialSizeId: item.materialSizeId ?? null,
            quantity: item.quantity,
          })),
        },
      },
      include: movementInclude,
    });
  }

  @Get('movements/active-scan')
  async activeScan(@Req() req: Authed) {
    const movement = await this.prisma.materialMovement.findFirst({
      where: { supervisorId: req.user.id, status: 'scanning' },
      include: movementInclude,
      orderBy: { startedAt: 'desc' },
    });

    if (!movement) {
      return { movement: null, session: null };
    }

    const session = await this.prisma.scanSession.findFirst({
      where: { materialMovementId: movement.id, status: 'active' },
      include: { material: true, materialSize: true },
      orderBy: { id: 'desc' },
    });

    return { movement, session };
  }

  @Get('movements/:id')
  show(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.materialMovement.findUniqueOrThrow({
      where: { id },
      include: movementInclude,
    });
  }

  @Post('movements/:id/scan')
  async startScan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const data = keysToCamel(body) as {
      materialId: number;
      materialSizeId?: number;
    };

    const movement = await this.prisma.materialMovement.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.materialMovement.update({
      where: { id },
      data: {
        status: 'scanning',
        startedAt: movement.startedAt ?? new Date(),
      },
    });

    const existing = await this.prisma.scanSession.findFirst({
      where: {
        materialMovementId: id,
        status: 'active',
        materialId: data.materialId,
        materialSizeId: data.materialSizeId ?? null,
      },
      include: { material: true, materialSize: true },
    });

    if (existing) return existing;

    return this.prisma.scanSession.create({
      data: {
        materialMovementId: id,
        materialId: data.materialId,
        materialSizeId: data.materialSizeId ?? null,
        status: 'active',
      },
      include: { material: true, materialSize: true },
    });
  }

  @Post('movements/:id/complete')
  async complete(@Param('id', ParseIntPipe) id: number) {
    const movement = await this.prisma.materialMovement.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });

    const number = randomCode(movement.type === 'outward' ? 'DC' : 'GRN');

    const updated = await this.prisma.materialMovement.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        dcNumber: movement.type === 'outward' ? number : movement.dcNumber,
        grnNumber: movement.type === 'inward' ? number : movement.grnNumber,
      },
      include: movementInclude,
    });

    await this.prisma.scanSession.updateMany({
      where: { materialMovementId: id, status: 'active' },
      data: { status: 'completed' },
    });

    for (const item of movement.items) {
      const qty = item.scannedCount || item.quantity;
      if (movement.type === 'outward') {
        const locId = movement.sourceLocationId;
        if (locId) {
          await this.stock.adjust(locId, item.materialId, item.materialSizeId, -qty);
        }
        if (movement.destinationLocationId) {
          await this.stock.adjust(
            movement.destinationLocationId,
            item.materialId,
            item.materialSizeId,
            qty,
          );
        }
      } else {
        const locId = movement.destinationLocationId ?? movement.sourceLocationId;
        if (locId) {
          await this.stock.adjust(locId, item.materialId, item.materialSizeId, qty);
        }
      }
    }

    await this.prisma.approval.create({
      data: {
        approvableType: 'MaterialMovement',
        approvableId: id,
        type: movement.type === 'outward' ? 'delivery' : 'return',
        status: 'pending',
        requestedById: movement.supervisorId,
      },
    });

    return {
      message: 'Movement completed (Tally DC/GRN stub queued)',
      movement: updated,
    };
  }

  @Get('scan-sessions/:id')
  showSession(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.scanSession.findUniqueOrThrow({
      where: { id },
      include: { material: true, materialSize: true },
    });
  }

  @Post('scan-sessions/:id/scan')
  async recordScan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const data = keysToCamel(body) as {
      detectedMaterialId: number;
      confidence?: number;
      manuallyVerified?: boolean;
    };
    return this.recordDetection(id, data.detectedMaterialId, data.confidence, data.manuallyVerified ?? false);
  }

  @Post('scan-sessions/:id/detect')
  @UseInterceptors(FileInterceptor('image'))
  async detectFromImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Image required');

    const aiUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:5001';
    const form = new FormData();
    form.append('image', file.buffer, {
      filename: file.originalname || 'scan.jpg',
      contentType: file.mimetype,
    });

    let detection: Record<string, unknown>;
    try {
      const res = await axios.post(`${aiUrl}/detect`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      detection = res.data;
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.code === 'ECONNREFUSED'
          ? 'AI detection service is not running on port 5001.'
          : axios.isAxiosError(err)
            ? (err.response?.data as { detail?: string })?.detail ?? err.message
            : 'AI detection failed';
      throw new ServiceUnavailableException(message);
    }

    if (!detection.detected) {
      throw new BadRequestException({
        message: detection.message ?? 'No centric elements detected',
        detection,
      });
    }

    const materialCode = String(detection.material_code ?? '');
    const material = await this.prisma.material.findUnique({
      where: { code: materialCode },
    });
    if (!material) {
      throw new BadRequestException({
        message: `Unknown material code ${materialCode}`,
        detection,
      });
    }

    const result = await this.recordDetection(
      id,
      material.id,
      typeof detection.confidence === 'number' ? detection.confidence : undefined,
      false,
    );

    return { ...result, detection };
  }

  @Patch('scan-sessions/:id/expected-material')
  async updateExpected(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const data = keysToCamel(body) as {
      materialId: number;
      materialSizeId?: number;
    };
    return this.prisma.scanSession.update({
      where: { id },
      data: {
        materialId: data.materialId,
        materialSizeId: data.materialSizeId ?? null,
      },
      include: { material: true, materialSize: true },
    });
  }

  private async recordDetection(
    sessionId: number,
    detectedMaterialId: number,
    confidence?: number,
    manuallyVerified = false,
  ) {
    const session = await this.prisma.scanSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { material: true, materialSize: true, movement: { include: { items: true } } },
    });

    const isMatch = detectedMaterialId === session.materialId;
    const feedback = isMatch ? 'match' : 'mismatch';

    await this.prisma.scanEvent.create({
      data: {
        scanSessionId: sessionId,
        detectedMaterialId,
        expectedSizeId: session.materialSizeId,
        isMatch,
        confidence: confidence ?? null,
        feedback,
        manuallyVerified,
        scannedAt: new Date(),
      },
    });

    const updatedSession = await this.prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        matchedCount: isMatch ? session.matchedCount + 1 : session.matchedCount,
        mismatchCount: isMatch ? session.mismatchCount : session.mismatchCount + 1,
      },
      include: { material: true, materialSize: true },
    });

    let quantityStatus: 'ok' | 'reached' | 'exceeded' | undefined;
    let expectedQuantity: number | undefined;
    let scannedCount: number | undefined;

    if (isMatch) {
      const item = session.movement.items.find(
        (i) =>
          i.materialId === session.materialId &&
          (i.materialSizeId ?? null) === (session.materialSizeId ?? null),
      );
      if (item) {
        const next = item.scannedCount + 1;
        await this.prisma.movementItem.update({
          where: { id: item.id },
          data: { scannedCount: next },
        });
        expectedQuantity = item.quantity;
        scannedCount = next;
        quantityStatus =
          next > item.quantity ? 'exceeded' : next === item.quantity ? 'reached' : 'ok';
      }
    }

    return {
      feedback,
      session: updatedSession,
      quantity_status: quantityStatus,
      expected_quantity: expectedQuantity,
      scanned_count: scannedCount,
    };
  }
}
