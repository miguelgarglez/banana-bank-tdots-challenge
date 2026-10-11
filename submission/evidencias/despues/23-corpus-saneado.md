# 23 · Corpus saneado y lector HTML/CSV

## Antes / después

| Métrica                                                                | Antes | Después |
| ---------------------------------------------------------------------- | ----- | ------- |
| Documentos                                                             | 80    | 46      |
| Chunks en el índice                                                    | 435   | 88      |
| Frases de plantilla (>40 caracteres) presentes en todos los documentos | 24    | 0       |

La única oración de más de 40 caracteres compartida por los 46 documentos es la nota legal redactada a propósito: «Banana Bank is a simulated bank: this document describes only the policies of the test environment, in euros.». El resto de los textos son distintos entre sí.

El corpus nuevo tiene 8 fichas `*-fees-2026.md` vigentes (una por producto), 8 `archive-*.md` (v1 históricas), 8 `notice-*.csv`, 20 `faq-*.md`, `operator-procedures.md` y `context-guide-1.html`. `readDocument` convierte las etiquetas de bloque HTML a encabezados y párrafos Markdown y parsea el CSV con un parser mínimo sin dependencias (campos entrecomillados, `""` escapado, saltos de línea internos), de modo que `Aurora policy update` se lee con jerarquía en el lector (ver `23-documentos-lector.png` y `23-documentos-notice.png`).

## Comprobación del asistente (Lucía, conversaciones nuevas)

**P:** What is the Horizon monthly fee?
**R:** The Horizon monthly fee is €3 per calendar month. [horizon-fees-2026 v2]
**Fuentes:** horizon-fees-2026, notice-horizon

**P:** When is the Aurora fee waived?
**R:** The Aurora monthly fee is waived to €0 when, in the same calendar month, you receive a salary payment of at least €1,200 and make three settled card purchases. A transfer from your own account doesn't count as salary. If either requirement isn't met, the fee is €6. [aurora-fees-2026 v2]
**Fuentes:** faq-aurora-waiver, aurora-fees-2026, notice-aurora

**P:** What was the Aurora fee in March 2026?
**R:** The Aurora monthly fee in March 2026 was **€8**. This was a historical fee and did not include the waiver introduced later [archive-aurora-1 v1].
**Fuentes:** aurora-fees-2026, notice-aurora, faq-aurora-waiver
**Nota:** cita correctamente el archivo histórico (`archive-aurora-1`); la respuesta literal dice «historical fee» y que la bonificación aún no existía, pero no menciona explícitamente que la cuota vigente es €6.

**P:** What is the maximum per transfer?
**R:** The maximum is EUR 100,000 per transfer, subject to available funds and authorization. Negative amounts and fractions of less than one cent aren't allowed. [faq-limits v2]
**Fuentes:** faq-limits

**P:** Do you offer travel insurance?
**R:** The documentation doesn't say whether Banana Bank offers travel insurance. I can open a support case so an operator can check—would you like me to? [context-guide-1 v2]
**Fuentes:** context-guide-1

## Verificación

`npm test` 66/66, `npx tsc --noEmit`, `npx prettier --check`, `node tools/functional.mjs`. Tests nuevos en `tests/retrieval.test.ts`: conversión de HTML a Markdown con encabezados en líneas propias, parseo del CSV `notice-aurora`, integridad del manifiesto (ids únicos, ficheros existentes), ausencia de `##` fuera de inicio de línea tras `readDocument` y cobertura de los 8 productos (una ficha vigente y un archivo v1).
