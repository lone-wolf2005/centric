"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Quotation = {
  id: number;
  quote_no: string;
  revision: number;
  customer_name: string;
  site_name: string | null;
  status: string;
  estimated_amount: string | null;
};

export default function QuotationsPage() {
  const token = getStoredToken();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [siteName, setSiteName] = useState("");

  async function load() {
    setQuotations(await apiFetch<Quotation[]>("/quotations", { token }));
  }

  useEffect(() => {
    load().catch(() => setQuotations([]));
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/quotations", {
      token,
      method: "POST",
      body: JSON.stringify({ customer_name: customerName, site_name: siteName }),
    });
    setCustomerName("");
    setSiteName("");
    await load();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Customer Quotations</h2>
          <p className="text-sm text-slate-500">
            FRD: Quotation → Order → DC → GRN → Monthly Billing (external customers).
          </p>
        </div>

        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name"
            className="rounded-xl border px-4 py-3"
            required
          />
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Site name"
            className="rounded-xl border px-4 py-3"
          />
          <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-3 text-white">
            Create Quotation
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {quotations.map((q) => (
            <article key={q.id} className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-emerald-700">{q.quote_no} · Rev {q.revision}</p>
              <h3 className="mt-1 font-semibold">{q.customer_name}</h3>
              <p className="text-sm text-slate-500">{q.site_name}</p>
              <span className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">
                {q.status}
              </span>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1 text-xs"
                  onClick={async () => {
                    await apiFetch(`/quotations/${q.id}/revise`, { token, method: "POST" });
                    await load();
                  }}
                >
                  Revise
                </button>
                {q.status !== "confirmed" && (
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white"
                    onClick={async () => {
                      await apiFetch(`/quotations/${q.id}/confirm`, { token, method: "POST" });
                      await load();
                    }}
                  >
                    Confirm → Order
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
