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
  const visible = { thinking: false, tool_result: true, system: false };

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
    .scaleExtent([0.02, 6])
    .on('zoom', (e) => {
      root.attr('transform', e.transform);
      updateChapters();
      drawMinimap();
    });
  svg.call(zoom);
  const linkGen = d3
    .linkHorizontal()
    .x((d) => d.x)
    .y((d) => d.y);
  let nodesById = new Map();
  let childOf = new Map();
  let posOf = new Map();
  let rowLanes = []; // calles con fila propia
  let laneY = new Map();
  let bigLane = new Set();
  let clusterInfo = [];
  const ROW = 56,
    STEP = 16,
    TWIG_STEP = 12,
    TWIG_DY = 22,
    STACK_DY = 14,
    X0 = 60,
    TOP = 30;

  const isVis = (n) =>
    n.kind === 'user' || n.kind === 'assistant' || n.kind === 'tool_call' || !!visible[n.kind];
  const visParentId = (n) => {
    let p = n.parent;
    while (p) {
      const pn = nodesById.get(p);
      if (!pn) return null;
      if (isVis(pn)) return p;
      p = pn.parent;
    }
    return null;
  };

  // posición x del ancestro visible más cercano (para anclar calles/ramitas)
  const anchorX = (nodeId) => {
    let p = nodeId;
    const seen = new Set();
    while (p && !seen.has(p)) {
      seen.add(p);
      if (posOf.has(p)) return posOf.get(p).x;
      const pn = nodesById.get(p);
      p = pn ? pn.parent : null;
    }
    return null;
  };
  const anchorPos = (nodeId) => {
    let p = nodeId;
    const seen = new Set();
    while (p && !seen.has(p)) {
      seen.add(p);
      if (posOf.has(p)) return posOf.get(p);
      const pn = nodesById.get(p);
      p = pn ? pn.parent : null;
    }
    return null;
  };

  function buildLayout() {
    posOf = new Map();
    laneY = new Map();
    clusterInfo = [];
    const laneNodes = new Map();
    for (const l of session.lanes)
      laneNodes.set(
        l.id,
        session.nodes.filter((n) => n.lane === l.id && isVis(n)),
      );
    bigLane = new Set(
      session.lanes.filter((l) => (laneNodes.get(l.id) || []).length >= 20).map((l) => l.id),
    );

    // orden de filas: main, sidekick, luego grandes por x de bifurcación
    const laneOrderMap = new Map(
      session.lanes.map((l) => [l.id, session.nodes.findIndex((n) => n.lane === l.id)]),
    );
    const laneOrderOf = (l) => laneOrderMap.get(l.id) ?? 0;
    rowLanes = session.lanes
      .filter((l) => bigLane.has(l.id))
      .sort((a, b) => {
        const rank = (l) => (l.id === 'main' ? 0 : l.id === 'sidekick' ? 1 : 2);
        const d = rank(a) - rank(b);
        if (d) return d;
        const pa = anchorX(a.forkNodeId) ?? 0,
          pb = anchorX(b.forkNodeId) ?? 0;
        return pa - pb || laneOrderOf(a) - laneOrderOf(b);
      });
    rowLanes.forEach((l, i) => laneY.set(l.id, TOP + i * ROW + ROW / 2));

    // pasada 1: main coloca su eje x
    const vis = (l) => laneNodes.get(l.id) || [];
    const main = rowLanes.find((l) => l.id === 'main') || rowLanes[0];
    if (main)
      vis(main).forEach((n, i) => posOf.set(n.id, { x: X0 + i * STEP, y: laneY.get(main.id) }));

    // pasada 2: resto de calles con fila, ancladas en la x de su bifurcación
    for (const l of rowLanes) {
      if (l === main) continue;
      const xs = l.forkNodeId != null ? anchorX(l.forkNodeId) : null;
      const xStart = (xs ?? X0) + STEP;
      vis(l).forEach((n, i) => posOf.set(n.id, { x: xStart + i * STEP, y: laneY.get(l.id) }));
    }

    // pasada 3: ramitas (calles pequeñas) bajo su bifurcación
    const occupied = new Map(); // lanePadre -> [ [ [x0,x1]x3 ] ]
    const small = session.lanes.filter((l) => !bigLane.has(l.id));
    const pending = [];
    for (const l of small) {
      const nodes = vis(l);
      if (!nodes.length) continue;
      const anchor = l.forkNodeId != null ? anchorPos(l.forkNodeId) : null;
      const parentLane = anchor
        ? posLane(anchor)
        : l.parentLane && laneY.has(l.parentLane)
          ? l.parentLane
          : main && main.id;
      if (!laneY.has(parentLane)) {
        pending.push({ lane: l, anchor, parentLane });
        continue;
      }
      placeTwig(l, nodes, anchor, parentLane);
    }
    // las que quedaron sin fila padre: agrupadas en un clúster bajo main
    if (pending.length) {
      const y = laneY.get(main ? main.id : rowLanes[0].id) + TWIG_DY + 3 * STACK_DY;
      const x = (pending[0].anchor ? pending[0].anchor.x : X0) + 40;
      clusterInfo.push({
        x,
        y,
        lanes: pending.map((p) => p.lane.id),
        nodes: pending.flatMap((p) => vis(p.lane)),
      });
    }

    function posLane(p) {
      for (const [id, y] of laneY) if (Math.abs(y - p.y) < ROW / 2) return id;
      return null;
    }
    function placeTwig(l, nodes, anchor, parentLane) {
      const baseX = anchor ? anchor.x : X0;
      const x0 = baseX + STEP,
        x1 = x0 + nodes.length * TWIG_STEP;
      const occ = occupied.get(parentLane) || [[], [], []];
      let level = -1;
      for (let lv = 0; lv < 3; lv++) {
        if (!occ[lv].some(([a, b]) => x0 < b + 8 && x1 > a - 8)) {
          level = lv;
          break;
        }
      }
      if (level === -1) {
        pending.push({ lane: l, anchor, parentLane });
        return;
      }
      occ[level].push([x0, x1]);
      occupied.set(parentLane, occ);
      const y = laneY.get(parentLane) + TWIG_DY + level * STACK_DY;
      nodes.forEach((n, i) => posOf.set(n.id, { x: x0 + i * TWIG_STEP, y, twig: true }));
    }
  }

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
      if (nodeId && nodesById.has(nodeId)) {
        selectNode(nodesById.get(nodeId));
        centerNode(nodesById.get(nodeId), 1);
      } else {
        const firstUser = session.nodes.find(
          (n) => n.lane === 'main' && n.kind === 'user' && isVis(n),
        );
        if (firstUser) centerNode(firstUser, 1);
        else zoom1();
      }
      window.__lastLoadMs = Math.round(performance.now() - t0p);
      history.replaceState(null, '', `#session=${id}`);
    });
  }

  const tooltip = $('#tooltip');
  function showTip(e, html) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const r = $('#center').getBoundingClientRect();
    let x = e.clientX - r.left + 12,
      y = e.clientY - r.top + 12;
    if (x + 330 > r.width) x = e.clientX - r.left - 330;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  const hideTip = () => {
    tooltip.hidden = true;
  };
  const tipHtml = (n) => {
    const lane = session.lanes.find((l) => l.id === n.lane);
    return `<span class="tk">${KIND_ES[n.kind]}</span> · ${lane ? lane.label : n.lane} · ${fmtTime(n.t)}<br>${escapeHtml(n.title || '')}`;
  };
  const escapeHtml = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function renderGraph() {
    root.selectAll('*').remove();
    nodesById = new Map(session.nodes.map((n) => [n.id, n]));
    childOf = new Map();
    for (const n of session.nodes) {
      if (n.parent != null) {
        if (!childOf.has(n.parent)) childOf.set(n.parent, []);
        childOf.get(n.parent).push(n.id);
      }
    }
    // tool_call con resultado fallido → borde rojo
    const failedCalls = new Set();
    for (const n of session.nodes)
      if (n.kind === 'tool_result' && n.result && n.result.success === false && n.parent != null)
        failedCalls.add(n.parent);

    buildLayout();

    // bandas de calle
    const bands = root.append('g');
    rowLanes.forEach((l, i) => {
      bands
        .append('rect')
        .attr('class', 'lane-band')
        .attr('x', 0)
        .attr('width', graphW())
        .attr('y', TOP + i * ROW)
        .attr('height', ROW);
      bands
        .append('text')
        .attr('class', 'lane-label')
        .attr('x', 8)
        .attr('y', TOP + i * ROW + 12)
        .text(l.label);
    });

    // marcas verticales de capítulos dentro del grafo
    const chapters = session.nodes.filter(
      (n) => n.lane === 'main' && n.kind === 'user' && posOf.has(n.id),
    );
    const chG = root.append('g').attr('class', 'chapter-marks');
    for (const n of chapters) {
      const p = posOf.get(n.id);
      chG
        .append('line')
        .attr('x1', p.x)
        .attr('x2', p.x)
        .attr('y1', 0)
        .attr('y2', TOP + rowLanes.length * ROW + 80)
        .attr('stroke', '#e3e1d8');
    }

    window.__linkEls = root.append('g').attr('class', 'links');
    window.__nodeEls = root
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g.node')
      .data(session.nodes.filter((n) => posOf.has(n.id)))
      .join('g')
      .attr(
        'class',
        (n) =>
          `node k-${n.kind}` +
          (n.kind === 'tool_call' && failedCalls.has(n.id) ? ' result-false' : ''),
      )
      .attr('transform', (n) => `translate(${posOf.get(n.id).x},${posOf.get(n.id).y})`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .on('click', (e, n) => selectNode(n))
      .on('keydown', (e, n) => {
        if (e.key === 'Enter') selectNode(n);
      })
      .on('mouseenter', (e, n) => showTip(e, tipHtml(n)))
      .on('mousemove', (e, n) => showTip(e, tipHtml(n)))
      .on('mouseleave', hideTip);
    __nodeEls
      .append('circle')
      .attr('r', (n) => (posOf.get(n.id).twig ? 4 : n.kind === 'tool_result' ? 5 : 7));

    // clústeres de ramas agrupadas
    const cl = root
      .append('g')
      .attr('class', 'clusters')
      .selectAll('g.cluster')
      .data(clusterInfo)
      .join('g')
      .attr('class', 'cluster')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .on('mouseenter', (e, d) =>
        showTip(
          e,
          `<span class="tk">${d.lanes.length} ramas pequeñas</span><br>${escapeHtml(d.lanes.join(', '))}`,
        ),
      )
      .on('mousemove', (e, d) =>
        showTip(
          e,
          `<span class="tk">${d.lanes.length} ramas pequeñas</span><br>${escapeHtml(d.lanes.join(', '))}`,
        ),
      )
      .on('mouseleave', hideTip);
    cl.append('circle').attr('r', 7);
    cl.append('text')
      .attr('dy', 3)
      .text((d) => `${d.lanes.length}↗`);

    drawLinks();
    updateChapters();
    drawMinimap();
  }

  const graphW = () => {
    let max = 200;
    for (const p of posOf.values()) if (p.x > max) max = p.x;
    return max + 80;
  };
  const graphH = () => TOP + rowLanes.length * ROW + 4 * STACK_DY + TWIG_DY + 40;

  function drawLinks() {
    const data = [];
    for (const n of session.nodes) {
      if (!posOf.has(n.id)) continue;
      const p = visParentId(n);
      if (!p || !posOf.has(p)) continue;
      const pn = nodesById.get(p);
      data.push({
        s: posOf.get(p),
        t: posOf.get(n.id),
        cls: pn.lane !== n.lane ? 'link fork' : posOf.get(n.id).twig ? 'link twig' : 'link',
      });
    }
    __linkEls
      .selectAll('path')
      .data(data)
      .join('path')
      .attr('class', (d) => d.cls)
      .attr('d', (d) => linkGen({ source: d.s, target: d.t }));
  }

  function applyFilters() {
    renderGraph();
    if (selected) __nodeEls.classed('selected', (d) => d === selected);
    applySearch();
  }
  ['thinking', 'tool_result', 'system'].forEach((k) => {
    $(`#f-${k}`).addEventListener('change', (e) => {
      visible[k] = e.target.checked;
      applyFilters();
    });
  });

  // --- capítulos (franja fija) ---
  const strip = $('#chapter-strip');
  function updateChapters() {
    if (!session) return;
    strip.textContent = '';
    const tr = d3.zoomTransform(svg.node());
    const cw = $('#center').clientWidth;
    const items = session.nodes
      .filter((n) => n.lane === 'main' && n.kind === 'user' && posOf.has(n.id))
      .map((n) => ({ n, x: tr.applyX(posOf.get(n.id).x) }))
      .filter((d) => d.x > -100 && d.x < cw + 100)
      .sort((a, b) => Math.abs(a.x - cw / 2) - Math.abs(b.x - cw / 2));
    const placed = [];
    for (const d of items) {
      const w = Math.min(220, d.n.text.slice(0, 40).length * 5.5 + 12);
      const x0 = d.x + 6,
        x1 = x0 + w;
      if (placed.some(([a, b]) => x0 < b && x1 > a)) continue;
      placed.push([x0, x1]);
      const el = document.createElement('span');
      el.className = 'ch';
      el.style.left = `${x0}px`;
      el.textContent = (d.n.text || '').slice(0, 40);
      el.addEventListener('click', () => {
        selectNode(d.n);
        centerNode(d.n, 1);
      });
      strip.appendChild(el);
    }
  }

  // --- minimapa ---
  const mm = $('#minimap'),
    mmc = $('#minimap-canvas');
  function drawMinimap() {
    if (!session) return;
    const w = mm.clientWidth,
      h = mm.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    mmc.width = w * dpr;
    mmc.height = h * dpr;
    const ctx = mmc.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const gw = graphW(),
      gh = graphH();
    const k = Math.min((w - 8) / gw, (h - 8) / gh);
    const ox = 4,
      oy = 4;
    ctx.strokeStyle = '#d8d4c6';
    for (const [id, y] of laneY) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * k);
      ctx.lineTo(ox + gw * k, oy + y * k);
      ctx.stroke();
    }
    ctx.fillStyle = '#6f7a74';
    for (const [id, p] of posOf) {
      ctx.fillRect(ox + p.x * k, oy + p.y * k - 0.5, 1.5, 1.5);
    }
    const tr = d3.zoomTransform(svg.node());
    const vw = $('#center').clientWidth / tr.k,
      vh = $('#center').clientHeight / tr.k;
    const vx = -tr.x / tr.k,
      vy = -tr.y / tr.k;
    ctx.strokeStyle = '#1f3d35';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(ox + vx * k, oy + vy * k, vw * k, vh * k);
    mm._k = k;
    mm._ox = ox;
    mm._oy = oy;
    mm._gw = gw;
    mm._gh = gh;
  }
  function minimapJump(e) {
    const r = mm.getBoundingClientRect();
    const x = (e.clientX - r.left - mm._ox) / mm._k;
    const y = (e.clientY - r.top - mm._oy) / mm._k;
    const tr = d3.zoomTransform(svg.node());
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(cw / 2 - x * tr.k, ch / 2 - y * tr.k).scale(tr.k),
    );
  }
  let mmDrag = false;
  mm.addEventListener('pointerdown', (e) => {
    mmDrag = true;
    mm.setPointerCapture(e.pointerId);
    minimapJump(e);
  });
  mm.addEventListener('pointermove', (e) => {
    if (mmDrag) minimapJump(e);
  });
  mm.addEventListener('pointerup', () => {
    mmDrag = false;
  });

  // --- zoom helpers ---
  function zoom1() {
    const tr = d3.zoomTransform(svg.node());
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    const cx = (-tr.x + cw / 2) / tr.k,
      cy = (-tr.y + ch / 2) / tr.k;
    svg
      .transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity.translate(cw / 2 - cx, ch / 2 - cy).scale(1));
  }
  $('#zoom1').addEventListener('click', zoom1);
  function fit() {
    if (!session) return;
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    const k = Math.min(cw / graphW(), ch / graphH(), 1) * 0.96;
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(cw / 2 - (graphW() / 2) * k, ch / 2 - (graphH() / 2) * k).scale(k),
    );
  }
  $('#fit').addEventListener('click', fit);

  function centerNode(n, k) {
    const p = posOf.get(n.id);
    if (!p) return;
    const cw = $('#center').clientWidth,
      ch = $('#center').clientHeight;
    const zk = k ?? d3.zoomTransform(svg.node()).k;
    svg
      .transition()
      .duration(400)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(cw / 2 - p.x * zk, ch / 2 - p.y * zk).scale(zk),
      );
  }

  function selectNode(n) {
    selected = n;
    __nodeEls.classed('selected', (d) => d === n);
    renderDetail(n);
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
    if (!selected) return;
    const p = visParentId(selected);
    if (p) {
      selectNode(nodesById.get(p));
      centerNode(nodesById.get(p));
    }
  });
  $('#nav-child').addEventListener('click', () => {
    if (!selected) return;
    const kids = (childOf.get(selected.id) || []).filter((id) => {
      const kn = nodesById.get(id);
      return kn && posOf.has(id);
    });
    if (kids.length) {
      selectNode(nodesById.get(kids[0]));
      centerNode(nodesById.get(kids[0]));
    }
  });
  $('#copy-link').addEventListener('click', () => {
    const base = location.href.split('#')[0];
    const url = `${base}#session=${session.id}&node=${selected ? selected.id : ''}`;
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

  window.addEventListener('resize', () => {
    updateChapters();
    drawMinimap();
  });

  // --- hash inicial ---
  const h = new URLSearchParams(location.hash.slice(1));
  const sid = h.get('session');
  if (sid && INDEX.some((s) => s.id === sid)) openSession(sid, h.get('node'));
  else {
    const main = INDEX.find((s) => s.role === 'principal') || INDEX[0];
    if (main) openSession(main.id);
  }
})();
