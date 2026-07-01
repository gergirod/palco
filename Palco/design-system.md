# Design System — Palco

*Última actualización: 01/07/2026.*

La marca de Palco es **ámbar** sobre una base de **neutrales fríos**, con dos colores de estado: **crisis** (carmín) y **positivo** (esmeralda). El ámbar transmite la energía del "en vivo" sin caer en el rojo, que queda reservado para la señal de crisis — el corazón del producto.

## Fuente de verdad

El color vive en dos archivos que hay que mantener en espejo:

- `src/app/globals.css` → bloque `:root`, para CSS y estilos inline (`var(--token)`).
- `tailwind.config.ts` → `theme.extend.colors`, para las utilidades (`bg-signal`, `text-crisis`, etc.).

Regla: **ningún color hardcodeado en los componentes.** Si necesitás un tono nuevo, se agrega como token acá, no como hex suelto en un `.tsx`.

## Tokens

| Token | Hex | Rol |
|---|---|---|
| `ink` | `#16181d` | Texto principal |
| `paper` | `#ffffff` | Fondo de página |
| `surface` | `#f6f7f9` | Secciones alternas / fondo de la app (dashboard) |
| `line` | `#e5e7eb` | Bordes y divisores |
| `muted` | `#565d6b` | Texto secundario |
| `signal` | `#b45309` | **Marca.** Fills con texto blanco, links, acentos |
| `signal-bright` | `#e8820c` | Ámbar brillante — solo acentos decorativos grandes |
| `signal-soft` | `#fbebd6` | Tinte de fondo: chips, hover, estado seleccionado |
| `signal-line` | `#f0c99a` | Borde sobre estado seleccionado |
| `signal-ring` | `#f5d9b0` | Anillo de foco |
| `crisis` | `#e11d48` | Alerta / sentimiento negativo (carmín) |
| `crisis-soft` | `#fce7ef` | Fondo suave de crisis |
| `up` | `#059669` | Positivo / sentimiento a favor (esmeralda) |
| `up-soft` | `#d1fae5` | Fondo suave positivo |

## Por qué dos ámbares

El ámbar brillante (`#e8820c`) es lindo pero no pasa contraste como texto sobre blanco ni con texto blanco encima. Por eso el color de marca real es el ámbar profundo `#b45309` (amber-700), que funciona en los dos usos que aparecen en el código:

- **Relleno con texto blanco** (botones, badges): blanco sobre `#b45309` da ~5:1 → cumple WCAG AA.
- **Texto de acento sobre blanco** (links, cifras, eyebrow): `#b45309` sobre blanco da ~5:1 → cumple AA.

`signal-bright` queda disponible solo para acentos decorativos grandes donde el contraste no es un problema (el punto del logo, un número gigante, el gradiente del gráfico).

## Separación crisis vs. marca

Antes la crisis era un rojo coral (`#e5484d`) cercano al naranja. Con la marca ahora en ámbar, se movió la crisis a **carmín `#e11d48`** para que la señal de alerta —la killer feature— se distinga de un vistazo del color de marca. Ámbar = Palco; carmín = algo pasó.

## Clases de componente

Definidas en `globals.css`, se usan en toda la app:

- `.card` — tarjeta blanca con borde `line` y sombra suave.
- `.btn-signal` — botón primario: relleno `signal` + texto blanco.
- `.btn-ghost` — botón secundario: borde `line`, fondo blanco, hover `signal-soft`.
- `.eyebrow` — etiqueta chica en mayúsculas, color `signal`.

## Neutrales fríos

La base pasó de papel cálido (`#faf8f5`) a blanco frío. En Tailwind, la escala de grises del dashboard y el onboarding migró de `stone-*` (cálido) a `slate-*` (frío) para acompañar. El fondo de la app usa `surface` (`#f6f7f9`) y las tarjetas quedan en blanco, así siempre hay contraste entre capa y fondo.

## Cómo cambiar el color de marca

1. Editá `--signal` (y los derivados `signal-soft/line/ring/bright`) en `globals.css`.
2. Espejá los mismos valores en `tailwind.config.ts`.
3. En el dashboard/onboarding, el ámbar de marca aparece como la constante `BRAND` y algunos valores arbitrarios (`#b45309`, `#f0a44e`, tintes `#fbebd6/#f5d9b0/#f0c99a`); actualizalos si cambia el tono base.
4. Verificá contraste: cualquier color que lleve texto blanco encima o que se use como texto sobre blanco tiene que superar 4.5:1.
