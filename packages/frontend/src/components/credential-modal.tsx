"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Shield, Key, Lock } from "lucide-react";

export interface CredentialRequest {
  id: string;
  platform: string;
  type: "password" | "oauth" | "otp" | "api_key";
  context?: string;
}

interface CredentialModalProps {
  request: CredentialRequest;
  onSubmit: (requestId: string, credentials: Record<string, string>) => void;
  onDismiss: () => void;
}

export function CredentialModal({ request, onSubmit, onDismiss }: CredentialModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      onSubmit(request.id, values);
    },
    [request.id, values, onSubmit]
  );

  const updateField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const typeIcon = {
    password: <Lock className="h-5 w-5" />,
    oauth: <Shield className="h-5 w-5" />,
    otp: <Key className="h-5 w-5" />,
    api_key: <Key className="h-5 w-5" />,
  };

  const typeLabel = {
    password: "Login Credentials",
    oauth: "OAuth Authentication",
    otp: "One-Time Password",
    api_key: "API Key",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-elevated border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-warning/10 text-warning">
              {typeIcon[request.type]}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {typeLabel[request.type]}
              </h3>
              <p className="text-xs text-text-muted">
                Agent needs access to {request.platform}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Context */}
        {request.context && (
          <div className="px-5 py-3 bg-bg text-xs text-text-muted border-b border-border">
            {request.context}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {request.type === "password" && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={values.username ?? ""}
                  onChange={(e) => updateField("username", e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Enter username or email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={values.password ?? ""}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Enter password"
                />
              </div>
            </>
          )}

          {request.type === "otp" && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                One-Time Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={values.otp ?? ""}
                onChange={(e) => updateField("otp", e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary font-mono text-center text-lg tracking-widest placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="000000"
                maxLength={8}
              />
            </div>
          )}

          {request.type === "api_key" && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                API Key
              </label>
              <input
                type="password"
                value={values.api_key ?? ""}
                onChange={(e) => updateField("api_key", e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Enter API key"
              />
            </div>
          )}

          {request.type === "oauth" && (
            <p className="text-sm text-text-muted">
              The agent is requesting OAuth authentication with {request.platform}.
              Click "Authorize" to provide access.
            </p>
          )}

          {/* Security notice */}
          <div className="flex items-start gap-2 text-[10px] text-text-muted pt-1">
            <Shield className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Credentials are sent directly to the agent container via encrypted channel
              and are not stored by Northwall.
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border rounded transition-colors"
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded transition-colors",
                "bg-accent text-white hover:bg-accent/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {submitting
                ? "Sending..."
                : request.type === "oauth"
                ? "Authorize"
                : "Send Credentials"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
