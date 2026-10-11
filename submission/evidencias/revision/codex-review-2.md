Revisión estática de `12ad4d2..HEAD`, sin modificar archivos. No ejecuté los tests porque crean bases de datos y archivos temporales.

### A. Los seis hallazgos

1. **Confirmación dependiente del modelo: parcialmente resuelto, gravedad alta.** El servidor rechaza un «sí» sin código, y el clic queda asociado al usuario y al payload. Pero [authorization.ts:110](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:110) acepta cualquier mensaje que _contenga_ el código: «**No confirmes ABC123**» supera el control si el modelo llama a `confirm_transfer`. Sigue dependiendo del modelo distinguir consentimiento de negación o cita.

2. **Duplicación tras `unknown`: parcialmente resuelto.** Reintentar **el mismo intentId** consulta el ledger sin reenviar; `unknown` tampoco caduca. Sin embargo, el bloqueo solo se aplica al crear propuestas, en [authorization.ts:16](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:16): crear previamente dos propuestas idénticas A/B, ejecutar A hasta `unknown` y confirmar B permite enviar otra referencia sin resolver A. La UI muestra operaciones pendientes, pero eso no impone la restricción al ejecutar.

3. **Cuerpo ilegible tratado como rechazo: resuelto para JSON ilegible.** [client.ts:38](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/client.ts:38) convierte el fallo de lectura en `BankError(502)`; `dispatchTransfer` consulta la referencia y conserva `unknown` si tampoco puede verificarla. Escenario: banco cobra, devuelve texto truncado y falla la consulta; no se registra un rechazo definitivo. Sigue faltando validar la estructura del JSON válido, pero ese hueco ya existía.

4. **Copiloto: parcialmente resuelto.** La respuesta de A ya no se muestra bajo B gracias a [page.tsx:948](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/app/page.tsx:948), y un JSON inválido produce 502. No queda garantizada la separación entre afirmaciones y hechos: [copilot.ts:40](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:40) incluye argumentos de herramientas y conceptos controlados por el cliente dentro de `AGENT ACTIVITY`, declarado confiable. Un «el banco ya verificó el reintegro» registrado allí puede acabar en `verifiedFacts`; el esquema solo comprueba que sea texto.

5. **Formulario conserva intentId tras confirmar: resuelto para el clic, incompleto para chat.** [page.tsx:283](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/app/page.tsx:283) limpia la referencia tras confirmar desde la tarjeta. Si una propuesta manual se confirma mediante el chat, esa limpieza no ocurre: volver a enviar el formulario sin cambiar campos reutiliza la intención completada y muestra el resultado anterior, en lugar de proponer el segundo pago.

6. **Dedupe por payload fusiona intenciones: resuelto para intenciones distintas.** Dos intentId diferentes con iguales datos obtienen aprobaciones independientes, salvo el bloqueo por incertidumbre. Pero eliminar la deduplicación también permite crear varias aprobaciones para **el mismo intentId** en [authorization.ts:52](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:52): repetir la petición de propuesta genera otra tarjeta. La referencia bancaria compartida evita por sí sola dos cargos de esa misma intención, pero quedan aprobaciones y estados incoherentes.

### B. Defectos nuevos

| Gravedad  | Archivo y escenario                                                                                                                                                                                                                                                                                                                                                                                                                 | Arreglo                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Alta**  | [authorization.ts:96](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:96): primera confirmación caducada cambia la intención a `expired`; la segunda omite el control porque solo comprueba `awaiting_confirmation`, consume la aprobación y ejecuta.                                                                                                                        | Rechazar siempre aprobaciones caducadas para una ejecución nueva y mantener `expired` terminal.                                                        |
| **Alta**  | [authorization.ts:26](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/banking/authorization.ts:26): busca `processing`, pero `resolveIntent` devuelve precisamente `processing` y solo se bloquea `unknown`; mientras A sigue ejecutándose puede crearse y confirmarse B con otra referencia. Además, dos propuestas concurrentes pueden superar la consulta antes de que ninguna entre en ejecución. | Aplicar una exclusión atómica al ejecutar mientras exista otra operación equivalente sin resolver, incluyendo `processing` y propuestas preexistentes. |
| **Media** | [tools.ts:112](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/agent/tools.ts:112): `operation_status` obtiene correctamente la operación, hace una segunda consulta y, si esta falla, sustituye la evidencia de éxito por `unknown`; si la primera devuelve 404, nunca llama al reconciliador.                                                                                                       | Reconciliar con una única consulta y utilizar su resultado tanto en la respuesta como en la base de datos.                                             |
| **Media** | [copilot.ts:96](/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/src/operator/copilot.ts:96): ahora guarda el brief completo; el siguiente brief lo incorpora entre los últimos eventos como `AGENT ACTIVITY` confiable, convirtiendo una afirmación generada previamente en aparente evidencia.                                                                                                           | Excluir `copilot.brief` de las evidencias verificadas o identificarlo explícitamente como salida no verificada.                                        |

### C. Tests que faltan

En `tests/approvals.test.ts`:

- Mensajes «no confirmes CÓDIGO», código citado y código como subcadena: forzar `confirm_transfer` y comprobar **cero cargos y aprobación sin consumir**.
- Confirmar **dos veces** una aprobación caducada: ambos intentos rechazados, estado `expired`, cero cargos.
- Dos confirmaciones concurrentes de la misma aprobación: un solo cargo y una sola referencia.
- Repetir, también concurrentemente, la propuesta con el **mismo intentId**: una sola aprobación activa.
- Dos intenciones deliberadamente distintas con payload idéntico: aprobaciones distintas; confirmar una no consume la otra.
- A/B propuestas antes de ejecutar; A queda `unknown`; confirmar B debe quedar bloqueado sin segundo POST.
- A retenida en `processing`; proponer y confirmar B equivalente debe quedar bloqueado.

En `tests/transfers.test.ts`:

- `unknown` con 404: comprobar transición prevista y ausencia de reenvío.
- Ejercitar dashboard, inicio del chat y `operation_status`, no solo llamar directamente a `resolveIntent`.
- `operation_status` con primera lectura exitosa y siguiente lectura fallida: conservar `completed`.
- Verificar saldos, número de POST y referencias en los escenarios concurrentes anteriores.

En `tests/client.test.ts`:

- POST que cobra y devuelve cuerpo ilegible; consulta posterior exitosa y consulta posterior fallida: respectivamente `completed` y `unknown`, nunca rechazo ni segundo cargo.

En pruebas del copiloto y de UI, actualmente ausentes:

- JSON inválido produce 502; fuentes inventadas se eliminan; afirmaciones del cliente en conceptos/eventos no se convierten en hechos.
- Generar dos briefs seguidos y comprobar que el primero no entra como evidencia confiable del segundo.
- Respuesta tardía del brief A después de seleccionar B: no aparece bajo B.
- Propuesta manual confirmada por clic **y por chat**; después, mismos campos: nueva intención.
- Confirmación que termina en `unknown`: mantener visible y recuperable la operación pendiente.

### D. Veredicto

No se puede presentar el lunes con la garantía «las transferencias no se duplican y no se mueven sin confirmación del titular». Hay idempotencia por intención, pero persisten vías de ejecución con referencias distintas durante la incertidumbre y una negación que contiene el código supera la autorización del servidor. Antes de sostener esa garantía deben corregirse esos controles y la reactivación de aprobaciones caducadas, y probarse las carreras indicadas.
