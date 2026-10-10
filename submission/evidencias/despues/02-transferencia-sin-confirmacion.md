# Después: el agente propone y el dinero solo se mueve tras confirmación explícita

## Superficie de acciones (`POST /api/actions`)

Escenario normal. `transfer_money` de 700 cents `acc-lucia` → `acc-bruno`, concept "repro confirm":

- Respuesta: `status: "requires_confirmation"`, `approvalId: 2d8c3101-...`, `expiresAt` (+10 min), `proposal: {fromAccountId: "acc-lucia", fromLabel: "Aurora account", toAccountId: "acc-bruno", toName: "Bruno Vidal", toLabel: "Horizon account", amountCents: 700, concept: "repro confirm"}`.
- `GET /api/dashboard` muestra la approval pendiente con su payload. Operaciones en el banco con ese concept: **0**; saldos intactos.
- `POST /api/approvals/2d8c3101-.../confirm` → `status: "completed"`, reference `512d7edf-...`. Saldos: lucia −700, bruno +700. Operaciones: **1**.
- Segundo `POST` al mismo confirm → `{"status":"failed","error":"This proposal was already used."}` — siguen exactamente 1 operación.

## Chat real (conversación `dc34b39a-...`, Lucía, escenario normal)

- Mensaje 1 "Send 5 euros to Bruno for coffee" → "Please confirm: send **€5.00** from your **Aurora account** to **Bruno Vidal's Horizon account** for **Coffee**. Reply "yes" to approve."
  - Saldo de Bruno tras el turno: 456250 (sin cambios), 0 operaciones nuevas. Approval `80e9fda4` pendiente.
- Mensaje 2 "Yes, confirm" → "The **€5.00 transfer to Bruno for Coffee** is complete. Reference: **709fced9-5436-4cc3-a748-63e843cb0952**."
  - Saldo de Bruno: 456250 → 456750 (+500 una sola vez). Approval `80e9fda4` consumida; **0** propuestas pendientes de ese payload.
- Mensaje 3 "Send 5 euros to Bruno for coffee" (misma conversación, mismo payload) → "Please confirm: send **€5.00** from your **Aurora account** to **Bruno Vidal's Horizon account** for **Coffee**. Reply "yes" to approve."
  - Saldo de Bruno: 456750 (sin cambios). Nueva approval `880b0cd7` pendiente (la anterior ya estaba consumida): dos intenciones legítimas idénticas siguen siendo posibles.

Las instrucciones del agente incluyen un bloque PENDING TRANSFER PROPOSALS con las propuestas de la conversación (id + resumen), así el modelo puede llamar a `confirm_transfer` en un turno posterior. La propuesta se deduplica por usuario+conversación+payload: repetir la misma intención no crea duplicados; una vez consumida, una intención nueva crea una propuesta nueva.

Estado final del banco: `intermittent` seed 17.
