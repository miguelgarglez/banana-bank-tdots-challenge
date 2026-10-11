# Guion v2 · Banana Bank · reto t·Dots · vídeo de entrega

Idioma: español de España. Voz en off: OpenAI TTS `gpt-4o-mini-tts`, voz `alloy`, instrucción de estilo: "Narrador técnico en español de España, tono claro, cercano y tranquilo, ritmo pausado, sin énfasis publicitario". Formato 1920×1080, 30 fps. Duración objetivo: 8:30–9:30. Subtítulos quemados en todo el vídeo (banda inferior).

Regla de duración: cada escena dura lo que dure su audio + 0,8 s de aire. Las grabaciones de pantalla se recortan/aceleran para encajar en la narración, nunca al revés.

---

## Sistema visual (igual en todas las escenas)

- Paleta de la app: crema `#f8f6ef` (fondo), bosque `#1f3d35` (texto principal, superficies oscuras), plátano `#f5d94b` (acento), tinta `#14201c`, gris `#6b7572` (muted), línea `#e3e0d6`, blanco `#ffffff`, aviso `#b4552d`, ok `#2f7a4f`.
- Tipografía: Inter (auto-embebida). Títulos 72–96 px peso 700, letter-spacing −0,02em. Cuerpo 30–36 px peso 500. Etiquetas pequeñas "eyebrow" 20 px peso 700, mayúsculas, tracking 0,18em, color muted. Monoespaciada para rutas de archivo: `ui-monospace, SFMono-Regular, Menlo` 24 px.
- Marco de navegador para las grabaciones: contenedor redondeado 20 px, sombra suave (`0 30px 80px rgba(20,32,28,.18)`), barra superior de 44 px color `#efede4` con tres puntos y una "barra de URL" en píldora que muestra la ruta real (texto cambia con la grabación). La grabación (1440×900) se escala para que el marco mida ~1500 px de ancho, centrado, y deja libre la banda inferior de subtítulos (nada por debajo de y = 860 salvo subtítulos).
- "Punch-in": para enfocar una zona de la grabación se anima `scale` + `x/y` del wrapper INTERIOR al marco (no del clip), con `power3.inOut`, 0,8 s, y se vuelve con la misma curva. Nunca más de scale 1,8.
- Etiqueta de archivo: chip en la esquina inferior izquierda (sobre la banda de subtítulos, y ≈ 800), fondo bosque, texto crema monoespaciado, entra deslizando 12 px desde abajo con fade.
- Marcador de sección: arriba a la izquierda, "01 — Parte 1 · Fallo 1" en eyebrow; y una barra de progreso de 3 px en el borde superior que avanza con el tiempo total del vídeo (ancho = t/T). Vive en una capa superior global, no en cada escena.
- Subtítulos: capa global en pista propia, grupos de 4–7 palabras cortados por frase y pausas ≥150 ms, caja píldora `rgba(31,61,53,.92)` con texto crema 38 px peso 600, centrados, línea base a y = 985, máximo 1500 px de ancho, entrada fade+8 px arriba 0,18 s, salida fade 0,12 s con `tl.set(visibility hidden)` al final de cada grupo. Un grupo visible a la vez. Fuente de tiempos: transcripción Whisper de cada MP3 (`--language es`).
- Transiciones entre escenas: corte limpio con 0,3 s de fade del contenido saliente y entrada escalonada del entrante (stagger 60 ms). Sin wipes ni efectos de catálogo.
- Movimiento: entradas `power3.out` 0,5–0,7 s desde 24 px; números con count-up `power2.out`; líneas de diagrama se dibujan con `strokeDashoffset`. Nada rebota salvo el check final de "enviado" (`back.out(1.6)`).

Recursos: grabaciones en `recordings/*.mp4` (ver `recordings/NOTES.md` para los timestamps de cada hito), capturas en `../challenge-banana-candidate/submission/evidencias/`, icono del plátano en `../challenge-banana-candidate/app/icon.svg`.

---

## E01 · Portada (≈ 15 s)

Visual: fondo crema. El plátano del icono (`app/icon.svg`) grande (260 px) a la izquierda haciendo UNA vuelta completa con la misma curva que el loader (acelera a 372°, vuelve a 360° con pequeño rebote, 1,5 s) y queda quieto. A la derecha, "Banana Bank" (96 px) entra por palabras; debajo "Reto técnico t·Dots · octubre 2026" y "Miguel García González" en eyebrow. Una mancha amarilla desenfocada (blur 120 px, opacidad .35) se desplaza lentamente detrás.

