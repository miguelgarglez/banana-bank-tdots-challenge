#!/usr/bin/env node
// build-sessions-viewer.mjs <ai-sessions-dir> <out-dir>
// Normaliza los exports de submission/ai-sessions/ en ficheros data/*.js
// consumibles por el visor (index.html + viewer.js + viewer.css + vendor/d3).
// Node sin dependencias. Falla si los recuentos de nodos no cuadran con la fuente.
import fs from 'node:fs';
import path from 'node:path';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('uso: node build-sessions-viewer.mjs <ai-sessions-dir> <out-dir>');
  process.exit(1);
}
const srcDir = path.join(outDir, 'src');
const dataDir = path.join(outDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'vendor'), { recursive: true });

const clip = (s, n = 90) => {
  s = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const firstStringArg = (args) => {
  if (args == null) return '';
  if (typeof args === 'string') return args;
  if (typeof args === 'object') {
    for (const v of Object.values(args)) if (typeof v === 'string') return v;
  }
  return '';
};
const toolTitle = (name, args) => clip(`${name}(${clip(firstStringArg(args), 40)})`, 90);

function newSession(id, agent, title, startedAt, endedAt) {
  return {
    id,
    agent,
    title,
    startedAt,
    endedAt,
    lanes: [],
    nodes: [],
    stats: { nodes: 0, byKind: {}, byTool: {}, userTurns: 0, durationMs: 0 },
  };
}
function finishSession(sess, laneOrder) {
  const byId = new Map(sess.nodes.map((n) => [n.id, n]));
  const laneOf = new Map();
  for (const n of sess.nodes) laneOf.set(n.id, n.lane);
  for (const lane of sess.lanes) {
    const first = sess.nodes.find((n) => n.lane === lane.id);
    let fork =
      first && first.parent != null
        ? first
        : sess.nodes.find(
            (n) => n.lane === lane.id && n.parent != null && laneOf.get(n.parent) !== lane.id,
          );
    if (fork && fork.parent != null && laneOf.get(fork.parent) !== lane.id) {
      lane.parentLane = laneOf.get(fork.parent);
      lane.forkNodeId = fork.parent;
    }
  }
  sess.lanes.sort((a, b) => {
    const rank = (l) => (l.id === 'main' ? 0 : l.id === 'sidekick' ? 1 : 2);
    const d = rank(a) - rank(b);
    if (d) return d;
    return (laneOrder.get(a.id) ?? 0) - (laneOrder.get(b.id) ?? 0);
  });
  for (const n of sess.nodes) {
    sess.stats.nodes++;
    sess.stats.byKind[n.kind] = (sess.stats.byKind[n.kind] || 0) + 1;
    if (n.tool) sess.stats.byTool[n.tool.name] = (sess.stats.byTool[n.tool.name] || 0) + 1;
    if (n.kind === 'user') sess.stats.userTurns++;
  }
  const times = sess.nodes
    .map((n) => n.t)
    .filter(Boolean)
    .sort();
  if (times.length > 1)
    sess.stats.durationMs = Date.parse(times[times.length - 1]) - Date.parse(times[0]);
  else if (sess.startedAt && sess.endedAt)
    sess.stats.durationMs = Date.parse(sess.endedAt) - Date.parse(sess.startedAt);
  return sess;
}

function normalizeDevin(dir, id) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8'));
  const sess = newSession(id, 'devin', meta.title || id, meta.created_at, meta.last_activity_at);
  const lastForRaw = new Map();
  const toolCallIds = new Map();
  const laneOrder = new Map();
  const laneLabel = (c) =>
    c === 'main'
      ? 'principal'
      : c === 'sidekick'
        ? 'subagente sidekick'
        : `rama ${c.split('@')[1]}`;
  const ensureLane = (c) => {
    if (!laneOrder.has(c)) {
      laneOrder.set(c, sess.nodes.length);
      sess.lanes.push({ id: c, label: laneLabel(c) });
    }
  };
  let seq = 0;
  const push = (rawId, lane, kind, fields, parentOverride, rawParent) => {
    const eid = `n${seq}`;
    const parent =
      parentOverride !== undefined
        ? parentOverride
        : (lastForRaw.get(rawId) ?? lastForRaw.get(rawParent) ?? null);
    const node = {
      id: eid,
      parent,
      lane,
      t: fields.t,
      seq: seq++,
      kind,
      title: fields.title ?? clip(fields.text),
      text: fields.text ?? '',
    };
    if (fields.tool) node.tool = fields.tool;
    if (fields.result) node.result = fields.result;
    if (fields.tokens != null) node.tokens = fields.tokens;
    if (fields.images) node.images = fields.images;
    sess.nodes.push(node);
    lastForRaw.set(rawId, eid);
    return eid;
  };
  const exp = { user: 0, assistant: 0, thinking: 0, tool_call: 0, tool_result: 0, system: 0 };
  for (const line of fs.readFileSync(path.join(dir, 'nodes.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line);
    const m = raw.message || {};
    const lane = raw.chain || 'main';
    ensureLane(lane);
    const md = m.metadata || {};
    const ext = md.extensions || {};
    const t = md.created_at || raw.created_at || null;
    const tokens = md.num_tokens ?? undefined;
    const base = { t, tokens };
    if (m.role === 'system') {
      exp.system++;
      push(
        raw.node_id,
        lane,
        'system',
        { ...base, text: m.content || '' },
        undefined,
        raw.parent_node_id,
      );
    } else if (m.role === 'user') {
      exp.user++;
      push(
        raw.node_id,
        lane,
        'user',
        {
          ...base,
          text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          images: Array.isArray(m.images) ? m.images.length : 0,
        },
        undefined,
        raw.parent_node_id,
      );
    } else if (m.role === 'assistant') {
      const thinking =
        m.thinking && typeof m.thinking.thinking === 'string' ? m.thinking.thinking : '';
      const content = typeof m.content === 'string' ? m.content : '';
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      exp.thinking += thinking.trim() ? 1 : 0;
      exp.assistant += content.trim() || (!thinking.trim() && !calls.length) ? 1 : 0;
      exp.tool_call += calls.length;
      if (thinking.trim())
        push(
          raw.node_id,
          lane,
          'thinking',
          { ...base, text: thinking },
          undefined,
          raw.parent_node_id,
        );
      if (content.trim() || (!thinking.trim() && !calls.length))
        push(
          raw.node_id,
          lane,
          'assistant',
          { ...base, text: content },
          undefined,
          raw.parent_node_id,
        );
      calls.forEach((c) => {
        const eid = push(
          raw.node_id,
          lane,
          'tool_call',
          {
            ...base,
            title: toolTitle(c.name, c.arguments),
            text: '',
            tool: { name: c.name, args: c.arguments },
          },
          undefined,
          raw.parent_node_id,
        );
        if (c.id) toolCallIds.set(c.id, eid);
      });
    } else if (m.role === 'tool') {
      const meta2 = ext['chisel/tool_result_meta'] || {};
      const parent = toolCallIds.get(m.tool_call_id) ?? lastForRaw.get(raw.parent_node_id) ?? null;
      exp.tool_result++;
      push(
        raw.node_id,
        lane,
        'tool_result',
        {
          ...base,
          text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          result: { success: meta2.success, kind: meta2.kind },
        },
        parent,
        raw.parent_node_id,
      );
    } else {
      exp.system++;
      push(
        raw.node_id,
        lane,
        'system',
        { ...base, text: JSON.stringify(m).slice(0, 4000) },
        undefined,
        raw.parent_node_id,
      );
    }
  }
  finishSession(sess, laneOrder);
  for (const k of Object.keys(exp))
    if ((sess.stats.byKind[k] || 0) !== exp[k])
      throw new Error(`${id}: kind ${k} emitidos=${sess.stats.byKind[k] || 0} != fuente ${exp[k]}`);
  return sess;
}

function normalizeCodex(file, id) {
  let startedAt = null,
    endedAt = null,
    cwd = '';
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const sess = newSession(id, 'codex', `revisión Codex ${id.slice(0, 8)}`, null, null);
  sess.lanes.push({ id: 'main', label: 'principal' });
  const laneOrder = new Map([['main', 0]]);
  const callMap = new Map();
  let seq = 0,
    prev = null,
    srcItems = 0;
  const push = (kind, fields, parent) => {
    const node = {
      id: `n${seq}`,
      parent: parent === undefined ? prev : parent,
      lane: 'main',
      t: fields.t,
      seq: seq++,
      kind,
      title: fields.title ?? clip(fields.text),
      text: fields.text ?? '',
    };
    if (fields.tool) node.tool = fields.tool;
    if (fields.result) node.result = fields.result;
    sess.nodes.push(node);
    prev = node.id;
    return node.id;
  };
  for (const line of lines) {
    const o = JSON.parse(line);
    const t = o.timestamp || null;
    if (t) {
      if (!startedAt || t < startedAt) startedAt = t;
      if (!endedAt || t > endedAt) endedAt = t;
    }
    if (o.type === 'session_meta') {
      cwd = o.payload?.cwd || cwd;
      continue;
    }
    if (o.type !== 'response_item') continue;
    const p = o.payload || {};
    srcItems++;
    const textOf = (c) =>
      Array.isArray(c)
        ? c
            .map((x) => x && (x.text || x.summary_text || ''))
            .filter(Boolean)
            .join('\n')
        : String(c ?? '');
    if (p.type === 'message') {
      const text = textOf(p.content);
      const kind = p.role === 'developer' ? 'system' : p.role === 'user' ? 'user' : 'assistant';
      push(kind, { t, text });
    } else if (p.type === 'reasoning') {
      const text =
        (p.summary || [])
          .map((s) => s.summary_text || s.text || '')
          .filter(Boolean)
          .join('\n') || '[razonamiento cifrado]';
      push('thinking', { t, text });
    } else if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const args = p.input ?? p.arguments;
      const eid = push('tool_call', {
        t,
        title: toolTitle(p.name, args),
        tool: { name: p.name, args: typeof args === 'string' ? { input: args } : args },
      });
      if (p.call_id) callMap.set(p.call_id, eid);
    } else if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      push(
        'tool_result',
        {
          t,
          text: Array.isArray(p.output)
            ? p.output
                .map((x) => x.text || '')
                .filter(Boolean)
                .join('\n')
            : String(p.output ?? ''),
        },
        callMap.get(p.call_id) ?? prev,
      );
    } else {
      srcItems--;
    }
  }
  sess.startedAt = startedAt;
  sess.endedAt = endedAt;
  sess.cwd = cwd;
  finishSession(sess, laneOrder);
  if (sess.nodes.length !== srcItems)
    throw new Error(`${id}: nodos=${sess.nodes.length} != items fuente ${srcItems}`);
  return sess;
}

