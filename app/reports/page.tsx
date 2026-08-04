"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StatCard } from "@/components/StatCard";
import { apiFetch, getStoredToken } from "@/lib/api";

type ItemSummary = {
  id: number;
  name: string;
  total_inward: number;
  total_outward: number;
  balance: number;
};

type AiAccuracy = {
  total_scans: number;
  accuracy_percent: number;
};

type Utilization = {
  material: string;
  at_godown: number;
  at_sites: number;
  total: number;
  utilization_percent: number;
};

type MovementReportRow = {
  id: number;
  date: string;
  supervisor?: string | null;
  reference?: string | null;
  destination?: string | null;
  customer?: string | null;
  site?: string | null;
  items: Array<{
    material?: string | null;
    size?: string | null;
    quantity: number;
    scanned_count: number;
  }>;
};

type ExceptionRow = {
  id: number;
  confidence?: number | null;
  scannedAt?: string;
  scanned_at?: string;
  detectedMaterial?: { name?: string } | null;
  detected_material?: { name?: string } | null;
  session?: {
    material?: { name?: string } | null;
    materialSize?: { label?: string } | null;
    material_size?: { label?: string } | null;
    movement?: { supervisor?: { name?: string } | null } | null;
  } | null;
};

type Tab =
  | "summary"
  | "inward"
  | "outward"
  | "exceptions"
  | "utilization"
  | "supervisor";

