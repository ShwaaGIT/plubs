import crypto from "crypto";

const DEFAULT_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "plubs_session";

export type Account = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  trust_score: number | null;
  password_hash: string;
  password_salt: string;
  created_at: string;
};

export type Session = {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
};

export function makeSessionToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function getSessionExpiryDate(days = DEFAULT_TTL_DAYS) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type PasswordDigest = {
  algo: "scrypt";
  salt: string; // hex
  hash: string; // hex
  N: number;
  r: number;
  p: number;
  dkLen: number;
};

export async function hashPassword(password: string): Promise<PasswordDigest> {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1, dkLen = 64;
  const hash = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, dkLen, { N, r, p }, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey as Buffer)
    )
  );
  return {
    algo: "scrypt",
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    N,
    r,
    p,
    dkLen,
  };
}

export async function verifyPassword(password: string, digest: PasswordDigest): Promise<boolean> {
  if (digest.algo !== "scrypt") return false;
  const salt = Buffer.from(digest.salt, "hex");
  const expected = Buffer.from(digest.hash, "hex");
  const derived = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, digest.dkLen, { N: digest.N, r: digest.r, p: digest.p }, (err, dk) =>
      err ? reject(err) : resolve(dk as Buffer)
    )
  );
  return crypto.timingSafeEqual(derived, expected);
}

export function buildCookie(token: string, expires: Date) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Expires=${expires.toUTCString()}`,
  ];
  return attrs.join("; ");
}

export function clearCookie() {
  const past = new Date(0);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Expires=${past.toUTCString()}`,
  ];
  return attrs.join("; ");
}

export function readCookie(cookies: string | null | undefined, name = SESSION_COOKIE_NAME): string | null {
  if (!cookies) return null;
  const parts = cookies.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}
