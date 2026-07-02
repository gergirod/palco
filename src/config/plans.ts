/** Planes comerciales de Palco (límite = nombres en watchlist). */
export type PlanId = "esencial" | "profesional" | "enterprise";

export type PlanDef = {
  id: PlanId;
  nombre: string;
  para: string;
  limite: number;
  precio: string;
  bajada: string;
  incluye: string[];
  destacado?: boolean;
  aMedida?: boolean;
};

export const PLANES: PlanDef[] = [
  {
    id: "esencial",
    nombre: "Individual",
    para: "Un nombre",
    limite: 1,
    precio: "USD 90/mes",
    bajada: "Seguí un nombre o tema y no te pierdas nada de lo que se dice.",
    incluye: [
      "1 nombre o tema",
      "Tablero actualizado cada día",
      "Resumen diario por mail",
      "Avisos de crisis apenas los detectamos",
    ],
  },
  {
    id: "profesional",
    nombre: "Pro",
    para: "Hasta 3 nombres",
    limite: 3,
    precio: "USD 250/mes",
    bajada: "Seguí tu principal, un rival y un tema — todo junto.",
    incluye: [
      "Hasta 3 nombres o temas",
      "Avisos de crisis apenas los detectamos",
      "Resumen diario por mail",
      "Reporte semanal curado, listo para presentar",
    ],
    destacado: true,
  },
  {
    id: "enterprise",
    nombre: "A medida",
    para: "Sin límite",
    limite: 999,
    precio: "Hablemos",
    aMedida: true,
    bajada: "Todos los nombres que necesites, con reportes a tu marca y API.",
    incluye: [
      "Nombres o temas ilimitados",
      "Reporte semanal curado",
      "Reportes con tu marca + API",
      "Soporte dedicado",
    ],
  },
];

export function getPlan(id: string | null | undefined): PlanDef | undefined {
  return PLANES.find((p) => p.id === id);
}

export function planLimite(id: string | null | undefined): number {
  return getPlan(id)?.limite ?? 1;
}

export const PLAN_LABEL: Record<string, string> = {
  esencial: "Individual",
  profesional: "Pro",
  enterprise: "A medida",
};
