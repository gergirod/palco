import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import {
  EMPTY_DECISIONS,
  mergeDecisions,
  norm,
  type CatalogDecisions,
  type Promovida,
} from "@/lib/palco-catalog-admin";
import { fetchUiPayload, supabaseAdminEnabled, upsertUiPayload } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdminEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase admin no configurado" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const tipo = body.tipo as string;
  const current =
    (await fetchUiPayload<CatalogDecisions>("palco_catalog_decisions")) ?? EMPTY_DECISIONS;

  let next: CatalogDecisions;

  if (tipo === "descartar") {
    const canonical = String(body.canonical_guess ?? "");
    const formNorm = norm(canonical);
    if (!formNorm) {
      return NextResponse.json({ ok: false, error: "Falta canonical_guess" }, { status: 400 });
    }
    next = mergeDecisions(current, { tipo: "descartar", formNorm });
  } else if (tipo === "fusionar") {
    const canonical = String(body.canonical_guess ?? "");
    const targetName = String(body.target_name ?? "");
    const formNorm = norm(canonical);
    const targetNorm = norm(targetName);
    if (!formNorm || !targetNorm) {
      return NextResponse.json({ ok: false, error: "Faltan datos de fusión" }, { status: 400 });
    }
    next = mergeDecisions(current, { tipo: "fusionar", formNorm, targetNorm });
  } else if (tipo === "promover") {
    const slug = String(body.slug ?? "").trim();
    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "Político");
    const alias = Array.isArray(body.alias)
      ? body.alias.map((a) => String(a).trim()).filter(Boolean)
      : [];
    const excluir = Array.isArray(body.excluir)
      ? body.excluir.map((a) => String(a).trim()).filter(Boolean)
      : [];
    if (!slug || !name) {
      return NextResponse.json({ ok: false, error: "Faltan slug o name" }, { status: 400 });
    }
    const promovida: Promovida = { slug, name, type, alias, excluir };
    next = mergeDecisions(current, { tipo: "promover", promovida });
  } else if (tipo === "fusionar_grupo") {
    const items = body.items as { canonical_guess: string }[] | undefined;
    const targetName = String(body.target_name ?? "");
    const targetNorm = norm(targetName);
    if (!items?.length || !targetNorm) {
      return NextResponse.json({ ok: false, error: "Grupo inválido" }, { status: 400 });
    }
    next = {
      descartadas: [...current.descartadas],
      fusiones: { ...current.fusiones },
      promovidas: [...current.promovidas],
    };
    for (const item of items) {
      const formNorm = norm(item.canonical_guess);
      if (formNorm && formNorm !== targetNorm) {
        next.fusiones[formNorm] = targetNorm;
      }
    }
  } else {
    return NextResponse.json({ ok: false, error: "tipo inválido" }, { status: 400 });
  }

  const ok = await upsertUiPayload("palco_catalog_decisions", next);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, decisions: next });
}
