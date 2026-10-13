import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../lib/password";
import { clearSession, createSession, readSession } from "../lib/session";
import type { AppEnv, UserRole, UserRow } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes = new Hono<AppEnv>()
  .post("/register", async (c) => {
    const body = await c.req.json<{
      email?: string;
      password?: string;
      name?: string;
    }>().catch(() => null);

    if (!body) return c.json({ error: "Invalid JSON body" }, 400);

    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? "";
    const password = body.password ?? "";

    if (!EMAIL_RE.test(email)) return c.json({ error: "A valid email is required" }, 400);
    if (name.length < 2 || name.length > 80) {
      return c.json({ error: "Name must be between 2 and 80 characters" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    let role: UserRole;

    try {
      const insertedUser = await c.env.DB.prepare(
        `INSERT INTO users (id, email, name, password_hash, role)
         SELECT ?, ?, ?, ?, CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 'admin' ELSE 'user' END
         RETURNING role`,
      )
        .bind(id, email, name, passwordHash)
        .first<{ role: UserRole }>();

      if (!insertedUser) {
        throw new Error("User registration did not return the inserted role");
      }
      role = insertedUser.role;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("UNIQUE")) {
        return c.json({ error: "An account with this email already exists" }, 409);
      }
      console.error(JSON.stringify({ message: "register failed", error: message }));
      return c.json({ error: "Unable to create account" }, 500);
    }

    const user = { id, email, name, role };
    await createSession(c, user);
    return c.json({ user }, 201);
  })
  .post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
    if (!body) return c.json({ error: "Invalid JSON body" }, 400);

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const row = await c.env.DB.prepare(
      "SELECT id, email, name, password_hash, role FROM users WHERE email = ?",
    )
      .bind(email)
      .first<UserRow>();

    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const user = { id: row.id, email: row.email, name: row.name, role: row.role };
    await createSession(c, user);
    return c.json({ user });
  })
  .post("/logout", async (c) => {
    clearSession(c);
    return c.json({ ok: true });
  })
  .get("/me", async (c) => {
    const user = await readSession(c);
    if (!user) return c.json({ user: null });
    return c.json({ user });
  });
