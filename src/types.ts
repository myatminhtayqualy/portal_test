export type UserRole = "admin" | "user";
export type Severity = "info" | "warning" | "critical";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    user: SessionUser;
  };
};

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
};

export type PostRow = {
  id: string;
  title: string;
  severity: Severity;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  author_name?: string;
};
