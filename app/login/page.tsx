"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, storeToken } from "@/lib/api";
import type { User } from "@/lib/types";

type Mode = "login" | "forgot" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("supervisor@centric.local");
  const [password, setPassword] = useState("password");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<{ token: string; user: User }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      storeToken(response.token);
      localStorage.setItem("centric_user", JSON.stringify(response.user));
      router.push("/");
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : "Login failed";
      if (message === "Failed to fetch" || message === "Request failed") {
        setError("Cannot reach API. Start NestJS: cd api && npm run start:dev");
      } else {
        setError("Invalid credentials. Try forgot password if locked out.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await apiFetch<{
        message: string;
        reset?: boolean;
        temp_password?: string;
      }>("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setInfo(res.message);
      if (res.temp_password) {
        setTempPassword(res.temp_password);
        setPassword(res.temp_password);
        setMode("reset");
        setInfo(
          `${res.message} Temporary password: ${res.temp_password}`,
        );
      }
    } catch {
      setError("Could not process forgot password request.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ message: string }>("/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          temp_password: tempPassword,
          new_password: newPassword,
        }),
      });
      setInfo(res.message);
      setPassword(newPassword);
      setMode("login");
    } catch {
      setError("Reset failed. Check temporary password and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #0b3d36 0%, #15202b 48%, #1c2a24 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(196,92,38,0.25), transparent 35%), radial-gradient(circle at 80% 10%, rgba(15,107,92,0.35), transparent 40%)",
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <section className="text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200/80">
            RR Thulasi · Centric
          </p>
          <h1 className="font-display mt-4 max-w-lg text-4xl font-semibold leading-tight sm:text-5xl">
            Yard control that pays for itself
          </h1>
          <p className="mt-4 max-w-md text-base text-teal-50/80">
            AI-verified inward/outward counts, valued DC &amp; GRN documents, and a
            clear path into Tally — built for rental accountability.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-teal-50/75">
            <li>• Match/mismatch AI scan with live quantity control</li>
            <li>• DC/GRN monthly rental value from size rates</li>
            <li>• Site stock, billing statements, approvals</li>
          </ul>
        </section>

        <section className="surface-card w-full max-w-md justify-self-end p-8 shadow-2xl shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
            Secure access
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-[var(--ink)]">
            {mode === "login"
              ? "Sign in"
              : mode === "forgot"
                ? "Forgot password"
                : "Set new password"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {mode === "login"
              ? "Supervisor and approver accounts for yard operations."
              : mode === "forgot"
                ? "Enter your work email to generate a temporary password."
                : "Use the temporary password, then choose a new one."}
          </p>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setInfo("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
              {info ? <p className="text-sm text-[var(--brand)]">{info}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white hover:bg-[var(--brand-ink)] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in to Centric"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="mt-8 space-y-4">
              <Field label="Work email" type="email" value={email} onChange={setEmail} />
              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
              {info ? <p className="text-sm text-[var(--brand)]">{info}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Sending..." : "Generate temporary password"}
              </button>
              <button
                type="button"
                className="w-full text-sm text-[var(--muted)]"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset} className="mt-8 space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Field
                label="Temporary password"
                type="text"
                value={tempPassword}
                onChange={setTempPassword}
              />
              <Field
                label="New password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
              />
              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
              {info ? <p className="text-sm text-[var(--brand)]">{info}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                className="w-full text-sm text-[var(--muted)]"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--ink)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[#f8fafb] px-4 py-3 outline-none ring-[var(--brand)] focus:ring-2"
        required
      />
    </label>
  );
}
