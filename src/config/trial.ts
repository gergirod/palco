// Palco — configuración de la prueba gratis y del cobro (early stage).
// El corte del trial lo maneja la DB (palco_accounts.trial_ends_at); acá solo
// vive lo que ve el usuario y a dónde lo mandás a pagar.

/** Días de prueba. Es solo informativo para los textos de la UI.
 *  El vencimiento real lo define trial_ends_at en la DB (trigger SQL). */
export const TRIAL_DIAS = 2;

/** Plan que simulamos durante la prueba (Pro = hasta 3 nombres). */
export const TRIAL_PLAN = "profesional";
export const TRIAL_LIMITE = 3;

/** A dónde mandás a la gente cuando se le vence la prueba.
 *  Early stage: sin cobro automático. Le pasás un link de pago / lo contactás
 *  y activás la cuenta a mano (update status='active' en Supabase). */
export const PAGO = {
  // WhatsApp de contacto (formato internacional, sin + ni espacios).
  whatsapp: "5491100000000",
  // Mail de contacto.
  email: "german@knownfy.ai",
  // Link de cobro de Mercado Pago (dejalo vacío hasta tenerlo).
  //   Mercado Pago → Herramientas para vender → Link de pago / Suscripciones.
  mercadoPagoUrl: "",
};

/** Mensaje pre-armado de WhatsApp. */
export function whatsappPagoUrl(email?: string): string {
  const txt = encodeURIComponent(
    `Hola! Se me terminó la prueba de Palco${email ? ` (${email})` : ""}. Quiero activar mi plan.`
  );
  return `https://wa.me/${PAGO.whatsapp}?text=${txt}`;
}
