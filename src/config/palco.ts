// Palco — config del cliente (reglas del flag + destinatarios).
// Es el equivalente TS de pipeline/config/palco_watchlist.yaml, para que la
// route de Vercel evalúe alertas y mande mails sin depender del entorno Python.
// El cliente define esto UNA vez; el motor decide solo qué se manda.

export type Sensibilidad = "baja" | "media" | "alta";

export interface ReglasPalco {
  sensibilidad: Sensibilidad;
  alerta: {
    min_audiencia_vivo: number;
    min_chat_ratio: number;
    solo_negativas: boolean;
  };
  crisis: {
    requiere_negativo: boolean;
    min_audiencia_vivo: number;
    min_chat_ratio: number;
  };
  horario_silencio: string; // "00:00-08:00" (hora ART)
  dedupe_minutos: number;
}

export const CLIENTE = "Consultora Demo";

// A dónde llegan los mails.
export const DESTINATARIOS = ["german@knownfy.ai"];

// concierge = las alertas quedan como preview para revisión del operador.
// auto      = el sistema manda solo.
export const MODO: "concierge" | "auto" = "concierge";

export const REGLAS: ReglasPalco = {
  sensibilidad: "media",
  alerta: {
    min_audiencia_vivo: 3000,
    min_chat_ratio: 2.0,
    solo_negativas: false,
  },
  crisis: {
    requiere_negativo: true,
    min_audiencia_vivo: 1500,
    min_chat_ratio: 1.5,
  },
  horario_silencio: "00:00-08:00",
  dedupe_minutos: 30,
};

// Multiplicadores por sensibilidad (idénticos a palco_alerts.py).
export const SENS: Record<Sensibilidad, number> = {
  baja: 1.4,
  media: 1.0,
  alta: 0.7,
};