Narración: "Hola, soy Miguel. Este es mi trabajo para el reto de Banana Bank: un banco ficticio que lanza su asistente de inteligencia artificial el lunes. En nueve minutos: qué encontré, qué arreglé, qué construí encima y cómo lo comprobé todo."

## E02 · Qué recibí, cómo trabajé, mapa del vídeo (≈ 45 s)

Visual A (0–18 s): diagrama de tres cajas con líneas que se dibujan: "Navegador" → "App Next.js + agente · :3000" → "Banco simulado · :4001 · API firmada HMAC". La tercera caja lleva un candado y la etiqueta "no se toca".
Visual B (18–32 s): lista de método, aparece línea a línea: "1 · Reproducir el fallo y guardar la prueba" · "2 · Test que falla → arreglo → test que pasa" · "3 · Misma reproducción por API y en navegador" · "4 · Revisión independiente con otros modelos".
Visual C (32–45 s): mapa del vídeo en cuatro fichas horizontales: "Parte 1 · tres fallos" · "Parte 2 · copiloto de operador" · "Parte 2 · transferir desde el chat" · "Calidad y verificación". Se encienden una a una.

Narración: "La aplicación es un Next.js con un agente que habla con un banco externo por una API firmada. El simulador del banco es intocable: en la evaluación pueden sustituirlo por otro con el mismo contrato. Mi método fue el mismo en cada bloque. Primero, reproducir el fallo y guardar la prueba. Después, escribir un test que falla, arreglar, y ver el test pasar. Luego, repetir la misma reproducción por API y en el navegador. Y por último, pedir revisión independiente a otros modelos. El vídeo sigue ese orden: tres fallos de la parte uno, dos capacidades nuevas en la parte dos, y la calidad del conjunto."

## E03 · Parte 1 · Fallo 1: una respuesta perdida duplicaba el dinero (≈ 80 s)

Visual A (0–20 s): tarjeta "ANTES" con tres cifras grandes que aparecen una a una con count-up: "Orden · 10 €" · "Cobrado · 20 €" · "Operaciones en el banco · 2". Debajo, en muted: "La app mostraba una sola operación, completada".
Visual B (20–50 s): diagrama de flujo que se dibuja: "POST /v1/transfers · referencia estable por intención" → rombo "¿5xx o timeout?" → "GET /v1/operations/:ref" → tres salidas en abanico: "200 · completada" (verde) · "404 · reintenta con la MISMA referencia" (bosque) · "sin respuesta · estado unknown, se verifica después" (ámbar). Debajo: "equivalentes bloqueadas mientras haya una sin resolver".
Visual C (50–80 s): grabación `transfer-lost-response.mp4` en marco de navegador, con una etiqueta ámbar arriba a la derecha "banco: lost-response". Punch-in a la tarjeta cuando pasa a review y a SENT. Al final, sobre el marco, una ficha pequeña: "libro mayor del banco · 1 operación · 10,00 €".
Chips de archivo: `src/banking/dispatch.ts` · `src/banking/resolve.ts` · `tests/transfers.test.ts`.

Narración: "El fallo más grave es de dinero. Cuando el banco cobra pero pierde la respuesta, la aplicación reintentaba con una referencia nueva, y el banco, que deduplica por referencia, la veía como otra operación. Lo reproduje con el escenario de respuesta perdida: una orden de diez euros movió veinte. El banco tenía dos operaciones; la aplicación mostraba una sola, completada. El arreglo: una referencia estable por intención. Ante un error ambiguo, la aplicación consulta la operación por esa referencia antes de decidir. Si existe, está completada. Si el banco no la tiene, reintenta con la misma referencia. Y si tampoco puede verificar, la deja en estado desconocido, nunca en fallida, y la resuelve después contra el libro mayor. Mientras una operación equivalente siga sin resolver, se bloquea cualquier otra igual. Aquí lo veis con el banco perdiendo la respuesta a propósito: la transferencia sale una sola vez, con su referencia, y el libro mayor tiene una única operación."

