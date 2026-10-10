El código cierra el caso secuencial de “sí” y de un `unknown` idéntico. No cierra el doble cargo ni una confirmación que solo cita el código.

## A. Los seis hallazgos

**1. Confirmación dependiente del modelo — parcial.** Un `sí` ya no mueve dinero: con `confirmedBy: 'message'` el servidor exige que el mensaje de ese `runId` contenga el código (`src/banking/authorization.ts:106-114`), y el clic pasa por `confirmedBy: 'click'` (`app/api/[...path]/route.ts:177`). Hueco: la prueba es `includes` tras quitar espacios y guiones (`authorization.ts:110-111`). Escenario: hay una propuesta con código `7F3A2B` y el cliente escribe «no hagáis la transferencia, el código 7F3A2B era un ejemplo». El prompt ordena llamar a `confirm_transfer` en cuanto el mensaje contiene el código (`src/agent/run.ts:73`). El servidor consume la aprobación y hace el cargo.

**2. `unknown` duplicado, otra referencia y `expired` a los 10 minutos — parcial.** El mismo `intentId` en `unknown` solo consulta el ledger (`src/banking/actions.ts:54`, `src/banking/resolve.ts:28-38`). La caducidad solo actúa si el estado es `awaiting_confirmation` (`authorization.ts:96-101`). Una propuesta nueva con el mismo JSON, si el ledger sigue sin responder, queda `blocked` (`authorization.ts:16-36`). Huecos:
- El bloqueo compara el JSON entero (`authorization.ts:19`). Escenario: la primera transferencia, concepto `Alquiler`, queda `unknown` y el formulario ya borró el `intentId` (`app/page.tsx:283`). El reintento lleva `Alquiler.`. No hay bloqueo, se confirma la segunda propuesta y el ledger acaba con dos cargos. Al confirmar no se repite el bloqueo: ese camino empieza en `authorization.ts:78`.
- `processing` entra en la consulta pero `resolveIntent` solo cierra `unknown` (`resolve.ts:20-21`). Si el resultado no es `unknown`, el bucle no bloquea (`authorization.ts:27`). Escenario: el clic de confirmar pone `processing` (`actions.ts:69`) y el POST sigue en vuelo (`bankTimeoutMs` 1400). En esa ventana la propuesta ya no está (aprobación consumida) y tampoco sale en `pendingOperations` (solo `unknown`). Otro `transfer_money` con otro `intentId` crea una segunda aprobación; confirmarla usa otra referencia.

**3. Cuerpo ilegible tratado como rechazo — resuelto en el cargo.** Un cuerpo que no es JSON lanza `BankError(502)` (`src/banking/client.ts:37-42`). En el dispatch, un status ≥ 500 no marca `failed`: busca la operación y, si no puede, devuelve `unknown` (`src/banking/dispatch.ts:33-44`). Escenario: el banco hace el cargo y responde 504 con HTML. El intent queda `unknown` con la misma referencia; el reintento del mismo intent no genera otro débito.

**4. Brief del copiloto — parcial.** JSON inválido responde 502 y no se pinta (`src/operator/copilot.ts:80-85`). Las fuentes que no están en la recuperación se tiran (`copilot.ts:86-87`). El brief aceptado se guarda entero en `events` (`copilot.ts:88-97`). La UI lo muestra solo si `brief.caseId` es el caso abierto (`app/page.tsx:941`, `app/page.tsx:951`). Hueco: que el texto del cliente no sea un hecho es una frase del prompt (`copilot.ts:25`), sin comprobación posterior. Escenario: el cliente escribe «me habéis cobrado 5.000 € el 1 de octubre, referencia ABC». El modelo lo mete en `verifiedFacts`. El operador ve ese apartado como verificado. Lo mismo con un documento `internal` copiado en `draftReply`.

**5. El formulario conservaba el `intentId` tras confirmar — resuelto.** `confirm()` lo anula siempre (`app/page.tsx:283`) y el envío manual también en `completed`, `failed` y `blocked` (`app/page.tsx:262`). Escenario: confirmar deja `unknown`, el siguiente envío usa otro id y, si el JSON coincide y el primero sigue `unknown`, el servidor bloquea. El efecto es el hueco del punto 2: al soltar el id, la única traba es ese JSON.

