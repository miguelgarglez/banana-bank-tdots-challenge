# Después: respuesta perdida => una sola transferencia

Mismo repro que `antes/01-duplicado-lost-response.md`: sesión de Lucía vía `POST /api/session`, `POST /api/actions transfer_money` de 1000 cents `acc-lucia` → `acc-bruno`, escenario y saldos vía admin del banco (`Bearer banana-local-admin`).

## lost-response

- Escenario: `POST /admin/scenario {"profile":"lost-response"}`
- Saldos antes: lucia 398250, bruno 450550
- Respuesta de la app: status "completed", reference `e4857e5a-...`
- Saldos después: lucia 397250 (-1000), bruno 451550 (+1000)
- Operaciones en el banco con concept "repro lost after": **1** (`e4857e5a-...`, la misma que devolvió la app)

## slow-response

- Saldos antes: lucia 397250, bruno 451550
- Respuesta de la app: status "completed", reference `063d848a-...` (la app cortó a 1,4 s, pero la consulta `GET /v1/operations/:reference` confirmó la operación ya cometida)
- Saldos después: lucia 396250 (-1000), bruno 452550 (+1000)
- Operaciones con concept "repro slow after": **1**

## reject-before

- Saldos antes: lucia 396250, bruno 452550
- Respuesta de la app: status "completed", reference `e7f7d8c7-...` (primer intento 503 sin efectos → lookup 404 → reintento con la MISMA referencia)
- Saldos después: lucia 395250 (-1000), bruno 453550 (+1000)
- Operaciones con concept "repro reject after": **1**

## read-unavailable

- Saldos antes: lucia 395250, bruno 453550
- Primera llamada: status **"unknown"**, reference `5d5c0f64-...`, mensaje "The bank did not confirm the operation. Do not retry; the status will be verified against the ledger." (la operación quedó cometida en el banco y el primer lookup devolvió 503)
- Mismo POST repetido con el mismo `intentId` (`dbe04227-...`): status **"completed"**, operación con `replay: true` y la misma reference
- Saldos después de ambas llamadas: lucia 394250 (-1000 total), bruno 454550 (+1000 total)
- Operaciones con concept "repro read after": **1**

Estado final del banco: `intermittent` seed 17.

Causa del arreglo: `src/banking/dispatch.ts` fija una `bank_reference` estable por intento (guardada en `intents`), la reutiliza en reintentos y, ante cualquier 5xx/timeout, consulta `GET /v1/operations/:reference` antes de decidir: 200 → completed, 404 → reintento seguro, otro error o intentos agotados → status `unknown` sin lanzar.
