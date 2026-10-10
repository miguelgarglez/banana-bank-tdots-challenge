# Banana Bank · plan de trabajo

Entrega: lunes 12 oct, ZIP a hr@tdots.es. Proyecto en `challenge-banana-candidate/`.
Evidencias previas en `evidencias/antes/`. El simulador (`simulator/`) no se toca.

Regla: cada punto se cierra con prueba automatizada o evidencia antes/después.

## P0 · Dinero (Parte 1, obligatorio)

1. **Transferencia duplicada en reintentos** — `src/banking/dispatch.ts`
   - Cada reintento tras 5xx/timeout genera una referencia nueva; el banco no puede deduplicar.
   - Reproducido con `lost-response`: 10 EUR → dos operaciones, 20 EUR descontados, la app muestra una sola `completed`. También afecta a `slow-response` (timeout app 1,4 s vs 2,6 s).
   - Arreglo: referencia estable por intención; ante error ambiguo, consultar estado por esa referencia, nunca crear otra operación; si no se puede verificar, estado "desconocido" honesto.
   - Evidencia: `evidencias/antes/01-duplicado-lost-response.md`.

2. **Transferencia sin confirmación** — `src/agent/run.ts`, rutas `approvals`
   - "Send 5 euros to Bruno for coffee" mueve dinero en un turno.
   - Existe tabla/rutas de approvals y estados `requires_confirmation`, pero no se usan; el endpoint de confirmación no valida expiración ni uso único.
   - Arreglo: el agente crea propuesta (origen, destino, importe, concepto); el dinero no se mueve hasta confirmación explícita; validar expiración, payload y uso único.
   - Evidencia: `evidencias/antes/02-transferencia-sin-confirmacion.md`.

## P1 · Parte 2 (funcionalidad diferencial)

3. **Copiloto de operador con reconciliación bancaria**
   - Al abrir un caso: línea temporal con conversación, eventos, intents y operaciones reales del banco.
   - Marcar discrepancias verificables ("la app dijo failed, el banco dice completed") con referencias. Caso plantado: Lucía.
   - Borrador de respuesta al cliente separando hechos verificados de pendientes, citando documentos.
   - Requiere arreglar antes: `src/operator/view.ts` (devuelve `history/events/intents` vacíos y `bank: null`) y `src/telemetry.ts` (solo guarda `{tool, status}`; perder args, resultados, importes, referencias).
   - Evidencia: `evidencias/antes/03-operador-sin-evidencias.md`.
   - Alternativa si conviene demo más visual: revisión previa inteligente de transferencia (saldo posterior, comisiones, elegibilidad Aurora, posibles duplicados).

## P2 · Agente y RAG (baratos, refuerzan Parte 1)

4. **Alcance y honestidad del prompt** — `src/agent/prompt.ts`
   - Responde a cualquier cosa (ej. algoritmo para invertir una lista en Python) y el prompt invita a "rellenar con prácticas bancarias comunes y dar estimaciones concretas".
   - Arreglo: alcance explícito (cuentas, transferencias, documentos, casos), rechazo amable de lo demás, prohibido inventar datos ausentes en los extractos.
   - Pendiente guardar la captura de la respuesta de Python en `evidencias/antes/`.

5. **Versiones caducadas en RAG** — `src/retrieval/search.ts`, `src/ingestion/chunker.ts`
   - No filtra por `validTo`; metadatos de versión/vigencia solo en el primer chunk.
   - Evidencia: `evidencias/antes/04-sondeo-rag.md` (no reprodujo fallo grave; riesgo medio).

6. Menores: la UI no envía `intentId` (doble clic crea intención nueva); `request_human` abre caso aunque el usuario solo pida información; historial recortado a 24 mensajes; locks en memoria.

## P3 · Refactor y sistema de diseño (si hay tiempo; nunca a medias)

Orden por riesgo creciente. Cada paso debe dejar la app igual en comportamiento y aspecto, verificada en navegador.

7. **API** — `app/api/[...path]/route.ts` (233 líneas, ~15 rutas en cadena de `if`)
   - Mapa `ruta → handler` con un archivo por dominio (session, dashboard, chat, transfers, approvals, documents, operator). Mismo comportamiento, misma auth (`sameOrigin`, `actor`).

8. **Tokens de diseño** — `app/globals.css` (1.387 líneas)
   - Ya hay 8 tokens (`--forest`, `--lime`, `--ink`, `--paper`, `--muted`, `--line`, `--white`, `--font`) y ~25 hex sueltos que son variaciones sin tokenizar (`#324e49`, `#fbefb0`, `#f5d94b`, fondos `#f4f6ef`…).
   - Extraer tokens de color, espaciado, radio y tipografía fieles a la marca actual; sustituir hex sueltos por variables. Sin cambio visual.

9. **Vista** — `app/page.tsx` (1.001 líneas, todas las pestañas en un componente)
   - Partir por pestaña (Overview, Chat, Transfer, Activity, Approvals, Documents, Operator) + componentes compartidos (Icon, Sidebar, Notice). Estado compartido (pestaña, conversación activa, approvals, error/notice) en el padre o un hook.
   - CSS por componente a la vez que se parte la vista.

## Cierre

- Pruebas antes/después (`npm test`, `npm run typecheck`), verificación en navegador.
- Revisión independiente con otro modelo.
- `submission/README.md` (ambas partes, rutas relativas), exports completos de sesiones de IA en `submission/ai-sessions/`, vídeo `submission/demo.mp4` (5–10 min) o PDF.
- Excluir `.env*` (salvo `.env.example`), `node_modules/`, `.next/`, `.git/`. Escaneo de secretos. Probar el ZIP descomprimido en limpio.
