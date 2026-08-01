import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(
    locationId: number,
    materialId: number,
    materialSizeId: number | null,
    delta: number,
  ) {
    const existing = await this.prisma.stockBalance.findFirst({
      where: {
        locationId,
        materialId,
        materialSizeId: materialSizeId ?? null,
      },
    });

    if (existing) {
      return this.prisma.stockBalance.update({
        where: { id: existing.id },
        data: { quantity: Math.max(0, existing.quantity + delta) },
      });
    }

    return this.prisma.stockBalance.create({
      data: {
        locationId,
        materialId,
        materialSizeId: materialSizeId ?? null,
        quantity: Math.max(0, delta),
      },
    });
  }

  async set(
    locationId: number,
    materialId: number,
    materialSizeId: number | null,
    quantity: number,
  ) {
    const existing = await this.prisma.stockBalance.findFirst({
      where: {
        locationId,
        materialId,
        materialSizeId: materialSizeId ?? null,
      },
    });

    if (existing) {
      return this.prisma.stockBalance.update({
        where: { id: existing.id },
        data: { quantity: Math.max(0, quantity) },
      });
    }

    return this.prisma.stockBalance.create({
      data: {
        locationId,
        materialId,
        materialSizeId: materialSizeId ?? null,
        quantity: Math.max(0, quantity),
      },
    });
  }
}
