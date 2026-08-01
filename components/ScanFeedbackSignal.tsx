"use client";

import { useEffect } from "react";

export type ScanSignalStatus = "match" | "mismatch" | "warning" | null;

const styles = {
  match: {
    box: "border-emerald-500 bg-emerald-50",
    ping: "bg-emerald-500",
    dot: "bg-emerald-600",
    title: "text-emerald-800",
    body: "text-emerald-700",
    headline: "GREEN SIGNAL — CORRECT MATERIAL",
    fallback: "Item verified and count incremented.",
    overlay: "border-emerald-500",
    badge: "bg-emerald-600",
    badgeText: "CORRECT",
  },
  warning: {
    box: "border-amber-500 bg-amber-50",
    ping: "bg-amber-500",
    dot: "bg-amber-600",
    title: "text-amber-900",
    body: "text-amber-800",
    headline: "AMBER WARNING — QUANTITY LIMIT",
    fallback: "Target quantity reached or exceeded.",
    overlay: "border-amber-500",
    badge: "bg-amber-600",
    badgeText: "QTY WARN",
  },
  mismatch: {
    box: "border-red-500 bg-red-50",
    ping: "bg-red-500",
    dot: "bg-red-600",
    title: "text-red-800",
    body: "text-red-700",
    headline: "RED SIGNAL — WRONG MATERIAL",
    fallback:
      "Item rejected. Not counted. Ask worker to bring correct material.",
    overlay: "border-red-500",
    badge: "bg-red-600",
    badgeText: "WRONG",
  },
} as const;

export function ScanFeedbackSignal({
  status,
  label,
  onClear,
}: {
  status: ScanSignalStatus;
  label?: string;
  onClear?: () => void;
}) {
  useEffect(() => {
    if (!status || !onClear) {
      return;
    }

    const timer = window.setTimeout(onClear, 3500);

    return () => window.clearTimeout(timer);
  }, [status, onClear]);

  if (!status) {
    return null;
  }

  const theme = styles[status];

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 shadow-lg transition ${theme.box}`}
      role="status"
      aria-live="assertive"
    >
      <span className="relative flex h-5 w-5 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${theme.ping}`}
        />
        <span className={`relative inline-flex h-5 w-5 rounded-full ${theme.dot}`} />
      </span>

      <div>
        <p className={`text-sm font-bold tracking-wide ${theme.title}`}>
          {theme.headline}
        </p>
        <p className={`text-sm ${theme.body}`}>{label ?? theme.fallback}</p>
      </div>
    </div>
  );
}

export function ScanVideoOverlay({ status }: { status: ScanSignalStatus }) {
  if (!status) {
    return null;
  }

  const theme = styles[status];

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 rounded-2xl border-4 ${theme.overlay} animate-pulse`}
      />
      <div
        className={`pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg ${theme.badge}`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
        {theme.badgeText}
      </div>
    </>
  );
}
