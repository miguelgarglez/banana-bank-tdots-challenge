# Guion del vídeo · Banana Bank · reto t·Dots

Idioma: español de España. Voz en off generada con OpenAI TTS (`gpt-4o-mini-tts`), tono claro, cercano y tranquilo. Formato 1920x1080. Duración objetivo: 5:30 a 6:30.

Cada escena tiene: id, duración aproximada, visual, texto en pantalla y narración. La narración manda sobre la duración: cada escena dura lo que dure su audio más 0,6 s de aire.

---

## E01 · Portada (≈ 14 s)

Visual: fondo crema de la marca (#f8f6ef) con el amarillo plátano (#f5d94b) y el verde bosque (#1f3d35) de la app. Título grande, subtítulo, nombre.

Texto: "Banana Bank" · "Reto técnico t·Dots · octubre 2026" · "Miguel García González".

Narración: "Hola, soy Miguel. Este es mi trabajo para el reto de Banana Bank: un banco ficticio que quiere lanzar su asistente de inteligencia artificial el lunes. En seis minutos os cuento qué encontré, qué arreglé, qué construí y cómo lo comprobé."

## E02 · Qué recibí y cómo trabajé (≈ 40 s)

Visual: diagrama de tres cajas conectadas: "Navegador" → "App Next.js + agente (puerto 3000)" → "Banco simulado (puerto 4001, API firmada HMAC)". Debajo, una lista que aparece línea a línea.

Texto en lista: "1. Reproducir el fallo antes de tocar nada" · "2. Test que falla, arreglo, test que pasa" · "3. Misma prueba repetida después, en la API y en el navegador" · "4. Revisión independiente con otros dos modelos" · "El simulador del banco no se toca".

Narración: "La aplicación es un Next.js con un agente que habla con un banco externo por una API firmada. El simulador del banco es intocable: en la evaluación pueden sustituirlo por otro con el mismo contrato. Mi método fue siempre el mismo. Primero reproducir el fallo y guardar la prueba. Después escribir un test que falla, arreglar, y ver el test pasar. Luego repetir la misma reproducción en la API y en el navegador. Y al final, dos rondas de revisión independiente con otros modelos, que encontraron defectos reales que también corregí."

## E03 · Fallo 1: una respuesta perdida duplicaba el dinero (≈ 70 s)

Visual A (primeros 25 s): tarjeta "ANTES" con tres números grandes que aparecen uno a uno: "Orden: 10 €" · "Cobrado: 20 €" · "Operaciones en el banco: 2". Debajo, pequeño: "La app mostró una sola operación completada".

Visual B (resto): diagrama de flujo animado: "POST /v1/transfers (referencia estable)" → rombo "¿5xx o timeout?" → "GET /v1/operations/:ref" → tres salidas: "200: completada" · "404: reintentar con la misma referencia" · "otro error: estado unknown, se verifica después".

Texto: "src/banking/dispatch.ts · src/banking/resolve.ts".

Narración: "El fallo más grave es de dinero. Cuando el banco cobra pero pierde la respuesta, la aplicación reintentaba con una referencia nueva. El banco deduplica por referencia, así que la veía como otra operación. Lo reproduje con el escenario de respuesta perdida: una orden de diez euros movió veinte, el banco registró dos operaciones y la aplicación mostró una sola, completada. El cliente y el operador no podían verlo. El arreglo: una referencia estable por intención. Ante un error ambiguo, la aplicación consulta la operación por esa referencia antes de decidir. Si existe, está completada. Si el banco dice que no la tiene, reintenta con la misma referencia. Si tampoco puede verificar, la deja en estado desconocido, nunca en fallida, y la resuelve después contra el libro mayor. Mientras una operación equivalente siga sin resolver, se bloquea cualquier otra igual. Y un timeout o una respuesta ilegible ya no se tratan como rechazo."

## E04 · Fallo 2: el agente movía dinero sin confirmación (≈ 70 s)

Visual: secuencia de capturas con zoom suave: `02-chat-propuesta-codigo.png` (zoom al resumen y al código), `03-chat-yes-rechazado.png` (zoom a "The transfer hasn't gone through"), `04-chat-confirmado.png` (zoom a la referencia), `06-overview-propuesta-pendiente.png` (zoom al panel "Proposals awaiting confirmation" con el código).

Texto: "ANTES: 'Send 5 euros to Bruno' → transferencia ejecutada en el mismo turno" · "AHORA: resumen + código · el servidor verifica el mensaje · 'yes' no basta".

Narración: "El segundo fallo: decir 'envía cinco euros a Bruno' ejecutaba la transferencia en el mismo turno, sin resumen ni confirmación. Ahora todo el dinero pasa por una única puerta. El agente propone: origen, destino, importe y concepto, y un código de seis caracteres. Y la confirmación la verifica el servidor, no el modelo. Por chat, el mensaje del cliente tiene que ser el código, y nada más. Un 'sí' a secas se rechaza. Una negación que mencione el código también. Desde el panel, el botón de confirmar es la otra vía, y las dos consumen la propuesta una sola vez. Las propuestas caducan a los diez minutos, el importe tiene que coincidir, y el formulario manual pasa por la misma puerta."

## E05 · Fallo 3: alcance del agente y versiones de documentos (≈ 40 s)

Visual A: captura `antes/05-fuera-de-alcance-python.png` con una etiqueta roja "ANTES". Visual B: tarjeta con las tres respuestas nuevas como citas: "No puedo ayudar con programación. Sí con tus cuentas, transferencias y trámites de Banana Bank." · "La documentación no cubre hipotecas. ¿Quieres que abra un caso?" · "Antes de septiembre, 8 € [archive-aurora-1 v1]. Ahora, 6 € [aurora-fees-2026 v2]."

Texto: "prompt con alcance y citas · chunks por párrafo con metadatos · filtro de vigencia".

Narración: "El tercer bloque es el agente y la búsqueda. El asistente escribía código Python si se lo pedían, y el prompt le animaba a rellenar huecos con 'prácticas bancarias comunes'. Además, los ochenta documentos comparten párrafos de plantilla idénticos, y el troceado por caracteres producía fragmentos iguales sin título ni vigencia. Ahora el prompt acota el alcance, exige citar documento y versión, y trata lo caducado como histórico. El troceado respeta párrafos y lleva los metadatos en cada fragmento, y la búsqueda excluye por defecto lo que ya no está en vigor. El resultado: rechaza lo que no es banca, no inventa, y distingue la comisión histórica de la actual con sus citas."

## E06 · Parte 2: copiloto de operador con reconciliación (≈ 80 s)

Visual: `07-operador-caso-lucia.png` (zoom a "Reconciliation" y al hallazgo en naranja), `08-operador-brief.png` (recorrido lento de arriba abajo: hechos verificados, pendientes, discrepancias, borrador), `09-operador-reconciliado.png` (zoom a "completed → completed" y a los eventos).

Texto: "El caso de Lucía: la app dijo 'fallida', el banco dice 'completada'" · "Reconciliación calculada en código · informe del modelo anclado a la evidencia".

Narración: "Para la parte creativa elegí al operador, porque el starter ya traía su caso perfecto. Lucía pidió ochenta y cinco euros para una cena. La aplicación le dijo que no se pudo. El banco sí la ejecutó. Y el operador solo veía el último mensaje. Ahora, al abrir el caso, ve la conversación completa, la actividad del agente, las intenciones de la aplicación y las operaciones reales del banco. La aplicación cruza cada intención con el libro mayor y señala la discrepancia: registrada como fallida, completada en el banco, con referencia, importe y fecha. Un botón corrige el estado sin tocar el banco y deja un evento auditado. El copiloto redacta un informe con esquema estricto: hechos verificados, comprobaciones pendientes, discrepancias, acciones con citas a procedimientos internos, y un borrador de respuesta al cliente que solo puede contener hechos verificados. El texto del cliente y los documentos entran marcados como no confiables, las fuentes se validan, y el caso no se puede cerrar con una discrepancia pendiente."

## E07 · Verificación y revisión independiente (≈ 40 s)

Visual: tarjeta con contadores que suben: "13 → 51 tests" · "35 commits" · "2 rondas de revisión". Al lado, dos tarjetas de revisor: "Codex (GPT)" y "Cursor (Grok 4.7)" con tres hallazgos resumidos cada una: "confirmación dependiente del modelo" · "estado unknown que podía duplicar" · "caducidad que reactivaba aprobaciones" / "cuerpo ilegible tratado como rechazo" · "informe bajo otro caso" · "negación que contenía el código".

Narración: "El starter traía trece pruebas; ahora hay cincuenta y una, y cada arreglo tiene su test que fallaba antes. Las reproducciones de antes y después, por API y en navegador, están en la carpeta de evidencias. Y pedí dos rondas de revisión a otros dos modelos. Encontraron cosas que yo no había visto: que la confirmación aún dependía del criterio del modelo, que una operación en estado desconocido podía acabar duplicada al proponerla de nuevo, o que una negación que citara el código pasaba el control. Todo eso está corregido y cubierto por pruebas, y los informes íntegros van en la entrega."

## E08 · Cierre (≈ 25 s)

Visual: fondo de marca, lista de la entrega: "submission/README.md · explicación completa" · "submission/evidencias/ · antes, después, revisiones" · "submission/ai-sessions/ · sesiones de IA completas" · "npm ci · npm run setup · npm run dev".

Texto final: "Gracias · Miguel García González".

Narración: "Queda fuera, por tiempo, partir la vista en componentes y extraer tokens de diseño. Lo que está, está verificado: las transferencias no se duplican, el dinero no se mueve sin confirmación del titular, y el operador ve lo que pasó de verdad. En el ZIP van el código, el README de entrega, las evidencias, las revisiones y las sesiones de IA completas. Gracias por vuestro tiempo."
