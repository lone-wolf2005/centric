import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MaterialsController } from './materials/materials.controller';
import { FrdController } from './frd/frd.controller';
import { MovementsController } from './movements/movements.controller';
import { BillingController } from './billing/billing.controller';
import { ReportsController } from './reports/reports.controller';
import {
  TallyController,
  TallyContractController,
} from './tally/tally.controller';
import { StockService } from './stock/stock.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    MaterialsController,
    FrdController,
    MovementsController,
    BillingController,
    ReportsController,
    TallyController,
    TallyContractController,
  ],
  providers: [StockService],
})
export class AppModule {}
