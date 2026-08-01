"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { clearToken } from "@/lib/api";
import type { User } from "@/lib/types";

export function ProtectedPage({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("centric_user");

    if (!stored) {
      router.replace("/login");
      return;
    }

    setUser(JSON.parse(stored) as User);
  }, [router]);

  function handleLogout() {
    clearToken();
    localStorage.removeItem("centric_user");
    router.push("/login");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading...
      </div>
    );
  }

  return (
    <AppShell userName={user.name} onLogout={handleLogout}>
      {children}
    </AppShell>
  );
}
