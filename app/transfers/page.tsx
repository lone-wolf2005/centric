"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Location = { id: number; name: string; type: string };
type Transfer = {
  id: number;
  transfer_no: string;
  status: string;
  sender_approval: string;
  receiver_approval: string;
  authority_approval: string;
  from_location?: Location;
  to_location?: Location;
};

export default function TransfersPage() {
  const token = getStoredToken();
  const [locations, setLocations] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  async function load() {
    const [loc, list] = await Promise.all([
      apiFetch<Location[]>("/locations", { token }),
      apiFetch<Transfer[]>("/site-transfers", { token }),
    ]);
    setLocations(loc);
    setTransfers(list);
  }

  useEffect(() => {
    load().catch(() => {
      setLocations([]);
      setTransfers([]);
    });
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/site-transfers", {
      token,
      method: "POST",
      body: JSON.stringify({
        from_location_id: Number(fromId),
        to_location_id: Number(toId),
      }),
    });
    await load();
  }

  async function approve(id: number, role: string) {
    await apiFetch(`/site-transfers/${id}/approve`, {
      token,
      method: "POST",
      body: JSON.stringify({ role, decision: "approved" }),
    });
    await load();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Site Transfers</h2>
          <p className="text-sm text-slate-500">
            Godown ↔ Client Site ↔ Project Site with sender, receiver, and authority approval.
          </p>
        </div>

        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3">
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="rounded-xl border px-4 py-3" required>
            <option value="">From location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="rounded-xl border px-4 py-3" required>
            <option value="">To location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-3 text-white">
            Initiate Transfer
          </button>
        </form>

        <div className="space-y-4">
          {transfers.map((t) => (
            <article key={t.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-emerald-700">{t.transfer_no}</p>
                  <p className="font-medium">
                    {t.from_location?.name} → {t.to_location?.name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">Status: {t.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["sender", "receiver", "authority"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => approve(t.id, role)}
                      className="rounded-lg border px-3 py-1 text-xs capitalize"
                    >
                      Approve {role}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
