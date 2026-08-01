"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Approval = {
  id: number;
  type: string;
  status: string;
  notes: string | null;
  approvable_type: string;
  approvable_id: number;
  requester?: { name: string };
  approver?: { name: string };
};

export default function ApprovalsPage() {
  const token = getStoredToken();
  const [approvals, setApprovals] = useState<Approval[]>([]);

  async function load() {
    setApprovals(await apiFetch<Approval[]>("/approvals", { token }));
  }

  useEffect(() => {
    load().catch(() => setApprovals([]));
  }, [token]);

  async function decide(a: Approval, decision: "approved" | "rejected") {
    if (a.approvable_type === "SiteTransfer" || a.type === "transfer") {
      await apiFetch(`/site-transfers/${a.approvable_id}/approve`, {
        token,
        method: "POST",
        body: JSON.stringify({ role: "authority", decision }),
      });
    } else {
      await apiFetch(`/movements/${a.approvable_id}/approve`, {
        token,
        method: "POST",
        body: JSON.stringify({ decision }),
      });
    }
    await load();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Approval Workflow</h2>
          <p className="text-sm text-slate-500">
            Delivery confirmation, return confirmation, site transfers, and override approvals.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3 capitalize">{a.type}</td>
                  <td className="px-4 py-3 capitalize">{a.status}</td>
                  <td className="px-4 py-3">{a.requester?.name ?? "-"}</td>
                  <td className="px-4 py-3">{a.approver?.name ?? "Pending"}</td>
                  <td className="px-4 py-3">
                    {a.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white"
                          onClick={() => decide(a, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border px-3 py-1 text-xs"
                          onClick={() => decide(a, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
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
