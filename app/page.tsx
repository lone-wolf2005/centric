"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type RecentDoc = {
  id: number;
  doc_type: "DC" | "GRN";
  reference: string;
  site: string | null;
  customer: string | null;
  monthly_value: number;
  qty_total: number;
  completed_at: string | null;
  tally_order_id: number | null;
};

type Dashboard = {
  today_inward: number;
  today_outward: number;
  active_scans: number;
  mismatches_today: number;
  material_categories: number;
  pending_approvals: number;
  open_tally_orders: number;
  dc_today_count: number;
  grn_today_count: number;
  dc_today_value: number;
  grn_today_value: number;
  dc_total_value: number;
  grn_total_value: number;
  recent_documents: RecentDoc[];
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>("/reports/dashboard", { token: getStoredToken() })
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,#0b3d36_0%,#1a2f2a_55%,#15202b_100%)] p-7 text-white shadow-lg">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/80">
                Operations control
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold">Yard dashboard</h2>
              <p className="mt-2 max-w-xl text-sm text-teal-50/75">
                Live scan health, valued Delivery Challans &amp; GRNs, and Tally-ready
                documents for RR Thulasi centering rentals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/scan"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)]"
              >
                Start AI scan
              </Link>
              <Link
                href="/orders"
                className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                Open Tally hub
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="DC value (today)"
            value={inr(stats?.dc_today_value ?? 0)}
            hint={`${stats?.dc_today_count ?? 0} challans · monthly rental book`}
            tone="brand"
          />
          <Metric
            label="GRN value (today)"
            value={inr(stats?.grn_today_value ?? 0)}
            hint={`${stats?.grn_today_count ?? 0} receipts · qty × rate/month`}
            tone="accent"
          />
          <Metric
            label="All DC book value"
            value={inr(stats?.dc_total_value ?? 0)}
            hint="Completed outward documents"
          />
          <Metric
            label="All GRN book value"
            value={inr(stats?.grn_total_value ?? 0)}
            hint="Completed inward documents"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Today outward" value={stats?.today_outward ?? 0} />
          <Metric label="Today inward" value={stats?.today_inward ?? 0} />
          <Metric label="Active scans" value={stats?.active_scans ?? 0} />
          <Metric
            label="Mismatches today"
            value={stats?.mismatches_today ?? 0}
            tone={stats?.mismatches_today ? "warn" : undefined}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Recent DC / GRN</h3>
                <p className="text-sm text-[var(--muted)]">
                  Valued at qty × rate/month for Tally posting
                </p>
              </div>
              <Link href="/orders" className="text-sm font-semibold text-[var(--brand)]">
                View all in Tally →
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-2 font-medium">Doc</th>
                    <th className="px-2 py-2 font-medium">Party / site</th>
                    <th className="px-2 py-2 font-medium">Qty</th>
                    <th className="px-2 py-2 font-medium">Value</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recent_documents ?? []).map((doc) => (
                    <tr key={`${doc.doc_type}-${doc.id}`} className="border-t border-[var(--line)]">
                      <td className="px-2 py-3">
                        <span
                          className={`mr-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                            doc.doc_type === "DC"
                              ? "bg-teal-50 text-teal-800"
                              : "bg-orange-50 text-orange-800"
                          }`}
                        >
                          {doc.doc_type}
                        </span>
                        <span className="font-medium">{doc.reference}</span>
                      </td>
                      <td className="px-2 py-3 text-[var(--muted)]">
                        <div>{doc.customer ?? "—"}</div>
                        <div className="text-xs">{doc.site ?? ""}</div>
                      </td>
                      <td className="px-2 py-3 money">{doc.qty_total}</td>
                      <td className="px-2 py-3 font-semibold money">{inr(doc.monthly_value)}</td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/orders?doc=${doc.id}`}
                          className="text-xs font-semibold text-[var(--brand)]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!stats?.recent_documents?.length ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-8 text-center text-[var(--muted)]">
                        No completed DC/GRN yet. Finish a scan movement to generate one.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-card p-5">
              <h3 className="font-display text-lg font-semibold">Tally queue</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Open Tally orders" value={String(stats?.open_tally_orders ?? 0)} />
                <Row label="Pending approvals" value={String(stats?.pending_approvals ?? 0)} />
                <Row label="Material categories" value={String(stats?.material_categories ?? 0)} />
              </dl>
              <Link
                href="/orders"
                className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Navigate to Tally hub
              </Link>
            </div>

            <div className="surface-card p-5">
              <h3 className="font-display text-lg font-semibold">How value is calculated</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                For each DC/GRN line: <strong>qty × rate/month</strong> from the size master
                (Excel rent rates). Daily book = qty × (rate/month ÷ 30). Totals roll into
                Tally document posting.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "accent" | "warn";
}) {
  const accent =
    tone === "brand"
      ? "border-teal-200 bg-teal-50/60"
      : tone === "accent"
        ? "border-orange-200 bg-orange-50/50"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50/60"
          : "border-[var(--line)] bg-white";
  return (
    <div className={`rounded-2xl border p-5 ${accent}`}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="font-display money mt-2 text-2xl font-semibold text-[var(--ink)]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
