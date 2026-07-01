/** Términos de búsqueda de una entidad Palco (nombre + alias, no son entidades separadas). */
export type WatchlistDisplay = {
  nombre: string;
  alias: string[];
  excluir?: string[];
};

export function watchlistFromRadar(r: {
  entity: string;
  watchlist: string[];
  watchlist_display?: WatchlistDisplay;
}): WatchlistDisplay {
  if (r.watchlist_display) return r.watchlist_display;
  const items = r.watchlist ?? [];
  const nombre = items[0] || r.entity;
  const alias = items.slice(1);
  return { nombre, alias, excluir: [] };
}

/** Alias para mostrar (sin repetir el nombre canónico). */
export function displayAlias(w: WatchlistDisplay): string[] {
  const n = w.nombre.trim().toLowerCase();
  return w.alias.filter((a) => a.trim().toLowerCase() !== n);
}

export function matchesQuery(
  q: string,
  nombre: string,
  alias: string[] = []
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (nombre.toLowerCase().includes(needle)) return true;
  return alias.some((a) => a.toLowerCase().includes(needle));
}