export default function ReportsPage() {
  const token = getStoredToken();
  const [tab, setTab] = useState<Tab>("summary");
  const [itemSummary, setItemSummary] = useState<ItemSummary[]>([]);
  const [aiAccuracy, setAiAccuracy] = useState<AiAccuracy | null>(null);
  const [pendingReturns, setPendingReturns] = useState<unknown[]>([]);
  const [damageScrap, setDamageScrap] = useState<unknown[]>([]);
  const [billingPending, setBillingPending] = useState<unknown[]>([]);
  const [inward, setInward] = useState<MovementReportRow[]>([]);
  const [outward, setOutward] = useState<MovementReportRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [utilization, setUtilization] = useState<Utilization[]>([]);
  const [supervisors, setSupervisors] = useState<
    Array<{ id: number; supervisor_name: string; movement_count: number; items_handled: number }>
  >([]);

  useEffect(() => {
    Promise.all([
      apiFetch<ItemSummary[]>("/reports/item-summary", { token }),
      apiFetch<AiAccuracy>("/reports/ai-accuracy", { token }),
      apiFetch<unknown[]>("/reports/pending-returns", { token }),
      apiFetch<unknown[]>("/reports/damage-scrap", { token }),
      apiFetch<unknown[]>("/reports/billing-pending", { token }),
      apiFetch<MovementReportRow[]>("/reports/inward", { token }),
      apiFetch<MovementReportRow[]>("/reports/outward", { token }),
      apiFetch<ExceptionRow[]>("/reports/exceptions", { token }),
      apiFetch<Utilization[]>("/reports/asset-utilization", { token }),
      apiFetch<
        Array<{
          id: number;
          supervisor_name: string;
          movement_count: number;
          items_handled: number;
        }>
      >("/reports/supervisor-summary", { token }),
    ])
      .then(
        ([
          items,
          accuracy,
          returns,
          damage,
          billing,
          inRows,
          outRows,
          exRows,
          util,
          supers,
        ]) => {
          setItemSummary(items);
          setAiAccuracy(accuracy);
          setPendingReturns(returns);
          setDamageScrap(damage);
          setBillingPending(billing);
          setInward(inRows);
          setOutward(outRows);
          setExceptions(exRows);
          setUtilization(util);
          setSupervisors(supers);
        },
      )
      .catch(() => {
        setItemSummary([]);
        setAiAccuracy(null);
      });
  }, [token]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "summary", label: "Summary" },
    { id: "inward", label: "Inward" },
    { id: "outward", label: "Outward" },
    { id: "exceptions", label: "Exceptions" },
    { id: "utilization", label: "Utilization" },
    { id: "supervisor", label: "Supervisors" },
  ];

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Reports</h2>
            <p className="text-sm text-slate-500">
              Proposal + FRD operational reports. Rent statements live under Billing.
            </p>
          </div>
          <a
            className="rounded-xl border px-4 py-2 text-sm"
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/reports/daily-activity/export`}
          >
            Export daily CSV
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Scans" value={aiAccuracy?.total_scans ?? 0} />
          <StatCard label="AI Accuracy" value={`${aiAccuracy?.accuracy_percent ?? 0}%`} />
          <StatCard label="Pending Returns" value={pendingReturns.length} />
          <StatCard label="Billing Pending" value={billingPending.length} />
        </section>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm ${
                tab === t.id ? "bg-emerald-700 text-white" : "border bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <section className="rounded-2xl border bg-white p-6">
            <h3 className="text-lg font-semibold">Item-wise Movement Summary</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Inward</th>
                    <th className="px-3 py-2">Outward</th>
                    <th className="px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSummary.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.total_inward}</td>
                      <td className="px-3 py-2">{item.total_outward}</td>
                      <td className="px-3 py-2">
                        {item.balance < 0
                          ? `Outward ${Math.abs(item.balance)}`
                          : item.balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border p-4">
                <h4 className="font-semibold">Damage / Scrap</h4>
                <p className="mt-2 text-3xl font-semibold">{damageScrap.length}</p>
              </article>
              <article className="rounded-xl border p-4">
                <h4 className="font-semibold">Billing Pending Sites</h4>
                <p className="mt-2 text-3xl font-semibold">{billingPending.length}</p>
              </article>
            </div>
          </section>
        )}

        {tab === "inward" && (
          <MovementReportTable title="Material Inward" rows={inward} refLabel="GRN" />
        )}
        {tab === "outward" && (
          <MovementReportTable title="Material Outward" rows={outward} refLabel="DC" />
        )}
        {tab === "exceptions" && <ExceptionTable rows={exceptions} />}

        {tab === "utilization" && (
          <section className="rounded-2xl border bg-white p-6">
            <h3 className="font-semibold">Asset Utilization</h3>
            <table className="mt-4 min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Godown</th>
                  <th className="px-3 py-2">Sites</th>
                  <th className="px-3 py-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {utilization.map((u) => (
                  <tr key={u.material} className="border-t">
                    <td className="px-3 py-2">{u.material}</td>
                    <td className="px-3 py-2">{u.at_godown}</td>
                    <td className="px-3 py-2">{u.at_sites}</td>
                    <td className="px-3 py-2">{u.utilization_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "supervisor" && (
          <section className="rounded-2xl border bg-white p-6">
            <h3 className="font-semibold">Supervisor-wise</h3>
            <table className="mt-4 min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2">Supervisor</th>
                  <th className="px-3 py-2">Movements</th>
                  <th className="px-3 py-2">Items handled</th>
                </tr>
              </thead>
              <tbody>
                {supervisors.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{s.supervisor_name}</td>
                    <td className="px-3 py-2">{s.movement_count}</td>
                    <td className="px-3 py-2">{s.items_handled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </ProtectedPage>
  );
}

function MovementReportTable({
  title,
  rows,
  refLabel,
}: {
  title: string;
  rows: MovementReportRow[];
  refLabel: string;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{rows.length} records</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">{refLabel}</th>
              <th className="px-3 py-2">Supervisor</th>
              <th className="px-3 py-2">Site / Destination</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Scanned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const qty = row.items.reduce((s, i) => s + (i.quantity || 0), 0);
              const scanned = row.items.reduce((s, i) => s + (i.scanned_count || 0), 0);
              const place = row.site || row.destination || "—";
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-2">{row.reference || "—"}</td>
                  <td className="px-3 py-2">{row.supervisor || "—"}</td>
                  <td className="px-3 py-2">{place}</td>
                  <td className="px-3 py-2">{row.customer || "—"}</td>
                  <td className="px-3 py-2">
                    <ul className="space-y-1">
                      {row.items.map((item, idx) => (
                        <li key={`${row.id}-${idx}`}>
                          {item.material || "Material"}
                          {item.size ? ` · ${item.size}` : ""}{" "}
                          <span className="text-slate-500">
                            ({item.scanned_count}/{item.quantity})
                          </span>
                        </li>
                      ))}
                      {!row.items.length ? <li className="text-slate-400">No line items</li> : null}
                    </ul>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {scanned}/{qty}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={7}>
                  No records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExceptionTable({ rows }: { rows: ExceptionRow[] }) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h3 className="font-semibold">AI Exceptions</h3>
      <p className="mt-2 text-sm text-slate-500">{rows.length} mismatches</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Expected</th>
              <th className="px-3 py-2">Detected</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Supervisor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const when = row.scanned_at || row.scannedAt;
              const expected = row.session?.material?.name;
              const size =
                row.session?.material_size?.label || row.session?.materialSize?.label;
              const detected =
                row.detected_material?.name || row.detectedMaterial?.name || "—";
              const supervisor = row.session?.movement?.supervisor?.name || "—";
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {when ? new Date(when).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {expected || "—"}
                    {size ? ` · ${size}` : ""}
                  </td>
                  <td className="px-3 py-2">{detected}</td>
                  <td className="px-3 py-2">
                    {row.confidence != null ? `${Math.round(Number(row.confidence))}%` : "—"}
                  </td>
                  <td className="px-3 py-2">{supervisor}</td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={5}>
                  No AI exceptions.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
