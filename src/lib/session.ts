import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { Context } from "hono";
import type { AppEnv, SessionUser } from "../types";

const COOKIE_NAME = "alert_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type TokenPayload = SessionUser & {
  sub: string;
  exp: number;
};

export async function createSession(c: Context<AppEnv>, user: SessionUser): Promise<void> {
  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const token = await sign(
    {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    } satisfies TokenPayload,
    secret,
    "HS256",
  );

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: new URL(c.req.url).protocol === "https:",
  });
}

export async function readSession(c: Context<AppEnv>): Promise<SessionUser | null> {
  const secret = c.env.AUTH_SECRET;
  const token = getCookie(c, COOKIE_NAME);
  if (!secret || !token) return null;

  try {
    const payload = await verify(token, secret, "HS256");
    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "admin" && payload.role !== "user")
    ) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}
