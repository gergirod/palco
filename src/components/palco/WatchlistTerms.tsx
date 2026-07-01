import { displayAlias, watchlistFromRadar, type WatchlistDisplay } from "@/lib/palco-watchlist";

type Props = {
  radar: { entity: string; watchlist: string[]; watchlist_display?: WatchlistDisplay };
  className?: string;
  compact?: boolean;
};

/** Una entidad, sus alias agrupados — no pills sueltas por término. */
export function WatchlistTerms({ radar, className = "", compact = false }: Props) {
  const w = watchlistFromRadar(radar);
  const alias = displayAlias(w);

  if (compact) {
    return (
      <div className={className}>
        <p className="text-[13px] font-semibold text-stone-800">{w.nombre}</p>
        {alias.length > 0 && (
          <p className="mt-0.5 text-[12px] text-stone-500">
            buscando: {alias.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`text-right ${className}`}>
      <p className="text-[13px] font-semibold text-stone-800">{w.nombre}</p>
      {alias.length > 0 && (
        <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
          buscando:{" "}
          {alias.map((a, i) => (
            <span key={a}>
              {i > 0 && <span className="text-stone-300"> · </span>}
              <span className="text-stone-600">{a}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
