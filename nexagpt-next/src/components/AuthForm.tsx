"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "./Logo";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      // Full navigation so the server layout picks up the new session.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-full border border-border bg-bg px-5 py-3 text-base outline-none transition focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f]";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="size-12" />
          <h1 className="text-3xl font-semibold">{isRegister ? "Create an account" : "Welcome back"}</h1>
          <p className="text-sm text-muted">
            {isRegister ? "Sign up to start chatting with NexaGPT." : "Log in to continue to NexaGPT."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          {isRegister && (
            <input
              type="text"
              placeholder="Your name"
              autoComplete="name"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoFocus={!isRegister}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-4 -translate-y-1/2 text-muted hover:text-fg"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {isRegister && <p className="px-5 text-xs text-subtle">At least 8 characters.</p>}

          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#10a37f] py-3 font-medium text-white transition hover:bg-[#0d8c6d] disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isRegister ? "Create account" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <Link href={isRegister ? "/login" : "/register"} className="font-medium text-[#10a37f] hover:underline">
            {isRegister ? "Log in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  );
}
