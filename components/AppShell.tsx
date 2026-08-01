"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { navGroups } from "@/lib/navigation";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5">
      <span
        className={`absolute left-0 block h-0.5 w-5 bg-[var(--ink)] transition ${
          open ? "top-2 rotate-45" : "top-0"
        }`}
      />
      <span
        className={`absolute left-0 top-2 block h-0.5 w-5 bg-[var(--ink)] transition ${
          open ? "opacity-0" : "opacity-100"
        }`}
      />
      <span
        className={`absolute left-0 block h-0.5 w-5 bg-[var(--ink)] transition ${
          open ? "top-2 -rotate-45" : "top-4"
        }`}
      />
    </span>
  );
}

export function AppShell({
  children,
  userName,
  onLogout,
}: {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg border border-[var(--line)] p-2 hover:bg-slate-50"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              <MenuIcon open={menuOpen} />
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white sm:flex">
                C
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
                  RR Thulasi
                </p>
                <h1 className="font-display truncate text-lg font-semibold">Centric Control</h1>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/orders"
              className="hidden rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium hover:bg-slate-50 sm:inline"
            >
              Tally hub
            </Link>
            {userName ? (
              <span className="hidden text-sm text-[var(--muted)] md:inline">{userName}</span>
            ) : null}
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm text-white"
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-[61px] z-50 h-[calc(100vh-61px)] w-72 overflow-y-auto border-r border-[var(--line)] bg-white shadow-xl transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex flex-col gap-6 p-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-[var(--brand)] text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
