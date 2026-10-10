# Antes: respuesta perdida => transferencia duplicada

Escenario: `npm run scenario -- lost-response`. Una orden de 10,00 EUR (1000 cents) de Lucía a Bruno vía `POST /api/actions transfer_money`.

- Saldos antes: lucia 400750, bruno 448050
- Respuesta de la app: status "completed", una sola operación (reference 15961097-...)
- Saldos después: lucia 398750 (-2000), bruno 450050 (+2000)
- Operaciones en el banco con concept "repro lost": 2 (references b2f84f4a-... y 15961097-...)
- Tabla intents de la app: 1 fila, completed, solo conoce la segunda referencia

Causa: src/banking/dispatch.ts reintenta un 5xx con una referencia NUEVA (randomUUID por intento), así que el banco no puede aplicar su idempotencia actor+reference.
