import { PrismaService } from '../prisma/prisma.service';

export type ValuedLine = {
  material: string;
  size: string | null;
  quantity: number;
  scanned_count: number;
  rate_per_month: number;
  rate_per_day: number;
  monthly_value: number;
  daily_value: number;
};

export type ValuedDocument = {
  id: number;
  doc_type: 'DC' | 'GRN';
  reference: string;
  movement_type: string;
  status: string;
  destination: string | null;
  site: string | null;
  customer: string | null;
  supervisor: string | null;
  tally_order_id: number | null;
  tally_order_no: string | null;
  completed_at: string | null;
  item_count: number;
  qty_total: number;
  monthly_value: number;
  daily_value: number;
  lines: ValuedLine[];
};

function qtyOf(item: { scannedCount: number; quantity: number }) {
  return item.scannedCount > 0 ? item.scannedCount : item.quantity;
}

export async function valueMovement(
  prisma: PrismaService,
  movementId: number,
): Promise<ValuedDocument | null> {
  const m = await prisma.materialMovement.findUnique({
    where: { id: movementId },
    include: {
      supervisor: true,
      tallyOrder: true,
      destinationLocation: true,
      quotation: true,
      indent: true,
      items: { include: { material: true, materialSize: true } },
    },
  });
  if (!m || m.status !== 'completed') return null;

  const docType = m.type === 'outward' ? 'DC' : 'GRN';
  const reference =
    (m.type === 'outward' ? m.dcNumber : m.grnNumber) ?? `${docType}-${m.id}`;

  const lines: ValuedLine[] = m.items.map((item) => {
    const qty = qtyOf(item);
    const rateMonth = item.materialSize?.ratePerMonth ?? 0;
    const rateDay = item.materialSize?.ratePerDay ?? rateMonth / 30;
    return {
      material: item.material.name,
      size: item.materialSize?.label ?? null,
      quantity: item.quantity,
      scanned_count: item.scannedCount,
      rate_per_month: rateMonth,
      rate_per_day: rateDay,
      monthly_value: Math.round(qty * rateMonth * 100) / 100,
      daily_value: Math.round(qty * rateDay * 100) / 100,
    };
  });

  const monthly = lines.reduce((s, l) => s + l.monthly_value, 0);
  const daily = lines.reduce((s, l) => s + l.daily_value, 0);

  return {
    id: m.id,
    doc_type: docType,
    reference,
    movement_type: m.type,
    status: m.status,
    destination: m.destination ?? m.destinationLocation?.name ?? null,
    site:
      m.tallyOrder?.siteName ??
      m.quotation?.siteName ??
      m.indent?.siteName ??
      m.destinationLocation?.name ??
      null,
    customer:
      m.tallyOrder?.customerName ??
      m.quotation?.customerName ??
      m.indent?.projectName ??
      null,
    supervisor: m.supervisor?.name ?? null,
    tally_order_id: m.tallyOrderId,
    tally_order_no: m.tallyOrder?.orderNo ?? null,
    completed_at: m.completedAt?.toISOString() ?? null,
    item_count: lines.length,
    qty_total: lines.reduce((s, l) => s + (l.scanned_count || l.quantity), 0),
    monthly_value: Math.round(monthly * 100) / 100,
    daily_value: Math.round(daily * 100) / 100,
    lines,
  };
}

export async function listValuedDocuments(
  prisma: PrismaService,
  opts?: { type?: 'DC' | 'GRN'; take?: number },
) {
  const movements = await prisma.materialMovement.findMany({
    where: {
      status: 'completed',
      ...(opts?.type === 'DC'
        ? { type: 'outward', dcNumber: { not: null } }
        : opts?.type === 'GRN'
          ? { type: 'inward', grnNumber: { not: null } }
          : {
              OR: [
                { type: 'outward', dcNumber: { not: null } },
                { type: 'inward', grnNumber: { not: null } },
              ],
            }),
    },
    orderBy: { completedAt: 'desc' },
    take: opts?.take ?? 50,
    select: { id: true },
  });

  const docs: ValuedDocument[] = [];
  for (const row of movements) {
    const doc = await valueMovement(prisma, row.id);
    if (doc) docs.push(doc);
  }
  return docs;
}