## E04 · Parte 1 · Fallo 2: el agente movía dinero sin confirmación (≈ 70 s)

Visual: grabación `chat-code-confirmation.mp4` en marco, a la izquierda (ocupa ~62 % del ancho). A la derecha, una columna de reglas que se van encendiendo al ritmo de la narración: "Una sola puerta · authorizeTransfer" · "Propuesta con código de 6 caracteres" · "El servidor verifica, no el modelo" · "'yes' no basta · negación con código tampoco" · "Caduca en 10 min · un solo uso · payload idéntico" · "El formulario manual pasa por la misma puerta". Punch-ins: al código de confirmación, a la respuesta de rechazo del "yes", a la referencia final.
Arriba, pequeño, tachado: "ANTES · 'Send 5 euros to Bruno' → ejecutada en el mismo turno".
Chips: `src/banking/authorization.ts` · `tests/approvals.test.ts · 16 casos`.

Narración: "Segundo fallo: 'envía cinco euros a Bruno' ejecutaba la transferencia en el mismo turno, sin resumen ni confirmación. Ahora todo el dinero pasa por una única puerta. El agente propone origen, destino, importe y concepto, y un código de seis caracteres. La confirmación la verifica el servidor, no el modelo. Por chat, el mensaje tiene que ser el código y nada más: un 'sí' a secas se rechaza, y una negación que mencione el código, también. El botón de la tarjeta es la otra vía, y las dos consumen la propuesta una sola vez. Las propuestas caducan a los diez minutos, el importe tiene que coincidir, y el formulario manual pasa por la misma puerta."

## E05 · Parte 1 · Fallo 3: alcance del agente, búsqueda y corpus (≈ 70 s)

Visual A (0–12 s): captura `evidencias/antes/05-fuera-de-alcance-python.png` en marco con etiqueta roja "ANTES", ligero punch-in al código Python.
Visual B (12–40 s): grabación `agent-scope.mp4`: rechazo del Python y respuesta sobre la comisión Aurora con chips de cita. Punch-in a los chips.
Visual C (40–58 s): tres contadores grandes con flecha: "80 → 46 documentos" · "435 → 88 fragmentos" · "24 → 0 frases de plantilla compartidas". Debajo en muted: "chunker por párrafos · metadatos en cada fragmento · filtro de vigencia".
Visual D (58–70 s): grabación `citations.mp4`: clic en el chip → se abre el documento en el lector.
Chips: `src/agent/prompt.ts` · `src/ingestion/chunker.ts` · `src/retrieval/search.ts` · `fixtures/documents/`.

Narración: "Tercer bloque: el agente y la búsqueda. El asistente escribía código Python si se lo pedían, y el prompt le animaba a rellenar huecos con 'prácticas bancarias comunes'. Ahora el prompt acota el alcance a Banana Bank, exige citar documento y versión, y trata lo caducado como histórico: rechaza lo que no es banca, no inventa, y distingue la comisión histórica de la actual. El corpus también tenía trampa: ochenta documentos que eran casi el mismo texto, con veinticuatro frases de plantilla repetidas en todos, troceadas por caracteres y sin título ni vigencia en cada fragmento. Lo reescribí: cuarenta y seis documentos distintos, ochenta y ocho fragmentos únicos, cero frases compartidas, troceado por párrafos con metadatos, y una búsqueda que excluye por defecto lo que ya no está en vigor. Y las citas dejaron de ser un código opaco: son chips con el título del documento que abren la fuente en el lector."

## E06 · Parte 2 · Copiloto de operador con reconciliación (≈ 85 s)

Visual: grabación `operator-case.mp4` en marco grande (casi todo el ancho). Secuencia con punch-ins guiados por los timestamps de NOTES.md: bandeja con segmentos Open/Resolved → abrir el caso de Lucía → punch-in a "Money check" (hallazgo ámbar) → recorrido de la línea de tiempo → "Draft a brief" → punch-in a la tarjeta del informe (hechos verificados, pendientes, discrepancias, borrador editable, chips de fuentes) → "Apply reconciliation" → punch-in a la fila en verde y al evento "Reconciled by operator" en la timeline. Rótulos breves que aparecen y desaparecen bajo el marco: "la app dijo 'failed' · el banco dice 'completed'" · "reconciliación calculada en código" · "informe anclado a la evidencia" · "no se cierra con discrepancias".
Chips: `src/operator/view.ts` · `src/operator/copilot.ts` · `app/components/operator/`.

