#!/usr/bin/env python3
import re

CSS = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate/app/globals.css'

# literal -> token name (role-based)
MAP = {
    '#172b2b': '--color-ink',
    '#6d7d79': '--color-ink-muted',
    '#e1e7e1': '--color-line',
    '#faf9ef': '--color-bg',
    '#194f43': '--color-brand',
    '#f5d94b': '--color-accent',
    '#fff': '--color-surface',
    '#fffef7': '--color-chrome',
    '#fbefb0': '--color-accent-soft',
    '#324e49': '--color-control',
    '#54775c': '--color-focus',
    '#dfb72c': '--color-brand-dot',
    '#7a8b7f': '--color-demo-label',
    '#64746c': '--color-nav-text',
    '#edf1e8': '--color-nav-hover',
    '#f4dc63': '--color-badge',
    '#687e70': '--color-history-button',
    '#768078': '--color-conversation',
    '#eef1e9': '--color-conversation-active-bg',
    '#284e3d': '--color-conversation-active',
    '#8a9b8d': '--color-conversation-dot',
    '#536a5b': '--color-sidebar-bottom',
    '#6d9b59': '--color-live',
    '#95a096': '--color-mark',
    '#64726b': '--color-breadcrumb',
    '#a2aca0': '--color-breadcrumb-sep',
    '#739251': '--color-hello-dot',
    '#dce3d8': '--color-chip-bg',
    '#77836e': '--color-chip-text',
    '#d8e1d0': '--color-card-border',
    '#edf2dd': '--color-card-bg',
    '#e7c735': '--color-primary-accent',
    '#e1e5dc': '--color-assistant-border',
    '#fdfdf9': '--color-assistant-bg',
    '#dbe7d0': '--color-assistant-ring',
    '#f6f8f0': '--color-assistant-halo',
    '#e3ebda': '--color-assistant-halo-line',
    '#f9faf5': '--color-assistant-halo-outer',
    '#4d7456': '--color-sparkle',
    '#fdfefa': '--color-panel',
    '#849080': '--color-section-sub',
    '#eef0e9': '--color-movement-bg',
    '#f0f2ea': '--color-movement-icon-bg',
    '#7a8575': '--color-movement-icon',
    '#e5efdd': '--color-positive-bg',
    '#55815f': '--color-positive',
    '#94a08f': '--color-movement-meta',
    '#4e7b52': '--color-credit',
    '#e6ebdd': '--color-quick-border',
    '#103d33': '--color-primary-hover',
    '#d8e0d4': '--color-secondary-border',
    '#476351': '--color-secondary-text',
    '#e1e7db': '--color-support-border',
    '#739060': '--color-support-icon',
    '#6d7f6d': '--color-footer',
    '#92a08e': '--color-footer-sub',
    '#fcebe6': '--color-danger-bg',
    '#9c4335': '--color-danger',
    '#2c6642': '--color-success',
    '#d5e1ce': '--color-spinner-track',
    '#537f5a': '--color-spinner',
    '#edf0e7': '--color-chat-header',
    '#ebf1e2': '--color-avatar-bg',
    '#8a9785': '--color-chat-sub',
    '#718364': '--color-tag-text',
    '#f0f3e9': '--color-tag-bg',
    '#f4f6ef': '--color-bubble',
    '#99a18d': '--color-bubble-meta',
    '#244e43': '--color-bubble-user',
    '#b2c7bb': '--color-bubble-user-meta',
    '#e2e9dc': '--color-composer-border',
    '#294f42': '--color-composer-button',
    '#929c89': '--color-footnote',
    '#4f7556': '--color-sparkle-lg',
    '#e0e7d8': '--color-suggestion-border',
    '#fafbf7': '--color-suggestion-bg',
    '#58705b': '--color-suggestion-text',
    '#8a9882': '--color-thinking',
    '#829977': '--color-thinking-dot',
    '#697a61': '--color-label',
    '#dce4d5': '--color-select-border',
    '#304e40': '--color-select-text',
    '#99a18f': '--color-unit',
    '#66805d': '--color-transfer-note',
    '#d7e4cb': '--color-approval-bg',
    '#e9efe0': '--color-count-bg',
    '#e8ede3': '--color-case-item',
    '#edf3e5': '--color-case-item-active',
    '#93a08b': '--color-case-meta',
    '#849978': '--color-case-date',
    '#957b31': '--color-warning',
    '#f5edd4': '--color-warning-bg',
    '#f1f4e9': '--color-quote-bg',
    '#b6ca9e': '--color-quote-border',
    '#8b9884': '--color-muted-soft',
    '#879778': '--color-empty',
    '#dbe4d2': '--color-search-border',
    '#829573': '--color-search-icon',
    '#edf0e8': '--color-doc-item',
    '#6f8267': '--color-doc-item-text',
    '#eff5e7': '--color-doc-item-active',
    '#3e5e48': '--color-doc-title',
    '#5b705b': '--color-reader-text',
    '#dde6d4': '--color-result-border',
    '#fbfdf8': '--color-result-bg',
    '#8a9a80': '--color-result-meta',
    '#8a6d1a': '--color-finding',
    '#d8dce8': '--color-brief-border',
}
RADIUS = {
    '5px': '--radius-xs',
    '7px': '--radius-sm',
    '8px': '--radius-md',
    '10px': '--radius-lg',
    '15px': '--radius-xl',
    '12px': '--radius-2xl',
    '50%': '--radius-pill',
}

src = open(CSS).read()
m = re.search(r':root \{.*?\}\n', src, re.S)
assert m

decls = []
for lit, name in MAP.items():
    decls.append(f'  {name}: {lit};')
for val, name in RADIUS.items():
    decls.append(f'  {name}: {val};')
decls += [
    '  --ink: var(--color-ink);',
    '  --muted: var(--color-ink-muted);',
    '  --line: var(--color-line);',
    '  --paper: var(--color-bg);',
    '  --forest: var(--color-brand);',
    '  --lime: var(--color-accent);',
    '  --white: var(--color-surface);',
    '  --font: Arial, Helvetica, sans-serif;',
]
src = src[: m.start()] + ':root {\n' + '\n'.join(decls) + '\n}\n' + src[m.end():]

body = src[m.end():]
for lit, name in sorted(MAP.items(), key=lambda x: -len(x[0])):
    body = re.sub(re.escape(lit) + r'\b', f'var({name})', body)
for val, name in sorted(RADIUS.items(), key=lambda x: -len(x[0])):
    body = re.sub(rf'(border-radius: ){re.escape(val)}(;)', rf'\1var({name})\2', body)
src = src[: m.end()] + body
open(CSS, 'w').write(src)

left = [l for l in src.split('\n') if re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\(', l)]
print('literal lines remaining:', len(left))
for l in left[:10]:
    print(' ', l.strip()[:100])
