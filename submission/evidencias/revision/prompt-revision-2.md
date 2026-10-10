Eres un revisor independiente y escéptico. Solo lectura, no modifiques archivos. Proyecto: aplicación bancaria Next.js/TypeScript con un simulador de banco externo en simulator/ (intocable).

En una primera revisión (resumen de hallazgos): (1) la confirmación de transferencias dependía del modelo; (2) una operación en estado `unknown` podía acabar duplicada porque la UI retiraba la propuesta y el siguiente intento usaba otra referencia, y a los 10 minutos pasaba a `expired`; (3) un cuerpo ilegible del banco se trataba como rechazo; (4) el brief del copiloto podía mostrarse bajo otro caso, aceptar texto del cliente como hechos y volcar JSON inválido como resumen; (5) el formulario manual conservaba el intentId tras confirmar; (6) dedupe de propuestas por payload fusionaba intenciones.

El candidato respondió con `git log 12ad4d2..HEAD` (lee `git diff 12ad4d2 HEAD -- src app tests`): código de confirmación de 6 caracteres que el servidor verifica en el propio mensaje del cliente (`confirmedBy: 'message'`) o clic en la UI (`'click'`); `resolveIntent` (src/banking/resolve.ts) que consulta el ledger por referencia y cierra `unknown` a completed/failed, invocado en dashboard, al inicio de cada turno del chat, en `operation_status` y al reintentar la misma intención; bloqueo (`status: 'blocked'`) de una nueva propuesta con payload idéntico mientras exista una intención `unknown` no resoluble; caducidad solo para `awaiting_confirmation`; consumo atómico de la aprobación y asignación atómica de la referencia; `BankError(502)` para cuerpos ilegibles; copiloto con secciones no confiables, fuentes filtradas, error 502 si el JSON no valida y auditoría completa; UI con brief ligado al caso.

Tareas, en español y Markdown:
A. Para cada uno de los seis hallazgos anteriores: ¿queda resuelto? Verifica leyendo el código y razona con un escenario concreto. Si queda un hueco, archivo:línea y escenario.
B. Defectos NUEVOS introducidos por estos cambios (regresiones, estados inconsistentes, carreras, agujeros). Archivo:línea, escenario, gravedad, arreglo en una frase.
C. ¿Qué tests de tests/*.test.ts faltan para los escenarios de A y B? Lista precisa.
D. Veredicto en tres frases: ¿se puede presentar el lunes como "las transferencias no se duplican y no se mueven sin confirmación del titular"?
Prioriza dinero y seguridad. Sé concreto y breve; nada de elogios ni refactors grandes.
