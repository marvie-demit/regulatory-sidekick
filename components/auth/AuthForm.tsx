"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/lib/auth/actions";

type AuthState = { error?: string; message?: string };

const inputCls =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";

export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next?: string;
}) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1.5 text-left">
        <span className={labelCls}>Work email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-left">
        <span className={labelCls}>Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          className={inputCls}
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {pending
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>

      <p className="mt-1 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-teal-700 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-teal-700 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
