# 22 · Markdown en lector de documentos y chat

## Qué
`app/components/Markdown.tsx` — renderizador sin dependencias y sin `dangerouslySetInnerHTML`: parser por bloques (`#`/`##`/`###` → encabezados, `- `/`* ` → `<ul>`, `N. ` → `<ol>`, líneas consecutivas → `<p>`, línea vacía separa) con inline `**negrita**` y `` `código` `` (`code.inline-code`). `skipLeadingTitle` omite el primer h1 cuando coincide con el título del documento.

## Dónde
- `DocumentsTab`: el `<pre>` del lector pasa a `<Markdown>`; `.document-reader .markdown` hereda fuente 12px/1.6 con párrafos `0 0 12px`, h2 de sección 15px/600, listas `padding-left 20px` — misma legibilidad, con jerarquía.
- `ChatTab`: las burbujas usan el mismo renderer; en `.bubble` los párrafos van a `margin: 0` y el espacio solo aparece entre bloques (`> * + *`, 8px), listas compactas, encabezados reducidos a 12px/600.

## Verificación
`tests/markdown.test.ts` (renderToStaticMarkup): título omitido, párrafos unidos, ul/ol, bold+code inline, `<script>` escapado. `npm test` 61/61, `tsc`, prettier, `functional.mjs` OK.

## Capturas
`22-documentos-markdown.png` (Aurora · current fees), `22-chat-markdown.png` (conversación con propuesta en línea).
