/*
 * ANTOSC — Mapa de rede (torres + fibra ótica + rotas)
 * Sem bibliotecas externas. Dados: africa-geo.js, coverage-data.js, network-data.js
 */
(function () {
  'use strict';
  var root = document.getElementById('network-map');
  var G = window.ANTOSC_GEO, COV = window.ANTOSC_COVERAGE, NET = window.ANTOSC_NETWORK;
  if (!root || !G || !COV || !NET) return;

  var META = window.ANTOSC_NETWORK_META || {};
  var ZL = window.ANTOSC_ZONE_LABELS || {};
  var NS = 'http://www.w3.org/2000/svg';
  var C = { active: '#ffc83d', build: '#ff6b5e', navy: '#0b2a66', amber: '#f59e0b' };
  var STATUS = { ativo: 'Ativo', implementacao: 'Em implementação', pendente: 'Pendente' };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function merc(lat) { var r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)) * 180 / Math.PI; }
  function proj(lon, lat) { return [(lon - G.lon0) * G.k, (G.y0 - merc(lat)) * G.k]; }
  function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  // ---------- nós
  var nodes = {}, list = [];
  COV.forEach(function (c) {
    var n = { id: c.id, name: c.name, short: c.short || c.name, p: proj(c.coords[1], c.coords[0]), count: c.count, zone: c.zone, lab: c.lab || 'r', site: true };
    nodes[n.id] = n; list.push(n);
  });
  NET.border.forEach(function (b) {
    var n = { id: b.id, name: b.name, short: b.short, p: proj(b.coords[0], b.coords[1]), lab: b.lab || 'r', site: false };
    nodes[n.id] = n; list.push(n);
  });
  var links = NET.links.filter(function (l) { return nodes[l.a] && nodes[l.b]; });

  // ---------- estrutura
  var W = 1200, H = 640, S = { k: 1, tx: 0, ty: 0 }, filter = 'all', home = null;
  var svg = el('svg', { 'class': 'nm-svg', width: '100%', height: '100%', role: 'img',
    'aria-label': 'Mapa da rede ANTOSC: torres por província e rotas de fibra ótica ativas, em implementação ou pendentes.' });
  var defs = el('defs', {}, svg);
  var og = el('linearGradient', { id: 'nm-ocean', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
  el('stop', { offset: '0', 'stop-color': '#1a86d8' }, og);
  el('stop', { offset: '.55', 'stop-color': '#0f5cb3' }, og);
  el('stop', { offset: '1', 'stop-color': '#0a3a85' }, og);
  var lg = el('linearGradient', { id: 'nm-land', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
  el('stop', { offset: '0', 'stop-color': '#f4f8fd' }, lg);
  el('stop', { offset: '1', 'stop-color': '#d6e4f3' }, lg);
  var ag = el('linearGradient', { id: 'nm-ang', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
  el('stop', { offset: '0', 'stop-color': '#ffffff' }, ag);
  el('stop', { offset: '1', 'stop-color': '#e9f1fa' }, ag);
  var gf = el('filter', { id: 'nm-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { stdDeviation: '4' }, gf);

  el('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#nm-ocean)' }, svg);
  var viewport = el('g', { id: 'nm-viewport' }, svg);
  var overlay = el('g', { id: 'nm-overlay' }, svg);

  // graticule (a cada 5°)
  var grat = el('g', { fill: 'none', stroke: '#ffffff', 'stroke-opacity': '.10', 'stroke-width': '1' }, viewport);
  var i, x0 = proj(-6, 0)[0], x1 = proj(42, 0)[0], yTop = 0, yBot = G.h;
  for (i = -5; i <= 40; i += 5) { var gx = proj(i, 0)[0]; el('path', { d: 'M' + gx + ' ' + yTop + 'L' + gx + ' ' + yBot, 'vector-effect': 'non-scaling-stroke' }, grat); }
  for (i = -35; i <= 10; i += 5) { var gy = proj(0, i)[1]; el('path', { d: 'M' + x0 + ' ' + gy + 'L' + x1 + ' ' + gy, 'vector-effect': 'non-scaling-stroke' }, grat); }

  // terra
  var land = el('g', {}, viewport);
  G.countries.forEach(function (c) {
    el('path', { d: c.d, fill: c.id === 'Angola' ? 'url(#nm-ang)' : 'url(#nm-land)', stroke: c.id === 'Angola' ? '#ffffff' : '#9db8d6',
      'stroke-width': c.id === 'Angola' ? '1.6' : '.8', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, land);
  });

  // links
  var linkLayer = el('g', {}, viewport), linkEls = [];
  function curve(a, b, bend) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    return 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'Q' + (mx - dy * bend).toFixed(1) + ' ' + (my + dx * bend).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
  }
  links.forEach(function (l) {
    var d = curve(nodes[l.a].p, nodes[l.b].p, l.bend || 0), act = l.status === 'ativo', col = act ? C.active : C.build;
    var g = el('g', { 'class': 'nm-link nm-' + l.status }, linkLayer);
    el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 8, 'stroke-opacity': '.28', filter: 'url(#nm-glow)', 'vector-effect': 'non-scaling-stroke' }, g);
    var core = el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': act ? 3 : 2.6, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke',
      'stroke-dasharray': act ? 'none' : (l.status === 'pendente' ? '3 8' : '9 7') }, g);
    if (l.status === 'implementacao') core.setAttribute('class', 'nm-flow');
    var hit = el('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': 16, 'vector-effect': 'non-scaling-stroke', 'class': 'nm-hit' }, g);
    hit.addEventListener('mousemove', function (e) { tip(e, linkHTML(l)); });
    hit.addEventListener('mouseleave', hideTip);
    hit.addEventListener('click', function (e) { tip(e, linkHTML(l)); });
    linkEls.push({ l: l, g: g });
  });

  // rótulos de países e do oceano (posição em lon/lat)
  var tags = [];
  [['Namíbia', 17.6, -21.3], ['Zâmbia', 26.4, -15.3], ['RD Congo', 23.2, -3.6], ['Congo', 15.3, -1.2], ['Botswana', 23.6, -21.9],
   ['Gabão', 11.9, 0.4], ['Zimbabwe', 29.6, -19.2]].forEach(function (t) { tags.push({ t: t[0].toUpperCase(), p: proj(t[1], t[2]), cls: 'nm-country' }); });
  tags.push({ t: 'OCEANO ATLÂNTICO', p: proj(5.2, -12.5), cls: 'nm-sea', rot: -90 });
  tags.forEach(function (tg) {
    tg.node = el('text', { 'class': tg.cls, 'text-anchor': 'middle' }, overlay);
    tg.node.textContent = tg.t;
  });

  // nós
  var nodeEls = [];
  function radius(n) { return n.site ? 5 + Math.sqrt(n.count) * 0.95 : 4.5; }
  list.forEach(function (n) {
    var r = radius(n), g = el('g', { 'class': 'nm-node', tabindex: 0, 'data-id': n.id, role: 'button', 'aria-label': n.name }, overlay);
    if (n.site) {
      el('circle', { r: r + 6, fill: C.active, 'fill-opacity': '.22' }, g);
      el('circle', { r: r, fill: '#ffffff', stroke: C.amber, 'stroke-width': 3 }, g);
      el('circle', { r: Math.max(2, r * 0.42), fill: C.navy }, g);
    } else {
      el('circle', { r: r + 3, fill: '#0b2a66', 'fill-opacity': '.35' }, g);
      el('circle', { r: r, fill: '#cfe3f8', stroke: '#ffffff', 'stroke-width': 2 }, g);
    }
    var cnt = n.site ? String(n.count) : '';
    var lab = el('g', { 'class': 'nm-label' }, g);
    var rect = el('rect', { height: 20, rx: 10, fill: '#0b2a66', 'fill-opacity': n.site ? '.94' : '.7', stroke: '#ffffff', 'stroke-opacity': '.45' }, lab);
    var tx = el('text', { x: 9, y: 14, fill: '#ffffff', 'font-size': 11, 'font-weight': 700, 'letter-spacing': '.3' }, lab);
    tx.textContent = n.short;
    var t2 = null;
    if (cnt) { t2 = el('text', { y: 14, fill: C.active, 'font-size': 11.5, 'font-weight': 800 }, lab); t2.textContent = cnt; }
    n._l = { lab: lab, rect: rect, tx: tx, t2: t2, r: r };
    g.addEventListener('mousemove', function (e) { tip(e, nodeHTML(n)); });
    g.addEventListener('mouseleave', hideTip);
    g.addEventListener('click', function (e) { tip(e, nodeHTML(n)); });
    g.addEventListener('focus', function () { var b = g.getBoundingClientRect(), rb = root.getBoundingClientRect(); tipAt(b.left - rb.left + b.width / 2, b.top - rb.top, nodeHTML(n)); });
    g.addEventListener('blur', hideTip);
    nodeEls.push({ n: n, g: g });
  });

  // posiciona as etiquetas com a largura real do texto (fallback: estimativa)
  function layoutLabels() {
    list.forEach(function (n) {
      var L = n._l, r = L.r, h = 20, p = r + 6, w1, w2 = 0;
      try { w1 = L.tx.getComputedTextLength(); } catch (e) { w1 = 0; }
      if (!w1) w1 = n.short.length * 7.6;
      if (L.t2) { try { w2 = L.t2.getComputedTextLength(); } catch (e) { w2 = 0; } if (!w2) w2 = String(n.count).length * 8; L.t2.setAttribute('x', (9 + w1 + 7).toFixed(1)); }
      var w = 9 + w1 + (L.t2 ? 7 + w2 : 0) + 10;
      L.rect.setAttribute('width', w.toFixed(1));
      var pos = { r: [p, -h / 2], l: [-p - w, -h / 2], t: [-w / 2, -p - h], b: [-w / 2, p],
        tr: [r + 2, -r - h], tl: [-r - 2 - w, -r - h], br: [r + 2, r], bl: [-r - 2 - w, r] }[n.lab] || [p, -h / 2];
      L.lab.setAttribute('transform', 'translate(' + pos[0].toFixed(1) + ' ' + pos[1].toFixed(1) + ')');
    });
  }

  // ---------- balões
  var tipEl = document.createElement('div');
  tipEl.className = 'nm-tip'; tipEl.setAttribute('role', 'status');
  function nodeHTML(n) {
    var act = 0, bld = 0;
    links.forEach(function (l) { if (l.a === n.id || l.b === n.id) { if (l.status === 'ativo') act++; else bld++; } });
    var h = '<b>' + n.name + '</b>';
    h += n.site ? '<div>' + n.count + ' sites · Zona ' + (ZL[n.zone] || n.zone) + '</div>' : '<div>Ponto de ligação transfronteiriço</div>';
    h += '<div class="nm-tip-sub">Fibra: ' + act + ' ativo(s) · ' + bld + ' em implementação/pendente</div>';
    return h;
  }
  function linkHTML(l) {
    var s = '<span class="nm-dot ' + (l.status === 'ativo' ? 'on' : 'off') + '"></span>' + STATUS[l.status];
    return '<b>' + nodes[l.a].short + ' ⇄ ' + nodes[l.b].short + '</b><div>' + s + '</div><div class="nm-tip-sub">' +
      (l.kind === 'transfronteirica' ? 'Rota transfronteiriça' : 'Rota interprovincial') + (l.note ? ' · ' + l.note : '') + '</div>';
  }
  function tipAt(x, y, html) {
    tipEl.innerHTML = html; tipEl.style.display = 'block';
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(W - w - 8, x + 14)) + 'px';
    tipEl.style.top = Math.max(8, Math.min(H - h - 8, y - h - 10)) + 'px';
  }
  function tip(e, html) { var r = root.getBoundingClientRect(); tipAt(e.clientX - r.left, e.clientY - r.top, html); }
  function hideTip() { tipEl.style.display = 'none'; }

  // ---------- vista / zoom
  function clamp() {
    var mw = G.w * S.k, mh = G.h * S.k;
    S.tx = mw <= W ? (W - mw) / 2 : Math.min(0, Math.max(W - mw, S.tx));
    S.ty = mh <= H ? (H - mh) / 2 : Math.min(0, Math.max(H - mh, S.ty));
  }
  function draw() {
    viewport.setAttribute('transform', 'translate(' + S.tx.toFixed(2) + ' ' + S.ty.toFixed(2) + ') scale(' + S.k.toFixed(4) + ')');
    nodeEls.forEach(function (o) { o.g.setAttribute('transform', 'translate(' + (o.n.p[0] * S.k + S.tx).toFixed(1) + ' ' + (o.n.p[1] * S.k + S.ty).toFixed(1) + ')'); });
    tags.forEach(function (t) {
      var x = t.p[0] * S.k + S.tx, y = t.p[1] * S.k + S.ty;
      t.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' + (t.rot ? ' rotate(' + t.rot + ')' : ''));
    });
  }
  function fit() {
    var xs = list.map(function (n) { return n.p[0]; }), ys = list.map(function (n) { return n.p[1]; });
    var bx = Math.min.apply(null, xs), bw = Math.max.apply(null, xs) - bx, by = Math.min.apply(null, ys), bh = Math.max.apply(null, ys) - by;
    var wide = W > 760, pl = wide ? W * 0.30 : W * 0.06, pr = wide ? W * 0.12 : W * 0.06, pt = H * 0.13, pb = H * 0.17;
    var k = Math.min((W - pl - pr) / bw, (H - pt - pb) / bh);
    S.k = k; S.tx = pl + ((W - pl - pr) - bw * k) / 2 - bx * k; S.ty = pt + ((H - pt - pb) - bh * k) / 2 - by * k;
    home = { k: S.k, tx: S.tx, ty: S.ty };
    clamp(); draw();
  }
  function zoomAt(f, cx, cy) {
    var minK = Math.max(W / G.w, H / G.h), nk = Math.max(minK, Math.min(7, S.k * f));
    S.tx = cx - (cx - S.tx) * (nk / S.k); S.ty = cy - (cy - S.ty) * (nk / S.k); S.k = nk; clamp(); draw();
  }
  function focusOn(n, k) {
    S.k = k; S.tx = W * 0.5 - n.p[0] * k; S.ty = H * 0.5 - n.p[1] * k; clamp(); draw();
  }
  function size() {
    var r = root.getBoundingClientRect(); W = r.width || 1200; H = r.height || 640; fit();
  }

  // arrastar (rato) / zoom (Ctrl + roda, duplo clique, botões)
  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0 || (e.target.closest && e.target.closest('.nm-node'))) return;
    drag = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty }; svg.classList.add('nm-grab'); hideTip();
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return; S.tx = drag.tx + e.clientX - drag.x; S.ty = drag.ty + e.clientY - drag.y; clamp(); draw();
  });
  window.addEventListener('pointerup', function () { drag = null; svg.classList.remove('nm-grab'); });
  svg.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); var r = root.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  svg.addEventListener('dblclick', function (e) { var r = root.getBoundingClientRect(); zoomAt(1.6, e.clientX - r.left, e.clientY - r.top); });

  // ---------- filtros (separadores)
  function applyFilter() {
    linkEls.forEach(function (o) {
      var l = o.l, show = filter === 'all' || (filter === 'ativa' && l.status === 'ativo') ||
        (filter === 'impl' && l.status !== 'ativo') || (filter === 'trans' && l.kind === 'transfronteirica');
      if (filter === 'torres') show = false;
      o.g.style.display = show ? '' : 'none';
    });
    var tabs = root.querySelectorAll('.nm-tab');
    Array.prototype.forEach.call(tabs, function (t) { t.classList.toggle('active', t.getAttribute('data-filter') === filter); });
  }

  // ---------- controlos e informação
  var ui = document.getElementById('network-map-ui');
  if (ui) { root.appendChild(ui); ui.style.display = ''; }
  root.insertBefore(svg, root.firstChild); root.appendChild(tipEl);

  function on(id, ev, fn) { var n = document.getElementById(id); if (n) n.addEventListener(ev, fn); }
  on('nm-zoom-in', 'click', function () { zoomAt(1.4, W / 2, H / 2); });
  on('nm-zoom-out', 'click', function () { zoomAt(1 / 1.4, W / 2, H / 2); });
  on('nm-reset', 'click', function () { S.k = home.k; S.tx = home.tx; S.ty = home.ty; clamp(); draw(); hideTip(); });
  on('nm-luanda', 'click', function () { focusOn(nodes.luanda, Math.max(home.k * 4.2, 2.4)); });
  Array.prototype.forEach.call(root.querySelectorAll('.nm-tab'), function (t) {
    t.addEventListener('click', function () { filter = t.getAttribute('data-filter'); applyFilter(); });
  });
  on('nm-search', 'input', function (e) {
    var q = norm(e.target.value.trim()); if (q.length < 2) return;
    var f = list.filter(function (n) { return norm(n.name).indexOf(q) > -1; })[0];
    if (f) { focusOn(f, Math.max(home.k * 3, 2.2)); var r = root.getBoundingClientRect(); setTimeout(function () { tipAt(f.p[0] * S.k + S.tx, f.p[1] * S.k + S.ty, nodeHTML(f)); }, 0); }
  });

  var T = window.ANTOSC_TOTALS || {}, NT = window.ANTOSC_NETWORK_TOTALS || {};
  function setTxt(id, v) { var n = document.getElementById(id); if (n && v !== undefined) n.textContent = v; }
  setTxt('nm-sites', T.sites); setTxt('nm-active', NT.active); setTxt('nm-building', NT.building); setTxt('nm-cross', NT.crossBorder);
  if (META.validated === false) {
    var b = document.createElement('div'); b.className = 'nm-banner';
    b.textContent = 'Traçado ilustrativo — em validação interna'; root.appendChild(b);
  }
  if (META.updated) setTxt('nm-updated', 'Dados atualizados em ' + META.updated);

  layoutLabels(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutLabels);
  size(); applyFilter();
  if (window.ResizeObserver) new ResizeObserver(function () { size(); }).observe(root); else window.addEventListener('resize', size);
  window.ANTOSC_MAP = { svg: svg, fit: fit };
})();
