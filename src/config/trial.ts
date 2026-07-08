// Palco — configuración de la prueba gratis y del cobro (early stage).
// El corte del trial lo maneja la DB (palco_accounts.trial_ends_at); acá solo
// vive lo que ve el usuario y a dónde lo mandás a pagar.
//
// Venta por mail, no self-serve: el comprador (equipos de campaña / figuras
// públicas) no decide con tarjeta a las 2 de la mañana — decide después de
// una conversación. El alta real de cuenta la activa Germán a mano en
// Supabase (status='trial' o 'active') una vez que esa conversación pasó.

import { APP_NAME } from "@/config/app";

/** Días de prueba una vez activada a mano. Es solo informativo para los
 *  textos de la UI — el vencimiento real lo define trial_ends_at en la DB. */
export const TRIAL_DIAS = 2;

/** Plan que simulamos durante la prueba (Pro = hasta 3 perfiles). */
export const TRIAL_PLAN = "profesional";
export const TRIAL_LIMITE = 3;

/** A dónde mandás a la gente para activar o reactivar el monitoreo.
 *  Early stage: sin cobro automático ni activación automática. Todo pasa
 *  por mail y vos activás la cuenta a mano (update status en Supabase). */
export const PAGO = {
  // Mail de contacto.
  email: "german@knownfy.ai",
  // Link de cobro de Mercado Pago (dejalo vacío hasta tenerlo).
  //   Mercado Pago → Herramientas para vender → Link de pago / Suscripciones.
  mercadoPagoUrl: "",
};

/** Mail pre-armado para activar el monitoreo de una campaña (nombre propio +
 *  rivales). `detalle` es opcional: lista de nombres que ya cargó en el
 *  onboarding, para que el mail llegue con contexto y no en blanco. */
export function mailtoPagoUrl(email?: string, detalle?: string): string {
  const subject = `${APP_NAME} - activar monitoreo de campaña`;
  const body = [
    "Hola!",
    email ? `Mi cuenta: ${email}.` : null,
    detalle ? `Quiero seguir: ${detalle}.` : "Quiero activar el monitoreo de mi campaña.",
  ]
    .filter(Boolean)
    .join(" ");
  return `mailto:${PAGO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