Narración: "La parte dos la dediqué al operador, porque el starter ya traía el caso perfecto. Lucía pidió ochenta y cinco euros para una cena. La aplicación le dijo que no se pudo. El banco sí la ejecutó. Y el operador solo veía el último mensaje. Ahora la vista del caso es una herramienta de trabajo. Arriba, el chequeo de dinero: la aplicación cruza cada intención con el libro mayor del banco y señala la discrepancia, registrada como fallida, completada en el banco, con referencia, importe y fecha, y el arreglo está ahí mismo. Debajo, una sola línea de tiempo: mensajes, actividad del agente en palabras llanas, entradas del banco e hitos del caso. El copiloto redacta un informe con esquema estricto: hechos verificados, comprobaciones pendientes, discrepancias, acciones con citas a procedimientos internos, y un borrador de respuesta editable que solo puede contener hechos verificados. Aplicar la reconciliación corrige el estado sin tocar el banco y deja un evento auditado. Y el caso no se puede cerrar mientras quede una discrepancia pendiente."

## E07 · Parte 2 · Transferir desde la conversación (≈ 80 s)

Visual A (0–8 s): diagrama de cuatro pasos en línea: "el modelo detecta la intención" → "una tarjeta determinista recoge los datos" → "el servidor crea la propuesta" → "el titular confirma". El tercer y cuarto paso llevan un candado: "sin cambios en autorización".
Visual B (8–60 s): grabación `chat-transfer-card.mp4` en marco: mensaje → tarjeta borrador bajo la respuesta con el destinatario ya marcado → completar → revisión (punch-in al código y a la cuenta atrás; otro punch-in al placeholder del compositor "Type confirm XXXXXX…") → confirmar → enviado con referencia.
Visual C (60–80 s): grabación `transfer-tab.mp4` recortada al tramo del importe y la revisión: punch-in a los dígitos deslizando y al "Balance after". Rótulo: "la misma tarjeta en la pestaña Transfers".
Chips: `src/agent/tools.ts · draft_transfer` · `src/banking/attachments.ts` · `app/components/transfer/`.

Narración: "Y una segunda capacidad, esta para el cliente: las transferencias ocurren dentro de la conversación. Antes, el modelo tenía que extraer cuatro datos del texto libre y llamar a la herramienta; si faltaba uno, preguntaba una y otra vez, y podía inventarse el importe. Ahora el agente tiene una herramienta de borrador: detecta la intención y lo que ya se ha dicho, y abre una tarjeta editable debajo de su respuesta con lo que falta. La tarjeta es el mismo componente que la pestaña de transferencias, y pasa por borrador, revisión y enviado en el mismo sitio, con el código, la cuenta atrás de caducidad y el saldo resultante. El modelo no toca el dinero: la propuesta, el código, la caducidad y el uso único siguen siendo del servidor. Las tarjetas se derivan de las intenciones reales, así que una conversación reabierta muestra cada transferencia en su estado verdadero, junto al mensaje que la creó. En la pestaña de transferencias, la misma tarjeta: los dígitos del importe deslizan al escribir y el saldo resultante se recalcula en vivo."

## E08 · Calidad · Refactor sin cambio de píxeles y rutas reales (≈ 60 s)

Visual A (0–25 s): tres fichas que entran escalonadas: "API · 270 líneas de if → tabla de rutas por dominio" · "Tokens de diseño · color y radio por rol" · "Vista · 1.200 líneas → componentes + hook". Debajo, un sello grande: "0 px de diferencia · 8 capturas × 3 pasos" con un pequeño par de miniaturas "antes | después" idénticas (usa `evidencias/despues/19-ui-overview.png` dos veces).
Visual B (25–60 s): grabación `routes-reload.mp4` en marco; la barra de URL del marco va mostrando la ruta real (`/assistant/<id>`, `/documents/<id>`, `/no-existe`). Rótulos: "recargar mantiene el estado" · "atrás y adelante" · "roles redirigen a su inicio" · "404 con vuelta a casa".
Chips: `src/api/router.ts` · `app/styles/tokens.css` · `app/(app)/` · `submission/tools/parity.mjs`.

