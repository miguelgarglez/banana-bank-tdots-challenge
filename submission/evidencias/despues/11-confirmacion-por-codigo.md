# Confirmación por código (endurecimiento)

## Resolución de unknown vía ledger (escenario read-unavailable)

1. `POST /api/actions` transfer_money 5€ Lucía→Bruno → `requires_confirmation` (approvalId f00db379, code F00DB3).
2. `POST /api/approvals/f00db379…/confirm` (clic) →
   `{"status":"unknown","reference":"ae60e619-b860-4297-976c-e0d97742c661","error":"The bank has not confirmed this operation yet. Its status will be verified against the ledger; it must not be sent again."}`
3. `GET /api/dashboard` → `pendingOperations: []`: el propio dashboard resolvió la intención contra el ledger. Evento `transfer.resolved` registrado; intención `verify-unknown-1` quedó `completed` con operation_id; el banco tiene **1 sola operación** con esa referencia.

## Chat (conversación d9f94463, escenario normal)

- "Send 5 euros to Bruno for coffee" →
  "Confirma la transferencia de **5,00 €** desde tu **cuenta Aurora** a **Bruno Vidal (cuenta Horizon)**, concepto **«coffee»**. Responde con el código: **FFD800**."
- "yes" →
  "No se pudo completar: el banco solicita el código de confirmación mostrado en la propuesta. Envíame ese código para continuar."
  (0 operaciones «coffee»; Bruno sin cambios — el servidor rechazó con code_required.)
- "confirm FFD800" →
  "La transferencia se completó: **5,00 € a Bruno** por **«coffee»**. Referencia: **fe171474-6b01-4c36-bd74-cbda70a009be**."
  (1 operación «coffee»; Bruno +500 una sola vez.)

## Idioma

Conversación nueva de Lucía, pregunta en inglés "What accounts do I have?" →

"You have two accounts:

- Aurora account
- Personal savings"

(Dashboard: acc-lucia Aurora account 391050¢, acc-lucia-savings Personal savings 100000¢ — respuesta en inglés, sin saldos inventados.)
