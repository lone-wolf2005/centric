"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Doc = {
  id: number;
  doc_type: "DC" | "GRN";
  reference: string;
  monthly_value: number;
  qty_total: number;
};

type MaterialMovement = {
  id: number;
  type: "inward" | "outward";
  status: string;
  dc_number: string | null;
  grn_number: string | null;
  supervisor?: { name: string };
  items: Array<{
    quantity: number;
    scanned_count: number;
    material?: { name: string };
    material_size?: { rate_per_month?: number | null };
  }>;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function estimate(m: MaterialMovement) {
  return m.items.reduce((sum, item) => {
    const qty = item.scanned_count || item.quantity;
    const rate = item.material_size?.rate_per_month ?? 0;
    return sum + qty * rate;
  }, 0);
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<MaterialMovement[]>("/movements", { token: getStoredToken() }),
      apiFetch<Doc[]>("/tally/documents", { token: getStoredToken() }),
    ])
      .then(([m, d]) => {
        setMovements(m);
        setDocs(d);
      })
      .catch(() => {
        setMovements([]);
        setDocs([]);
      });
  }, []);

  const valueById = new Map(docs.map((d) => [d.id, d]));

  return (
    <ProtectedPage>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Material movements</h2>
            <p className="text-sm text-[var(--muted)]">
              Inward / outward with estimated DC·GRN book value (qty × rate/month).
            </p>
          </div>
          <Link href="/orders" className="text-sm font-semibold text-[var(--brand)]">
            Open in Tally hub →
          </Link>
        </div>

        <div className="surface-card overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Book value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => {
                const doc = valueById.get(movement.id);
                const value = doc?.monthly_value ?? estimate(movement);
                const ref =
                  movement.dc_number ?? movement.grn_number ?? doc?.reference ?? "—";
                return (
                  <tr key={movement.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 capitalize">{movement.type}</td>
                    <td className="px-4 py-3">{movement.status}</td>
                    <td className="px-4 py-3 font-medium">{ref}</td>
                    <td className="px-4 py-3">{movement.supervisor?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {movement.items
                        .map(
                          (item) =>
                            `${item.material?.name ?? "Item"} (${item.scanned_count}/${item.quantity})`,
                        )
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 font-semibold money">{inr(value)}</td>
                    <td className="px-4 py-3 text-right">
                      {movement.status === "completed" ? (
                        <Link
                          href={`/orders?doc=${movement.id}`}
                          className="text-xs font-semibold text-[var(--brand)]"
                        >
                          Tally
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedPage>
  );
}
