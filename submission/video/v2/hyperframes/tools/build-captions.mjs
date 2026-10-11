// Builds compositions/captions.html (burned-in captions) and ../../demo.es.srt.
// Text comes from the script (tools/scripts.json); whisper only supplies timing.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VO = path.join(PROJ, 'assets', 'vo');
const SRT = '/Users/miguelgarglez/Developer/hackathon-tdots/video-v2/demo.es.srt';
const SCRIPTS = JSON.parse(
  readFileSync(path.join(PROJ, 'tools', 'scripts.json'), 'utf8'),
);

const OFFSETS = {
  E01: 0,
  E02: 16.97,
  E03: 57.29,
  E04: 120.29,
  E05: 172.01,
  E06: 216.77,
  E06B: 285.17,
  E06C: 326.026,
  E07: 385.338,
  E07B: 448.05,
  E08: 483.698,
};

const norm = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
const NUMWORD = {
  diez: '10',
  veinte: '20',
  cinco: '5',
  trece: '13',
  ochenta: '80',
  seis: '6',
  ocho: '8',
  setenta: '70',
  cuarenta: '40',
  cincuenta: '50',
  setentayocho: '78',
  cuarentayseis: '46',
  ochentaycinco: '85',
  cincuentayseis: '56',
};
const eqKey = (n) => NUMWORD[n] ?? n;

// tokenize script text, keeping punctuation attached to words
const scriptTokens = (text) => text.trim().split(/\s+/);

// Align script tokens to whisper words; returns [{text,s,e}] per script token.
function align(tokens, words) {
  const spans = [];
  let i = 0,
    j = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let ws = 1; ws <= 3 && !matched; ws++) {
      for (let ss = 1; ss <= 3 && !matched; ss++) {
        if (j + ws > words.length || i + ss > tokens.length) continue;
        const scat = tokens
          .slice(i, i + ss)
          .map(norm)
          .join('');
        const wcat = words
          .slice(j, j + ws)
          .map((w) => norm(w.w))
          .join('');
        if (scat && eqKey(scat) === eqKey(wcat)) {
          spans.push({
            i,
            n: ss,
            s: words[j].s,
            e: words[j + ws - 1].e,
          });
          i += ss;
          j += ws;
          matched = true;
        }
      }
    }
    if (!matched) {
      spans.push({ i, n: 1, s: null, e: null });
      i++;
    }
  }
  // token-level timing
  const T = tokens.map((t, k) => ({ text: t, s: null, e: null }));
  for (const sp of spans)
    for (let k = 0; k < sp.n; k++) {
      T[sp.i + k].s = sp.s;
      T[sp.i + k].e = sp.e;
    }
  // fill gaps by interpolation
  for (let k = 0; k < T.length; k++) {
    if (T[k].s != null) continue;
    let p = k - 1;
    while (p >= 0 && T[p].e == null) p--;
    let n = k + 1;
    while (n < T.length && T[n].s == null) n++;
    const lo = p >= 0 ? T[p].e : words[0]?.s ?? 0;
    const hi = n < T.length ? T[n].s : words[words.length - 1]?.e ?? lo;
    T[k].s = lo;
    T[k].e = hi;
  }
  return T;
}

const HARD = /[.:;?!]$/;
const SOFT = /,$/;

const groups = [];
for (const [id, off] of Object.entries(OFFSETS)) {
  const words = JSON.parse(readFileSync(path.join(VO, `${id}.words.json`), 'utf8'));
  const T = align(scriptTokens(SCRIPTS[id]), words);
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    groups.push({
      start: cur[0].s + off,
      end: cur[cur.length - 1].e + off,
      text: cur.map((x) => x.text).join(' ').trim(),
    });
    cur = [];
  };
  for (let k = 0; k < T.length; k++) {
    const t = T[k];
    cur.push(t);
    const next = T[k + 1];
    const pause = next ? next.s - t.e >= 0.35 : false;
    if (cur.length >= 7 || !next || HARD.test(t.text) || (cur.length >= 3 && SOFT.test(t.text)) || (cur.length >= 3 && pause)) {
      flush();
    }
  }
  flush();
}
groups.sort((a, b) => a.start - b.start);
// merge tiny groups (<3 words) into the following group
for (let i = 0; i < groups.length - 1; i++) {
  if (groups[i].text.split(' ').length < 3) {
    const g = groups.splice(i, 1)[0];
    groups[i] = { start: g.start, end: groups[i].end, text: g.text + ' ' + groups[i].text };
    i--;
  }
}
for (let i = 0; i < groups.length - 1; i++) {
  if (groups[i].end > groups[i + 1].start) groups[i].end = groups[i + 1].start;
}
const clean = groups.filter((g) => g.end - g.start > 0.15 && g.text.length);
console.log(`${clean.length} caption groups`);
// sample output for review
for (const [id, off] of Object.entries({ E07B: OFFSETS.E07B, E03: OFFSETS.E03 })) {
  const sample = clean.filter((g) => g.start >= off && g.start < off + 20).slice(0, 3);
  sample.forEach((g) => console.log(`${id} ${(g.start - off).toFixed(1)}s: ${g.text}`));
}

const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <template>
      <style>
        #root {
          position: absolute;
          inset: 0;
          font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            'Segoe UI',
            sans-serif;
        }
        .cap-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 950px;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }
        .cap-line span {
          display: inline-block;
          max-width: 1500px;
          background: rgba(31, 61, 53, 0.92);
          color: #f8f6ef;
          font-size: 38px;
          font-weight: 600;
          font-family: ui-sans-serif, system-ui, sans-serif;
          padding: 14px 28px;
          border-radius: 14px;
          text-align: center;
          line-height: 1.3;
        }
      </style>
      <div
        id="root"
        data-composition-id="captions"
        data-width="1920"
        data-height="1080"
        data-layout-allow-caption-zone
        data-layout-allow-overlap
      >
        ${clean
          .map(
            (g, i) =>
              `<div class="cap-line" id="cap-${i}" data-layout-allow-overlap style="opacity:0"><span data-layout-allow-overlap>${g.text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')}</span></div>`,
          )
          .join('\n        ')}
      </div>
      <script>
        const tl = gsap.timeline({ paused: true });
        const CAPS = ${JSON.stringify(clean.map((g) => ({ s: +g.start.toFixed(3), e: +g.end.toFixed(3) })))};
        CAPS.forEach((g, i) => {
          const el = document.getElementById('cap-' + i);
          tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, g.s);
          tl.to(el, { opacity: 0, duration: 0.12 }, g.e - 0.12);
          tl.set(el, { opacity: 0, visibility: 'hidden' }, g.e);
        });
        setTimeout(() => {
          CAPS.forEach((g, i) => {
            const el = document.getElementById('cap-' + i);
            if (getComputedStyle(el).opacity === '1' && tl.time() > g.e)
              console.warn('caption still visible past end:', i);
          });
        }, 0);
        window.__timelines['captions'] = tl;
      </script>
    </template>
  </body>
</html>
`;
writeFileSync(path.join(PROJ, 'compositions', 'captions.html'), html);

const ts = (t) => {
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = Math.floor(t % 60),
    ms = Math.round((t % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
writeFileSync(
  SRT,
  clean.map((g, i) => `${i + 1}\n${ts(g.start)} --> ${ts(g.end)}\n${g.text}\n`).join('\n'),
);
console.log(`wrote captions.html + ${SRT}`);
