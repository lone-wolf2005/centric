"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Location = { id: number; name: string; type: string };
type Bill = {
  id: number;
  bill_no: string;
  site_name: string;
  period_start: string;
  period_end: string;
  centering_total: number;
  scaffolding_total: number;
  grand_total: number;
  status: string;
  lines?: Array<{
    id: number;
    particulars: string;
    category_group: string;
    unit: string;
    quantity: number;
    start_date: string;
    end_date: string;
    days: number;
    total_consumed: number;
    rate_per_month: number;
    rate_per_day: number;
    amount: number;
  }>;
};

export default function BillingPage() {
  const token = getStoredToken();
  const [locations, setLocations] = useState<Location[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Bill | null>(null);
  const [filterLocation, setFilterLocation] = useState("");

  async function load() {
    const [locs, list] = await Promise.all([
      apiFetch<Location[]>("/locations", { token }),
      apiFetch<Bill[]>("/billing", { token }),
    ]);
    setLocations(locs.filter((l) => l.type !== "godown"));
    setBills(list);
    if (list[0] && !selectedId) {
      setSelectedId(list[0].id);
    }
  }

  useEffect(() => {
    load().catch(() => {
      setLocations([]);
      setBills([]);
    });
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    apiFetch<Bill>(`/billing/${selectedId}`, { token })
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedId, token]);

  const filtered = useMemo(
    () =>
      filterLocation
        ? bills.filter((b) => String(b.site_name) === filterLocation || String((b as Bill & { location_id?: number }).location_id) === filterLocation)
        : bills,
    [bills, filterLocation],
  );

  const centeringLines = detail?.lines?.filter((l) => l.category_group === "centering") ?? [];
  const scaffoldingLines = detail?.lines?.filter((l) => l.category_group === "scaffolding") ?? [];

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Monthly Rental Billing</h2>
          <p className="text-sm text-slate-500">
            Excel-style rent statements: days × qty × (rate/month ÷ 30). Seeded from May 2026 site usage.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            <option value="">All sites</option>
            {locations.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
          {detail && (
            <a
              className="rounded-xl border px-4 py-2 text-sm"
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/reports/rent-statement/export?bill_id=${detail.id}`}
            >
              Export CSV
            </a>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="max-h-[70vh] space-y-2 overflow-auto rounded-2xl border bg-white p-3">
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`w-full rounded-xl px-3 py-3 text-left text-sm ${
                  selectedId === b.id ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"
                }`}
              >
                <div className="font-medium">{b.site_name}</div>
                <div className="text-xs text-slate-500">
                  {b.bill_no} · ₹{Number(b.grand_total).toLocaleString("en-IN")}
                </div>
              </button>
            ))}
          </aside>

          <section className="rounded-2xl border bg-white p-5">
            {!detail ? (
              <p className="text-sm text-slate-500">Select a bill to view the rent statement.</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">{detail.site_name}</h3>
                  <p className="text-sm text-slate-500">
                    {detail.bill_no} · {String(detail.period_start).slice(0, 10)} to{" "}
                    {String(detail.period_end).slice(0, 10)} · {detail.status}
                  </p>
                </div>

                <LineTable title="Centering Materials" lines={centeringLines} total={detail.centering_total} />
                <LineTable title="Scaffolding Materials" lines={scaffoldingLines} total={detail.scaffolding_total} />

                <div className="flex justify-end gap-6 border-t pt-4 text-sm">
                  <div>
                    Centering: <strong>₹{Number(detail.centering_total).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    Scaffolding: <strong>₹{Number(detail.scaffolding_total).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    Grand total: <strong>₹{Number(detail.grand_total).toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                {detail.status === "draft" && (
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
                    onClick={async () => {
                      await apiFetch(`/billing/${detail.id}/raise`, { token, method: "POST" });
                      await load();
                      setDetail(await apiFetch<Bill>(`/billing/${detail.id}`, { token }));
                    }}
                  >
                    Mark Raised
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </ProtectedPage>
  );
}

function LineTable({
  title,
  lines,
  total,
}: {
  title: string;
  lines: NonNullable<Bill["lines"]>;
  total: number;
}) {
  if (!lines.length) return null;
  return (
    <div>
      <h4 className="mb-2 font-medium">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-2">Particulars</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Days</th>
              <th className="px-2 py-2">Rate/Mo</th>
              <th className="px-2 py-2">Rate/Day</th>
              <th className="px-2 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-2 py-2">{l.particulars}</td>
                <td className="px-2 py-2">{l.quantity}</td>
                <td className="px-2 py-2">{l.days}</td>
                <td className="px-2 py-2">{l.rate_per_month}</td>
                <td className="px-2 py-2">{Number(l.rate_per_day).toFixed(3)}</td>
                <td className="px-2 py-2">₹{Number(l.amount).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            <tr className="border-t bg-slate-50 font-medium">
              <td className="px-2 py-2" colSpan={5}>
                Total
              </td>
              <td className="px-2 py-2">₹{Number(total).toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
