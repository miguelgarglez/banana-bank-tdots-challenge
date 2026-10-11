# 20 · Select accesible propio

## Qué

Los cuatro `<select>` nativos (persona en la barra superior, conversación, cuenta origen y destinatario) se sustituyen por `app/components/Select.tsx`, un combobox/listbox sin librerías: disparador con `role="combobox"`, `aria-expanded`, `aria-controls` y `aria-activedescendant`; popover `role="listbox"` con opciones `role="option"` que llevan avatar o icono, etiqueta, descripción truncada y check en la seleccionada. Variantes `chrome` (barra superior) y `field` (formularios). Nuevo `app/components/Avatar.tsx` reutilizable y token `--shadow-popover`.

## Por qué

El select nativo no podía mostrar avatares, saldos ni grupos y rompe la identidad visual en cada plataforma. El componente muestra a cada persona con su avatar y rol (grupos Customers/Operators), cada cuenta con saldo e IBAN, y los destinatarios agrupados por titular.

## Accesibilidad

Teclado completo: Enter/Espacio/Flechas abren, flechas/Home/End navegan, Enter selecciona, Escape cierra y devuelve el foco, Tab cierra, type-ahead con buffer de 500 ms. Clic fuera cierra (pointerdown). Entrada con scale(.97)→1 + opacidad en `--dur-fast` desde el disparador (o desde abajo si se invierte), salida más rápida; `prefers-reduced-motion` deja solo opacidad.

## Verificación

`tools/select-check.mjs` (teclado: apertura con ArrowDown, selección de la tercera opción, Escape con retorno de foco, clic fuera) — todo OK. `npm test` 57/57, `tsc`, prettier y `tools/functional.mjs` OK. Capturas: `20-select-persona-abierto.png`, `20-select-destinatario-abierto.png`, `20-select-conversacion.png`.

## Limitación

El popover es `position: absolute` dentro del componente: en un contenedor con `overflow: hidden` podría recortarse; la alternativa (portal con coordenadas fijas) quedó fuera por sencillez.
