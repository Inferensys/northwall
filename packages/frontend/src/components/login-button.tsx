"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [mode, setMode] = useState<"idle" | "email">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  async function handleGitHubLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "repo read:user user:email",
      },
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (password) {
      // Try sign in with password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // If sign in fails, try sign up
        if (signInError.message.includes("Invalid login")) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (signUpError) {
            setError(signUpError.message);
          } else {
            // Sign up succeeded — try logging in immediately
            // (Supabase auto-confirms in dev if email confirmation is off)
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (retryError) {
              setError("Account created. Confirm it from your email, then sign in.");
            } else {
              window.location.href = "/workspace";
            }
          }
        } else {
          setError(signInError.message);
        }
      } else {
        window.location.href = "/workspace";
      }
    } else {
      // Magic link / OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setOtpSent(true);
      }
    }

    setLoading(false);
  }

  if (otpSent) {
    return (
      <div className="w-full space-y-3 text-center">
        <div className="rounded-lg border border-success/20 bg-success/5 p-4">
          <p className="text-sm text-success font-medium">Check your email</p>
          <p className="text-xs text-text-muted mt-1">
            Magic link sent to <strong>{email}</strong>
          </p>
        </div>
        <button
          onClick={() => { setOtpSent(false); setMode("idle"); }}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Try a different method
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* GitHub OAuth */}
      <button
        onClick={handleGitHubLogin}
        className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-white px-4 py-3 text-sm font-medium text-[#051914] hover:bg-bg-elevated transition-colors"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.38 6.84 9.74.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1.01.07 1.54 1.06 1.54 1.06.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.71 0 0 .84-.28 2.75 1.05A9.34 9.34 0 0 1 12 6.99c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.6.69.49A10.15 10.15 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" clipRule="evenodd" />
        </svg>
        Continue with GitHub
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email/Password form */}
      {mode === "idle" ? (
        <button
          onClick={() => setMode("email")}
          className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-surface transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Continue with email
        </button>
      ) : (
        <form onSubmit={handleEmailSubmit} className="space-y-2.5">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="password"
            placeholder="Password, or leave empty for magic link"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Signing in..."
              : password
              ? "Sign in"
              : "Send magic link"}
          </button>

          <button
            type="button"
            onClick={() => { setMode("idle"); setError(null); }}
            className="w-full text-xs text-text-muted hover:text-text-primary transition-colors py-1"
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
