"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { apiFetch, getStoredToken } from "@/lib/api";

type Indent = {
  id: number;
  indent_no: string;
  project_name: string;
  site_name: string | null;
  status: string;
};

export default function IndentsPage() {
  const token = getStoredToken();
  const [indents, setIndents] = useState<Indent[]>([]);
  const [projectName, setProjectName] = useState("");
  const [siteName, setSiteName] = useState("");

  async function load() {
    setIndents(await apiFetch<Indent[]>("/indents", { token }));
  }

  useEffect(() => {
    load().catch(() => setIndents([]));
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/indents", {
      token,
      method: "POST",
      body: JSON.stringify({ project_name: projectName, site_name: siteName }),
    });
    setProjectName("");
    setSiteName("");
    await load();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Internal Project Indents</h2>
          <p className="text-sm text-slate-500">
            FRD: Indent → DC → Material Usage → GRN → Billing (no quotation required).
          </p>
        </div>

        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
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
            Create Indent
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {indents.map((indent) => (
            <article key={indent.id} className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-emerald-700">{indent.indent_no}</p>
              <h3 className="mt-1 font-semibold">{indent.project_name}</h3>
              <p className="text-sm text-slate-500">{indent.site_name}</p>
              <span className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">
                {indent.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
