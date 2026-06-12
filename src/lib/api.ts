import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { serialize } from "./prisma";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(serialize(data), init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap an async route handler with uniform error handling. */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) return fail(e.message, e.status);
      if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
        return fail("A record with this unique value already exists.", 409);
      }
      console.error(e);
      return fail("Internal server error", 500);
    }
  };
}
