# Screen recordings — Banana Bank (video v2)

App en `http://127.0.0.1:3000` (dev server ya corriendo, se ha dejado encendido).
Grabadas con Playwright `recordVideo` 1440×900 @30fps, convertidas a mp4 (libx264, crf 20).
Los timestamps son segundos desde el inicio del mp4 (el vídeo empieza al crear la página;
t0 se tomó justo antes de `context.newPage()`).

## transfer-tab.mp4 — 16.4s (609K)
Flujo: Lucía → Transfers → Carla → 25 € "Team lunch" → review → SENT (perfil `normal`).
- 1.4s: app cargada (overview)
- 2.4s: persona Lucía seleccionada
- 3.3s: Transfers, tarjeta draft visible
- 4.8s: chip "Carla" pulsado
- 6.0s: primer account-pill seleccionado
- 7.1s: importe "25" tecleado (pressSequentially, morph de dígitos)
- 9.0s: descripción "Team lunch" tecleada
- 10.4s: tarjeta review (código de confirmación + countdown "Expires in")
- 14.0s: tarjeta done — **SENT, €25.00 a Carla Ríos · Aurora account, Reference 70e8cd96**
- fin ~16.4s tras 2.5s de hold

## transfer-lost-response.mp4 — 15.6s (567K)
Igual que el anterior con perfil `lost-response`: Bruno, 10 €, "Lost response check".
La respuesta del banco se pierde; la app reintenta y la operación se confirma UNA sola vez.
- 1.2s: app cargada
- 2.0s: persona Lucía
- 2.9s: tarjeta draft
- 4.4s: chip "Bruno" (sin account-pill: Bruno tiene 1 sola cuenta)
- 5.5s: importe "10" tecleado
- 8.2s: descripción tecleada
- 9.6s: tarjeta review
- 13.1s: tarjeta done — **SENT, €10.00 a Bruno Vidal · Horizon account, Reference 6d10a064**

Evidencia ledger (`.data/bank.sqlite`, operations más recientes tras la grabación):
```
6d10a064-…|1000|completed|2026-10-11T19:28:55.239Z   ← UNA sola op de 1000 cents (esta)
70e8cd96-…|2500|completed|2026-10-11T19:28:29.051Z   ← la de transfer-tab
2d5401a2-…|2500|completed|2026-10-11T19:15:23.090Z   ← anterior
```
Solo hay UNA operación nueva de 1000 céntimos pese al lost-response.
Escenario restaurado después a `intermittent 17`.

## chat-transfer-card.mp4 — 24.1s (791K)
Lucía → Assistant → nueva conversación → "quiero mandarle 20 euros a Bruno" (1 llamada
real al modelo). El modelo abrió la tarjeta draft de transferencia en el chat.
- 1.2s: app cargada
- 2.0s: persona Lucía
- 2.7s: pestaña Assistant
- 4.3s: "+ New conversation"
- 8.6s: mensaje enviado (tecleado en pantalla)
- 15.0s: respuesta del asistente + tarjeta draft visible en el chat
- 16.6s: descripción "Cena del viernes" rellenada (importe ya venía del draft)
- 17.9s: tarjeta review
- 21.6s: tarjeta done — **SENT**
- fin ~24.1s tras 2.5s de hold

## chat-code-confirmation.mp4 — 37.5s (977K)
Lucía → nueva conversación → "Send 5 euros from my Aurora account to Bruno for coffee"
→ "yes" (rechazado: no basta) → "confirm 19CA35" → completada. 3 llamadas reales al modelo.
- 1.2s: app cargada
- 4.0s: nueva conversación
- 10.6s: primera petición enviada
- 16.8s: respuesta 1 — "Please review the transfer card and confirm there, or reply with confirm 19CA35." (tarjeta review con código)
- 19.2s: enviado "yes"
- 22.7s: respuesta 2 (rechazo) — "Please confirm using the code shown on the transfer card, for example: confirm 19CA35." (el dinero NO se mueve)
- 23.9s: código leído del DOM: **19CA35**
- 26.6s: enviado "confirm 19CA35"
- 32.8s: respuesta 3 (texto repetido de la tarjeta de confirmación)
- 35.1s: tarjeta pasa a phase-done — **transferencia completada**
- fin ~37.5s tras 2.5s de hold

