# Sondeo RAG (no reproduce fallo grave)

- "Do you offer mortgages? rate?" -> el agente reconoce que no tiene información y abre un caso. Correcto, aunque abre caso sin que se lo pidan.
- "Aurora monthly fee?" -> EUR 6 con la condición de exención correcta (doc v2).
- /api/search "Aurora account monthly fee": 4 de 5 chunks sin title/version/validTo (solo el primer chunk de cada documento lleva metadatos, src/ingestion/chunker.ts). Los archivos v1 (fee EUR 8) no aparecieron en este top-5.
Riesgo real pero menor y dependiente del modelo: el prompt (src/agent/prompt.ts) pide "rellenar con práctica bancaria común y dar una estimación concreta".
