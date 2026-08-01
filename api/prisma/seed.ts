import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CENTERING = [
  'Centering Sheet',
  'Adjustment Sheet',
  'Aluminium Channel',
  'Adjustable Props',
  'Adjustable Span',
];

function inclusiveDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

async function main() {
  const catalogPath = path.join(__dirname, 'data', 'excel_catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as {
    sites: string[];
    materials: Record<
      string,
      Array<{
        label: string;
        rate_per_month: number;
        rate_per_day: number;
        unit: string;
      }>
    >;
    usage_may_2026: Array<{
      site_name: string;
      material: string;
      size_label: string;
      quantity: number;
      start_date: string;
      end_date: string;
      rate_per_month: number;
    }>;
  };

  const passwordHash = await bcrypt.hash('password', 10);

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@centric.local' },
    update: { passwordHash, name: 'Yard Supervisor', role: 'supervisor' },
    create: {
      email: 'supervisor@centric.local',
      name: 'Yard Supervisor',
      passwordHash,
      role: 'supervisor',
    },
  });

  await prisma.user.upsert({
    where: { email: 'approver@centric.local' },
    update: { passwordHash, name: 'Site Approver', role: 'approver' },
    create: {
      email: 'approver@centric.local',
      name: 'Site Approver',
      passwordHash,
      role: 'approver',
    },
  });

  const godown = await prisma.location.upsert({
    where: { name: 'Erode Godown' },
    update: { type: 'godown', address: 'Sakthi Mahal, Erode', isActive: true },
    create: {
      name: 'Erode Godown',
      type: 'godown',
      address: 'Sakthi Mahal, Erode',
      isActive: true,
    },
  });

  const siteMap = new Map<string, number>();
  for (const siteName of catalog.sites) {
    const loc = await prisma.location.upsert({
      where: { name: siteName },
      update: { type: 'project_site', address: siteName, isActive: true },
      create: {
        name: siteName,
        type: 'project_site',
        address: siteName,
        isActive: true,
      },
    });
    siteMap.set(siteName, loc.id);
  }

  const materialMap = new Map<string, number>();
  const sizeMap = new Map<string, { id: number; rate: number; unit: string }>();

  for (const [materialName, sizes] of Object.entries(catalog.materials)) {
    const code = materialName.toUpperCase().replace(/ /g, '_');
    const material = await prisma.material.upsert({
      where: { code },
      update: { name: materialName, isActive: true },
      create: { name: materialName, code, isActive: true },
    });
    materialMap.set(materialName, material.id);

    for (const size of sizes) {
      const row = await prisma.materialSize.upsert({
        where: {
          materialId_label: { materialId: material.id, label: size.label },
        },
        update: {
          ratePerMonth: size.rate_per_month,
          ratePerDay: size.rate_per_day,
          unit: size.unit || 'Nos',
        },
        create: {
          materialId: material.id,
          label: size.label,
          ratePerMonth: size.rate_per_month,
          ratePerDay: size.rate_per_day,
          unit: size.unit || 'Nos',
        },
      });
      sizeMap.set(`${materialName}|${size.label}`, {
        id: row.id,
        rate: size.rate_per_month,
        unit: size.unit || 'Nos',
      });

      const existing = await prisma.stockBalance.findFirst({
        where: {
          locationId: godown.id,
          materialId: material.id,
          materialSizeId: row.id,
        },
      });
      if (existing) {
        await prisma.stockBalance.update({
          where: { id: existing.id },
          data: { quantity: 500 },
        });
      } else {
        await prisma.stockBalance.create({
          data: {
            locationId: godown.id,
            materialId: material.id,
            materialSizeId: row.id,
            quantity: 500,
          },
        });
      }
    }
  }

  // May 2026 rent statements from Excel
  const bySite = new Map<string, typeof catalog.usage_may_2026>();
  for (const line of catalog.usage_may_2026) {
    const list = bySite.get(line.site_name) ?? [];
    list.push(line);
    bySite.set(line.site_name, list);
  }

  const periodStart = new Date('2026-05-01');
  const periodEnd = new Date('2026-05-31');

  let billIndex = 0;
  for (const [siteName, lines] of bySite) {
    const locationId = siteMap.get(siteName);
    if (!locationId) continue;
    billIndex += 1;

    let bill = await prisma.rentalBill.findFirst({
      where: { locationId, periodStart, periodEnd },
    });

    if (!bill) {
      bill = await prisma.rentalBill.create({
        data: {
          billNo: `RB-202605-${String(billIndex).padStart(3, '0')}`,
          locationId,
          siteName,
          periodStart,
          periodEnd,
          status: 'raised',
          generatedById: supervisor.id,
          raisedAt: new Date(),
        },
      });
    } else {
      await prisma.rentalBillLine.deleteMany({ where: { rentalBillId: bill.id } });
    }

    let centering = 0;
    let scaffolding = 0;

    for (const line of lines) {
      const materialId = materialMap.get(line.material);
      const size = sizeMap.get(`${line.material}|${line.size_label}`);
      if (!materialId || !size) continue;

      const start = new Date(line.start_date);
      const end = new Date(line.end_date);
      const days = inclusiveDays(start, end);
      const qty = line.quantity;
      const rateMonth = line.rate_per_month;
      const rateDay = rateMonth / 30;
      const consumed = days * qty;
      const amount = Math.round(consumed * rateDay * 100) / 100;
      const group = CENTERING.includes(line.material) ? 'centering' : 'scaffolding';

      await prisma.rentalBillLine.create({
        data: {
          rentalBillId: bill.id,
          materialId,
          materialSizeId: size.id,
          particulars: line.size_label,
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

      const bal = await prisma.stockBalance.findFirst({
        where: { locationId, materialId, materialSizeId: size.id },
      });
      if (bal) {
        await prisma.stockBalance.update({
          where: { id: bal.id },
          data: { quantity: qty },
        });
      } else {
        await prisma.stockBalance.create({
          data: {
            locationId,
            materialId,
            materialSizeId: size.id,
            quantity: qty,
          },
        });
      }
    }

    await prisma.rentalBill.update({
      where: { id: bill.id },
      data: {
        centeringTotal: Math.round(centering * 100) / 100,
        scaffoldingTotal: Math.round(scaffolding * 100) / 100,
        grandTotal: Math.round((centering + scaffolding) * 100) / 100,
        status: 'raised',
        raisedAt: new Date(),
      },
    });
  }

  // Wipe operational demo rows so reseed is idempotent and removes Sync duplicates
  await prisma.scanEvent.deleteMany();
  await prisma.scanSession.deleteMany();
  await prisma.movementItem.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.materialMovement.deleteMany();
  await prisma.siteTransferItem.deleteMany();
  await prisma.siteTransfer.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.indentItem.deleteMany();
  await prisma.appNotification.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.tallyOrder.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.indent.deleteMany();

  const authority = await prisma.user.upsert({
    where: { email: 'authority@centric.local' },
    update: { passwordHash, name: 'Company Authority', role: 'authority' },
    create: {
      email: 'authority@centric.local',
      name: 'Company Authority',
      passwordHash,
      role: 'authority',
    },
  });

  const yardLead = await prisma.user.upsert({
    where: { email: 'kumar@centric.local' },
    update: { passwordHash, name: 'Kumar · Yard Lead', role: 'supervisor' },
    create: {
      email: 'kumar@centric.local',
      name: 'Kumar · Yard Lead',
      passwordHash,
      role: 'supervisor',
    },
  });

  const approver = await prisma.user.upsert({
    where: { email: 'approver@centric.local' },
    update: { passwordHash, name: 'Priya · Site Approver', role: 'approver' },
    create: {
      email: 'approver@centric.local',
      name: 'Priya · Site Approver',
      passwordHash,
      role: 'approver',
    },
  });

  const pickSizes = (prefix: string, n = 3) =>
    [...sizeMap.entries()].filter(([k]) => k.startsWith(prefix)).slice(0, n);

  const sheetSizes = pickSizes('Centering Sheet', 3);
  const propSizes = pickSizes('Adjustable Props', 2);
  const cupSizes = pickSizes('Cuplock Units', 2);
  const alumSizes = pickSizes('Aluminium Channel', 2);
  const mixedSizes = [...sheetSizes, ...propSizes, ...cupSizes].slice(0, 5);

  // --- Quotations (external rental) ---
  const quotes = [
    {
      quoteNo: 'QT-2026-TIRU-01',
      customerName: 'Sakthi Constructions',
      siteName: 'TNSCB Tiruttani',
      status: 'confirmed',
      estimatedAmount: 285000,
      sizes: [...sheetSizes, ...alumSizes],
      qty: 120,
    },
    {
      quoteNo: 'QT-2026-SAIRAM-02',
      customerName: 'Sairam Engineering College',
      siteName: 'Sairam Engg',
      status: 'sent',
      estimatedAmount: 410000,
      sizes: [...sheetSizes, ...propSizes],
      qty: 200,
    },
    {
      quoteNo: 'QT-2026-MEPZ-03',
      customerName: 'MEPZ Developers Pvt Ltd',
      siteName: 'MEPZ TFC Tambaram',
      status: 'draft',
      estimatedAmount: 175000,
      sizes: cupSizes,
      qty: 80,
    },
  ];

  const quoteIds: Record<string, number> = {};
  for (const q of quotes) {
    const row = await prisma.quotation.create({
      data: {
        quoteNo: q.quoteNo,
        customerName: q.customerName,
        siteName: q.siteName,
        status: q.status,
        estimatedAmount: q.estimatedAmount,
        validUntil: new Date('2026-08-31'),
        revision: 1,
        createdById: supervisor.id,
        items: {
          create: q.sizes.map(([key, size], i) => ({
            materialId: materialMap.get(key.split('|')[0])!,
            materialSizeId: size.id,
            quantity: q.qty - i * 10,
            ratePerMonth: size.rate,
          })),
        },
      },
    });
    quoteIds[q.quoteNo] = row.id;
  }

  // --- Internal indents ---
  const indents = [
    {
      indentNo: 'IND-2026-BRIDGE-08',
      projectName: 'RR Internal Bridge Project',
      siteName: 'MEPZ TFC Tambaram',
      status: 'in_progress',
      sizes: [...propSizes, ...cupSizes],
      qty: 60,
    },
    {
      indentNo: 'IND-2026-ADMIN-11',
      projectName: 'MEPZ Admin Block Fit-out',
      siteName: 'MEPZ Admin BlockTambaram',
      status: 'open',
      sizes: sheetSizes,
      qty: 40,
    },
  ];

  const indentIds: Record<string, number> = {};
  for (const ind of indents) {
    const row = await prisma.indent.create({
      data: {
        indentNo: ind.indentNo,
        projectName: ind.projectName,
        siteName: ind.siteName,
        status: ind.status,
        createdById: yardLead.id,
        items: {
          create: ind.sizes.map(([key, size]) => ({
            materialId: materialMap.get(key.split('|')[0])!,
            materialSizeId: size.id,
            quantity: ind.qty,
          })),
        },
      },
    });
    indentIds[ind.indentNo] = row.id;
  }

  // --- Fixed Tally orders (no random duplicates) ---
  const tallyDefs = [
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

  const orderIds: Record<string, number> = {};
  for (const o of tallyDefs) {
    const row = await prisma.tallyOrder.create({
      data: { ...o, syncedAt: new Date() },
    });
    orderIds[o.orderNo] = row.id;
  }

  const loc = (name: string) => siteMap.get(name);

  async function createMovement(opts: {
    type: 'outward' | 'inward';
    ref: string;
    orderNo?: string;
    quotationNo?: string;
    indentNo?: string;
    supervisorId: number;
    from: number | undefined;
    to: number | undefined;
    destination: string;
    approvalStatus: string;
    returnCondition?: string;
    linkedDc?: string;
    dueInDays?: number;
    sizes: Array<[string, { id: number; rate: number; unit: string }]>;
    qty: number;
    scanned?: number;
    daysAgo?: number;
  }) {
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - (opts.daysAgo ?? 0));
    const startedAt = new Date(completedAt);
    startedAt.setHours(startedAt.getHours() - 3);

    const movement = await prisma.materialMovement.create({
      data: {
        type: opts.type,
        tallyOrderId: opts.orderNo ? orderIds[opts.orderNo] : null,
        quotationId: opts.quotationNo ? quoteIds[opts.quotationNo] : null,
        indentId: opts.indentNo ? indentIds[opts.indentNo] : null,
        supervisorId: opts.supervisorId,
        sourceLocationId: opts.from ?? null,
        destinationLocationId: opts.to ?? null,
        destination: opts.destination,
        status: 'completed',
        approvalStatus: opts.approvalStatus,
        returnCondition: opts.returnCondition ?? null,
        dcNumber: opts.type === 'outward' ? opts.ref : null,
        grnNumber: opts.type === 'inward' ? opts.ref : null,
        linkedDcNumber: opts.linkedDc ?? null,
        startedAt,
        completedAt,
        dueDate:
          opts.type === 'outward' && opts.dueInDays != null
            ? new Date(Date.now() + opts.dueInDays * 86400000)
            : null,
        receiverConfirmedById:
          opts.approvalStatus === 'approved' ? approver.id : null,
        receiverConfirmedAt:
          opts.approvalStatus === 'approved' ? completedAt : null,
        notes:
          opts.type === 'outward'
            ? `Demo DC ${opts.ref} dispatched from Erode Godown`
            : `Demo GRN ${opts.ref} received at yard`,
      },
    });

    for (const [key, size] of opts.sizes) {
      const materialId = materialMap.get(key.split('|')[0]);
      if (!materialId) continue;
      await prisma.movementItem.create({
        data: {
          materialMovementId: movement.id,
          materialId,
          materialSizeId: size.id,
          quantity: opts.qty,
          scannedCount: opts.scanned ?? opts.qty,
        },
      });
    }

    await prisma.approval.create({
      data: {
        approvableType: 'MaterialMovement',
        approvableId: movement.id,
        type: opts.type === 'outward' ? 'delivery' : 'return',
        status: opts.approvalStatus,
        requestedById: opts.supervisorId,
        approvedById:
          opts.approvalStatus === 'approved' ? approver.id : null,
        actedAt: opts.approvalStatus === 'approved' ? completedAt : null,
        notes:
          opts.approvalStatus === 'approved'
            ? 'Receiver confirmed on site'
            : 'Awaiting site confirmation',
      },
    });

    // Lightweight scan audit for outward docs
    if (opts.type === 'outward' && opts.sizes[0]) {
      const [key, size] = opts.sizes[0];
      const materialId = materialMap.get(key.split('|')[0])!;
      const session = await prisma.scanSession.create({
        data: {
          materialMovementId: movement.id,
          materialId,
          materialSizeId: size.id,
          status: 'completed',
          matchedCount: opts.scanned ?? opts.qty,
          mismatchCount: 1,
        },
      });
      await prisma.scanEvent.create({
        data: {
          scanSessionId: session.id,
          detectedMaterialId: materialId,
          expectedSizeId: size.id,
          isMatch: true,
          confidence: 92.5,
          feedback: 'match',
          scannedAt: startedAt,
        },
      });
      await prisma.scanEvent.create({
        data: {
          scanSessionId: session.id,
          detectedMaterialId:
            materialMap.get('Cuplock Units') ?? materialId,
          expectedSizeId: size.id,
          isMatch: false,
          confidence: 71.2,
          feedback: 'mismatch',
          actionTaken: 'worker_corrected',
          scannedAt: startedAt,
        },
      });
    }

    return movement;
  }

  await createMovement({
    type: 'outward',
    ref: 'DC-TIRU-2401',
    orderNo: 'TO-RENT-TIRU-001',
    quotationNo: 'QT-2026-TIRU-01',
    supervisorId: supervisor.id,
    from: godown.id,
    to: loc('TNSCB Tiruttani'),
    destination: 'TNSCB Tiruttani',
    approvalStatus: 'approved',
    dueInDays: 25,
    sizes: mixedSizes,
    qty: 48,
    daysAgo: 2,
  });

  await createMovement({
    type: 'inward',
    ref: 'GRN-TIRU-2401',
    orderNo: 'TO-RENT-TIRU-001',
    quotationNo: 'QT-2026-TIRU-01',
    supervisorId: yardLead.id,
    from: loc('TNSCB Tiruttani'),
    to: godown.id,
    destination: 'Erode Godown',
    approvalStatus: 'approved',
    returnCondition: 'normal',
    linkedDc: 'DC-TIRU-2401',
    sizes: sheetSizes,
    qty: 18,
    daysAgo: 0,
  });

  await createMovement({
    type: 'outward',
    ref: 'DC-MEPZ-1180',
    orderNo: 'TO-PROJ-MEPZ-003',
    indentNo: 'IND-2026-BRIDGE-08',
    supervisorId: yardLead.id,
    from: godown.id,
    to: loc('MEPZ TFC Tambaram'),
    destination: 'MEPZ TFC Tambaram',
    approvalStatus: 'pending',
    dueInDays: 40,
    sizes: [...propSizes, ...cupSizes],
    qty: 75,
    daysAgo: 1,
  });

  await createMovement({
    type: 'outward',
    ref: 'DC-SAIRAM-0902',
    orderNo: 'TO-RENT-SAIRAM-002',
    quotationNo: 'QT-2026-SAIRAM-02',
    supervisorId: supervisor.id,
    from: godown.id,
    to: loc('Sairam Engg'),
    destination: 'Sairam Engg',
    approvalStatus: 'approved',
    dueInDays: 15,
    sizes: [...sheetSizes, ...propSizes],
    qty: 110,
    daysAgo: 5,
  });

  await createMovement({
    type: 'inward',
    ref: 'GRN-SAIRAM-0902',
    orderNo: 'TO-RENT-SAIRAM-002',
    supervisorId: supervisor.id,
    from: loc('Sairam Engg'),
    to: godown.id,
    destination: 'Erode Godown',
    approvalStatus: 'approved',
    returnCondition: 'damaged',
    linkedDc: 'DC-SAIRAM-0902',
    sizes: propSizes,
    qty: 12,
    daysAgo: 3,
  });

  await createMovement({
    type: 'outward',
    ref: 'DC-UPSC-5510',
    orderNo: 'TO-RENT-UPSC-005',
    supervisorId: yardLead.id,
    from: godown.id,
    to: loc('UPSC Building Prayagraj'),
    destination: 'UPSC Building Prayagraj',
    approvalStatus: 'approved',
    dueInDays: -5,
    sizes: mixedSizes,
    qty: 95,
    daysAgo: 20,
  });

  await createMovement({
    type: 'inward',
    ref: 'GRN-UPSC-5510',
    orderNo: 'TO-RENT-UPSC-005',
    supervisorId: yardLead.id,
    from: loc('UPSC Building Prayagraj'),
    to: godown.id,
    destination: 'Erode Godown',
    approvalStatus: 'approved',
    returnCondition: 'repairable',
    linkedDc: 'DC-UPSC-5510',
    sizes: cupSizes,
    qty: 30,
    daysAgo: 4,
  });

  // Draft movement still scanning
  const draft = await prisma.materialMovement.create({
    data: {
      type: 'outward',
      tallyOrderId: orderIds['TO-RENT-PALANI-004'],
      supervisorId: supervisor.id,
      sourceLocationId: godown.id,
      destinationLocationId: loc('Palani Municipality'),
      destination: 'Palani Municipality',
      status: 'scanning',
      approvalStatus: 'pending',
      startedAt: new Date(),
      notes: 'Active AI scan session — Palani dispatch',
      items: {
        create: sheetSizes.map(([key, size]) => ({
          materialId: materialMap.get(key.split('|')[0])!,
          materialSizeId: size.id,
          quantity: 35,
          scannedCount: 12,
        })),
      },
    },
    include: { items: true },
  });

  if (sheetSizes[0]) {
    const [key, size] = sheetSizes[0];
    await prisma.scanSession.create({
      data: {
        materialMovementId: draft.id,
        materialId: materialMap.get(key.split('|')[0])!,
        materialSizeId: size.id,
        status: 'active',
        matchedCount: 12,
        mismatchCount: 2,
      },
    });
  }

  // Site transfers
  const transferA = await prisma.siteTransfer.create({
    data: {
      transferNo: 'ST-2026-GOD-MEPZ-01',
      fromLocationId: godown.id,
      toLocationId: loc('MEPZ TFC Tambaram')!,
      status: 'pending',
      senderApproval: 'approved',
      receiverApproval: 'pending',
      authorityApproval: 'pending',
      createdById: supervisor.id,
      notes: 'Emergency props for bridge pour',
      items: {
        create: propSizes.map(([key, size]) => ({
          materialId: materialMap.get(key.split('|')[0])!,
          materialSizeId: size.id,
          quantity: 25,
        })),
      },
    },
  });

  await prisma.approval.create({
    data: {
      approvableType: 'SiteTransfer',
      approvableId: transferA.id,
      type: 'transfer',
      status: 'pending',
      requestedById: supervisor.id,
      notes: 'Sender approved; awaiting receiver + authority',
    },
  });

  const transferB = await prisma.siteTransfer.create({
    data: {
      transferNo: 'ST-2026-TIRU-GOD-02',
      fromLocationId: loc('TNSCB Tiruttani')!,
      toLocationId: godown.id,
      status: 'completed',
      senderApproval: 'approved',
      receiverApproval: 'approved',
      authorityApproval: 'approved',
      createdById: yardLead.id,
      notes: 'Surplus sheets returned to godown',
      items: {
        create: sheetSizes.map(([key, size]) => ({
          materialId: materialMap.get(key.split('|')[0])!,
          materialSizeId: size.id,
          quantity: 15,
        })),
      },
    },
  });

  await prisma.approval.create({
    data: {
      approvableType: 'SiteTransfer',
      approvableId: transferB.id,
      type: 'transfer',
      status: 'approved',
      requestedById: yardLead.id,
      approvedById: authority.id,
      actedAt: new Date(),
      notes: 'Authority override cleared',
    },
  });

  // Notifications
  await prisma.appNotification.createMany({
    data: [
      {
        userId: supervisor.id,
        type: 'billing_reminder',
        title: 'Billing pending: Palani Municipality',
        body: 'May rental bill not raised for Palani Municipality this period.',
        meta: JSON.stringify({ location: 'Palani Municipality' }),
      },
      {
        userId: supervisor.id,
        type: 'return_due',
        title: 'Return due: DC-UPSC-5510',
        body: 'Material return overdue for DC-UPSC-5510 (UPSC Building Prayagraj).',
        meta: JSON.stringify({ dc_number: 'DC-UPSC-5510' }),
      },
      {
        userId: approver.id,
        type: 'billing_reminder',
        title: 'Delivery confirmation pending',
        body: 'DC-MEPZ-1180 awaits receiver approval at MEPZ TFC Tambaram.',
        meta: JSON.stringify({ reference: 'DC-MEPZ-1180' }),
      },
    ],
  });

  console.log('Seed complete:', {
    sites: siteMap.size,
    materials: materialMap.size,
    sizes: sizeMap.size,
    bills: bySite.size,
    tally_orders: tallyDefs.length,
    quotations: quotes.length,
    indents: indents.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
