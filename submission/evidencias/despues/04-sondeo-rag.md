# Después: sondeo RAG con metadatos y filtro de vigencia

Conversación nueva de Lucía (escenario normal), `POST /api/conversations/:id/messages`:

## Aurora fee, histórico vs actual

- "What was the Aurora monthly fee before September 2026, and what is it now?"
  → "The documentation confirms the current Aurora monthly fee is **€6**, waived to **€0** if you receive a salary of at least €1,200 and make three settled card purchases in the same month [aurora-fees-2026 v2]. It doesn't state the fee before September 2026, so I can't verify the historical amount from the available documentation. Would you like me to open a support case to check it?"
- "Please check the historical documents too — what was the fee before September 2026?"
  → "The historical documents returned don't specify Aurora's fee before September 2026. They confirm the current fee is €6 per month from September 1, 2026 [aurora-fees-2026 v2]. The historical amount isn't covered by the available excerpts; I can open a support case to have it checked."
  - El agente SÍ llamó a `search_documents` con `includeArchived: true` (evento tool.completed lo confirma), pero el top-5 quedó copado por documentos vigentes (notice-aurora, aurora-fees-2026, aurora-conditions-2026, todos v2) — `archive-aurora-1` (EUR 8) no entra en top-5 ni incluyendo archivados. El agente respondió con honestidad y ofreció el caso en lugar de inventar el importe.

## Mortgages

- "Do you offer mortgages? What rate?"
  → "I can't confirm whether Banana Bank offers mortgages or what rate applies because the available documentation doesn't cover mortgages. I can open a support case to check—would you like me to?"
  - Tabla incidents: 18 → 18. No abre el caso sin consentimiento.

## `POST /api/search` como lucia, "Aurora account monthly fee" (top-5)

| score | documentId | version | validTo |
|---|---|---|---|
| 0.792 | aurora-fees-2026 | v2 | — |
| 0.780 | aurora-conditions-2026 | v2 | — |
| 0.704 | notice-aurora | v2 | — |
| 0.696 | aurora-operations-2026 | v2 | — |
| 0.668 | aurora-fees-2026 | v2 | — |

Ningún archive-* y todos los chunks con metadatos (435 chunks en el índice, todos con title/version/validFrom/validTo, textos únicos).

## Tras el tope por documento (diversify, max 2 por documentId)

`POST /api/search` como Marta (operadora, includeArchived), "Aurora fee before September 2026":

| score | documentId | version | validTo |
|---|---|---|---|
| 0.732 | notice-aurora | v2 | — |
| 0.729 | aurora-fees-2026 | v2 | — |
| 0.723 | aurora-fees-2026 | v2 | — |
| 0.677 | aurora-conditions-2026 | v2 | — |
| 0.668 | faq-aurora-waiver | v2 | — |

Chat nuevo de Lucía:

- "What was the Aurora monthly fee before September 2026, and what is it now?"
  → "I found the current fee: **€6 per month**, waived to **€0** if you receive a salary payment of at least €1,200 and make three settled card purchases in the same month [aurora-fees-2026 v2]. The retrieved documentation doesn't include the fee before September 2026, so I can't confirm the historical amount. I can look for archived terms if you'd like."
- "Please check the historical documents too"
  → "Before September 2026, the Aurora monthly fee was **€8**, with no waiver under those historical terms; they applied through August 31, 2026 [archive-aurora-1 v1]. From September 1, 2026, the fee is **€6 per month**, waived to **€0** when both conditions are met in the same month: a salary payment of at least €1,200 and three settled card purchases [aurora-fees-2026 v2] [aurora-conditions-2026 v2]."
  - El agente llamó a `search_documents` con `includeArchived: true`; con el tope por documento el top-5 fue [aurora-fees-2026 ×2, notice-aurora, aurora-conditions-2026, archive-aurora-1] y el archivo sí entró.
