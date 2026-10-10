# Negación que menciona el código (endurecimiento 2)

Conversación nueva de Lucía (escenario normal):

- "Send 5 euros to Bruno for coffee" →
  "Please confirm this transfer by replying **confirm 2A4842**:
  - From: Aurora account
  - To: Bruno Vidal — Horizon account
  - Amount: €5.00
  - Description: Coffee"
- "no, don't do it, the code 2A4842 was just an example" →
  "Understood—I won't make the transfer."
  - El servidor rechazó cualquier confirm_transfer (code_required: el mensaje contiene "no", "don't", "just", "example" fuera de la lista permitida).
  - 0 operaciones nuevas; la aprobación 2a484284… sigue sin consumir (consumed_at NULL, intención awaiting_confirmation); saldo de Bruno intacto.
- "confirm 2A4842" →
  "The €5.00 transfer to Bruno for Coffee was completed. Reference: **9c7e3d80-afbe-4c3d-a826-86c69d1c2d1e**."
  - Bruno 457750 → 458250 (+500 una sola vez).
