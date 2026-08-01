"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type ScanLog = {
  id: number;
  is_match: boolean;
  size_mismatch: boolean;
  confidence: number | null;
  feedback: string;
  action_taken: string | null;
  scanned_at: string;
  detected_material?: { name: string };
  session?: {
    material?: { name: string };
    material_size?: { label: string };
    movement?: { supervisor?: { name: string } };
  };
};

export default function ScanHistoryPage() {
  const token = getStoredToken();
  const [logs, setLogs] = useState<ScanLog[]>([]);

  useEffect(() => {
    apiFetch<ScanLog[]>("/scan-history", { token })
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [token]);

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">AI Scan Audit Log</h2>
          <p className="text-sm text-slate-500">
            FRD §8.4 — complete scan history for audit, verification, and traceability.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-3">{new Date(log.scanned_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {log.session?.material?.name}
                    {log.session?.material_size ? ` (${log.session.material_size.label})` : ""}
                  </td>
                  <td className="px-4 py-3">{log.detected_material?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        log.is_match ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.is_match ? "Match" : "Mismatch"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{log.session?.movement?.supervisor?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedPage>
  );
}
