"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Location = { id: number; name: string; type: string; address: string | null };
type Balance = {
  id: number;
  quantity: number;
  location?: Location;
  material?: { id: number; name: string };
  material_size?: { id: number; label: string; rate_per_month?: number };
};

type StockResponse = {
  locations: Location[];
  balances: Balance[];
};

export default function StockPage() {
  const token = getStoredToken();
  const [data, setData] = useState<StockResponse>({ locations: [], balances: [] });
  const [locationId, setLocationId] = useState<string>("");

  useEffect(() => {
    apiFetch<StockResponse>("/stock", { token })
      .then(setData)
      .catch(() => setData({ locations: [], balances: [] }));
  }, [token]);

  const rows = useMemo(() => {
    const list = locationId
      ? data.balances.filter((b) => String(b.location?.id) === locationId)
      : data.balances;
    return list.filter((b) => b.quantity > 0).slice(0, 200);
  }, [data.balances, locationId]);

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Stock Monitoring</h2>
          <p className="text-sm text-slate-500">
            Quantity by location × material/size from Excel sites and godown stock.
          </p>
        </div>

        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="rounded-xl border px-4 py-2 text-sm"
        >
          <option value="">All locations</option>
          {data.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Rate/Mo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">{b.location?.name}</td>
                  <td className="px-4 py-3">{b.material?.name}</td>
                  <td className="px-4 py-3">{b.material_size?.label ?? "-"}</td>
                  <td className="px-4 py-3">{b.quantity}</td>
                  <td className="px-4 py-3">
                    {b.material_size?.rate_per_month != null
                      ? `₹${b.material_size.rate_per_month}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedPage>
  );
}
