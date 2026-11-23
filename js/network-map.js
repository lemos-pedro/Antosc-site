/*
 * ANTOSC — Mapa de rede (sites + fibra ótica + rotas + sites por província)
 * Sem bibliotecas externas.
 * Dados: africa-geo.js, angola-provinces.js, sites-data.js, coverage-data.js, network-data.js
 *
 * Interação: clicar numa província (ou no seu círculo) abre a lista de sites,
 * aproxima o mapa e mostra cada site no seu local. Pontos próximos agrupam-se
 * e separam-se ao ampliar. Esc volta atrás.
 */
(function () {
  'use strict';
  var root = document.getElementById('network-map');
  var G = window.ANTOSC_GEO, COV = window.ANTOSC_COVERAGE, NET = window.ANTOSC_NETWORK;
  if (!root || !G || !COV || !NET) return;

  var META = window.ANTOSC_NETWORK_META || {};
  var ZL = window.ANTOSC_ZONE_LABELS || {};
  var PR = window.ANTOSC_PROVINCES || [];
  var SITES = window.ANTOSC_SITES || [];
  var NS = 'http://www.w3.org/2000/svg';
  var C = { active: '#ffc83d', build: '#ff6b5e', navy: '#0b2a66', amber: '#f59e0b' };
  var STATUS = { ativo: 'Ativo', implementacao: 'Em implementação', pendente: 'Pendente' };
  var MAXK = 140;                       // zoom máximo (os sites mais próximos distam ~440 m)
  var CLUSTER_PX = 17;                  // distância (px) a partir da qual dois pontos se agrupam
  // Províncias criadas na reorganização territorial: sem polígono próprio; os sites continuam na província-mãe
  var PARENT = { 'icolo-e-bengo': 'luanda', 'moxico-leste': 'moxico', 'cuando': 'cubango' };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function merc(lat) { var r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)) * 180 / Math.PI; }
  function proj(lon, lat) { return [(lon - G.lon0) * G.k, (G.y0 - merc(lat)) * G.k]; }
  function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plain(name) { return String(name).replace(/\s*\(.*\)\s*$/, ''); }
  function reduceMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

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

  // ---------- sites por província
  var provSites = {}, siteById = {};
  SITES.forEach(function (s) {
    s._p = (s.lat != null && s.lon != null) ? proj(s.lon, s.lat) : null;
    siteById[s.id] = s;
    (provSites[s.prov] = provSites[s.prov] || []).push(s);
  });
  Object.keys(provSites).forEach(function (k) {
    provSites[k].sort(function (a, b) { return a.mun.localeCompare(b.mun, 'pt') || a.name.localeCompare(b.name, 'pt'); });
  });

  // ---------- estrutura
  var W = 1200, H = 640, S = { k: 1, tx: 0, ty: 0 }, filter = 'all', home = null;
  var svg = el('svg', { 'class': 'nm-svg', width: '100%', height: '100%', role: 'img', tabindex: '-1',
    'aria-label': 'Mapa da rede ANTOSC: sites por província, sites e rotas de fibra ótica ativas, em implementação ou pendentes. Clique numa província para ver os sites.' });
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

  // províncias (clicáveis). A intensidade do tom âmbar acompanha o n.º de sites.
  var provLayer = el('g', { 'class': 'nm-provs' }, viewport), provEls = {}, maxCnt = 1;
  COV.forEach(function (c) { if (c.count > maxCnt) maxCnt = c.count; });
  PR.forEach(function (p) {
    var n = nodes[p.id], cnt = n ? n.count : 0;
    var a = cnt ? 0.06 + 0.26 * Math.sqrt(cnt / maxCnt) : 0.02;
    var path = el('path', { d: p.d, 'class': 'nm-prov', 'fill-rule': 'evenodd', fill: 'rgba(245,158,11,' + a.toFixed(3) + ')',
      stroke: '#86a9d0', 'stroke-width': '.9', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', 'data-id': p.id }, provLayer);
    path.addEventListener('mousemove', function (e) { if (!drag) tip(e, provHTML(p.id)); });
    path.addEventListener('mouseleave', hideTip);
    path.addEventListener('click', function (e) {
      if (moved) { moved = false; return; }
      selectProvince(p.id);
      hideTip();
    });
    provEls[p.id] = { p: p, el: path };
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

  // nós (os rótulos e os círculos ficam em camadas separadas: um rótulo nunca tapa o círculo de outro nó)
  var labelLayer = el('g', { 'class': 'nm-node-labels' }, overlay), circleLayer = el('g', { 'class': 'nm-node-circles' }, overlay);
  var nodeEls = [];
  function radius(n) { return n.site ? 5 + Math.sqrt(n.count) * 0.95 : 4.5; }
  list.forEach(function (n) {
    var r = radius(n), g = el('g', { 'class': 'nm-node', tabindex: 0, 'data-id': n.id, role: 'button',
      'aria-label': n.site ? n.name + ': ' + plural(n.count, 'site', 'sites') + '. Ver sites.' : n.name }, circleLayer);
    var gl = el('g', { 'class': 'nm-nlab' + (n.site ? ' site' : ''), 'data-id': n.id, 'aria-hidden': 'true' }, labelLayer);
    if (n.site) {
      el('circle', { r: r + 6, fill: C.active, 'fill-opacity': '.22' }, g);
      el('circle', { r: r, fill: '#ffffff', stroke: C.amber, 'stroke-width': 3 }, g);
      el('circle', { r: Math.max(2, r * 0.42), fill: C.navy }, g);
    } else {
      el('circle', { r: r + 3, fill: '#0b2a66', 'fill-opacity': '.35' }, g);
      el('circle', { r: r, fill: '#cfe3f8', stroke: '#ffffff', 'stroke-width': 2 }, g);
    }
    var cnt = n.site ? String(n.count) : '';
    var lab = el('g', { 'class': 'nm-label' }, gl);
    var rect = el('rect', { height: 20, rx: 10, fill: '#0b2a66', 'fill-opacity': n.site ? '.94' : '.7', stroke: '#ffffff', 'stroke-opacity': '.45' }, lab);
    var tx = el('text', { x: 9, y: 14, fill: '#ffffff', 'font-size': 11, 'font-weight': 700, 'letter-spacing': '.3' }, lab);
    tx.textContent = n.short;
    var t2 = null;
    if (cnt) { t2 = el('text', { y: 14, fill: C.active, 'font-size': 11.5, 'font-weight': 800 }, lab); t2.textContent = cnt; }
    n._l = { lab: lab, rect: rect, tx: tx, t2: t2, r: r };
    function hov(on) { g.classList.toggle('hov', on); gl.classList.toggle('hov', on); }
    [g, gl].forEach(function (t) {
      t.addEventListener('mousemove', function (e) { tip(e, nodeHTML(n)); });
      t.addEventListener('mouseenter', function () { hov(true); });
      t.addEventListener('mouseleave', function () { hov(false); hideTip(); });
      t.addEventListener('click', function (e) {
        if (n.site) { selectProvince(n.id); hideTip(); }
        else tip(e, nodeHTML(n));
      });
    });
    g.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && n.site) { e.preventDefault(); selectProvince(n.id); }
    });
    g.addEventListener('focus', function () { hov(true); var b = g.getBoundingClientRect(), rb = root.getBoundingClientRect(); tipAt(b.left - rb.left + b.width / 2, b.top - rb.top, nodeHTML(n)); });
    g.addEventListener('blur', function () { hov(false); hideTip(); });
    nodeEls.push({ n: n, g: g, gl: gl });
  });

  // ---------- pontos dos sites, grupos e marcador do site selecionado
  var pinLayer = el('g', { 'class': 'nm-pins' }, overlay), pinEls = [], pinById = {}, clEls = [];
  var selLayer = el('g', { 'class': 'nm-sel-layer' }, overlay);
  var selMark = el('g', { 'class': 'nm-selmark', style: 'display:none' }, selLayer);
  el('circle', { 'class': 'ring', r: 15 }, selMark);
  var selGf = el('circle', { 'class': 'core', r: 8.5 }, selMark);
  var selRf = el('rect', { 'class': 'core', x: -8, y: -8, width: 16, height: 16, rx: 2.5, transform: 'rotate(45)' }, selMark);
  var selLab = el('g', { 'class': 'nm-label' }, selMark);
  var selRect = el('rect', { height: 22, rx: 11, fill: '#0b2a66', stroke: '#ffffff', 'stroke-opacity': '.6' }, selLab);
  var selTxt = el('text', { x: 10, y: 15, fill: '#ffffff', 'font-size': 12, 'font-weight': 700 }, selLab);
  var selW = 90;

  var selProv = null, selSite = null, fitK = 1, qText = '', tf = 'all', curList = [];

  function matches(s) {
    if (tf !== 'all' && s.type !== tf) return false;
    return !qText || norm(s.name + ' ' + s.id + ' ' + s.addr + ' ' + s.mun).indexOf(qText) > -1;
  }

  function buildPins(arr) {
    while (pinLayer.firstChild) pinLayer.removeChild(pinLayer.firstChild);
    pinEls = []; pinById = {}; clEls = [];
    arr.forEach(function (s, idx) {
      if (!s._p) return;
      var g = el('g', { 'class': 'nm-pin', tabindex: 0, role: 'button', 'aria-label': s.name + ', ' + s.mun + '. Ver detalhes.' }, pinLayer);
      var inner = el('g', { 'class': 'nm-pin-in' }, g);
      var pop = el('g', { 'class': 'nm-pin-pop' }, inner);
      pop.style.animationDelay = Math.min(idx * 7, 450) + 'ms';
      if (s.type === 'Rooftop') el('rect', { 'class': 'nm-pin-shape rf', x: -6, y: -6, width: 12, height: 12, rx: 2, transform: 'rotate(45)' }, pop);
      else el('circle', { 'class': 'nm-pin-shape gf', r: 7 }, pop);
      var o = { s: s, g: g, x: 0, y: 0, show: true };
      g.addEventListener('mousemove', function (e) { tip(e, siteTip(s)); });
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('click', function () { hideTip(); selectSite(s, false); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSite(s, true); } });
      g.addEventListener('focus', function () { var b = g.getBoundingClientRect(), rb = root.getBoundingClientRect(); tipAt(b.left - rb.left + b.width / 2, b.top - rb.top, siteTip(s)); });
      g.addEventListener('blur', hideTip);
      pinEls.push(o); pinById[s.id] = o;
    });
  }

  function clusterEl(n) {
    if (clEls[n]) return clEls[n];
    var g = el('g', { 'class': 'nm-cl', tabindex: 0, role: 'button' }, pinLayer);
    g._c = el('circle', { 'class': 'nm-cl-c' }, g);
    g._t = el('text', { 'class': 'nm-cl-t', 'text-anchor': 'middle', y: 4 }, g);
    g.addEventListener('click', function () { hideTip(); zoomToItems(g._items); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomToItems(g._items); } });
    g.addEventListener('mousemove', function (e) { tip(e, '<b>' + plural(g._items.length, 'site', 'sites') + ' nesta zona</b><div class="nm-tip-sub">Clique para ampliar</div>'); });
    g.addEventListener('mouseleave', hideTip);
    clEls[n] = g; return g;
  }

  // agrupa pontos que ficariam sobrepostos ao zoom atual
  function layoutPins() {
    if (!pinEls.length) return;
    var vis = [], cls = [], j, lim = CLUSTER_PX * CLUSTER_PX;
    pinEls.forEach(function (o) {
      o.x = o.s._p[0] * S.k + S.tx; o.y = o.s._p[1] * S.k + S.ty;
      if (!o.show) { o.g.style.display = 'none'; return; }
      vis.push(o);
    });
    vis.forEach(function (o) {
      var hit = null;
      if (o.s !== selSite) {
        for (j = 0; j < cls.length; j++) {
          var c = cls[j]; if (c.fixed) continue;
          var dx = c.x - o.x, dy = c.y - o.y;
          if (dx * dx + dy * dy < lim) { hit = c; break; }
        }
      }
      if (hit) { hit.items.push(o); hit.x += (o.x - hit.x) / hit.items.length; hit.y += (o.y - hit.y) / hit.items.length; }
      else cls.push({ x: o.x, y: o.y, items: [o], fixed: o.s === selSite });
    });
    var ci = 0;
    cls.forEach(function (c) {
      if (c.items.length === 1) {
        var o = c.items[0];
        o.g.style.display = '';
        o.g.setAttribute('transform', 'translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')');
      } else {
        c.items.forEach(function (o) { o.g.style.display = 'none'; });
        var g = clusterEl(ci++), r = 11 + Math.min(9, Math.sqrt(c.items.length) * 2.2);
        g._items = c.items.map(function (o) { return o.s; });
        g.style.display = '';
        g._c.setAttribute('r', r.toFixed(1));
        g._t.textContent = c.items.length;
        g.setAttribute('aria-label', plural(c.items.length, 'site', 'sites') + ' nesta zona. Ampliar.');
        g.setAttribute('transform', 'translate(' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ')');
      }
    });
    for (; ci < clEls.length; ci++) clEls[ci].style.display = 'none';
  }

  function placeSel() {
    if (!selSite || !selSite._p) return;
    var x = selSite._p[0] * S.k + S.tx, y = selSite._p[1] * S.k + S.ty;
    selMark.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    var right = x + 20 + selW < W - 70;
    selLab.setAttribute('transform', 'translate(' + (right ? 20 : -20 - selW) + ' -11)');
  }
  function updateSelMark() {
    if (!selSite || !selSite._p) { selMark.style.display = 'none'; return; }
    selMark.style.display = '';
    selGf.style.display = selSite.type === 'Rooftop' ? 'none' : '';
    selRf.style.display = selSite.type === 'Rooftop' ? '' : 'none';
    selTxt.textContent = selSite.name;
    var w = 0; try { w = selTxt.getComputedTextLength(); } catch (e) { w = 0; }
    if (!w) w = selSite.name.length * 7.4;
    selW = w + 20; selRect.setAttribute('width', selW.toFixed(1));
    placeSel();
  }

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
    var h = '<b>' + esc(n.name) + '</b>';
    h += n.site ? '<div>' + plural(n.count, 'site', 'sites') + ' · Zona ' + esc(ZL[n.zone] || n.zone) + '</div>' : '<div>Ponto de ligação transfronteiriço</div>';
    h += '<div class="nm-tip-sub">Fibra: ' + act + ' ativo(s) · ' + bld + ' em implementação/pendente</div>';
    if (n.site) h += '<div class="nm-tip-cta">' + (n.count ? 'Clique para ver os sites' : 'Clique para saber mais') + '</div>';
    return h;
  }
  function provHTML(id) {
    var n = nodes[id];
    return n ? nodeHTML(n) : '';
  }
  function siteTip(s) {
    return '<b>' + esc(s.name) + '</b><div>' + esc(s.id) + ' · ' + esc(s.type) + '</div><div class="nm-tip-sub">' + esc(s.mun) + '</div><div class="nm-tip-cta">Clique para ver detalhes</div>';
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
  function clamp(s) {
    s = s || S;
    var mw = G.w * s.k, mh = G.h * s.k;
    s.tx = mw <= W ? (W - mw) / 2 : Math.min(0, Math.max(W - mw, s.tx));
    s.ty = mh <= H ? (H - mh) / 2 : Math.min(0, Math.max(H - mh, s.ty));
    return s;
  }
  function draw() {
    viewport.setAttribute('transform', 'translate(' + S.tx.toFixed(2) + ' ' + S.ty.toFixed(2) + ') scale(' + S.k.toFixed(4) + ')');
    nodeEls.forEach(function (o) {
      var tr = 'translate(' + (o.n.p[0] * S.k + S.tx).toFixed(1) + ' ' + (o.n.p[1] * S.k + S.ty).toFixed(1) + ')';
      o.g.setAttribute('transform', tr); o.gl.setAttribute('transform', tr);
    });
    tags.forEach(function (t) {
      var x = t.p[0] * S.k + S.tx, y = t.p[1] * S.k + S.ty;
      t.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' + (t.rot ? ' rotate(' + t.rot + ')' : ''));
    });
    layoutPins(); placeSel();
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
    stopFly();
    var minK = Math.max(W / G.w, H / G.h), nk = Math.max(minK, Math.min(MAXK, S.k * f));
    S.tx = cx - (cx - S.tx) * (nk / S.k); S.ty = cy - (cy - S.ty) * (nk / S.k); S.k = nk; clamp(); draw();
  }

  // animação suave entre duas vistas (zoom logarítmico + deslocação do centro)
  var anim = 0;
  function stopFly() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }
  function flyTo(t, ms) {
    stopFly();
    t = clamp({ k: t.k, tx: t.tx, ty: t.ty });
    if (ms === 0 || reduceMotion()) { S.k = t.k; S.tx = t.tx; S.ty = t.ty; draw(); return; }
    var lk0 = Math.log(S.k), lk1 = Math.log(t.k);
    var c0x = (W / 2 - S.tx) / S.k, c0y = (H / 2 - S.ty) / S.k, c1x = (W / 2 - t.tx) / t.k, c1y = (H / 2 - t.ty) / t.k;
    var t0 = performance.now(); ms = ms || 750;
    (function step(now) {
      var u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      var k = Math.exp(lk0 + (lk1 - lk0) * e);
      S.k = k; S.tx = W / 2 - (c0x + (c1x - c0x) * e) * k; S.ty = H / 2 - (c0y + (c1y - c0y) * e) * k;
      clamp(); draw();
      anim = u < 1 ? requestAnimationFrame(step) : 0;
    })(t0);
  }

  // área livre do mapa (fora da gaveta de sites e dos controlos)
  function pads() {
    return W > 760 ? { l: 18 + 340 + 30, r: 78, t: 54, b: 96 } : { l: 14, r: 64, t: 50, b: Math.round(H * 0.47) };
  }
  function boxView(b, minK) {
    var P = pads(), aw = Math.max(80, W - P.l - P.r), ah = Math.max(80, H - P.t - P.b);
    var bw = Math.max(b[2] - b[0], 6), bh = Math.max(b[3] - b[1], 6);
    var k = Math.max(minK || home.k, Math.min(MAXK, Math.min(aw / bw, ah / bh) * 0.9));
    return { k: k, tx: P.l + aw / 2 - (b[0] + b[2]) / 2 * k, ty: P.t + ah / 2 - (b[1] + b[3]) / 2 * k };
  }
  function provBox(id) {
    var b = null, pe = provEls[id];
    function add(a, c, d, e) { b = b ? [Math.min(b[0], a), Math.min(b[1], c), Math.max(b[2], d), Math.max(b[3], e)] : [a, c, d, e]; }
    if (pe) add.apply(null, pe.p.bbox);
    (provSites[id] || []).forEach(function (s) { if (s._p) add(s._p[0], s._p[1], s._p[0], s._p[1]); });
    if (!b) { var n = nodes[id]; add(n.p[0] - 45, n.p[1] - 45, n.p[0] + 45, n.p[1] + 45); }
    return b;
  }
  function siteView(s) {
    var P = pads(), k = Math.min(MAXK, Math.max(S.k, fitK * 3.2));
    return { k: k, tx: P.l + (W - P.l - P.r) / 2 - s._p[0] * k, ty: P.t + (H - P.t - P.b) / 2 - s._p[1] * k };
  }
  function zoomToItems(items) {
    var b = null;
    items.forEach(function (s) {
      if (!s._p) return;
      b = b ? [Math.min(b[0], s._p[0]), Math.min(b[1], s._p[1]), Math.max(b[2], s._p[0]), Math.max(b[3], s._p[1])] : [s._p[0], s._p[1], s._p[0], s._p[1]];
    });
    if (!b) return;
    var pad = 4 / Math.max(S.k, 1);
    flyTo(boxView([b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], Math.min(MAXK, S.k * 1.6)), 650);
  }
  function size() {
    var r = root.getBoundingClientRect(); W = r.width || 1200; H = r.height || 640; fit();
    if (selProv) flyTo(selSite && selSite._p ? siteView(selSite) : boxView(provBox(selProv)), 0);
  }

  // arrastar (rato) / zoom (Ctrl + roda, duplo clique, botões)
  var drag = null, moved = false;
  svg.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0 || (e.target.closest && e.target.closest('.nm-node, .nm-nlab, .nm-pin, .nm-cl'))) return;
    stopFly(); moved = false;
    drag = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty }; svg.classList.add('nm-grab'); hideTip();
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true;
    S.tx = drag.tx + e.clientX - drag.x; S.ty = drag.ty + e.clientY - drag.y; clamp(); draw();
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
      if (filter === 'sites') show = false;
      o.g.style.display = show ? '' : 'none';
    });
    var tabs = root.querySelectorAll('.nm-tab');
    Array.prototype.forEach.call(tabs, function (t) { t.classList.toggle('active', t.getAttribute('data-filter') === filter); });
  }

  // ---------- controlos e informação
  var ui = document.getElementById('network-map-ui');
  if (ui) { root.appendChild(ui); ui.style.display = ''; }
  root.insertBefore(svg, root.firstChild); root.appendChild(tipEl);

  // ---------- gaveta com os sites da província
  var det = document.createElement('aside');
  det.className = 'nm-detail'; det.setAttribute('role', 'region'); det.setAttribute('aria-label', 'Sites da província');
  det.innerHTML =
    '<div class="nm-d-head">' +
      '<button type="button" class="nm-d-back"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Angola</span></button>' +
      '<h3 class="nm-d-title"></h3><p class="nm-d-sub" aria-live="polite"></p>' +
    '</div>' +
    '<div class="nm-d-tools">' +
      '<input type="search" class="nm-d-search" placeholder="Filtrar por nome, código ou local" aria-label="Filtrar os sites desta província" autocomplete="off">' +
      '<div class="nm-d-chips" role="group" aria-label="Tipo de site"></div>' +
    '</div>' +
    '<div class="nm-d-body"></div>' +
    '<div class="nm-d-foot">' +
      '<span class="nm-lg" title="Torre construída em terreno"><i class="nm-lg-gf"></i>Greenfield</span>' +
      '<span class="nm-lg" title="Estrutura instalada no topo de um edifício"><i class="nm-lg-rf"></i>Rooftop</span>' +
      '<span class="nm-lg" title="Vários sites próximos; amplie para os separar"><i class="nm-lg-cl">3</i>Grupo</span>' +
    '</div>';
  root.appendChild(det);
  var dTitle = det.querySelector('.nm-d-title'), dSub = det.querySelector('.nm-d-sub'), dBody = det.querySelector('.nm-d-body'),
      dSearch = det.querySelector('.nm-d-search'), dChips = det.querySelector('.nm-d-chips');

  function zoneOf(id) { var n = nodes[id]; return n ? (ZL[n.zone] || n.zone) : ''; }

  function renderHead() {
    var n = nodes[selProv], arr = provSites[selProv] || [], noPt = arr.filter(function (s) { return !s._p; }).length;
    dTitle.textContent = plain(n.name);
    var sub = plural(arr.length, 'site', 'sites') + ' · Zona ' + zoneOf(selProv);
    if (noPt) sub += ' · ' + noPt + ' sem ponto no mapa';
    dSub.textContent = sub;
  }
  function renderChips() {
    var arr = provSites[selProv] || [], cnt = { Greenfield: 0, Rooftop: 0 };
    arr.forEach(function (s) { cnt[s.type] = (cnt[s.type] || 0) + 1; });
    if (!(cnt.Greenfield && cnt.Rooftop)) { dChips.innerHTML = ''; dChips.style.display = 'none'; return; }
    dChips.style.display = '';
    dChips.innerHTML = [['all', 'Todos', arr.length], ['Greenfield', 'Greenfield', cnt.Greenfield], ['Rooftop', 'Rooftop', cnt.Rooftop]].map(function (c) {
      return '<button type="button" class="nm-chip' + (tf === c[0] ? ' active' : '') + '" data-t="' + c[0] + '" aria-pressed="' + (tf === c[0]) + '">' + c[1] + ' <em>' + c[2] + '</em></button>';
    }).join('');
  }
  function siteItemHTML(s) {
    return '<button type="button" class="nm-site' + (selSite === s ? ' on' : '') + '" data-id="' + esc(s.id) + '">' +
      '<i class="nm-lg-' + (s.type === 'Rooftop' ? 'rf' : 'gf') + '"></i>' +
      '<span class="nm-site-txt"><b>' + esc(s.name) + '</b><small>' + esc(s.addr) + '</small></span>' +
      (s._p ? '<span class="nm-site-id">' + esc(s.id) + '</span>' : '<span class="nm-site-id nm-nopt" title="Sem coordenadas válidas">sem ponto</span>') +
    '</button>';
  }
  function renderBody() {
    var arr = provSites[selProv] || [];
    det.classList.toggle('is-site', !!selSite);
    if (selSite) { dBody.innerHTML = siteDetailHTML(selSite); dBody.scrollTop = 0; return; }
    if (PARENT[selProv] || !arr.length) {
      var par = PARENT[selProv], pn = par && nodes[par];
      dChips.style.display = 'none'; dSearch.style.display = 'none';
      dBody.innerHTML = '<div class="nm-empty"><p>' + (par
        ? 'Esta província foi criada na reorganização territorial. Neste mapa, os sites da região continuam contabilizados em <b>' + esc(plain(pn.name)) + '</b>.'
        : 'Ainda não há sites registados nesta província.') + '</p>' +
        (par ? '<button type="button" class="nm-btn" data-go="' + par + '">Ver sites de ' + esc(plain(pn.name)) + '</button>' : '') + '</div>';
      return;
    }
    dSearch.style.display = '';
    curList = arr.filter(matches);
    pinEls.forEach(function (o) { o.show = matches(o.s); });
    var counts = {}; curList.forEach(function (s) { counts[s.mun] = (counts[s.mun] || 0) + 1; });
    var h = '', last = null;
    curList.forEach(function (s) {
      if (s.mun !== last) {
        if (last !== null) h += '</div>';
        last = s.mun;
        h += '<div class="nm-grp"><button type="button" class="nm-grp-b" data-mun="' + esc(s.mun) + '" title="Ver este município no mapa"><span>' + esc(s.mun) + '</span><em>' + counts[s.mun] + '</em></button>';
      }
      h += siteItemHTML(s);
    });
    if (last !== null) h += '</div>';
    if (!curList.length) h = '<div class="nm-empty"><p>Nenhum site corresponde ao filtro.</p></div>';
    dBody.innerHTML = h;
    var cur = dBody.querySelector('.nm-site.on'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    if (curList.length !== arr.length) dSub.textContent = curList.length + ' de ' + plural(arr.length, 'site', 'sites') + ' · Zona ' + zoneOf(selProv);
    else renderHead();
    draw();
  }
  function fmtCoord(v) { return v.toFixed(5); }
  function siteDetailHTML(s) {
    var idx = curList.indexOf(s), nav = '';
    if (idx > -1 && curList.length > 1) {
      nav = '<div class="nm-sd-nav"><button type="button" data-nav="-1" aria-label="Site anterior">Anterior</button><span>' + (idx + 1) + ' de ' + curList.length + '</span><button type="button" data-nav="1" aria-label="Site seguinte">Seguinte</button></div>';
    }
    var coords = s._p
      ? '<dd><span class="nm-sd-co">' + fmtCoord(s.lat) + ', ' + fmtCoord(s.lon) + '</span> <button type="button" class="nm-copy" data-copy="' + fmtCoord(s.lat) + ', ' + fmtCoord(s.lon) + '">Copiar</button></dd>'
      : '<dd class="nm-sd-warn">Coordenadas em validação. Este site ainda não tem ponto no mapa.</dd>';
    return '<div class="nm-sd">' +
      '<button type="button" class="nm-d-back nm-sd-back"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Voltar à lista</span></button>' +
      '<h4>' + esc(s.name) + '</h4>' +
      '<p class="nm-sd-tags"><span class="nm-badge">' + esc(s.id) + '</span><span class="nm-badge ' + (s.type === 'Rooftop' ? 'rf' : 'gf') + '"><i class="nm-lg-' + (s.type === 'Rooftop' ? 'rf' : 'gf') + '"></i>' + esc(s.type) + '</span></p>' +
      '<dl><dt>Município</dt><dd>' + esc(s.mun) + '</dd><dt>Localização</dt><dd>' + esc(s.addr) + '</dd><dt>Coordenadas</dt>' + coords + '</dl>' +
      (s._p ? '<a class="nm-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + s.lat + ',' + s.lon + '">Abrir no Google Maps</a>' : '') +
      nav + '</div>';
  }

  function refreshSelection() {
    root.classList.toggle('nm-has-detail', !!selProv);
    svg.classList.toggle('nm-dim', !!selProv);
    Object.keys(provEls).forEach(function (id) {
      var on = id === selProv;
      provEls[id].el.classList.toggle('sel', on);
      if (on) provLayer.appendChild(provEls[id].el);
    });
    var hasPins = !!selProv && (provSites[selProv] || []).some(function (s) { return s._p; });
    nodeEls.forEach(function (o) {
      var fade = !!selProv && o.n.id !== selProv, hide = hasPins && o.n.id === selProv;
      [o.g, o.gl].forEach(function (t) { t.classList.toggle('nm-faded', fade); t.classList.toggle('nm-hidden', hide); });
    });
  }

  function selectProvince(id, opts) {
    opts = opts || {};
    var n = nodes[id]; if (!n || !n.site) return;
    if (selProv === id && !opts.force) {                       // já aberta: só volta à lista
      if (selSite) backToList();
      return;
    }
    selProv = id; selSite = null; qText = ''; tf = 'all'; curList = [];
    dSearch.value = ''; dSearch.style.display = '';
    hideTip(); hideSugg();
    buildPins(provSites[id] || []);
    updateSelMark();
    refreshSelection();
    renderHead(); renderChips(); renderBody();
    var view = boxView(provBox(id));
    fitK = view.k;
    if (!opts.still) flyTo(view, 800);
    draw();
  }
  function closeProvince(noFly) {
    selProv = null; selSite = null; qText = ''; tf = 'all';
    buildPins([]); updateSelMark(); refreshSelection(); hideTip();
    if (!noFly) flyTo(home, 700);
  }
  function inDrawer() { return det.contains(document.activeElement); }
  function backToList() {
    var had = inDrawer();
    selSite = null; updateSelMark(); renderBody(); draw();
    if (had) { var it = dBody.querySelector('.nm-site.on') || dBody.querySelector('.nm-site'); if (it) it.focus({ preventScroll: true }); }
  }
  function selectSite(s, fly) {
    var fresh = !selProv || s.prov !== selProv;
    if (fresh) selectProvince(s.prov, { still: true, force: true });
    var had = inDrawer();
    selSite = s;
    updateSelMark(); renderBody(); draw();
    if (had) { var f = dBody.querySelector('.nm-sd-back'); if (f) f.focus({ preventScroll: true }); }
    if (!s._p) { if (fresh) flyTo(boxView(provBox(selProv)), 800); return; }   // sem ponto: mostrar a província
    var o = pinById[s.id], P = pads();
    var visible = o && o.x > P.l && o.x < W - P.r && o.y > P.t && o.y < H - P.b;
    if (fly !== false || !visible) flyTo(siteView(s), 750);
  }
  function setHot(id, on) { var o = pinById[id]; if (o) o.g.classList.toggle('hot', on); }

  // eventos da gaveta (delegados)
  det.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var b;
    if ((b = t.closest('.nm-sd-back'))) { backToList(); return; }
    if ((b = t.closest('.nm-d-back'))) { closeProvince(); return; }
    if ((b = t.closest('.nm-chip'))) {
      tf = b.getAttribute('data-t'); renderChips(); renderBody();
      var ac = dChips.querySelector('.nm-chip.active'); if (ac) ac.focus({ preventScroll: true });
      return;
    }
    if ((b = t.closest('.nm-site'))) { selectSite(siteById[b.getAttribute('data-id')], true); return; }
    if ((b = t.closest('.nm-grp-b'))) {
      var mun = b.getAttribute('data-mun');
      zoomToItems((provSites[selProv] || []).filter(function (s) { return s.mun === mun && matches(s); })); return;
    }
    if ((b = t.closest('[data-nav]'))) {
      var i = curList.indexOf(selSite) + parseInt(b.getAttribute('data-nav'), 10);
      if (i >= 0 && i < curList.length) selectSite(curList[i], true);
      return;
    }
    if ((b = t.closest('[data-go]'))) { var go = b.getAttribute('data-go'); closeProvince(true); selectProvince(go); return; }
    if ((b = t.closest('.nm-copy'))) {
      var txt = b.getAttribute('data-copy'), done = function () { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
      else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (er) {} document.body.removeChild(ta); }
    }
  });
  det.addEventListener('mouseover', function (e) { var b = e.target.closest && e.target.closest('.nm-site'); if (b) setHot(b.getAttribute('data-id'), true); });
  det.addEventListener('mouseout', function (e) { var b = e.target.closest && e.target.closest('.nm-site'); if (b) setHot(b.getAttribute('data-id'), false); });
  dSearch.addEventListener('input', function () { qText = norm(dSearch.value.trim()); renderBody(); });
  var inside = false;
  root.addEventListener('mouseenter', function () { inside = true; });
  root.addEventListener('mouseleave', function () { inside = root.contains(document.activeElement); });
  root.addEventListener('focusin', function () { inside = true; });
  root.addEventListener('focusout', function (e) { if (!e.relatedTarget || !root.contains(e.relatedTarget)) inside = false; });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !selProv || !inside) return;
    if (selSite) backToList(); else closeProvince();
  });

  // ---------- pesquisa (províncias e sites)
  var sIn = document.getElementById('nm-search'), sugg = null, suggItems = [], suggI = -1;
  function hideSugg() { if (sugg) { sugg.style.display = 'none'; sugg.innerHTML = ''; } suggItems = []; suggI = -1; }
  function pick(it) {
    if (!it) return;
    hideSugg(); if (sIn) sIn.value = '';
    if (it.s) selectSite(it.s, true); else selectProvince(it.id);
  }
  function paintSugg() {
    sugg.innerHTML = suggItems.map(function (it, k) {
      return '<button type="button" role="option" class="nm-sg' + (k === suggI ? ' on' : '') + '" data-k="' + k + '"><b>' + esc(it.label) + '</b><small>' + esc(it.sub) + '</small></button>';
    }).join('');
    sugg.style.display = suggItems.length ? 'block' : 'none';
  }
  if (sIn) {
    sugg = document.createElement('div'); sugg.className = 'nm-sugg'; sugg.setAttribute('role', 'listbox'); sugg.style.display = 'none';
    sIn.parentNode.insertBefore(sugg, sIn.nextSibling);
    sIn.addEventListener('input', function (e) {
      var q = norm(e.target.value.trim());
      if (q.length < 2) { hideSugg(); return; }
      var out = [];
      list.filter(function (n) { return n.site && norm(n.name).indexOf(q) > -1; }).slice(0, 3).forEach(function (n) {
        out.push({ id: n.id, label: plain(n.name), sub: 'Província · ' + plural(n.count, 'site', 'sites') });
      });
      var ss = SITES.filter(function (s) { return norm(s.name + ' ' + s.id + ' ' + s.addr).indexOf(q) > -1; });
      ss.slice(0, 8 - out.length).forEach(function (s) { out.push({ s: s, label: s.name, sub: s.id + ' · ' + s.mun }); });
      suggItems = out; suggI = out.length ? 0 : -1; paintSugg();
    });
    sIn.addEventListener('keydown', function (e) {
      if (!suggItems.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); suggI = (suggI + 1) % suggItems.length; paintSugg(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); suggI = (suggI - 1 + suggItems.length) % suggItems.length; paintSugg(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(suggItems[suggI]); }
      else if (e.key === 'Escape') { e.stopPropagation(); hideSugg(); }
    });
    sugg.addEventListener('mousedown', function (e) { e.preventDefault(); });
    sugg.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.nm-sg'); if (b) pick(suggItems[parseInt(b.getAttribute('data-k'), 10)]); });
    sIn.addEventListener('blur', function () { setTimeout(hideSugg, 120); });
  }

  function on(id, ev, fn) { var n = document.getElementById(id); if (n) n.addEventListener(ev, fn); }
  on('nm-zoom-in', 'click', function () { zoomAt(1.4, W / 2, H / 2); });
  on('nm-zoom-out', 'click', function () { zoomAt(1 / 1.4, W / 2, H / 2); });
  on('nm-reset', 'click', function () { if (selProv) closeProvince(); else flyTo(home, 600); hideTip(); });
  on('nm-luanda', 'click', function () {
    if (selProv === 'luanda') { if (selSite) backToList(); flyTo(boxView(provBox('luanda')), 700); } else selectProvince('luanda');
  });
  Array.prototype.forEach.call(root.querySelectorAll('.nm-tab'), function (t) {
    t.addEventListener('click', function () { filter = t.getAttribute('data-filter'); applyFilter(); });
  });

  var T = window.ANTOSC_TOTALS || {}, NT = window.ANTOSC_NETWORK_TOTALS || {};
  function setTxt(id, v) { var n = document.getElementById(id); if (n && v !== undefined) n.textContent = v; }
  setTxt('nm-sites', T.sites); setTxt('nm-active', NT.active); setTxt('nm-building', NT.building); setTxt('nm-cross', NT.crossBorder);
  if (META.validated === false) {
    var b = document.createElement('div'); b.className = 'nm-banner';
  }
  if (META.updated) setTxt('nm-updated', 'Dados atualizados em ' + META.updated);

  layoutLabels(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layoutLabels(); updateSelMark(); });
  size(); applyFilter();
  if (window.ResizeObserver) new ResizeObserver(function () { size(); }).observe(root); else window.addEventListener('resize', size);
  window.ANTOSC_MAP = { svg: svg, fit: fit, select: selectProvince, selectSite: function (id) { if (siteById[id]) selectSite(siteById[id], true); }, close: closeProvince };
})();
