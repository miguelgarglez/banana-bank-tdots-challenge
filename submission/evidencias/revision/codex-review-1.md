Revisión de código y reproducciones en memoria con HTTP simulado, sin modificar archivos. No ejecuté la suite, que crea bases temporales. No encontré cambios en `simulator/` ni accesos de la aplicación a su SQLite.

## A. Defectos reales

1. **Alta · La confirmación depende del modelo.** [authorization.ts:89](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:89), [tools.ts:96](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/agent/tools.ts:96). Si el modelo llama a `confirm_transfer` en un turno posterior sin consentimiento del cliente, el servidor ejecuta: solo comprueba aprobación y cambio de `runId`. Además, regenerar una aprobación caducada sobre la misma intención permite confirmarla en esa misma nueva ejecución, porque compara el `run_id` original; lo reproduje. Exigir consentimiento registrado fuera de los argumentos del modelo y asociar la ejecución de origen a cada aprobación.

2. **Alta · Un timeout durante la lectura del cuerpo se registra como rechazo.** [client.ts:37](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/client.ts:37), [dispatch.ts:25](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/dispatch.ts:25). Si llegan las cabeceras pero `response.json()` falla después del movimiento, el error queda fuera del `catch` de transporte: no consulta la referencia y termina en `failed`. Reproduje un movimiento registrado con estado local `failed`; el defecto preexistente sigue sin cubrirse. Incluir la lectura del cuerpo en el tratamiento de resultados ambiguos y consultar antes de afirmar un fallo.

3. **Alta · Un brief puede mostrarse bajo otro cliente.** [page.tsx:918](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/app/page.tsx:918). Generar el brief de A, abrir B mientras responde y recibir después A instala el brief de A en B: `generation` solo cambia al seleccionar persona, y la lista de casos sigue habilitada. El operador puede copiar datos de A para responder a B. Vincular cada respuesta al identificador del caso y descartar respuestas de selecciones anteriores.

4. **Media · Repetir una transferencia manual idéntica aparenta un segundo pago.** [page.tsx:279](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/app/page.tsx:279), [authorization.ts:45](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:45). Confirmar no limpia `manualIntentId`; enviar después el mismo formulario crea otra aprobación sobre la intención completada y la devuelve a `awaiting_confirmation`. Al confirmar aparece otro éxito, pero el banco devuelve el movimiento anterior; lo reproduje. Reiniciar la intención del formulario tras completar y devolver el resultado existente para reintentos de intenciones completadas.

5. **Media · Caducar una aprobación sobrescribe hechos bancarios.** [authorization.ts:85](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:85). Confirmar una aprobación antigua después de completar el pago cambia la intención a `expired`, conservando su `operation_id`; reproducido. También bloquea la recuperación por esa aprobación de una operación `unknown`, y [view.ts:24](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/view.ts:24) no permite reconciliar `expired`. Caducar únicamente autorizaciones pendientes y conservar los estados de operaciones ya enviadas.

6. **Media · La deduplicación fusiona intenciones legítimas distintas.** [authorization.ts:30](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:30). Dos `intentId` distintos con iguales datos y conversación, antes de confirmar, devuelven una sola aprobación y marcan el segundo como `superseded`; reproducido. Contradice el contrato de dos intenciones legítimas idénticas. Deduplicar por identidad de intención, sin usar igualdad de payload como prueba de identidad.

7. **Alta, condicionada a varios procesos · La referencia estable tiene una carrera.** [authorization.ts:93](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:93), [dispatch.ts:12](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/dispatch.ts:12). Dos procesos pueden leer la aprobación sin consumir y la referencia vacía, generar referencias diferentes y enviar dos movimientos para la misma intención. No lo reproduje con varios procesos; la lectura y escritura sin transacción permiten ese entrelazado. Consumir la aprobación y asignar la referencia mediante operaciones atómicas, reutilizando siempre el valor persistido.

## B. Casos límite no cubiertos por tests

- Timeout después de recibir cabeceras, cuerpo truncado y respuesta bancaria no parseable.
- Reintentar una intención completada; confirmar aprobaciones consumidas después de caducar; recuperar `unknown` después de diez minutos.
- Dos intenciones idénticas pendientes simultáneamente **en la aplicación**. El test de intenciones distintas existente prueba directamente el banco.
- Confirmaciones concurrentes entre procesos y caída después de consumir la aprobación pero antes de registrar el resultado.
- Turno informativo o negativo seguido de una llamada del modelo a `confirm_transfer`; regeneración de aprobación sobre una intención antigua.
- Cambiar de caso durante la generación del brief; reconciliar mientras existe un brief visible.
- JSON inválido, citas inexistentes e instrucciones maliciosas dentro de conversación o documentos del copiloto.

## C. Riesgos de la Parte 2

- **Prompt injection:** [copilot.ts:47](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:47) concatena mensajes libres con etiquetas como `BANK LEDGER`. Un cliente puede insertar esas etiquetas y falsas instrucciones o comprobaciones. Los documentos también entran como texto; este prompt no explicita que sean contenido no confiable. No he probado la explotación contra el modelo.
- **Hechos y citas inventados:** [copilot.ts:8](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:8) valida cadenas, no su correspondencia con evidencia. `verifiedFacts` puede contener afirmaciones falsas y `sources` identificadores inexistentes; además, el `catch` de la línea 91 muestra la respuesta sin validar como resumen. Rechazar salidas inválidas y comprobar referencias contra las fuentes suministradas.
- **Filtración en el borrador:** se envían cuentas, operaciones, resultados completos de herramientas y documentación interna al modelo. No hay filtro que impida trasladar información interna o datos irrelevantes a `draftReply`; el operador puede copiarlo. Limitar los datos enviados y mantener explícita la separación entre notas internas y respuesta al cliente.
- **Evidencia insuficiente o desactualizada:** recupera desde el último mensaje, incluso si lo escribió el asistente; excluye archivos históricos y corta fragmentos a 700 caracteres. Además, la UI conserva el brief tras reconciliar, aunque hayan cambiado los hechos.

## D. Calidad

- [copilot.ts:8](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:8): esquemas Zod y JSON duplicados; mantener una única definición.
- [types.ts:47](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/types.ts:47): `ActionResult` permite cualquier estado y combinación de campos. Tipar sus variantes y usar `CaseDetail` en la UI evitaría ocultar inconsistencias con `AnyRecord`.
- [authorization.ts:36](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:36): un reintento de la propia propuesta la marca `superseded`; reproducido. No actualizar si ambas intenciones son la misma.
- [copilot.ts:110](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:110): la auditoría guarda contadores, pero no el brief ni sus fuentes; después no permite reconstruir qué vio el operador.

## E. Veredicto

No está listo para el lunes. Bloquearía el merge por la autorización dependiente del modelo, la clasificación falsa de timeouts y el cruce de briefs entre clientes. Los fallos de estados e identidad de intención también necesitan correcciones y pruebas antes de presentar transferencias como fiables.