Nota: la respuesta 3 textual capturada es "Please confirm using the code shown on the
transfer card, for example: confirm 19CA35." — la tarjeta muestra el estado final SENT.

## operator-case.mp4 — 26.0s (1.5M)
Marta → Cases → segmentos Resolved/Open → caso "dinner payment" de Lucía →
Money check + timeline → "Draft a brief" (1 llamada real) → "Apply reconciliation".
- 1.1s: app cargada
- 2.0s: inbox de casos (Marta aterriza en /cases)
- 3.7s: segmento "Resolved"
- 5.8s: segmento "Open"
- 7.4s: detalle del caso (ledger Money check + timeline)
- 11.1s: scroll suave del timeline hacia abajo (~400px)
- 12.3s: scroll de vuelta
- 12.9s: clic en "Draft a brief"
- 17.2s: brief-card visible (respuesta del copilot)
- 23.0s: "Reconciled by operator" en el timeline (check verde)
- fin ~26.0s tras 3s de hold

Setup/restauración como en capture-operator.mjs: `intent-historic-lucia` a 'failed'
antes y después, y borrados los `intent.reconciled` de la última hora. Perfil `normal`.

## citations.mp4 — 10.0s (680K)
Fixture "Citation check" (mensaje con `[faq-human v2]` + `[ghost-doc v1]` injertado).
Lucía → Assistant → conversación → clic en el chip de cita → Documents con el lector.
- 1.1s: app cargada
- 2.6s: pestaña Assistant
- 3.7s: conversación "Citation check" abierta, chip de cita visible
- 7.0s: lector de Documents abierto en **"Can I ask for human support?"**
- fin ~10.0s tras 3s de hold
Fixture `conv-citation-check` eliminada al terminar.

## routes-reload.mp4 — 19.8s (1.5M)
Rutas y deep-links: conversación, documento, reloads, historial, 404.
- 1.6s: app cargada
- 2.7s: overview de Lucía
- 4.2s: conversación `/assistant/bee0b225-…` (clic en el sidebar)
- 6.3s: reload — URL y conversación se mantienen
- 7.4s: Transfers
- 8.5s: Documents
- 9.9s: documento `/documents/aurora-fees-2026`
- 12.0s: reload — URL y documento se mantienen
- 13.0s: back → `/documents`
- 14.0s: back → `/transfers`
- 15.0s: forward → `/documents`
- 16.8s: `/no-existe` → página 404 con botón
- 18.5s: clic "Back to home" → `/` (redirige a /overview)
- fin ~19.8s

## agent-scope.mp4 — 27.9s (719K)
Lucía → nueva conversación: petición fuera de scope (rechazo) + pregunta bancaria
con chip de cita. 2 llamadas reales al modelo.
- 1.1s: app cargada
- 3.9s: nueva conversación
- 9.8s: enviado "Can you write me a Python script to sort a list?"
- 14.3s: respuesta 1 (rechazo) — "I can only help with Banana Bank matters, such as accounts, transfers, bank policies, or support cases."
- 20.9s: enviado "What is the monthly fee of the Aurora account?"
- 25.4s: respuesta 2 con **1 chip de cita** — "The Aurora account's monthly fee is €6. It's waived to €0 if, in the same calendar month, you receive a salary payment of at least €1,200 and make three settled card purchases." (chip: "Aurora · fees and conditions ↗")
- fin ~27.9s tras 2.5s de hold

## overview-polish.mp4 — 7.3s (508K)
Detalles visuales: hover del logo (wiggle) + cambio de persona con banana loader.
- 1.1s: app cargada
- 1.9s: overview de Lucía quieto
- 3.9s: hover sobre el logo (wiggle)
- 5.4s: cambio a Bruno — se ve el loader del plátano
- 7.4s: overview de Bruno
- fin ~7.3s
