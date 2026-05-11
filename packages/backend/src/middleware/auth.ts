import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";

type AuthPayload = {
  userId: string;
  email: string;
};

// Augment Hono context
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL env var is required");
  return url;
}

function getJWKS() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${getSupabaseUrl()}/auth/v1/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Dev-mode auth bypass: skip JWT verification, use a fixed dev user
  if (process.env.DEV_AUTH_BYPASS === "true") {
    c.set("auth", {
      userId: "dev-user-001",
      email: "dev@northwall.local",
    });
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const supabaseUrl = getSupabaseUrl();

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });

    const userId = payload.sub;
    if (!userId) {
      return c.json({ error: "Invalid token: missing sub claim" }, 401);
    }

    c.set("auth", {
      userId,
      email: (payload.email as string) ?? "",
    });

    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});
