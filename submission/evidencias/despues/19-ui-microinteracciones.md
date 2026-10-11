# 19 · Pulido de interfaz: micro-interacciones y animación de marca

## Qué cambió

- Tokens de movimiento con nombre en `app/styles/tokens.css`: `--ease-out`, `--ease-in-out`, `--dur-press` (120 ms), `--dur-fast` (160 ms), `--dur-base` (220 ms), `--dur-slow` (320 ms). Todas las animaciones solo mueven `transform` y `opacity`; nada de `transition: all`. El storyboard está documentado al inicio de `app/styles/motion.css`.
- Pulsables (`primary`/`secondary`/nav/casos/conversaciones/documentos/composer): `scale(0.97)` al pulsar en 120 ms, hover sutil solo con `@media (hover:hover) and (pointer:fine)`, anillo de foco `--color-brand` de 2 px con `:focus-visible`, y texto ocupado con `blur(2px)` + opacidad .7 ("Sending…", "Confirming…").
- Navegación: indicador deslizante (`.nav-indicator`, `useLayoutEffect` + `offsetTop`, `translateY` en `--dur-base --ease-in-out`); el item activo ya no pinta su propio fondo.
- Entradas: cada pestaña entra con `@starting-style` (`opacity 0 → 1`, `translateY 6px → 0`); las listas (actividad, casos, documentos, resultados) hacen stagger de 30 ms por fila, máximo 8 filas.
- Chat: cada burbuja entra con `translateY(6px) + scale(.98)`; `**negrita**` y `` `código` `` se renderizan en línea; el "Checking…" lleva el BananaMark balanceándose junto a los tres puntos.
- Marca: `app/components/BananaMark.tsx` (balanceo -10°↔10° con el rabito 0,1 s retrasado; sacudida única al pasar sobre el logo; favicon `app/icon.svg`). La pantalla de carga sustituye el spinner por el plátano.
- Propuestas: panel "Proposals awaiting confirmation" con un pulso único de 900 ms; tarjeta inline dentro de la conversación que la originó (`conversationId`), con "Not now" que descarta vía `POST /api/approvals/:id/dismiss` (intención → `cancelled`, evento `transfer.cancelled`). El panel ordena por fecha y muestra 2 + "Show N more".
- Operador: flash verde de 700 ms al reconciliar, el `.finding` sale con opacidad y "Draft a brief" ocupado muestra tres líneas skeleton con shimmer.
- Avisos: entran desde arriba, salen en `--dur-fast` y el notice se auto-cierra a los 6 s. `prefers-reduced-motion` elimina todo el movimiento de transformación y deja solo opacidad/color.

## Cómo se verificó

- `npm test`: 57/57 (incluye dismiss: approval consumida, intent `cancelled`, evento auditado, 409 al repetir, 404 para otra persona, confirmación posterior `already_used`). `tsc --noEmit` y `prettier --check` limpios. `tools/functional.mjs`: flujo completo OK.
- Paridad píxel a píxel frente a `ref-p3-0` (8 capturas, Pillow): 0 px en lucia-overview, lucia-document-open, marta-cases y marta-case-lucia. Las diferencias restantes son solo las zonas previstas: el item de navegación activo al hacer hover muestra ahora el indicador accent en vez de nav-hover (lucia-documents/marta-documents 8 836 px, lucia-transfers 12 206 px) y el nuevo hover de la lista de conversaciones (lucia-chat-dinner 7 271 px). La regresión inicial (chat sin estilos por reescritura del componente) se corrigió restaurando el marcado original.

## Capturas y vídeo

- `19-ui-overview.png`, `19-ui-chat-propuesta.png` (propuesta real creada desde el chat), `19-ui-loading.png` (plátano en carga), `19-ui-operator.png`, `19-ui-dismiss.png` (botón "Not now").
- `19-ui-microinteracciones.webm` (27 s, 1440×900; también `19-ui-microinteracciones.mp4`, más ligero).
