# Antes: el operador no ve nada del caso

`GET /api/incidents/case-lucia` como Marta devuelve:
{"summary":"Could someone check the dinner payment with Bruno when available?","last":<mismo texto>,"history":0,"events":0,"intents":0,"bank":null}

src/operator/view.ts devuelve history/events/intents vacíos y bank null aunque la UI (app/page.tsx 807-841) ya los pinta.
Además src/telemetry.ts guarda solo {tool,status}: se pierden importes, cuentas, referencias y errores.
Dato plantado en el seed: intents.intent-historic-lucia está "failed" (ref-historic-lucia) y el banco tiene op-historic-lucia "completed" con esa misma referencia. La app dijo "no se pudo" y el dinero sí se movió.
