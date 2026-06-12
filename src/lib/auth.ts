import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RoleCode, SessionRole } from "./rbac";

const COOKIE = "kc_session";
const ALG = "HS256";

export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  roles: SessionRole[];
};

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, roles: user.roles })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      uid: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      roles: (payload.roles as SessionRole[]) ?? [],
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

/** Read & verify the current session from the cookie (server components / routes). */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Throw-style guard for API routes. */
export async function requireRole(...codes: RoleCode[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("unauthorized", 401);
  if (codes.length && !session.roles.some((r) => codes.includes(r.code))) {
    throw new AuthError("forbidden", 403);
  }
  return session;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const SESSION_COOKIE = COOKIE;
