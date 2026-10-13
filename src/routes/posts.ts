import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, PostRow, Severity } from "../types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function parseSeverity(value: unknown): Severity | null {
  if (value === "info" || value === "warning" || value === "critical") return value;
  return null;
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export const postRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT posts.id, posts.title, posts.severity, posts.content, posts.image_url,
              posts.created_at, posts.author_id, users.name AS author_name
       FROM posts
       JOIN users ON users.id = posts.author_id
       ORDER BY posts.created_at DESC
       LIMIT 100`,
    ).all<PostRow>();

    return c.json({ posts: results ?? [] });
  })
  .get("/:id", async (c) => {
    const post = await c.env.DB.prepare(
      `SELECT posts.id, posts.title, posts.severity, posts.content, posts.image_url,
              posts.created_at, posts.author_id, users.name AS author_name
       FROM posts
       JOIN users ON users.id = posts.author_id
       WHERE posts.id = ?`,
    )
      .bind(c.req.param("id"))
      .first<PostRow>();

    if (!post) return c.json({ error: "Post not found" }, 404);
    return c.json({ post });
  })
  .post("/", requireAuth, async (c) => {
    const form = await c.req.formData();
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();
    const severity = parseSeverity(form.get("severity"));

    if (title.length < 3 || title.length > 140) {
      return c.json({ error: "Title must be between 3 and 140 characters" }, 400);
    }
    if (!severity) {
      return c.json({ error: "Severity must be info, warning, or critical" }, 400);
    }
    if (content.length < 10 || content.length > 8000) {
      return c.json({ error: "Content must be between 10 and 8000 characters" }, 400);
    }

    let imageUrl: string | null = null;
    const image = form.get("image");

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_BYTES) {
        return c.json({ error: "Image must be 5 MB or smaller" }, 400);
      }
      if (!ALLOWED_TYPES.has(image.type)) {
        return c.json({ error: "Image must be JPEG, PNG, WebP, or GIF" }, 400);
      }

      const key = `posts/${crypto.randomUUID()}.${extensionFor(image.type)}`;
      await c.env.MY_BUCKET.put(key, image.stream(), {
        httpMetadata: { contentType: image.type },
      });
      imageUrl = `/files/${key}`;
    }

    const user = c.get("user");
    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO posts (id, title, severity, content, image_url, author_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, title, severity, content, imageUrl, user.id)
      .run();

    return c.json(
      {
        post: {
          id,
          title,
          severity,
          content,
          image_url: imageUrl,
          author_id: user.id,
          author_name: user.name,
        },
      },
      201,
    );
  });
