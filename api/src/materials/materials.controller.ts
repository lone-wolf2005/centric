import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async index() {
    return this.prisma.material.findMany({
      where: { isActive: true },
      include: { sizes: { orderBy: { label: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }
}
