"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Sheet — overlay reutilizable para paneles tipo "settings".
 *
 * En mobile se comporta como un bottom sheet nativo: sube desde abajo,
 * ocupa hasta el 90% de la pantalla, tiene un handle arriba para cerrar
 * y no requiere hacer scroll horizontal ni pelear con anchos fijos.
 * En desktop (≥640px) se comporta como el drawer lateral de siempre
 * (desliza desde la derecha, ancho fijo).
 *
 * Un solo componente: el cambio de comportamiento es puro CSS con
 * variantes `sm:`, sin detectar el viewport con JS — así no hay
 * parpadeo ni mismatch de hidratación entre server y cliente.
 */
export default function Sheet({
  open,
  onClose,
  children,
  desktopWidth = "440px",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Ancho del panel en desktop (el drawer lateral clásico). */
  desktopWidth?: string;
}) {
  // mounted: sigue en el DOM mientras dura la animación de salida.
  // visible: controla las clases de transform/opacity (entra/sale).
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  // cerrar con Escape, como cualquier overlay.
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 transition-opacity duration-200 sm:items-stretch sm:justify-end ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`flex w-full max-h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-[#f6f7f9] shadow-2xl transition-transform duration-200 ease-out sm:h-full sm:max-h-none sm:max-w-[var(--sheet-w)] sm:rounded-none ${
          visible ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full"
        }`}
        style={{ ["--sheet-w" as unknown as string]: desktopWidth } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {/* handle: solo mobile — el gesto nativo de "deslizá para cerrar" */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
