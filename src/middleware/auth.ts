import type { MiddlewareHandler } from "hono";
import { readSession } from "../lib/session";
import type { AppEnv } from "../types";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await readSession(c);
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  c.set("user", user);
  await next();
};
