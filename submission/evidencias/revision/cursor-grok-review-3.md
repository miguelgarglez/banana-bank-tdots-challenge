La promesa se cumple en las rutas que casan exactamente y en el orden de comprobaciones de esas rutas. No se cumple en el resto: el despachador autentica solo después de casar, y el matcher es a la vez más estricto (segmentos de más) y más laxo (segmento vacío).

## A. Comportamiento

El orden en una ruta que casa no cambia. `POST` sigue llamando a `sameOrigin` antes que a nada (`src/api/router.ts:48`). Luego, si la ruta casa, `actor` y después el rol (`src/api/router.ts:54-57`). El cuerpo se lee dentro del handler. En `POST /api/actions` el rol de cliente se comprueba después del Zod (`src/api/actions.ts:12-27`), igual que antes. En `preview-answer`, reconciliar, cerrar e ingesta el rol va antes del cuerpo. Textos (`Route not found.`, `Select a person to continue.`, `Operator role required.`, `A customer is required.`, `Invalid request data.`), el `503` con `missing_openai_api_key` y `Cache-Control: no-store` más la cookie de sesión se mantienen.

Lo que cambia es cuándo se exige sesión. Antes, `actor()` corría para cualquier ruta que no fuera `health`, `people` o `POST /session`, y el `404` llegaba después. Ahora el `404` sale del bucle si ninguna fila casa (`src/api/router.ts:49-67`), sin mirar la cookie.

- `GET /api/no-such` sin cookie: antes `401`, ahora `404`.
- `GET /api/actions` sin cookie: antes `401` (la rama exigía `POST`, pero `actor()` ya había corrido), ahora `404`.
- `POST /api/no-such` sin cookie y sin `Origin`: antes `401`, ahora `404`. Con `Origin` ajeno sigue el `403` de `sameOrigin`.

Segmentos de más. El `if` antiguo usaba prefijos (`path[0] === 'conversations' && path[1]`, y lo mismo en documentos, incidencias y aprobaciones) e ignoraba el resto. `match` exige el mismo número de segmentos (`src/api/router.ts:37`).

- `GET /api/conversations/{id}/extra` con la sesión del dueño: antes `200` con la conversación; ahora `404`. `GET .../messages` sigue devolviendo el mismo detalle.
- `POST /api/conversations/{id}/messages/extra`: antes enviaba el mensaje; ahora `404`.
- `GET /api/documents/{id}/foo`: antes `200` con el documento; ahora `404`. `.../chunks/extra` antes devolvía los chunks.
- `GET /api/incidents/{id}/reconcile` como operador: antes `200` con el caso (el `POST` era lo único que reconciliaba); ahora `404`. Como cliente: antes `403 Operator role required.` (el rol se miraba en cuanto el primer segmento era `incidents`); ahora `404`, sin mirar la sesión.
- `POST /api/approvals/{id}/confirm/extra` del dueño: antes confirmaba la transferencia; ahora `404`.

Id vacío. Antes `path[1]` tenía que ser truthy. `:id` acepta `''` (`src/api/router.ts:40`).

- `GET /api/conversations/` con un segmento vacío y sesión de cliente: antes `404 Route not found.`; ahora casa `conversations/:id` (`src/api/conversations.ts:53-54`) y responde `404 Conversation not found.`
- `GET /api/documents/` con id vacío: antes el listado; ahora `404 Document not found.` (`src/api/documents.ts:27-29`).
- `GET /api/incidents/` con id vacío como operador: antes el listado (`!path[1]`); ahora `caseDetail` con id vacío (`src/api/operator.ts:41-45`).

No hay `405`: método no listado sigue siendo `404`, como en la cadena de `if`. Los métodos que Next no exporta (`PUT`, `DELETE`) no llegan al despachador.

En la UI no vi un handler, un efecto ni un reset distinto del de la página única. `selectPerson` sigue vaciando conversación, caso, brief, documento, formulario y pestaña, y `generation` sigue invalidando respuestas tardías. El brief sigue atado a `brief.caseId` (`app/components/operator/CaseDetail.tsx:65`). Los tokens no cambian lógica.

## B. Seguridad

Las rutas que siguen casando conservan rol y propiedad: conversación y aprobación por `user_id` (`src/api/shared.ts:4-8`, `src/api/actions.ts:39-41`), documentos por audiencia (`src/api/documents.ts:13-14`), incidencias por rol `operator`. No hay lectura de datos de otro usuario.

Sí se pierde el muro previo al `404`. Un cliente anónimo distingue “esta ruta existe” (`401`/`403`) de “no existe” (`404`). Antes casi todo lo no público era `401` hasta tener sesión. Los subcaminos que ya no casan (`incidents/{id}/reconcile` en `GET`, segmentos de más) tampoco comprueban el rol: pasan de `403` a `404`. Es una fuga de la forma de la API, no de filas.

El id vacío no cruza usuarios: la consulta sigue filtrando por `user_id`. Cambia el código y el texto, no el conjunto de filas.

## C. Calidad

1. El rol de `actions` está dentro del handler (`src/api/actions.ts:27`), después del Zod. El resto lo declara la tabla. Es el sitio donde un rol nuevo se olvidaría.
2. `current` está tipado como `Person | null` (`src/api/router.ts:14`) y todos los handlers usan `current!`.
3. `forbidden` es un quinto argumento posicional (`src/api/router.ts:26-32`). El mismo texto de cliente está copiado dos veces (`src/api/conversations.ts:20` y `:32`); `Operator role required.` también, en `operator.ts` y `documents.ts`.
4. `match` no exige que `:id` sea no vacío (`src/api/router.ts:40`). Ahí nace el `404` distinto.
5. `useBananaApp` devuelve unos cuarenta campos y `page.tsx` los vuelve a pasar uno a uno. `query` no entra en el reset de `selectPerson` (`app/hooks/useBananaApp.ts:44-65`); `sources` y `docs` sí.
6. `setFrom`, `setTo`, `setAmount` y `setConcept` borran `manualIntentId` por dentro (`app/hooks/useBananaApp.ts:307-309`). El nombre no lo dice.
7. `updateIndex` y `searchDocs` no miran `generation` en el `catch` ni en el `finally` (`app/hooks/useBananaApp.ts:281-284`, `291-295`). `send` sí. Una ingesta tardía puede poner `busy` a falso en la persona nueva.
8. `conversationDetail` vuelve a declarar la firma de `json` (`src/api/conversations.ts:58-61`) en vez de usar la del contexto.

## D. Veredicto

El refactor no altera autenticación, cuerpos ni textos en las rutas exactas que ya usaba la interfaz, y no abre datos de un usuario a otro. Sí cambia la API en los bordes: sin sesión un camino desconocido pasa de `401` a `404`, un segmento de más deja de ejecutar la ruta prefijo, y un id vacío casa y responde otro `404`.
