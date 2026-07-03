import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "admin_session";

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("palco-admin-v1").digest("hex");
}

function hasValidSession(req: NextRequest): boolean {
  const token = expectedToken();
  if (!token) return false;
  const val = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!val) return false;
  try {
    return timingSafeEqual(Buffer.from(val), Buffer.from(token));
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (!hasValidSession(req)) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
