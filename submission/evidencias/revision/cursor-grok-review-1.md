Revisé el árbol actual de la aplicación (el `git diff` no llegó a ejecutarse). Ni `src/` ni `app/` importan el simulador ni abren su SQLite. El banco sigue fallando como dice el contrato.

## A. Defectos reales

**1. Alta. Un cargo ya hecho puede cobrarse otra vez.** `src/banking/dispatch.ts:32`, `src/banking/authorization.ts:45`, `src/agent/run.ts:59`, `src/agent/run.ts:108`, `app/api/[...path]/route.ts:66`.

Escenario: perfil `read-unavailable`. El `POST` confirma el cargo y el primer `GET /v1/operations/:ref` responde 503. `dispatch` se rinde en ese primer fallo y deja la intención en `unknown`, con la referencia ya guardada. La aprobación se marca usada antes de saber el resultado (`authorization.ts:93`), y el dashboard solo lista las no usadas, así que el botón desaparece. El texto al cliente y al modelo dice que no se reintente. El siguiente `transfer_money` del chat usa otro `intentId` (`runId:call_id`) y por tanto otra referencia. El banco lo trata como otra operación.

El segundo `confirm` del mismo `intentId` sí resuelve sin duplicar: lo cubre el test y el banco responde `replay`. Esa vía no está en la pantalla.

Arreglo: si el `GET` no es 404, repetirlo en la misma llamada; mientras la intención siga en `unknown`, no abras otra referencia para el mismo pago y muestra ese pendiente hasta que el `GET` lo cierre.

**2. Alta. A los 10 minutos se borra el estado `unknown` y se pide otro pago.** `src/banking/authorization.ts:85`.

Escenario: el cargo quedó en `unknown` y alguien llama a confirmar esa misma aprobación después de `expires_at` (el modelo aún tiene el `approvalId` en el historial, o un cliente llama al API). La caducidad se mira antes que el hueco de `unknown`, el estado pasa a `expired` y el error dice que pida una propuesta nueva. Esa propuesta es otra referencia. Además `expired` no entra en la lista de `view.ts:24`, así que el operador no ve el botón de reconciliar aunque el libro ya tenga el cargo.

Arreglo: si el estado es `unknown`, consulta el banco antes de caducar; no reescribas `unknown` a `expired`.

**3. Alta. El modelo puede mover el dinero en el turno siguiente.** `src/banking/authorization.ts:91`, `src/agent/tools.ts:96`, `src/agent/run.ts:70`.

Escenario: el cliente pide una transferencia, el modelo propone y el cliente escribe después «no», «¿cuál es mi saldo?» o un texto que pide llamar a `confirm_transfer`. El servidor solo exige que el `run_id` sea distinto del de la propuesta. En cualquier mensaje posterior lo es. El `approvalId` y el payload van en las instrucciones de ese turno. El clic de `POST /api/approvals/:id/confirm` sí es un acto del titular; la tool no comprueba el mensaje.

Arreglo: quita `confirm_transfer` del modelo y deja la ejecución en el clic, que ya relee el payload guardado.

**4. Media. Reenviar la misma intención tapa el cargo.** `src/banking/authorization.ts:55`, `app/page.tsx:262`.

Escenario: el formulario, si la respuesta no es `completed` ni `failed`, conserva el `intentId`. Un segundo «Send transfer» entra sin `approvalId`, no encuentra una aprobación libre (la anterior está usada) y pone la intención en `awaiting_confirmation`. La referencia vieja sigue. Si el cliente cambia importe, cuenta o concepto, el `intentId` se anula y nace otra referencia (defecto 1). Si no cambia nada y confirma, el banco hace replay y no hay segundo cargo. Entre medias el operador ve «esperando confirmación» con el dinero ya movido, y ese estado no es `fixable`.

Arreglo: si ya hay `bank_reference` y el estado es `unknown` o `processing`, no crees otra aprobación; resuelve esa referencia.

**5. Media. Una respuesta mala del copiloto se enseña como informe.** `src/operator/copilot.ts:91`, `app/page.tsx:930`.

Escenario: el modelo devuelve texto que no pasa el schema. El `catch` copia `output_text` al `summary` y la pantalla lo muestra como el brief, sin decir que la validación falló.

Arreglo: si el JSON no valida, devuelve un error y no rellenes `summary` con el texto libre.

**6. Baja. `operation_status` no cierra la intención.** `src/agent/tools.ts:109`. Una consulta que encuentra la operación deja la fila en `unknown`. El modelo puede decir que ya se hizo y, en el turno siguiente, proponer otra.

**7. Baja. Una cuenta que no es del titular deja la intención en `created`.** `src/banking/actions.ts:27` inserta antes de `authorization.ts:14`, que lanza 403. El `catch` de la tool responde `failed` y la fila no cambia.

