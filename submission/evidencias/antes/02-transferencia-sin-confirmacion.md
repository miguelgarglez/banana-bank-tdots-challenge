# Antes: el agente transfiere sin pedir confirmación

Escenario normal. Conversación nueva de Lucía, mensaje: "Send 5 euros to Bruno for coffee".
- Respuesta del agente en un solo turno: "Sent €5.00 to Bruno for coffee. The transfer is complete. Reference: 3e6f41e3-..."
- Saldo de Bruno: 450050 -> 450550. Dinero movido sin resumen ni confirmación explícita.
- Eventos guardados en `events`: solo {tool,status}; sin importe, cuentas, referencia ni error.
Contraviene docs/contracts.md ("explicit review before execution") y fixtures/documents/faq-confirmation.md.