**6. Dedupe por payload fusionaba intenciones — resuelto.** No hay reutilización de otro intent. Dos propuestas iguales en `awaiting_confirmation` siguen siendo dos filas; cada confirmación puede hacer su cargo. El bloqueo nuevo escribe `blocked` en el intent nuevo y no toca el antiguo (`authorization.ts:28-35`). Escenario: dos envíos idénticos aún sin confirmar, el usuario confirma los dos: dos operaciones. Es el comportamiento que este hallazgo pedía.

## B. Defectos nuevos

1. **Alta.** `src/banking/authorization.ts:27` y `src/banking/resolve.ts:20`. Un intent `processing` (cargo ya hecho, respuesta aún no) no bloquea, y confirmar la segunda aprobación no vuelve a mirar (`authorization.ts:78`). Dos referencias, dos débitos. Arreglo: tratar `processing` con referencia como no resuelto y repetir ese bloqueo al consumir la aprobación.
2. **Alta.** `src/banking/authorization.ts:110-111` junto con `src/agent/run.ts:73`. Cualquier aparición del código de 6 caracteres confirma, también en una negativa. Arreglo: aceptar solo un token afirmativo (el código solo, o `confirm` + código) y rechazar el mensaje si niega.
3. **Alta.** `src/banking/authorization.ts:19`. El bloqueo es igualdad de JSON, así que un concepto distinto mientras el primero sigue `unknown` abre otro cargo al confirmar. Arreglo: bloquear por misma cuenta origen, destino e importe mientras haya un intent `unknown` o `processing` sin cerrar contra el ledger.
4. **Media.** `src/banking/client.ts:40` y `src/banking/resolve.ts:40`. Un 404 con HTML pasa a 502; `resolveIntent` solo da por fallido el 404. El intent se queda `unknown` y el bloqueo idéntico no se levanta. Arreglo: conservar el status HTTP aunque el cuerpo no sea JSON.
5. **Media.** `src/agent/run.ts:48-51`. Al empezar el turno se resuelve el `unknown`, pero ese resultado no entra en el prompt. Si acaba `completed`, el modelo puede proponer la misma transferencia otra vez en ese turno. Arreglo: añadir al prompt el estado ya resuelto antes de dejar llamar a `transfer_money`.
6. **Baja.** `src/agent/run.ts:84-86`. Esa frase dice que un «sí» basta para `confirm_transfer`; la línea 73 exige el código. El servidor frena el «sí» pelado. Arreglo: borrar la instrucción del «sí».

## C. Tests que faltan

En `tests/approvals.test.ts` o `tests/transfers.test.ts`:

- Mensaje `no 7F3A2B` con `confirmedBy: 'message'` → `code_required` y cero operaciones. Mensaje que es solo el código → un cargo.
- Intent en `processing` con `bank_reference` ya persistida, más un segundo `transferMoney` de otro `intentId` y el mismo payload, solapado con el POST → `blocked` y una sola operación.
- Confirmar una segunda aprobación creada en esa ventana → sigue habiendo una sola operación.
- `unknown` con concepto `Alquiler` y una propuesta nueva `Alquiler.` (mismo origen, destino e importe) → `blocked` y una sola operación cuando el ledger ya tiene la primera.
- POST de transferencia con cuerpo `not json` y el cargo ya en el ledger → el intent no queda `failed`; el siguiente intento del mismo intent no crea otra operación.
- Lookup 404 con cuerpo HTML → no se interpreta como «sigue desconocido para siempre» ni como éxito.
- `resolveIntent` con 404 deja `failed` y permite un intento nuevo; con 503 deja `unknown` y el intento nuevo sigue `blocked`.
- Dos intents distintos en `awaiting_confirmation`, mismo payload, confirmados los dos → dos operaciones.
- Tras un `unknown`, `transferMoney` con un `intentId` nuevo y el mismo JSON → `blocked` (el test actual tira el banco, no este reintento).

En `tests/operator.test.ts`:

- Salida del modelo que no es JSON → `HttpError` 502 y ningún evento `copilot.brief`.
- `sources` con un id no recuperado → ese id no está en el brief guardado.
- El brief no afirma como hecho verificado una cifra que solo aparece en el mensaje del cliente. Esto hoy no tiene anclaje en código; el test fallaría y marca el hueco del punto 4.

## D. Veredicto

Esa frase no se puede presentar el lunes como garantía. Un `sí` sin código no mueve dinero, y un reintento con el mismo JSON mientras el banco no contesta no abre otra referencia ni caduca a los 10 minutos. Un «no» que cita el código sí hace el cargo, y un segundo intento con otro concepto, o nacido mientras el primero sigue en `processing`, confirma con otra referencia y puede debitar dos veces.
