"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-900 flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-[0.2em]">
            Inventory Management System
          </p>
          <h1 className="text-white text-[2.6rem] font-bold leading-tight tracking-tight mt-2">
            One platform.
            <br />
            Every product.
            <br />
            <span className="text-brand-400">Full visibility.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mt-6 max-w-sm">
            From HO master setup through seller onboarding and consignment QC to
            product placement and QR labeling — with role-based access and a full
            audit trail.
          </p>
        </div>
        <p className="relative z-10 px-10 pb-8 text-slate-600 text-xs">
          © 2026 Knowledge Center. All rights reserved.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Access the KC IMS console</p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="you@kc.local"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 text-white py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
