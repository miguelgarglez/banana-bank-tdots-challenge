# Después: el operador ve la conversación, la actividad y la reconciliación con el ledger

`GET /api/incidents/case-lucia` como Marta devuelve (recortado; history/events/intents son conteos):

```json
{
  "incident": {
    "id": "case-lucia",
    "user_id": "lucia",
    "conversation_id": "conv-lucia-support",
    "summary": "Could someone check the dinner payment with Bruno when available?",
    "status": "open",
    "created_at": "2026-09-23T16:40:00.000Z"
  },
  "customer": {
    "id": "lucia",
    "name": "Luc\u00eda Mart\u00edn",
    "role": "customer",
    "initials": "LM",
    "color": "#a6b5fa"
  },
  "lastMessage": {
    "id": "conv-lucia-support-message-2",
    "conversation_id": "conv-lucia-support",
    "role": "user",
    "content": "Could someone check the dinner payment with Bruno when available?",
    "created_at": "2026-09-23T16:40:20.000Z",
    "run_id": null
  },
  "bankError": null,
  "reconciliation": [
    {
      "intentId": "intent-historic-lucia",
      "reference": "ref-historic-lucia",
      "amountCents": 8500,
      "appStatus": "failed",
      "bankStatus": "completed",
      "operation": {
        "id": "op-historic-lucia",
        "userId": "lucia",
        "reference": "ref-historic-lucia",
        "fromAccountId": "acc-lucia",
        "toAccountId": "acc-bruno",
        "amountCents": 8500,
        "concept": "Team dinner",
        "createdAt": "2026-09-23T16:41:12.000Z",
        "status": "completed"
      },
      "finding": "App recorded failed; the bank ledger shows a completed operation (ref-historic-lucia, \u20ac85.00, 2026-09-23T16:41:12.000Z).",
      "fixable": true
    }
  ],
  "gaps": ["No agent activity was recorded for this conversation."],
  "history": 3,
  "events": 0,
  "intents": 1,
  "bank": {
    "accounts": 2,
    "operations": 12
  }
}
```

La discrepancia plantada salta sola: `appStatus: "failed"` contra `bankStatus: "completed"`, con `fixable: true` y el finding "App recorded failed; the bank ledger shows a completed operation (ref-historic-lucia, €85.00, 2026-09-23T16:41:12.000Z)."

## Copilot (`POST /api/incidents/case-lucia/brief`)

Respuesta completa:

```json
{
  "brief": {
    "summary": "The €85 team-dinner transfer to Bruno was completed, despite the app showing it as failed. The bank ledger and reconciliation match the transfer details.",
    "verifiedFacts": [
      "The bank ledger records a completed €85.00 transfer from Lucía’s Aurora account to Bruno for “Team dinner” on 2026-09-23 at 16:41:12, reference ref-historic-lucia.",
      "The app intent for that transfer is marked failed and reports that no response was received from the bank.",
      "Reconciliation confirms the app/ledger status mismatch and identifies the bank operation as completed."
    ],
    "pendingChecks": [],
    "discrepancies": [
      "App status is failed, while the bank ledger status is completed for the same reference, amount, and transfer."
    ],
    "suggestedActions": [
      "Tell Lucía the transfer is recorded as completed in the bank ledger; do not initiate another transfer to check it.",
      "If the recipient says they cannot see the payment, follow the internal ledger-inspection or reconciliation procedure (procedure-7; procedure-3)."
    ],
    "draftReply": "Hi Lucía, I checked the bank record: your €85.00 team-dinner transfer to Bruno is marked as completed on 23 September 2026 (reference ref-historic-lucia). The app showed a failure, but the bank ledger confirms the payment completed. If Bruno cannot see it, please let us know so we can advise on the next step.",
    "sources": ["procedure-7", "procedure-3"]
  },
  "model": "gpt-6-luna",
  "usage": {
    "input_tokens": 2819,
    "input_tokens_details": { "cache_write_tokens": 2816, "cached_tokens": 0 },
    "output_tokens": 309,
    "output_tokens_details": { "reasoning_tokens": 0 },
    "total_tokens": 3128
  }
}
```

- verifiedFacts habla de la operación completada de €85.00 con `ref-historic-lucia` el 2026-09-23 — solo hechos del ledger y del intent.
- pendingChecks vacío y draftReply se limita a hechos verificados + siguiente paso; nada inventado.
- sources: procedure-7, procedure-3 (citados como ids de documento).

## Reconcile (`POST /api/incidents/case-lucia/reconcile {"intentId":"intent-historic-lucia"}`)

- Primera llamada → la intención pasa a `completed` con `operationId: op-historic-lucia` y queda un evento `intent.reconciled` en la conversación.
- Segunda llamada → `409 {"error":"Nothing to reconcile for this intent."}`.

Estado dejado tras la verificación: la intención de Lucía se restauró al estado plantado (`failed`, `operation_id NULL`, error "No response received from the bank."), y se borraron los eventos `intent.reconciled` y `copilot.brief` de `conv-lucia-support` para que la demo parta del seed (0 eventos). `case-lucia` sigue `open` — no se cerró.

## Verificación en navegador (Playwright, 1440x1000)

- `03-operador-caso-lucia.png`: vista completa del caso de Lucía como Marta: reconciliación con la discrepancia (failed → completed, ref-historic-lucia, €85.00), botón "Apply reconciliation", conversación completa, operaciones del banco y el hueco "No agent activity was recorded".
- `03-operador-brief.png`: tras pulsar "Draft a brief": resumen, hechos verificados, pendientes, discrepancias, acciones sugeridas (procedure-3, procedure-7) y borrador de respuesta al cliente sin datos inventados.
- "Apply reconciliation" en la UI: la fila pasa a "completed → completed", el botón desaparece y aparecen los eventos `copilot.brief` e `intent.reconciled` en "Agent activity".
- Estado restaurado después con sqlite3 (intención failed, eventos borrados) para la demo.