Narración: "Con el comportamiento fijado por pruebas, reorganicé la aplicación sin cambiar un píxel: una tabla de rutas por dominio en la API, tokens de diseño con nombre por rol, y la vista de mil doscientas líneas partida en componentes y un hook. Cada paso se comparó píxel a píxel: cero diferencias en ocho capturas. Después, rutas reales: cada vista tiene su dirección; recargar mantiene la persona, la conversación, el documento o el caso abierto; atrás y adelante funcionan; cada rol aterriza en su inicio; y una ruta inexistente tiene su propia página con vuelta a casa."

## E09 · Calidad · Los detalles que no se ven (≈ 45 s)

Visual: rejilla 2×3 de fichas pequeñas con una grabación o captura recortada cada una, que se encienden en secuencia: "Loader con identidad" (`overview-polish.mp4`, el plátano girando) · "Select accesible · teclado completo" (`evidencias/despues/20-select-persona-abierto.png`) · "Foco solo con teclado" (`28-focus-modality/amount-tab.png` vs `amount-click.png`) · "Dígitos que deslizan" (`transfer-tab.mp4` recortado al importe) · "Markdown propio, sin dependencias" (`22-chat-markdown.png`) · "prefers-reduced-motion respetado" (icono y texto). Abajo: "tokens de movimiento · --dur-press … --dur-slow · --ease-out".
Chips: `app/styles/motion.css` · `app/components/Select.tsx` · `app/components/Markdown.tsx`.

Narración: "Una app bancaria también se juzga por lo que no se ve: la respuesta al pulsar, las entradas suaves, un estado de carga con identidad. Añadí tokens de movimiento con nombre, un selector accesible con teclado completo, un anillo de foco que solo aparece al navegar con teclado, importes y saldos que deslizan sus dígitos, un renderizador de Markdown propio sin dependencias, y todo respeta la preferencia de movimiento reducido."

## E10 · Verificación y revisión independiente (≈ 55 s)

Visual A (0–20 s): contadores grandes: "13 → 78 tests" · "12 scripts de Playwright" · "32 carpetas de evidencia" · "3 rondas de revisión". (Los valores se rellenan antes del TTS con los números reales.)
Visual B (20–40 s): dos tarjetas de revisor: "Codex · GPT" y "Cursor · Grok" con tres hallazgos cada una: "confirmación dependiente del modelo" · "estado unknown que podía duplicar" · "caducidad que reactivaba aprobaciones" / "cuerpo ilegible tratado como rechazo" · "informe bajo otro caso" · "negación que contenía el código". Cada hallazgo recibe un check verde al final.
Visual C (40–55 s): captura del visor de sesiones (`evidencias/despues/18-visor-sesiones-grafo.png`) en marco con punch-in suave.

Narración: "El starter traía trece pruebas; ahora hay setenta y ocho, y cada arreglo tiene su test que fallaba antes. Cada bloque de interfaz tiene un script de Playwright que lo recorre, comprueba el estado real y guarda capturas en la carpeta de evidencias. Pedí revisión a otros dos modelos. Encontraron cosas que yo no había visto: una confirmación que aún dependía del criterio del modelo, un estado desconocido que podía acabar duplicado al proponerlo de nuevo, una negación que citaba el código y pasaba el control. Todo está corregido y cubierto por pruebas. Y las sesiones de inteligencia artificial van completas, con un visor para recorrerlas: cada agente, cada llamada y cada resultado."

## E11 · Cierre (≈ 30 s)

Visual: fondo crema; a la izquierda la lista de la entrega con rutas en monoespaciada: `submission/README.md` · `submission/evidencias/` · `submission/ai-sessions/` + `ai-sessions-viewer/` · `submission/demo.mp4`; a la derecha los comandos en una tarjeta oscura: `npm ci` · `npm run setup` · `npm run dev`. Al final, el plátano vuelve a girar una vez y "Gracias · Miguel García González".

Narración: "Lo que está, está verificado: las transferencias no se duplican, el dinero no se mueve sin confirmación del titular, el operador ve lo que pasó de verdad, y el cliente transfiere sin salir de la conversación. En el ZIP van el código, el README de entrega, las evidencias de antes y después, las revisiones y las sesiones completas. Gracias por vuestro tiempo."
