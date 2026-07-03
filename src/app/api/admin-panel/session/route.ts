import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  adminCookieOptions,
  adminCookieValue,
  verifyAdminPassword,
  ADMIN_COOKIE,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ ok: false, error: "Admin no configurado" }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }

  const token = adminCookieValue();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Admin no configurado" }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
  return res;
}
