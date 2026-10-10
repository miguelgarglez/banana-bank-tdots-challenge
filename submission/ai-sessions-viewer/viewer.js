/* global d3, __SESSIONS_INDEX, __SESSION_DATA */
(function () {
  'use strict';
  const INDEX = window.__SESSIONS_INDEX || [];
  const DATA = () => window.__SESSION_DATA || {};
  const KINDS = ['user', 'assistant', 'thinking', 'tool_call', 'tool_result', 'system'];
  const KIND_ES = {
    user: 'usuario',
    assistant: 'asistente',
    thinking: 'pensamiento',
    tool_call: 'llamada',
    tool_result: 'resultado',
    system: 'sistema',
  };
  const AGENT_COLOR = { devin: '#1f3d35', codex: '#8ea4b8', cursor: '#b9a7d9' };
  const $ = (s) => document.querySelector(s);
  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDur = (ms) => {
    if (!ms && ms !== 0) return '—';
    const m = Math.round(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  };

  // --- estado ---
  let session = null;
  let selected = null;
  const visible = { thinking: true, tool_result: true, system: false };

  // --- cabecera / leyenda ---
  const totNodes = INDEX.reduce((a, s) => a + s.stats.nodes, 0);
  const totCalls = INDEX.reduce((a, s) => a + (s.stats.byKind.tool_call || 0), 0);
  const totMs = INDEX.reduce((a, s) => a + (s.stats.durationMs || 0), 0);
  $('#global-stats').textContent =
    `${INDEX.length} sesiones · ${totNodes} nodos · ${totCalls} llamadas a herramientas · ${fmtDur(totMs)} en total`;
  for (const k of KINDS) {
    const s = document.createElement('span');
    s.className = 'k';
    const d = document.createElement('span');
    d.className = `dot ${k}`;
    s.append(d, document.createTextNode(KIND_ES[k]));
    $('#legend').appendChild(s);
  }

  // --- línea de tiempo global ---
  const times = INDEX.map((s) => [Date.parse(s.startedAt), Date.parse(s.endedAt)])
    .flat()
    .filter(Number.isFinite);
  const t0 = Math.min(...times),
    t1 = Math.max(...times);
  const tl = $('#timeline');
  INDEX.forEach((s, i) => {
    const a = Date.parse(s.startedAt),
      b = Date.parse(s.endedAt);
    if (!Number.isFinite(a)) return;
    const bar = document.createElement('div');
    bar.className = `bar ${s.agent}`;
    bar.style.left = `${((a - t0) / (t1 - t0)) * 96 + 2}%`;
    bar.style.width = `${Math.max(1.5, ((b - a) / (t1 - t0)) * 96)}%`;
    bar.style.top = `${4 + i * Math.min(10, 44 / Math.max(1, INDEX.length))}px`;
    bar.title = `${s.title} (${fmtTime(s.startedAt)})`;
    bar.addEventListener('click', () => openSession(s.id));
    tl.appendChild(bar);
  });
  const axis = document.createElement('span');
  axis.className = 'axis';
  axis.style.left = '4px';
  axis.textContent = `${fmtTime(new Date(t0).toISOString())} → ${fmtTime(new Date(t1).toISOString())}`;
  tl.appendChild(axis);

  // --- lista de sesiones agrupada ---
  const groups = [
    ['Principal', (s) => s.role === 'principal'],
    ['Revisores independientes', (s) => s.role.startsWith('revisor')],
    ['Seguimiento', (s) => s.role === 'seguimiento'],
  ];
  const list = $('#session-list');
  for (const [name, pred] of groups) {
    const items = INDEX.filter(pred);
    if (!items.length) continue;
    const g = document.createElement('div');
    g.className = 'session-group';
    const h = document.createElement('h2');
    h.textContent = name;
    g.appendChild(h);
    for (const s of items) {
      const el = document.createElement('div');
      el.className = 'session-item';
      el.dataset.session = s.id;
      const t = document.createElement('div');
      t.className = 't';
      const tag = document.createElement('span');
      tag.className = 'agent-tag';
      tag.textContent = s.agent;
      tag.style.background = AGENT_COLOR[s.agent] || '#ccc';
      tag.style.color = '#fff';
      t.append(tag, document.createTextNode(s.title));
      const m = document.createElement('div');
      m.className = 'm';
      m.textContent = `${fmtTime(s.startedAt)} · ${fmtDur(s.stats.durationMs)} · ${s.stats.nodes} nodos · ${s.stats.byKind.tool_call || 0} llamadas`;
      el.append(t, m);
      el.addEventListener('click', () => openSession(s.id));
      g.appendChild(el);
    }
    list.appendChild(g);
  }

  // --- grafo ---
  const svg = d3.select('#graph');
  const root = svg.append('g');
  const zoom = d3
    .zoom()
    .scaleExtent([0.05, 6])
    .on('zoom', (e) => root.attr('transform', e.transform));
  svg.call(zoom);
  const linkGen = d3
    .linkHorizontal()
    .x((d) => d.x)
    .y((d) => d.y);
  let nodesById = new Map();
  let childOf = new Map();
  let posOf = new Map();
  let laneY = new Map();
  const ROW = 30,
    STEP = 28,
    X0 = 60,
    Y0 = 40;

  const isVis = (n) =>
    n.kind === 'user' || n.kind === 'assistant' || n.kind === 'tool_call' || visible[n.kind];
  const visParent = (n) => {
    let p = n.parent;
    while (p) {
      const pn = nodesById.get(p);
      if (!pn) return null;
      if (isVis(pn)) return p;
      p = pn.parent;
    }
    return null;
  };

  function loadSession(id) {
    const entry = INDEX.find((s) => s.id === id);
    if (DATA()[id]) return Promise.resolve(DATA()[id]);
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = entry.file;
      sc.onload = () => res(DATA()[id]);
      sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }

  function openSession(id, nodeId) {
    const t0p = performance.now();
    loadSession(id).then((s) => {
      session = s;
      selected = null;
      document
        .querySelectorAll('.session-item')
        .forEach((el) => el.classList.toggle('active', el.dataset.session === id));
      renderGraph();
      renderDetail(null);
      applySearch();
      if (nodeId && nodesById.has(nodeId)) selectNode(nodesById.get(nodeId), true);
      fit();
      window.__lastLoadMs = Math.round(performance.now() - t0p);
      history.replaceState(null, '', `#session=${id}`);
    });
  }

  function renderGraph() {
    root.selectAll('*').remove();
    nodesById = new Map(session.nodes.map((n) => [n.id, n]));
    childOf = new Map();
    laneY = new Map();
    session.lanes.forEach((l, i) => laneY.set(l.id, Y0 + i * ROW + 14));
    posOf = new Map(
      session.nodes.map((n) => [n.id, { x: X0 + n.seq * STEP, y: laneY.get(n.lane) }]),
    );
    for (const n of session.nodes) {
      if (n.parent != null) {
        if (!childOf.has(n.parent)) childOf.set(n.parent, []);
        childOf.get(n.parent).push(n.id);
      }
    }
    const W = X0 + session.nodes.length * STEP + 80;
    const H = Y0 + session.lanes.length * ROW + 60;

    const bands = root.append('g');
    session.lanes.forEach((l, i) => {
      bands
        .append('rect')
        .attr('class', 'lane-band')
        .attr('x', 0)
        .attr('width', W)
        .attr('y', Y0 + i * ROW)
        .attr('height', ROW);
      bands
        .append('text')
        .attr('class', 'lane-label')
        .attr('x', 8)
        .attr('y', laneY.get(l.id) + 4)
        .text(l.label);
    });

    const chapters = root.append('g').attr('class', 'chapters');
    for (const n of session.nodes) {
      if (n.lane !== 'main' || n.kind !== 'user') continue;
      const p = posOf.get(n.id);
      const g = chapters
        .append('g')
        .attr('class', 'chapter')
        .style('cursor', 'pointer')
        .on('click', () => {
          selectNode(n);
          centerNode(n);
        });
      g.append('line')
        .attr('x1', p.x)
        .attr('x2', p.x)
        .attr('y1', 8)
        .attr('y2', H - 20);
      g.append('text')
        .attr('x', p.x + 3)
        .attr('y', 16)
        .text((n.text || '').slice(0, 40));
    }

    const links = root.append('g').attr('class', 'links');
    window.__linkEls = links;
    const nodeG = root
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g.node')
      .data(session.nodes)
      .join('g')
      .attr(
        'class',
        (n) =>
          `node k-${n.kind}` +
          (n.kind === 'tool_result' && n.result && n.result.success === false
            ? ' result-false'
            : ''),
      )
      .attr('transform', (n) => `translate(${posOf.get(n.id).x},${posOf.get(n.id).y})`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .on('click', (e, n) => selectNode(n, true))
      .on('keydown', (e, n) => {
        if (e.key === 'Enter') selectNode(n, true);
      });
    nodeG.append('circle').attr('r', (n) => (n.kind === 'tool_result' ? 5 : 7));
    nodeG.append('title').text((n) => `${KIND_ES[n.kind]} · ${n.title}`);
    window.__nodeEls = nodeG;
    drawLinks();
    applyFilters();
    svg.attr('viewBox', null);
  }

  function drawLinks() {
    const data = session.lanes
      .filter((l) => l.forkNodeId != null)
      .map((l) => {
        const firstVis = session.nodes.find((n) => n.lane === l.id && isVis(n));
        if (!firstVis) return null;
        return { s: posOf.get(l.forkNodeId), t: posOf.get(firstVis.id), cross: true, forkOf: l.id };
      })
      .filter(Boolean);
    for (const n of session.nodes) {
      const p = visParent(n);
      if (!p) continue;
      data.push({ s: posOf.get(p), t: posOf.get(n.id), cross: nodesById.get(p).lane !== n.lane });
    }
    __linkEls
      .selectAll('path')
      .data(data)
      .join('path')
      .attr('class', (d) => `link${d.cross ? ' fork' : ''}`)
      .attr('d', (d) => linkGen({ source: d.s, target: d.t }));
  }

  function applyFilters() {
    __nodeEls.style('display', (n) => (isVis(n) ? null : 'none'));
    drawLinks();
  }
  ['thinking', 'tool_result', 'system'].forEach((k) => {
    $(`#f-${k}`).addEventListener('change', (e) => {
      visible[k] = e.target.checked;
      applyFilters();
    });
  });

  function fit() {
    if (!session) return;
    const b = root.node().getBBox();
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    const k = Math.min(cw / b.width, ch / b.height, 1) * 0.95;
    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(cw / 2 - (b.x + b.width / 2) * k, ch / 2 - (b.y + b.height / 2) * k)
        .scale(k),
    );
  }
  $('#fit').addEventListener('click', fit);

  function centerNode(n) {
    const p = posOf.get(n.id);
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    const k = d3.zoomTransform(svg.node()).k;
    svg
      .transition()
      .duration(400)
      .call(zoom.transform, d3.zoomIdentity.translate(cw / 2 - p.x * k, ch / 2 - p.y * k).scale(k));
  }

  function selectNode(n, center) {
    selected = n;
    __nodeEls.classed('selected', (d) => d === n);
    renderDetail(n);
    if (center) centerNode(n);
    history.replaceState(null, '', `#session=${session.id}&node=${n.id}`);
  }

  function renderDetail(n) {
    const head = $('#detail-head'),
      nav = $('#detail-nav'),
      body = $('#detail-body');
    body.textContent = '';
    if (!n) {
      head.innerHTML = '';
      const e = document.createElement('div');
      e.id = 'detail-empty';
      e.textContent = session
        ? 'Selecciona un nodo del grafo.'
        : 'Selecciona una sesión y un nodo.';
      head.appendChild(e);
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    head.textContent = '';
    const k = document.createElement('div');
    k.className = 'kind';
    k.textContent = KIND_ES[n.kind];
    const meta = document.createElement('div');
    meta.className = 'meta';
    const next = session.nodes[n.seq + 1];
    const dur =
      n.t && next && next.t
        ? ` · +${Math.max(0, Math.round((Date.parse(next.t) - Date.parse(n.t)) / 1000))} s`
        : '';
    const lane = session.lanes.find((l) => l.id === n.lane);
    meta.textContent =
      `${lane ? lane.label : n.lane} · ${fmtTime(n.t)}${dur}` +
      (n.tokens ? ` · ${n.tokens} tokens` : '') +
      ` · #${n.seq}`;
    head.append(k, meta);

    if (n.images) {
      const im = document.createElement('p');
      im.textContent = `${n.images} imágenes adjuntas`;
      body.appendChild(im);
    }
    if (n.tool) {
      const h = document.createElement('div');
      h.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = n.tool.name;
      h.appendChild(b);
      const pre = document.createElement('pre');
      pre.className = 'args';
      pre.textContent = JSON.stringify(n.tool.args, null, 2);
      body.append(h, pre);
    }
    if (n.kind === 'tool_result' && n.result) {
      const r = document.createElement('p');
      const s = document.createElement('span');
      const ok = n.result.success;
      s.className = ok === false ? 'ko' : 'ok';
      s.textContent = ok === false ? 'falló' : ok === true ? 'éxito' : 'resultado';
      r.append(s, document.createTextNode(n.result.kind ? ` · ${n.result.kind}` : ''));
      body.appendChild(r);
    }
    if (n.text) {
      const pre = document.createElement('pre');
      pre.textContent = n.text;
      body.appendChild(pre);
    }
  }
  $('#nav-parent').addEventListener('click', () => {
    let p = selected && selected.parent;
    while (p && !isVis(nodesById.get(p))) p = nodesById.get(p) && nodesById.get(p).parent;
    if (p) selectNode(nodesById.get(p), true);
  });
  $('#nav-child').addEventListener('click', () => {
    if (!selected) return;
    const kids = (childOf.get(selected.id) || []).filter((id) => isVis(nodesById.get(id)));
    if (kids.length) selectNode(nodesById.get(kids[0]), true);
  });
  $('#copy-link').addEventListener('click', () => {
    const url = `${location.origin === 'null' ? location.href.split('#')[0] : location.href.split('#')[0]}#session=${session.id}&node=${selected ? selected.id : ''}`;
    const done = () => {
      $('#copy-link').textContent = 'Copiado';
      setTimeout(() => ($('#copy-link').textContent = 'Copiar enlace'), 1200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done);
    else {
      location.hash = `session=${session.id}&node=${selected ? selected.id : ''}`;
      done();
    }
  });

  // --- búsqueda ---
  function applySearch() {
    if (!session) return;
    const q = $('#search').value.trim().toLowerCase();
    let hits = 0;
    __nodeEls.classed('hit', (n) => {
      const m =
        q &&
        ((n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q));
      if (m) hits++;
      return !!m;
    });
    $('#search-status').textContent = q ? `${hits} coincidencias` : '';
  }
  $('#search').addEventListener('input', applySearch);

  // --- hash inicial ---
  const h = new URLSearchParams(location.hash.slice(1));
  const sid = h.get('session');
  if (sid && INDEX.some((s) => s.id === sid)) openSession(sid, h.get('node'));
  else {
    const main = INDEX.find((s) => s.role === 'principal') || INDEX[0];
    if (main) openSession(main.id);
  }
})();
