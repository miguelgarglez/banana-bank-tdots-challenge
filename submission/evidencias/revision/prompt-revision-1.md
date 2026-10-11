Eres un revisor independiente y escéptico de un proyecto de hackathon bancario (Next.js 16, TypeScript, SQLite). Trabajas en modo solo lectura: no modifiques archivos.

Contexto: el starter traía fallos deliberados. El candidato ha hecho estos cambios (ver `git log fb0c776..HEAD` y `git diff fb0c776 HEAD -- src app tests`):

1. src/banking/dispatch.ts + actions.ts: referencia bancaria estable por intención, consulta GET /v1/operations/:ref antes de reintentar un 5xx/timeout, estado `unknown` honesto.
2. src/banking/authorization.ts + agent: puerta de confirmación (approvals con caducidad 10 min, uso único, mismo payload, guardia "misma run"), tool confirm_transfer, dedupe de propuestas idénticas por conversación.
3. src/operator/view.ts + copilot.ts + telemetry.ts + UI: vista de caso con reconciliación app↔banco, acciones reconcile/close, brief IA con JSON estricto.
4. src/agent/prompt.ts, ingestion/chunker.ts, retrieval/search.ts: alcance, citas, chunks con metadatos, filtro de vigencia, tope por documento.

Reglas del reto que debes vigilar (docs/contracts.md): el simulador (simulator/) es un banco externo y no debe haberse tocado; la app no accede a la SQLite del banco; la identidad sale de la sesión, nunca de argumentos del modelo; reintentar una intención no multiplica efectos; un timeout no prueba que el banco rechazó; los operadores no mueven dinero; no se inventa evidencia.

Revisa y responde en español, en Markdown, con estas secciones:
A. Defectos reales (bugs, carreras, agujeros de seguridad, estados inconsistentes). Para cada uno: archivo:línea, escenario concreto que lo dispara, gravedad (alta/media/baja), y arreglo sugerido en una o dos frases. Verifica cada afirmación leyendo el código; si no estás seguro, dilo.
B. Casos límite no cubiertos por tests (tests/*.test.ts): nómbralos con precisión.
C. Riesgos de la Parte 2 (copiloto): dónde puede inventar o filtrar datos, prompt injection desde mensajes del cliente o documentos.
D. Calidad: código muerto, duplicación, nombres confusos, cosas que un revisor senior pediría cambiar antes de hacer merge.
E. Veredicto: ¿listo para el lunes? Tres frases máximo.

Prioriza dinero, seguridad y datos de clientes. No propongas refactors grandes ni rediseños. Sé concreto y breve; nada de elogios.
