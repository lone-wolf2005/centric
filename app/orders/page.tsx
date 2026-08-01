"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type TallyOrder = {
  id: number;
  order_no: string;
  type: string;
  customer_name: string | null;
  site_name: string | null;
  status: string;
  movements?: Array<{
    id: number;
    type: string;
    dc_number: string | null;
    grn_number: string | null;
  }>;
};

type Doc = {
  id: number;
  doc_type: "DC" | "GRN";
  reference: string;
  site: string | null;
  customer: string | null;
  supervisor: string | null;
  monthly_value: number;
  daily_value: number;
  qty_total: number;
  tally_order_id: number | null;
  tally_order_no: string | null;
  completed_at: string | null;
  lines: Array<{
    material: string;
    size: string | null;
    scanned_count: number;
    quantity: number;
    rate_per_month: number;
    monthly_value: number;
    daily_value: number;
  }>;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function TallyHubInner() {
  const token = getStoredToken();
  const search = useSearchParams();
  const focusDoc = search.get("doc");
  const focusOrder = search.get("order");

  const [tab, setTab] = useState<"documents" | "orders">("documents");
  const [orders, setOrders] = useState<TallyOrder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"ALL" | "DC" | "GRN">("ALL");

  async function load() {
    const [orderList, documents] = await Promise.all([
      apiFetch<TallyOrder[]>("/tally-orders", { token }),
      apiFetch<Doc[]>("/tally/documents", { token }),
    ]);
    setOrders(orderList);
    setDocs(documents);
    const byQuery = focusDoc
      ? documents.find((d) => String(d.id) === focusDoc)
      : null;
    setSelected(byQuery ?? documents[0] ?? null);
    if (focusOrder) setTab("orders");
  }

  useEffect(() => {
    load().catch(() => {
      setOrders([]);
      setDocs([]);
    });
  }, [token, focusDoc, focusOrder]);

  const visible = useMemo(
    () => (filter === "ALL" ? docs : docs.filter((d) => d.doc_type === filter)),
    [docs, filter],
  );

  const totals = useMemo(() => {
    const dc = docs.filter((d) => d.doc_type === "DC");
    const grn = docs.filter((d) => d.doc_type === "GRN");
    return {
      dcValue: dc.reduce((s, d) => s + d.monthly_value, 0),
      grnValue: grn.reduce((s, d) => s + d.monthly_value, 0),
      dcCount: dc.length,
      grnCount: grn.length,
    };
  }, [docs]);

  async function syncOrders() {
    const response = await apiFetch<{ message: string }>("/tally-orders/sync", {
      token,
      method: "POST",
    });
    setMessage(response.message);
    await load();
  }

  async function pushSelected() {
    if (!selected) return;
    const res = await apiFetch<{ message: string }>(
      `/tally/documents/${selected.id}/push`,
      { token, method: "POST" },
    );
    setMessage(res.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
            ERP bridge
          </p>
          <h2 className="font-display text-2xl font-semibold">Tally hub</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Orders from Tally, valued DC/GRN from Centric, ready to push back.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncOrders}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
          >
            Sync orders
          </button>
          <button
            type="button"
            onClick={pushSelected}
            disabled={!selected}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Push selected to Tally
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="DC documents" value={String(totals.dcCount)} />
        <MiniStat label="DC book value" value={inr(totals.dcValue)} />
        <MiniStat label="GRN documents" value={String(totals.grnCount)} />
        <MiniStat label="GRN book value" value={inr(totals.grnValue)} />
      </section>

      <div className="flex gap-2">
        {(
          [
            ["documents", "DC / GRN documents"],
            ["orders", "Tally orders"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === id ? "bg-[var(--ink)] text-white" : "border border-[var(--line)] bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "documents" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="surface-card max-h-[70vh] overflow-auto p-3">
            <div className="mb-3 flex gap-1 p-1">
              {(["ALL", "DC", "GRN"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                    filter === f ? "bg-[var(--brand)] text-white" : "bg-slate-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {visible.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d)}
                className={`mb-2 w-full rounded-xl px-3 py-3 text-left ${
                  selected?.id === d.id ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--brand)]">{d.doc_type}</span>
                  <span className="text-xs font-semibold money">{inr(d.monthly_value)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold">{d.reference}</p>
                <p className="text-xs text-[var(--muted)]">{d.site ?? d.customer}</p>
              </button>
            ))}
          </aside>

          <section className="surface-card p-5">
            {!selected ? (
              <p className="text-sm text-[var(--muted)]">Select a DC or GRN document.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                      {selected.doc_type} · {selected.reference}
                    </p>
                    <h3 className="font-display mt-1 text-xl font-semibold">
                      {selected.customer ?? "Yard document"}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">
                      {selected.site} · Supervisor {selected.supervisor ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--muted)]">Monthly book value</p>
                    <p className="font-display text-2xl font-semibold money">
                      {inr(selected.monthly_value)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Daily equiv. {inr(selected.daily_value)}
                    </p>
                  </div>
                </div>

                {selected.tally_order_id ? (
                  <Link
                    href={`/orders?order=${selected.tally_order_id}`}
                    className="inline-flex text-sm font-semibold text-[var(--brand)]"
                    onClick={() => setTab("orders")}
                  >
                    Linked Tally order {selected.tally_order_no} →
                  </Link>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2">Material</th>
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Rate/Mo</th>
                        <th className="px-3 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map((line, idx) => (
                        <tr key={idx} className="border-t border-[var(--line)]">
                          <td className="px-3 py-2">{line.material}</td>
                          <td className="px-3 py-2">{line.size ?? "—"}</td>
                          <td className="px-3 py-2 money">
                            {line.scanned_count || line.quantity}
                          </td>
                          <td className="px-3 py-2 money">{inr(line.rate_per_month)}</td>
                          <td className="px-3 py-2 font-semibold money">
                            {inr(line.monthly_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-[var(--muted)]">
                  Formula: scanned qty × rate/month (from Excel size master). Push queues this{" "}
                  {selected.doc_type} into Tally (stub until ERP credentials are connected).
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <article key={order.id} className="surface-card p-5">
              <p className="text-sm font-semibold text-[var(--brand)]">{order.order_no}</p>
              <h3 className="mt-1 text-lg font-semibold">{order.customer_name}</h3>
              <p className="text-sm text-[var(--muted)]">{order.site_name}</p>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">{order.type}</span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">
                  {order.status}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                {(order.movements ?? []).slice(0, 4).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="block text-left font-medium text-[var(--brand)] hover:underline"
                    onClick={() => {
                      setTab("documents");
                      const found = docs.find((d) => d.id === m.id);
                      if (found) setSelected(found);
                    }}
                  >
                    {(m.dc_number ?? m.grn_number ?? `Movement #${m.id}`) + " →"}
                  </button>
                ))}
                {!order.movements?.length ? (
                  <p className="text-[var(--muted)]">No DC/GRN linked yet</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-display money mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedPage>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading Tally hub…</p>}>
        <TallyHubInner />
      </Suspense>
    </ProtectedPage>
  );
}
