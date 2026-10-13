const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: ITERATIONS,
    },
    keyMaterial,
    KEY_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt);
  return `pbkdf2$sha256$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return false;
  }

  const salt = b64ToBytes(parts[3]);
  const expected = b64ToBytes(parts[4]);
  const derived = new Uint8Array(await deriveKey(password, salt));

  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", derived),
    crypto.subtle.digest("SHA-256", expected),
  ]);

  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}
