// Nombre de la app, configurable desde Vercel (Project Settings → Environment
// Variables → NEXT_PUBLIC_APP_NAME) para el día que se elija un nombre/dominio
// definitivo distinto de "Palco". Si la env var no está seteada, se usa "Palco".
//
// NEXT_PUBLIC_* queda embebido en el bundle del cliente en build time, así que
// funciona tanto en componentes de servidor (layout, metadata) como en los
// "use client" (dashboard, onboarding, landing).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Palco";
