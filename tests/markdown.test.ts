import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown, parseMarkdown } from '../app/components/Markdown';

const render = (text: string, skipLeadingTitle?: string) =>
  renderToStaticMarkup(createElement(Markdown, { text, skipLeadingTitle }));

test('block parsing: headings, paragraphs and lists', () => {
  const blocks = parseMarkdown(
    '# Title\n\nFirst **para**\nsecond line\n\n- one\n- two\n\n1. a\n2. b',
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'p', 'ul', 'ol'],
  );
  assert.equal(blocks[0].type === 'heading' && blocks[0].text, 'Title');
  assert.equal(blocks[1].type === 'p' && blocks[1].text, 'First **para** second line');
  assert.deepEqual(blocks[2].type === 'ul' && blocks[2].items, ['one', 'two']);
});

test('skipLeadingTitle drops the first h1 when it matches', () => {
  const html = render('# Fees\n\nBody text.', 'fees');
  assert.ok(!html.includes('Fees'));
  assert.ok(html.includes('Body text.'));
  const kept = render('# Other\n\nBody text.', 'fees');
  assert.ok(kept.includes('Other'));
});

test('inline bold and code render safely', () => {
  const html = render('Use code **7F3A2B** or `confirm 7F3A2B` now.');
  assert.ok(html.includes('<strong>7F3A2B</strong>'));
  assert.ok(html.includes('<code class="inline-code">confirm 7F3A2B</code>'));
});

test('raw HTML in the text is escaped', () => {
  const html = render('Hello <script>alert(1)</script> world.');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