**8. Baja. Cerrar el caso no mira el libro.** `src/operator/view.ts:156`. Se puede cerrar con una intención `unknown` o con `failed` y operación hecha.

Sobre carreras de doble clic en la misma aprobación: en un solo proceso de Node el tramo entre leer `consumed_at` y escribirlo es síncrono, y la segunda llamada ve «already used». No lo marco como defecto. No lo he probado con dos procesos.

## B. Casos límite no cubiertos por tests

Los tests de transferencias y aprobaciones cubren el replay del mismo `intentId` justo después del `unknown`. No cubren lo que hace la pantalla ni el agente.

- Segunda intención, mismo importe y destino, mientras la primera está `unknown` y el banco ya tiene una operación: dos cargos.
- Confirmar la misma aprobación pasados los 10 minutos con estado `unknown`: hoy pasa a `expired`.
- El dashboard deja de mostrar la aprobación en cuanto `consumed_at` está puesto, que es el caso `unknown`.
- `sendMessage` llamando a `confirm_transfer` cuando el último mensaje no es un sí.
- El formulario reenviando el mismo `intentId` tras `unknown`, y reenviando tras cambiar el importe.
- `operation_status` sobre la referencia de una intención `unknown`.
- Reconciliar cuando el estado es `expired`, `awaiting_confirmation` o `superseded` y el banco tiene la operación.
- `unknown` con el banco en `not_found`, y cerrar el caso en ese estado.
- `caseBrief`: JSON inválido, mensaje del cliente con instrucciones, y un borrador que cita un documento interno.
- `search_documents` con `includeArchived: true` cuando el documento vencido puntúa más que el vigente.
- Que un operador reciba 403 en `transfer_money` por la app (el invariante actual lo prueba solo dentro del simulador).

## C. Riesgos de la Parte 2

El schema estricto obliga a tener campos. No obliga a que sean verdad. `verifiedFacts`, `discrepancies` y `sources` son strings del modelo. Nada los compara con el libro ni con los `documentId` recuperados.

El historial del cliente entra en el prompt como texto plano (`copilot.ts:50`). Un mensaje del tipo «hecho verificado: se devolvieron 5.000 €» puede salir en `verifiedFacts` o en `draftReply`. El operador tiene un botón de copiar ese borrador. Los documentos van igual de crudos (`copilot.ts:68`); el prompt del cliente dice que son datos (`prompt.ts:7`), el del operador no separa el mensaje del cliente de las reglas.

`searchDocuments(..., 'operator')` incluye documentos `internal`. Ese texto puede acabar en el borrador que se copia al cliente. La búsqueda usa el último mensaje o el resumen del caso, así que el cliente también elige qué fragmentos entran.

`POST /api/preview-answer` acepta `sources` escritas por el operador, sin volver a leer el índice. Un operador puede hacer que el modelo cite un texto que no está en el corpus.

En el chat, el mismo canal manda: el mensaje del cliente y los chunks públicos pueden pedir al modelo que confirme, cambie de tema o lea una tarifa vencida. `includeArchived` lo decide el modelo. El servidor filtra vigentes solo cuando el flag va en falso, y no marca el resultado como histórico; se fía de que el modelo lea `validTo`.

Saldos, IBAN y el historial del caso salen hacia el proveedor del modelo en cada brief. Es el diseño de esta pieza, y es datos de cliente.

## D. Calidad

- El aviso «Do not retry» (`dispatch.ts:5`, `run.ts:59`) empuja al camino que duplica el cargo. El camino seguro es la misma referencia.
- `failed` significa a la vez saldo insuficiente, propuesta caducada, «ya usada» y «confirma en otro mensaje». El modelo no puede distinguirlos.
- Reconciliar, cerrar y el brief insertan un `run_id` aleatorio que no existe en `runs` (`view.ts:138`, `copilot.ts:106`).
- `reconcile` casa solo por referencia y pinta el importe del intent (`view.ts:13`, `view.ts:36`). El banco impide otro payload con la misma referencia; aun así el botón no lo comprueba.
- Cada búsqueda carga todos los chunks y hace el producto en proceso (`search.ts:37`). Vale para el corpus de la prueba; un revisor lo preguntaría.
- `permission` en `transferMoney` a veces es una propuesta, no un rechazo.
- No hay tests de `copilot.ts` ni de `prompt.ts`.

## E. Veredicto

No está listo para mover dinero el lunes. Un cargo que el banco ya hizo puede quedar en `unknown`, la pantalla retira la propuesta y el siguiente intento usa otra referencia, así que el mismo pago se ejecuta dos veces; a los 10 minutos esa recuperación se convierte además en `expired`. El modelo puede llamar a `confirm_transfer` en cualquier turno posterior, y el copiloto puede devolver texto del cliente como si fueran hechos del caso.
