import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { fileRoutes } from "./routes/files";
import { postRoutes } from "./routes/posts";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "unhandled error",
      error: error.message,
      path: c.req.path,
    }),
  );
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/posts", postRoutes);
app.route("/files", fileRoutes);

export default app;
