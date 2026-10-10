# Entrega · Banana Bank · Miguel García González

- Fecha de entrega: 12 de octubre de 2026.
- Arranque: ver `README.md` en la raíz (`npm ci`, `npm run setup`, editar `.env.local` con `OPENAI_API_KEY`, `npm run doctor`, `npm run dev`, abrir http://127.0.0.1:3000). No hace falta nada más que lo que pide el starter. El índice de documentos incluido (`fixtures/embeddings/index.json.gz`) ya está regenerado con el nuevo chunker, así que no es necesario ejecutar `npm run ingest`.
- Comprobaciones: `npm test` (55 pruebas; el starter traía 13), `npm run typecheck`, `npx prettier --check app src tests`.
- El simulador (`simulator/`) no se ha tocado. La aplicación sigue hablando con el banco solo por su API HTTP firmada.

## Cómo probar en dos minutos

1. Como **Lucía**, en el asistente: `Send 5 euros to Bruno for coffee`. El agente resume la operación y pide un código de confirmación. Responde `yes` y verás que no se mueve dinero. Responde `confirm XXXXXX` con el código mostrado y la transferencia se ejecuta una sola vez.
2. Con el banco en modo `npm run scenario -- lost-response` (en otra terminal, con los servicios arrancados), repite una transferencia desde la pestaña Transfers y confírmala: el banco pierde la respuesta tras cobrar, pero la aplicación consulta la operación por su referencia y la da por completada una sola vez. `npm run scenario -- intermittent 17` restaura el perfil inicial.
3. Como **Marta** (operadora), abre el caso de Lucía ("Could someone check the dinner payment with Bruno"). La reconciliación muestra que la app registró la transferencia como fallida y el banco la tiene completada. Pulsa **Draft a brief** para el informe del copiloto y **Apply reconciliation** para corregir el estado.

## Parte 1 · Fallos encontrados y arreglados

### 1. Una respuesta perdida del banco duplicaba la transferencia (dinero, crítico)

- **Síntoma reproducido.** Con el perfil `lost-response`, una orden de 10 € de Lucía a Bruno movía 20 €: el banco tenía dos operaciones y la aplicación mostraba una sola `completed`. Lo mismo ocurría con `slow-response` (el banco tarda 2,6 s y la app cortaba a 1,4 s) y con la tercera operación del perfil `intermittent 17`, que es el perfil con el que arranca el entorno.
- **Causa.** `src/banking/dispatch.ts` generaba una referencia bancaria nueva en cada reintento tras un 5xx o timeout, así que la idempotencia del banco (actor + referencia) nunca se aplicaba.
- **Arreglo.** Una referencia estable por intención, guardada en `intents.bank_reference` de forma atómica. Ante un 5xx o timeout la aplicación consulta `GET /v1/operations/:reference`: si existe, la operación está completada; si el banco devuelve 404, reintenta con la misma referencia; si tampoco puede verificar, deja la intención en estado `unknown`, nunca en `failed`. Las intenciones `unknown` se resuelven después contra el ledger en cada carga del panel, al inicio de cada turno del chat, al consultar `operation_status` y al reintentar la misma intención (`src/banking/resolve.ts`). Mientras una operación equivalente (misma cuenta origen, destino e importe) siga sin resolver, se bloquea cualquier propuesta o confirmación equivalente. Un cuerpo de respuesta ilegible se trata como ambiguo, no como rechazo (`src/banking/client.ts`).
- **Evidencia.** `submission/evidencias/antes/01-duplicado-lost-response.md` y `submission/evidencias/despues/01-duplicado-lost-response.md` (mismo repro por API en los cuatro perfiles de fallo). Pruebas: `tests/transfers.test.ts` (fallaban 4 de 6 antes del arreglo: `evidencias/antes/06-...txt`), `tests/client.test.ts`.

### 2. El agente movía dinero sin confirmación del titular (dinero y seguridad, crítico)

- **Síntoma reproducido.** `Send 5 euros to Bruno for coffee` ejecutaba la transferencia en el mismo turno, sin resumen ni confirmación. La tabla `approvals`, el endpoint `approvals/:id/confirm` y el panel de propuestas existían, pero nadie creaba propuestas.
- **Arreglo.** `src/banking/authorization.ts` es la única puerta por la que se mueve dinero. Sin aprobación, crea una propuesta (origen, destino, importe, concepto; caduca a los 10 minutos; una sola propuesta activa por intención) y devuelve `requires_confirmation` con un código de seis caracteres. La confirmación llega por dos vías y las dos las verifica el servidor: el botón del panel (`confirmedBy: 'click'`) o un mensaje del cliente que contenga solo el código, opcionalmente precedido de "confirm" o "yes" (`confirmedBy: 'message'`; la tool `confirm_transfer` no puede confirmar por su cuenta). Un "sí" sin código, o una negación que mencione el código, se rechaza con `code_required`. La aprobación se consume de forma atómica y solo una vez, el payload debe coincidir, la caducidad es terminal y el formulario manual también pasa por la misma puerta.
- **Evidencia.** `evidencias/antes/02-transferencia-sin-confirmacion.md`, `evidencias/despues/02-...md`, `evidencias/despues/11-confirmacion-por-codigo.md` y `evidencias/despues/13-negacion-con-codigo.md` (conversaciones reales con textos exactos y saldos). Pruebas: `tests/approvals.test.ts` (16 casos: código correcto, "yes" sin código, negación con código, caducidad, doble uso, payload alterado, otro usuario, bloqueo por operación equivalente sin resolver).

### 3. El agente se salía del ámbito bancario y la búsqueda mezclaba versiones (medio)

- **Síntomas.** El asistente escribía código Python a petición de un cliente (`evidencias/antes/05-fuera-de-alcance-python.png`). El prompt pedía "rellenar con prácticas bancarias comunes y dar una estimación". El chunker cortaba cada 650 caracteres sin mirar párrafos, solo el primer chunk de cada documento llevaba título, versión y vigencia, y los párrafos de plantilla idénticos en los 80 documentos producían chunks con el mismo vector. La búsqueda no filtraba documentos caducados.
- **Arreglo.** Prompt con alcance explícito, respuestas solo desde la evidencia recuperada con citas `[documento vN]`, rechazo de lo que no es Banana Bank, tratamiento de los extractos históricos como pasados (`src/agent/prompt.ts`). Chunker por párrafos con el título del documento en cada chunk y metadatos completos (`src/ingestion/chunker.ts`, 435 chunks únicos). La búsqueda excluye por defecto los documentos fuera de vigencia a la fecha de referencia y limita a dos chunks por documento; los operadores y la tool con `includeArchived` ven el archivo (`src/retrieval/search.ts`).
- **Evidencia.** `evidencias/despues/04-sondeo-rag.md` (Python rechazado en una frase, hipoteca sin inventar y sin abrir caso, comisión Aurora histórica 8 € frente a actual 6 € con citas), `tests/retrieval.test.ts`.

### Lo que no he tocado

El simulador. Tampoco he cambiado el contrato de la API de la aplicación: todas las rutas existentes siguen funcionando con la misma forma, y se añaden `confirm_transfer` en `/api/actions`, `pendingOperations` y `confirmationCode` en `/api/dashboard`, y `POST /api/incidents/:id/{brief,reconcile,close}` para operadores.

## Parte 2 · Copiloto de operador con reconciliación bancaria

**Idea.** Cuando un cliente escribe a soporte "¿podéis comprobar el pago de la cena?", el operador necesita saber qué pasó de verdad. El starter le mostraba solo el último mensaje. Ahora, al abrir un caso, el operador ve la conversación completa, la actividad del agente (herramientas, argumentos y resultados), las intenciones de la aplicación y las operaciones reales del banco (`GET /v1/operator/customer`, con el operador como actor). La aplicación cruza cada intención con el ledger por referencia y señala las discrepancias: "la app registró `failed`; el banco tiene una operación completada (ref, importe, fecha)". El botón **Apply reconciliation** corrige el estado de la aplicación sin tocar el banco y deja un evento auditado. **Draft a brief** pide al modelo un informe con esquema JSON estricto: resumen, hechos verificados, comprobaciones pendientes, discrepancias, acciones sugeridas con citas a procedimientos internos y un borrador de respuesta al cliente que solo puede contener hechos verificados. Las secciones del prompt con texto del cliente o de documentos van marcadas como no confiables, las fuentes citadas se validan contra lo recuperado, un JSON inválido devuelve error en vez de texto libre, y el informe completo queda en `events` para auditoría. **Close case** se niega mientras quede una discrepancia reconciliable.

**Por qué es útil.** El caso de Lucía que trae el starter es exactamente este: la app le dijo "no se pudo" y el dinero sí se movió. Antes el operador no tenía forma de verlo; ahora lo ve en la primera pantalla, con la prueba del banco, y el copiloto le redacta la respuesta sin inventar nada. Respeta las reglas del contrato: el operador no mueve dinero, no se repite una transferencia para comprobar otra y no se afirma ninguna verificación que no esté en la evidencia.

**Cómo probarlo.** Selecciona a Marta, abre el caso de Lucía, pulsa Draft a brief y Apply reconciliation. Capturas en `submission/evidencias/despues/03-operador-caso-lucia.png` y `03-operador-brief.png`; el JSON real del informe en `03-operador-con-evidencias.md`. Pruebas: `tests/operator.test.ts`.

**Archivos.** `src/operator/view.ts` (vista del caso, reconciliación, acciones), `src/operator/copilot.ts` (informe), `src/telemetry.ts` (ahora guarda argumentos y resultados completos), `app/page.tsx` (panel del caso).

## Refactor sin cambio de comportamiento

- API: `app/api/[...path]/route.ts` pasa de 270 líneas de `if` a un despachador de 11 líneas sobre una tabla de rutas por dominio (`src/api/router.ts`, `src/api/{session,dashboard,conversations,actions,operator,documents}.ts`), con la misma autenticación, roles, códigos y textos de error. Único cambio deliberado: las rutas casan por longitud exacta; antes un segmento sobrante se ignoraba por el emparejamiento por prefijo.
- Tokens de diseño: todos los colores y radios de la hoja de estilos salen de variables con nombre por rol (`app/styles/tokens.css`), sin cambio visual.
- Vista: `app/page.tsx` (1.200 líneas) partido en componentes por pestaña (`app/components/`), un hook con el estado y las acciones (`app/hooks/useBananaApp.ts`) y una hoja de estilos por componente (`app/styles/`).

Cada paso se verificó con una herramienta de paridad visual (Playwright, 8 capturas a 1440 px, comparación píxel a píxel con Pillow): 0 píxeles de diferencia en los tres pasos, además de las 55 pruebas, el typecheck y un flujo funcional automatizado. Evidencias: `submission/evidencias/despues/16-paridad-api.txt` y `17-paridad-tokens-y-componentes.txt`.

## Método de trabajo y verificación

- Primero reproduje cada fallo por API o en el navegador y guardé la prueba en `evidencias/antes/`. Cada arreglo lleva una prueba automatizada que falla antes y pasa después (los commits locales siguen ese orden: test, luego fix) y la misma reproducción repetida en `evidencias/despues/`.
- Dos rondas de revisión independiente con otros modelos (Codex GPT y Cursor con Grok), con los informes íntegros en `submission/evidencias/revision/`. Encontraron defectos reales (confirmación dependiente del modelo, estado `unknown` que podía duplicar al reproponer, caducidad que reactivaba aprobaciones, cuerpo ilegible tratado como rechazo, informe del copiloto bajo otro caso) y todos están corregidos y cubiertos por pruebas.
- Verificación en navegador con Playwright y conversaciones reales con el modelo `gpt-6-luna`; los textos exactos están en las evidencias.
- Sesiones de IA completas en `submission/ai-sessions/` (ver abajo).
- Trazabilidad: todos los agentes trabajaron con su directorio dentro del proyecto (Devin como agente principal con un subagente de implementación; Codex y Cursor solo como revisores de solo lectura). Las sesiones exportadas muestran el razonamiento, las órdenes ejecutadas y los resultados tal cual ocurrieron.

## Materiales incluidos

- `submission/README.md`: este documento.
- `submission/demo.mp4`: vídeo de demostración de ambas partes.
- `submission/evidencias/antes/`, `submission/evidencias/despues/`: reproducciones, salidas de `npm test`, capturas y conversaciones.
- `submission/evidencias/revision/`: prompts e informes de las dos revisiones independientes.
- `submission/ai-sessions/`: exports originales y completos de todas las sesiones de IA, generados con un exportador propio que recorre las bases de datos locales de cada herramienta: `manifest.json` (todas las sesiones en orden de inicio, con agente, id, cwd y hora), `devin/<sesión>/nodes.jsonl` (cada nodo de la sesión principal de Devin y de sus ramas de subagentes, verbatim), `codex/<rollout>.jsonl` (los dos rollouts de Codex usados como revisor independiente, byte a byte) y `cursor/<chat>/` (los dos chats de Cursor con Grok, byte a byte más los mensajes decodificados). Además, `devin-atif-righteous-nest.json`: export oficial ATIF de la sesión principal de Devin (`devin -r righteous-nest --export`).
- `submission/video/`: guion del vídeo, capturas usadas y la composición HyperFrames con la que se renderizó `demo.mp4` (voz en off generada con OpenAI TTS a partir del guion).
- `submission/tools/`: herramienta de paridad visual y flujo funcional (Playwright) usados para verificar el refactor.
- `submission/PLAN.md`: plan de trabajo y prioridades tal como lo seguí.

## Terminado, verificado y pendiente

- Terminado y verificado: los tres bloques de la Parte 1, el copiloto de la Parte 2, 55 pruebas, build de producción, vídeo de demostración de 5:54.
- Límites conocidos: la confirmación por chat exige que el mensaje sea solo el código (con "confirm" o "yes" opcionales); cualquier otra redacción se rechaza y el agente vuelve a pedir el código. El bloqueo de operaciones equivalentes compara cuenta origen, destino e importe mientras exista una operación sin resolver; dos intenciones legítimas idénticas sí pueden ejecutarse una vez resuelta la primera. El copiloto reduce pero no elimina el riesgo de que el modelo califique como hecho algo escrito por el cliente; por eso la interfaz separa lo verificado por el ledger (reconciliación, calculada en código) de lo redactado por el modelo.
- Pendiente (fuera de alcance por tiempo): búsqueda vectorial fuera de memoria para corpus grandes.
