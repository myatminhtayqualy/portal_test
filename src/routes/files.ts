import { Hono } from "hono";
import type { AppEnv } from "../types";

export const fileRoutes = new Hono<AppEnv>().get("/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/files\//, ""));
  if (!key || key.includes("..")) {
    return c.json({ error: "Invalid object key" }, 400);
  }

  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.json({ error: "File not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});