function normalizeCursor(dir, id) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const sess = newSession(
    id,
    'cursor',
    `revisión Cursor (Grok) ${id.slice(0, 8)}`,
    meta.createdAtMs ? new Date(meta.createdAtMs).toISOString() : null,
    meta.updatedAtMs ? new Date(meta.updatedAtMs).toISOString() : null,
  );
  sess.lanes.push({ id: 'main', label: 'principal' });
  const laneOrder = new Map([['main', 0]]);
  const callMap = new Map();
  let seq = 0,
    prev = null,
    srcExpected = 0;
  const push = (kind, fields, parent) => {
    const node = {
      id: `n${seq}`,
      parent: parent === undefined ? prev : parent,
      lane: 'main',
      t: null,
      seq: seq++,
      kind,
      title: fields.title ?? clip(fields.text),
      text: fields.text ?? '',
    };
    if (fields.tool) node.tool = fields.tool;
    sess.nodes.push(node);
    prev = node.id;
    return node.id;
  };
  for (const line of fs.readFileSync(path.join(dir, 'messages.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const m = JSON.parse(line);
    const c = m.content;
    if (m.role === 'protobuf-text') {
      srcExpected++;
      push('system', {
        title: clip(
          `bloque decodificado (store.db) · ${(Array.isArray(c) ? c : [c]).length} fragmentos`,
        ),
        text: (Array.isArray(c) ? c : [c]).join('\n\n'),
      });
      continue;
    }
    if (typeof c === 'string') {
      srcExpected++;
      push(m.role === 'system' ? 'system' : 'user', { text: c });
      continue;
    }
    for (const part of Array.isArray(c) ? c : []) {
      if (typeof part !== 'object') continue;
      srcExpected++;
      if (m.role === 'assistant' && part.type === 'reasoning') {
        push('thinking', { text: part.text || '[razonamiento firmado, sin texto]' });
      } else if (m.role === 'assistant' && part.type === 'tool-call') {
        const eid = push('tool_call', {
          title: toolTitle(part.toolName || part.name, part.input ?? part.args),
          tool: { name: part.toolName || part.name, args: part.input ?? part.args },
        });
        if (part.toolCallId) callMap.set(part.toolCallId, eid);
      } else if (m.role === 'tool' || part.type === 'tool-result') {
        push(
          'tool_result',
          {
            text: part.result ?? part.text ?? JSON.stringify(part),
          },
          callMap.get(part.toolCallId) ?? prev,
        );
      } else {
        push(m.role === 'user' ? 'user' : 'assistant', { text: part.text ?? '' });
      }
    }
  }
  finishSession(sess, laneOrder);
  if (sess.nodes.length !== srcExpected)
    throw new Error(`${id}: nodos=${sess.nodes.length} != partes fuente ${srcExpected}`);
  return sess;
}

// --- sesiones ---
const manifest = JSON.parse(fs.readFileSync(path.join(inDir, 'manifest.json'), 'utf8'));
const sessions = [];
for (const s of manifest.sessions) {
  let norm;
  if (s.agent === 'devin') norm = normalizeDevin(path.join(inDir, s.path), s.id);
  else if (s.agent === 'codex') norm = normalizeCodex(path.join(inDir, s.path), s.id);
  else if (s.agent === 'cursor') norm = normalizeCursor(path.join(inDir, s.path), s.id);
  else continue;
  norm._entry = {
    id: s.id,
    agent: s.agent,
    title: norm.title,
    cwd: s.cwd || norm.cwd || '',
    startedAt: norm.startedAt || s.start,
    endedAt: norm.endedAt || s.end,
    model: s.model || '',
    stats: norm.stats,
  };
  sessions.push(norm);
}
// roles
const reviewers = sessions
  .filter((s) => s.agent !== 'devin')
  .sort((a, b) => Date.parse(a._entry.startedAt) - Date.parse(b._entry.startedAt));
sessions.forEach((s) => {
  if (s.agent === 'devin') s._entry.role = s.id === 'righteous-nest' ? 'principal' : 'seguimiento';
  else s._entry.role = `revisor independiente · ronda ${reviewers.indexOf(s) + 1}`;
});

const index = [];
for (const s of sessions) {
  const file = `data/${s.agent}-${s.id.replace(/[^A-Za-z0-9_-]/g, '_')}.js`;
  fs.writeFileSync(
    path.join(outDir, file),
    `window.__SESSION_DATA = window.__SESSION_DATA || {};\nwindow.__SESSION_DATA[${JSON.stringify(s.id)}] = ${JSON.stringify({ ...s, _entry: undefined })};\n`,
  );
  index.push({ ...s._entry, file });
  console.log(
    `${s.agent} ${s.id}: ${s.stats.nodes} nodos, ${s.stats.byKind.tool_call || 0} llamadas, ${s.lanes.length} calles`,
  );
}
fs.writeFileSync(
  path.join(dataDir, 'index.js'),
  `window.__SESSIONS_INDEX = ${JSON.stringify(index, null, 1)};\nwindow.__SESSION_DATA = window.__SESSION_DATA || {};\n`,
);

// --- visor + vendor ---
for (const f of ['index.html', 'viewer.js', 'viewer.css']) {
  const src = path.join(srcDir, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, f));
}
const d3Candidates = [
  '/Users/miguelgarglez/Developer/hackathon-tdots/tools/node_modules/d3/dist/d3.min.js',
  path.join(process.cwd(), 'node_modules/d3/dist/d3.min.js'),
];
const d3lic = [
  '/Users/miguelgarglez/Developer/hackathon-tdots/tools/node_modules/d3/LICENSE',
  path.join(process.cwd(), 'node_modules/d3/LICENSE'),
];
const d3src = d3Candidates.find((p) => fs.existsSync(p));
if (!d3src) throw new Error('no encuentro d3 (npm i d3@7 en tools/)');
fs.copyFileSync(d3src, path.join(outDir, 'vendor/d3.v7.min.js'));
const licsrc = d3lic.find((p) => fs.existsSync(p));
if (licsrc) fs.copyFileSync(licsrc, path.join(outDir, 'vendor/d3.LICENSE'));
console.log(`index: ${index.length} sesiones → ${outDir}`);
