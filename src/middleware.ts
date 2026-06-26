import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

// Auth pages — logged-in users get bounced away from these to the dashboard.
const AUTH_PAGES = ["/login", "/forgot-password"];
// No-auth-required paths. "/rms" = public kiosk screens (/rms/screen/<token>...).
// NOTE: admin pages /rms-screens, /rms-blocks, /rms-preview do NOT start with "/rms/" so stay protected.
const PUBLIC = [...AUTH_PAGES, "/rms"];

async function valid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await valid(token);

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Only bounce logged-in users away from auth pages (login/forgot) — NOT from the kiosk.
  if (authed && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, static assets, and API auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpeg|logo.png|api/auth).*)"],
};
