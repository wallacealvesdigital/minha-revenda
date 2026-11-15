'use strict';
/* Minha Revenda — estoque, vendas e clientes de uma revendedora (mercadoria consignada).
   Tudo fica no celular (IndexedDB). A leitura da foto da lista usa a API do Gemini. */

// ================= utilidades =================
const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = (n) => { n = Number(n) || 0; return Math.round(n * 100 + (n < 0 ? -1e-6 : 1e-6)) / 100; };
const brl = (n) => 'R$ ' + r2(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec = (n) => (n == null ? '' : r2(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const num = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').replace(/[^\d,.]/g, '');
  if (!t) return null;
  const n = t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
  return isNaN(n) ? null : n;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hoje = () => iso(new Date());
const dm = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');
const dma = (d) => (d ? dm(d) + '/' + d.slice(0, 4) : '');
const soma = (arr, f) => r2(arr.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

const IC = {
  mais: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  foto: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  voltar: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  busca: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  certo: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ajustes: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  inicio: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  estoque: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  vender: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  clientes: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.8c1.8.7 3 2.5 3.5 5.2"/></svg>'
};

// ================= banco no aparelho =================
const STORES = ['produtos', 'clientes', 'vendas', 'pagamentos', 'movimentos', 'fotos', 'config'];
const S = { produtos: [], clientes: [], vendas: [], pagamentos: [], movimentos: [], cfg: { id: 'main' } };
let db;

function abrirDB() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('minha-revenda', 1);
    r.onupgradeneeded = () => {
      for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
function ler(store, id) {
  return new Promise((ok, erro) => {
    const t = db.transaction(store, 'readonly');
    const req = id === undefined ? t.objectStore(store).getAll() : t.objectStore(store).get(id);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}
// ops: [store, objeto] grava; [store, null, id] apaga. Tudo numa transação só.
function gravar(ops, limpar = []) {
  const stores = [...new Set(ops.map((o) => o[0]).concat(limpar))];
  return new Promise((ok, erro) => {
    const t = db.transaction(stores, 'readwrite');
    for (const s of limpar) t.objectStore(s).clear();
    for (const [s, obj, id] of ops) obj ? t.objectStore(s).put(obj) : t.objectStore(s).delete(id);
    t.oncomplete = () => ok();
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error || new Error('Não consegui salvar.'));
  });
}
async function commit(ops) {
  await gravar(ops);
  for (const [s, obj, idDel] of ops) {
    if (s === 'fotos') continue;
    if (s === 'config') { S.cfg = obj; continue; }
    const arr = S[s];
    const id = obj ? obj.id : idDel;
    const i = arr.findIndex((x) => x.id === id);
    if (obj) i >= 0 ? (arr[i] = obj) : arr.push(obj);
    else if (i >= 0) arr.splice(i, 1);
  }
}
async function carregar() {
  for (const s of ['produtos', 'clientes', 'vendas', 'pagamentos', 'movimentos']) S[s] = await ler(s);
  S.cfg = (await ler('config', 'main')) || { id: 'main' };
}
const salvarCfg = (patch) => commit([['config', { ...S.cfg, ...patch }]]);

// ================= regras do negócio =================
const produto = (id) => S.produtos.find((p) => p.id === id);
const prodPorCod = (cod) => (cod ? S.produtos.find((p) => p.cod === cod) : null);
const cliente = (id) => S.clientes.find((c) => c.id === id);
const devido = (v) => r2(v.total - v.pago);
const ganhoVenda = (v) => soma(v.itens, (i) => (i.preco * i.qtd * i.com) / 100);
const saldo = (cid) => soma(S.vendas.filter((v) => v.clienteId === cid), devido);
const ordemVenda = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.criado - b.criado);
const vendasDe = (cid) => S.vendas.filter((v) => v.clienteId === cid).sort(ordemVenda).reverse();
const valorMov = (m) => soma(m.itens, (i) => i.qtd * i.preco);
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0];
const ultimaCompra = (cid) => { const v = vendasDe(cid)[0]; return v ? v.data : null; };

// A empresa passa a cada 2 meses: recolhe o que não vendeu, entrega produto novo e recebe o TOTAL vendido.
// A comissão dela a empresa calcula e paga depois; no app o ganho é só pra acompanhar.
const DIAS_ENTRE_VISITAS = 60;
const ultimoAcerto = () => S.movimentos.filter((m) => m.tipo === 'repasse').sort((a, b) => a.criado - b.criado).slice(-1)[0] || null;
const vendasDoPeriodo = () => { const u = ultimoAcerto(); return S.vendas.filter((v) => !u || v.criado > u.criado); };
const ultimoMov = (tipo) => S.movimentos.filter((m) => !tipo || m.tipo === tipo).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.criado - b.criado)).slice(-1)[0] || null;
const somaDias = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };

// Pagamento abate primeiro a compra mais antiga
function alocar(cid, valor) {
  let resta = r2(valor);
  const aloc = [];
  const vendas = [];
  for (const v of S.vendas.filter((x) => x.clienteId === cid && devido(x) > 0).sort(ordemVenda)) {
    if (resta <= 0) break;
    const parte = Math.min(resta, devido(v));
    aloc.push({ vendaId: v.id, valor: r2(parte) });
    vendas.push({ ...v, pago: r2(v.pago + parte) });
    resta = r2(resta - parte);
  }
  return { aloc, vendas };
}

// ================= navegação e desenho =================
let V = {};          // estado da tela aberta
let LEITURA = null;  // lista lida da foto, esperando conferência
let TRAVA = null;    // tela de PIN (null = destravado)
let escondidoEm = 0;

function rota() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const p = path.split('/').filter(Boolean);
  return { nome: p[0] || 'inicio', id: p[1] ? decodeURIComponent(p[1]) : null, q: Object.fromEntries(new URLSearchParams(qs || '')), chave: h };
}
const ir = (h) => { location.hash = h; };
let ultimaChave = '';

function tela() {
  if (TRAVA) return tPin();
  const r = rota();
  const f = TELAS[r.nome] || tInicio;
  return f(r);
}

function render(modo) {
  const html = tela();
  if (modo === 'parcial') {
    const t = document.createElement('template');
    t.innerHTML = html;
    $app.querySelectorAll('[data-r]').forEach((el) => {
      const n = t.content.querySelector('[data-r="' + CSS.escape(el.dataset.r) + '"]');
      if (n) { el.innerHTML = n.innerHTML; for (const a of ['class', 'disabled']) n.hasAttribute(a) ? el.setAttribute(a, n.getAttribute(a)) : el.removeAttribute(a); }
    });
    return;
  }
  const chave = TRAVA ? 'pin' : rota().chave;
  const mesma = chave === ultimaChave;
  const ativo = document.activeElement && document.activeElement.id;
  const scroll = mesma ? [...$app.querySelectorAll('.main,.sheet')].map((e) => e.scrollTop) : [];
  $app.innerHTML = html;
  if (mesma) {
    [...$app.querySelectorAll('.main,.sheet')].forEach((e, i) => { if (scroll[i]) e.scrollTop = scroll[i]; });
    if (ativo) { const el = document.getElementById(ativo); if (el && el.focus) el.focus({ preventScroll: true }); }
  } else {
    const auto = $app.querySelector('[data-auto]');
    if (auto && !auto.value) auto.focus({ preventScroll: true });
  }
  ultimaChave = chave;
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function nav(ativo) {
  const it = [['inicio', '#/', 'Início'], ['estoque', '#/estoque', 'Estoque'], ['vender', '#/venda', 'Vender'], ['clientes', '#/clientes', 'Clientes']];
  return '<nav class="nav" aria-label="Menu">' + it.map(([k, h, t]) => `<a href="${h}" class="${k === ativo ? 'on' : ''}">${IC[k]}${t}</a>`).join('') + '</nav>';
}
const voltar = (h, txt) => `<a class="back" href="${h}">${IC.voltar}${esc(txt)}</a>`;
const pronto = (titulo, texto, botoes) => `<div class="screen"><main class="done"><div class="done-ic">${IC.certo}</div><h1>${titulo}</h1>${texto}${botoes}</main></div>`;
const stepper = (menos, mais, val, extra = '', grande = false) =>
  `<div class="stepper"><button type="button" class="step ${grande ? 'grande' : ''}" data-a="${menos}" ${extra} aria-label="Diminuir">−</button><strong aria-live="polite">${val}</strong><button type="button" class="step ${grande ? 'grande' : ''}" data-a="${mais}" ${extra} aria-label="Aumentar">+</button></div>`;

// ================= telas =================
function tInicio() {
  const periodo = vendasDoPeriodo();
  const vendi = soma(periodo, (v) => v.total);
  const ganho = soma(periodo, ganhoVenda);
  const aReceber = soma(S.vendas, devido);
  const acerto = ultimoAcerto();
  const visita = ultimoMov();
  const ultChegou = ultimoMov('chegou');
  const ultDevolvi = ultimoMov('devolvi');
  const acabando = S.produtos.filter((p) => p.qtd <= 2).length;
  const devedoras = S.clientes.map((c) => ({ c, s: saldo(c.id) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  const mesTxt = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const ub = S.cfg.ultimoBackup;
  const dias = ub ? Math.round((new Date(hoje()) - new Date(ub)) / 864e5) : null;
  const backupTxt = ub
    ? `Última cópia: ${dm(ub)}, ${dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias'}.`
    : 'Você ainda não fez nenhuma cópia.';
  const atrasado = dias === null || dias >= 7;
  return `<div class="screen">
  <header class="top"><div class="row">
    <div class="col" style="gap:2px"><span class="muted" style="font-size:16px">${esc(mesTxt[0].toUpperCase() + mesTxt.slice(1))}</span><h1>Olá${S.cfg.nome ? ', ' + esc(S.cfg.nome) : ''}</h1></div>
    <a href="#/ajustes" class="step" style="display:flex;align-items:center;justify-content:center;color:var(--texto)" aria-label="Ajustes">${IC.ajustes}</a>
  </div></header>
  <main class="main">
    <span class="muted small" style="font-weight:700">${acerto ? 'Desde o último acerto com a empresa (' + dm(acerto.data) + ')' : 'Desde o começo'}</span>
    <section class="grid2" aria-label="Resumo desde o último acerto">
      <div class="card stat"><span class="muted small">Vendi</span><strong>${brl(vendi)}</strong></div>
      <div class="card stat"><span class="muted small">Meu ganho previsto</span><strong class="ok">${brl(ganho)}</strong></div>
      <div class="card stat"><span class="muted small">Falta receber das clientes</span><strong class="owe">${brl(aReceber)}</strong></div>
      <div class="card stat"><span class="muted small">Passar pra empresa (total vendido)</span><strong>${brl(vendi)}</strong></div>
    </section>
    <div class="col">
      <a class="btn btn-p" href="#/venda">${IC.mais}Nova venda</a>
      <div class="grid2"><a class="btn btn-s" href="#/pagamento">Receber</a><a class="btn btn-s" href="#/foto">${IC.foto}Foto da lista</a></div>
    </div>
    <section class="card">
      <h2 style="margin:0">Meu estoque</h2>
      <div class="row"><span class="muted">Unidades guardadas</span><strong>${soma(S.produtos, (p) => p.qtd)}</strong></div>
      <div class="row"><span class="muted">Valem, se vender tudo</span><strong>${brl(soma(S.produtos, (p) => p.qtd * p.preco))}</strong></div>
      ${ultChegou ? `<div class="row"><span class="muted">Última entrega (${dm(ultChegou.data)})</span><strong>${brl(valorMov(ultChegou))}</strong></div>` : ''}
      ${ultDevolvi ? `<div class="row"><span class="muted">Última devolução (${dm(ultDevolvi.data)})</span><strong>${brl(valorMov(ultDevolvi))}</strong></div>` : ''}
      ${acabando ? `<a class="row" href="#/estoque?so=acabando" style="min-height:44px;color:var(--aviso);font-weight:700">${plural(acabando, 'produto acabando', 'produtos acabando')}<span aria-hidden="true">›</span></a>` : ''}
      <a class="row" href="#/historico" style="min-height:44px;font-weight:700">Ver o que chegou e o que devolvi<span aria-hidden="true">›</span></a>
    </section>
    <section class="card">
      <h2 style="margin:0">Visita da empresa</h2>
      <span class="muted small">${S.cfg.proximaVisita && S.cfg.proximaVisita >= hoje() ? `${visita ? `Última visita em ${dma(visita.data)}. ` : ''}Próxima visita marcada na lista: <strong>${dma(S.cfg.proximaVisita)}</strong>.` : visita ? `Última visita em ${dma(visita.data)}. A próxima deve ser por volta de ${dm(somaDias(visita.data, DIAS_ENTRE_VISITAS))}.` : 'A empresa passa a cada 2 meses: recolhe o que não vendeu, entrega produto novo e recebe o total vendido.'}</span>
      <a class="btn btn-s" href="#/acerto">A empresa veio: fazer o acerto</a>
    </section>
    <section class="card">
      <h2 style="margin:0">Quem está devendo</h2>
      ${devedoras.length ? devedoras.map((x) => `<a class="row" href="#/cliente/${encodeURIComponent(x.c.id)}" style="min-height:44px"><span>${esc(x.c.nome)}</span><span class="owe">${brl(x.s)}</span></a>`).join('') : '<span class="muted">Ninguém devendo agora.</span>'}
      <a href="#/clientes" style="min-height:44px;display:flex;align-items:center;font-weight:700">Ver todas as clientes</a>
    </section>
    <section class="card">
      <h2 style="margin:0">Cópia de segurança</h2>
      <span class="small ${atrasado ? 'warn' : 'muted'}">${backupTxt} Faça uma por semana pra não perder nada se o celular quebrar.</span>
      <button type="button" class="btn btn-s" data-a="backupEnviar">Fazer cópia agora</button>
    </section>
  </main>${nav('inicio')}</div>`;
}

function tEstoque(r) {
  if (V.so === undefined) V.so = r.q.so === 'acabando' ? 'acabando' : 'todos';
  V.q = V.q || '';
  const q = norm(V.q.trim());
  const lista = S.produtos
    .filter((p) => (!q || norm(p.nome).includes(q) || p.cod.includes(q)) && (V.so === 'todos' || p.qtd <= 2))
    .sort((a, b) => (a.qtd > 0) !== (b.qtd > 0) ? (a.qtd > 0 ? -1 : 1) : a.nome.localeCompare(b.nome, 'pt-BR'));
  const nAcab = S.produtos.filter((p) => p.qtd <= 2).length;
  const itens = lista.map((p) => `<a class="item row" href="#/produto/${encodeURIComponent(p.id)}">
      <div class="col" style="gap:2px;min-width:0"><strong>${esc(p.nome)}</strong><span class="muted small">Cód. ${esc(p.cod)} · ${brl(p.preco)} · ganho ${p.com}%</span></div>
      <div class="col" style="align-items:flex-end;gap:4px"><span><strong style="font-size:22px">${p.qtd}</strong> <span class="muted small">un.</span></span>${p.qtd <= 2 ? `<span class="tag">${p.qtd === 0 ? 'Acabou' : 'Acabando'}</span>` : ''}</div>
    </a>`).join('');
  const vazio = !S.produtos.length
    ? '<div class="item col" style="gap:12px"><span>Seu estoque está vazio. Quando chegar mercadoria, toque em “Chegou mercadoria” e tire foto da lista.</span></div>'
    : !lista.length ? `<div class="item col" style="gap:12px"><span>Nenhum produto${V.q ? ' com “' + esc(V.q) + '”' : ''}.</span><a class="btn btn-s" href="#/produto/novo">Cadastrar produto novo</a></div>` : '';
  return `<div class="screen">
  <header class="top">
    <div class="row"><div class="col" style="gap:0"><h1>Estoque</h1><span class="muted small">${soma(S.produtos, (p) => p.qtd)} unidades guardadas</span></div>
      <a href="#/historico" class="linkbtn">Histórico</a></div>
    <a class="btn btn-p" href="#/foto">${IC.foto}Chegou mercadoria</a>
    <div class="grid2"><a class="btn btn-s" href="#/devolver">Devolver</a><a class="btn btn-s" href="#/produto/novo">${IC.mais}Produto</a></div>
    <div class="search">${IC.busca}<label class="sr" for="busca">Buscar produto</label><input id="busca" type="search" placeholder="Nome ou código do produto" value="${esc(V.q)}" data-i="q" autocomplete="off"></div>
    <div class="chips"><button type="button" class="chip ${V.so === 'todos' ? 'on' : ''}" data-a="filtro" data-v="todos">Todos</button><button type="button" class="chip ${V.so === 'acabando' ? 'on' : ''}" data-a="filtro" data-v="acabando">Acabando (${nAcab})</button></div>
  </header>
  <main class="main" data-r="lista">${itens}${vazio}</main>${nav('estoque')}</div>`;
}

function tProduto(r) {
  const novo = !r.id || r.id === 'novo';
  const p = novo ? null : produto(r.id);
  if (!novo && !p) return naoAchei('Produto não encontrado.', '#/estoque', 'Voltar ao estoque');
  if (!V.init) Object.assign(V, { init: 1, cod: p ? p.cod : '', nome: p ? p.nome : '', preco: p ? dec(p.preco) : '', com: p ? p.com : null, qtd: p ? p.qtd : 1 });
  const v = num(V.preco);
  const outra = V.com != null && V.com !== 25 && V.com !== 35;
  return `<div class="screen">
  <header class="top">${voltar('#/estoque', 'Estoque')}<h1>${novo ? 'Novo produto' : 'Editar produto'}</h1></header>
  <main class="main">
    <div class="field"><label for="cod">Código</label><input id="cod" class="input" inputmode="numeric" value="${esc(V.cod)}" data-i="cod" placeholder="Ex.: 10234" autocomplete="off" ${novo ? 'data-auto' : ''}></div>
    <div class="field"><label for="nome">Nome do produto</label><input id="nome" class="input" value="${esc(V.nome)}" data-i="nome" placeholder="Ex.: Batom Matte Vermelho" autocomplete="off"></div>
    <div class="field"><label for="preco">Preço de venda</label><input id="preco" class="input" inputmode="decimal" value="${esc(V.preco)}" data-i="preco" placeholder="R$ 0,00" autocomplete="off"></div>
    <div class="field"><span class="lbl">Quanto eu ganho em cada venda</span>
      <div class="grid2"><button type="button" class="opt grande ${V.com === 25 ? 'on' : ''}" data-a="prodCom" data-v="25">25%</button><button type="button" class="opt grande ${V.com === 35 ? 'on' : ''}" data-a="prodCom" data-v="35">35%</button></div>
      ${outra ? `<span class="small muted">Esse produto está com ${V.com}% (veio da lista). Toque em 25% ou 35% pra trocar.</span>` : ''}
    </div>
    <div class="card" style="gap:2px" data-r="ganho">${v != null && V.com != null
      ? `<div class="row"><span>Você ganha em cada um</span><span class="ok" style="font-size:22px">${brl((v * V.com) / 100)}</span></div><span class="muted small">O resto (${brl(v - (v * V.com) / 100)}) é da empresa.</span>`
      : '<span class="muted small">Coloque o preço e escolha a porcentagem pra ver quanto você ganha.</span>'}</div>
    <div class="field"><span class="lbl">Quantas unidades eu tenho</span>${stepper('prodMenos', 'prodMais', V.qtd, '', true)}</div>
    ${V.erro ? `<div class="erro" role="alert">${esc(V.erro)}</div>` : ''}
    <button type="button" class="btn btn-p" data-a="prodSalvar" style="margin-top:8px">Salvar produto</button>
    ${novo ? '' : '<button type="button" class="btn btn-perigo" data-a="prodApagar">Apagar produto</button>'}
  </main></div>`;
}

function tFoto(r) {
  const juntar = r.q.juntar === '1' && LEITURA;
  if (V.estado === 'lendo') {
    return `<div class="screen"><main class="done"><div class="spin" aria-hidden="true"></div><h1>Lendo a lista…</h1><span class="muted">Leva uns segundos. Não feche o app.</span>
      ${V.preview ? `<div class="foto-area" style="width:100%"><img src="${V.preview}" alt="Foto da lista"></div>` : ''}</main></div>`;
  }
  const semChave = !S.cfg.geminiKey;
  return `<div class="screen">
  <header class="top">${voltar(juntar ? '#/conferir' : '#/estoque', juntar ? 'Conferir lista' : 'Estoque')}<h1>${juntar ? 'Mais uma foto da lista' : 'Foto da lista'}</h1>
    <span class="muted">${juntar ? 'Os produtos dessa foto entram junto na mesma conferência.' : 'Tire foto da lista de produtos que chegou. Eu leio e você confere antes de entrar no estoque.'}</span></header>
  <main class="main">
    <div class="foto-area">${IC.foto.replace('class="ic"', 'class="ic" style="width:48px;height:48px;stroke-width:1.5"')}<span>A foto aparece aqui</span></div>
    ${V.erro ? `<div class="erro" role="alert">${esc(V.erro)}</div>` : ''}
    <section class="card"><strong>Pra foto sair boa</strong>
      <div class="tip"><span class="num">1</span><span>Coloque a lista numa mesa, bem esticada.</span></div>
      <div class="tip"><span class="num">2</span><span>Fique num lugar claro, sem sombra em cima do papel.</span></div>
      <div class="tip"><span class="num">3</span><span>Enquadre a folha inteira. Se for grande, tire uma foto de cada parte.</span></div>
    </section>
    ${semChave ? `<div class="erro">Pra ler a foto falta colocar a chave do Gemini. <a href="#/ajustes">Abrir ajustes</a></div>` : `
    <div class="col">
      <label class="btn btn-p">${IC.foto}Tirar foto da lista<input type="file" accept="image/*" capture="environment" class="sr" data-c="fotoEscolhida"></label>
      <label class="btn btn-s">Escolher foto da galeria<input type="file" accept="image/*" class="sr" data-c="fotoEscolhida"></label>
    </div>
    <span class="muted small" style="text-align:center">Pra ler a foto o celular precisa estar com internet.</span>`}
    <button type="button" class="linkbtn" data-a="digitarMao" style="align-self:center">Prefiro digitar a lista à mão</button>
  </main></div>`;
}

function itemProblemas(it) {
  if (!it.on) return [];
  const p = [];
  if (!it.cod) p.push('Falta o código do produto.');
  if (!it.nome) p.push('Falta o nome do produto.');
  if (it.preco == null) p.push('Não consegui ler o preço. Toque em “Corrigir” e coloque.');
  if (!it.qtd) p.push('Não consegui ler a quantidade. Quantas chegaram?');
  if (it.com == null) p.push('Não consegui ler quanto você ganha nesse. Escolha:');
  return p;
}

function tConferir() {
  if (V.feito) {
    const f = V.feito;
    return pronto('Mercadoria guardada', `<span class="muted">Entraram ${plural(f.un, 'unidade', 'unidades')} de ${plural(f.n, 'produto', 'produtos')}, da lista de ${dma(f.data)}. A lista${f.fotos ? ' e a foto ficam' : ' fica'} no histórico.</span>`,
      '<a class="btn btn-p" href="#/estoque">Ver estoque</a><a class="btn btn-s" href="#/historico">Ver histórico</a>');
  }
  if (!LEITURA) return naoAchei('Nenhuma lista pra conferir agora.', '#/foto', 'Tirar foto da lista');
  const L = LEITURA;
  const itens = L.itens.map((it) => {
    const p = prodPorCod(it.cod);
    const probs = itemProblemas(it);
    const cls = !it.on ? 'fora' : probs.length ? 'alerta' : '';
    const k = esc(it.k);
    const edit = it.edit || (it.on && (!it.cod || !it.nome || it.preco == null));
    return `<div class="conf ${cls}">
      <div class="row" style="align-items:flex-start">
        <div class="col" style="gap:2px;min-width:0"><strong>${esc(it.nome || 'Produto sem nome')}</strong>
          <span class="muted small">Cód. ${esc(it.cod || '?')} · vende por ${it.preco != null ? brl(it.preco) : '?'}${it.com != null ? ' · ganho ' + it.com + '%' : ''}</span></div>
        <span class="tag ${p ? 'tag-ok' : 'tag-novo'}">${p ? 'Tinha ' + p.qtd : 'Produto novo'}</span>
      </div>
      ${edit ? `<div class="col" style="gap:8px">
        <div class="field"><label for="cc-${k}">Código</label><input id="cc-${k}" class="input sm" inputmode="numeric" value="${esc(it.cod)}" data-set="confCampo" data-k="${k}" data-f="cod" autocomplete="off"></div>
        <div class="field"><label for="cn-${k}">Nome</label><input id="cn-${k}" class="input sm" value="${esc(it.nome)}" data-set="confCampo" data-k="${k}" data-f="nome" autocomplete="off"></div>
        <div class="field"><label for="cp-${k}">Preço de venda (cada um)</label><input id="cp-${k}" class="input sm" inputmode="decimal" value="${esc(it.precoTxt ?? dec(it.preco))}" data-set="confCampo" data-k="${k}" data-f="preco" placeholder="R$ 0,00" autocomplete="off"></div>
        <button type="button" class="btn btn-s" data-a="confOk" data-v="${k}" style="min-height:48px">Pronto</button>
      </div>` : `<button type="button" class="linkbtn small" data-a="confEditar" data-v="${k}" style="align-self:flex-start">Corrigir nome, código ou preço</button>`}
      <div data-r="al-${k}" class="col" style="gap:4px">${probs.map((t) => `<span class="small warn">${t}</span>`).join('')}</div>
      ${it.on && (it.lerCom || it.com == null) ? `<div class="grid2"><button type="button" class="opt ${it.com == null ? 'alerta' : ''} ${it.com === 25 ? 'on' : ''}" data-a="confCom" data-v="${k}|25">25%</button><button type="button" class="opt ${it.com == null ? 'alerta' : ''} ${it.com === 35 ? 'on' : ''}" data-a="confCom" data-v="${k}|35">35%</button></div>` : ''}
      <div class="row">
        <label class="check" for="ch-${k}"><input id="ch-${k}" type="checkbox" ${it.on ? 'checked' : ''} data-c="confChegou" data-k="${k}">Chegou</label>
        ${stepper('confMenos', 'confMais', it.qtd || 0, `data-v="${k}"`)}
      </div>
    </div>`;
  }).join('');
  return `<div class="screen">
  <header class="top">
    ${voltar('#/foto', 'Tirar outra foto')}<h1>Confira a lista</h1>
    <div class="row"><label for="data" class="small" style="font-weight:700">Data da lista<br><span class="muted" style="font-weight:400">${L.dataLida ? 'li na foto, confira' : 'confira a data'}</span></label>
      <input id="data" class="date" type="date" value="${esc(L.data)}" max="${hoje()}" data-c="confData"></div>
    <span class="muted small">${L.itens.length ? `Encontrei ${plural(L.itens.length, 'produto', 'produtos')}. Corrija o que estiver errado e desmarque o que não chegou.` : 'Nenhum produto ainda. Use “Adicionar produto” pra colocar à mão.'}</span>
  </header>
  <main class="main">${itens}
    <button type="button" class="btn btn-s" data-a="confAdd">${IC.mais}Adicionar produto que faltou</button>
    <a class="btn btn-s" href="#/foto?juntar=1">${IC.foto}Juntar outra foto (lista grande)</a>
    <button type="button" class="linkbtn" data-a="confDescartar" style="align-self:center">Descartar essa lista</button>
  </main>
  <div class="foot" data-r="foot">${confRodape()}</div></div>`;
}
function confRodape() {
  const incl = LEITURA.itens.filter((x) => x.on && x.qtd > 0);
  const pend = LEITURA.itens.filter((x) => itemProblemas(x).length).length;
  const T = LEITURA.total;
  let confere = '';
  if (T) {
    const lidos = LEITURA.itens.filter((x) => x.qtd > 0);
    const q = soma(lidos, (x) => x.qtd), v = r2(soma(lidos, (x) => x.qtd * (x.preco || 0)));
    confere = q === T.qtd && Math.abs(v - T.valor) < 0.01
      ? `<span class="small ok">Bate com o total da lista: ${plural(T.qtd, 'peça', 'peças')}, ${brl(T.valor)}.</span>`
      : `<span class="small warn">O total da lista é ${plural(T.qtd, 'peça', 'peças')} e ${brl(T.valor)}. Aqui deu ${plural(q, 'peça', 'peças')} e ${brl(v)}. Confira quantidades e preços.</span>`;
  }
  return `${confere}<div class="row small"><span class="muted">${plural(soma(incl, (x) => x.qtd), "unidade", "unidades")} em produtos</span><strong>${brl(soma(incl, (x) => x.qtd * (x.preco || 0)))}</strong></div>
    <div class="row small"><span class="muted">Se vender tudo, eu ganho</span><span class="ok">${brl(soma(incl, (x) => (x.qtd * (x.preco || 0) * (x.com || 0)) / 100))}</span></div>
    ${pend ? `<span class="small warn">Falta conferir ${plural(pend, 'item marcado', 'itens marcados')} em laranja.</span>` : ''}
    <button type="button" class="btn btn-p" data-a="confConfirmar" ${pend || !incl.length ? 'disabled' : ''}>Colocar no estoque</button>`;
}

function tDevolver() {
  if (V.feito) {
    const f = V.feito;
    return pronto('Devolução anotada', `<span class="muted">Saíram do estoque ${plural(f.un, 'unidade', 'unidades')} (${brl(f.valor)} em produtos), devolvidas em ${dma(f.data)}.</span>`,
      '<a class="btn btn-p" href="#/historico">Ver histórico</a><a class="btn btn-s" href="#/estoque">Voltar ao estoque</a>');
  }
  if (!V.init) Object.assign(V, { init: 1, data: hoje(), dev: {}, q: '' });
  const chegada = {};
  for (const m of S.movimentos.filter((x) => x.tipo === 'chegou').sort((a, b) => (a.data < b.data ? -1 : 1))) for (const i of m.itens) chegada[i.cod] = m.data;
  const q = norm(V.q.trim());
  const prods = S.produtos.filter((p) => p.qtd > 0).sort((a, b) => (chegada[a.cod] || '').localeCompare(chegada[b.cod] || '') || a.nome.localeCompare(b.nome, 'pt-BR'));
  const vis = prods.filter((p) => !q || norm(p.nome).includes(q) || p.cod.includes(q) || V.dev[p.id]);
  const un = prods.reduce((s, p) => s + (V.dev[p.id] || 0), 0);
  const valor = soma(prods, (p) => (V.dev[p.id] || 0) * p.preco);
  return `<div class="screen">
  <header class="top">${voltar('#/estoque', 'Estoque')}<h1>Devolver mercadoria</h1>
    <span class="muted small">Toque no + dos produtos que vão voltar pra empresa.</span>
    <div class="row"><label for="data" class="small" style="font-weight:700">Data da devolução</label><input id="data" class="date" type="date" value="${esc(V.data)}" max="${hoje()}" data-c="devData"></div>
    ${prods.length > 6 ? `<div class="search">${IC.busca}<label class="sr" for="busca">Buscar produto</label><input id="busca" type="search" placeholder="Nome ou código" value="${esc(V.q)}" data-i="q" autocomplete="off"></div>` : ''}
  </header>
  <main class="main" data-r="lista">${prods.length ? vis.map((p) => {
    const n = V.dev[p.id] || 0;
    return `<div class="conf ${n ? 'sel' : ''}"><div class="col" style="gap:2px"><strong>${esc(p.nome)}</strong><span class="muted small">Tenho ${p.qtd}${chegada[p.cod] ? ' · chegou em ' + dm(chegada[p.cod]) : ''}</span></div>
      <div class="row"><span class="small" style="font-weight:700">Devolver</span>${stepper('devMenos', 'devMais', n, `data-v="${esc(p.id)}"`)}</div></div>`;
  }).join('') : '<div class="item">Não tem nada no estoque pra devolver.</div>'}</main>
  <div class="foot"><div class="row small"><span class="muted">${plural(un, 'unidade', 'unidades')}</span><strong>${brl(valor)} em produtos</strong></div>
    <button type="button" class="btn btn-p" data-a="devConfirmar" ${un ? '' : 'disabled'}>Devolver ${plural(un, 'unidade', 'unidades')}</button></div></div>`;
}

function tHistorico() {
  V.filtro = V.filtro || 'tudo';
  const nomes = { tudo: 'Tudo', chegou: 'Chegou', devolvi: 'Devolvi', repasse: 'Acertos' };
  const tags = { chegou: ['Chegou', 'tag-ok'], devolvi: ['Devolvi', 'tag-dev'], repasse: ['Acerto', ''] };
  const lista = S.movimentos.filter((m) => V.filtro === 'tudo' || m.tipo === V.filtro).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criado - a.criado));
  if (V.aberto === undefined && lista[0]) V.aberto = lista[0].id;
  return `<div class="screen">
  <header class="top">${voltar('#/estoque', 'Estoque')}<h1>O que chegou e o que devolvi</h1>
    <div class="chips">${Object.keys(nomes).map((k) => `<button type="button" class="chip ${V.filtro === k ? 'on' : ''}" data-a="histFiltro" data-v="${k}">${nomes[k]}</button>`).join('')}</div></header>
  <main class="main">${lista.length ? lista.map((m) => {
    const aberto = V.aberto === m.id;
    return `<div class="hist"><button type="button" class="head" data-a="histAbrir" data-v="${esc(m.id)}" aria-expanded="${aberto}">
        <span class="col" style="gap:2px"><strong>${dma(m.data)}</strong><span class="muted small">${m.tipo === 'repasse' ? 'Passei ' + brl(m.valor) + ' pra empresa' : plural(soma(m.itens, (i) => i.qtd), 'unidade', 'unidades') + ' · ' + brl(valorMov(m))}</span></span>
        <span class="tag ${tags[m.tipo][1]}">${tags[m.tipo][0]}</span></button>
      ${aberto ? `<div class="body">${m.tipo === 'repasse' ? `<div class="row small"><span>${plural(m.nVendas, 'venda', 'vendas')} no período</span><span>${brl(m.vendido)}</span></div>
        <div class="row small"><span>Meu ganho previsto</span><span class="ok">${brl(m.ganho)}</span></div>
        <button type="button" class="linkbtn small" data-a="acApagar" data-v="${esc(m.id)}" style="color:#9B1C1C">Apagar esse acerto</button>` : ''}
        ${m.itens.map((i) => `<div class="row small"><span>${i.qtd}× ${esc(i.nome)}</span><span>${brl(i.qtd * i.preco)}</span></div>`).join('')}
        ${(m.fotos || []).map((f, n) => `<button type="button" class="linkbtn small" data-a="verFoto" data-v="${esc(f)}">Ver foto da lista${m.fotos.length > 1 ? ' ' + (n + 1) : ''}</button>`).join('')}</div>` : ''}</div>`;
  }).join('') : '<div class="item">Ainda não tem nada aqui. Cada mercadoria que chega e cada devolução aparecem nessa lista.</div>'}</main>
  ${V.foto ? `<div class="overlay" data-a="fecharFoto"><div class="sheet" role="dialog" aria-label="Foto da lista"><img src="${V.foto}" alt="Foto da lista"><button type="button" class="btn btn-s" data-a="fecharFoto">Fechar</button></div></div>` : ''}
  </div>`;
}

function tAcerto() {
  if (V.feito) {
    const f = V.feito;
    return pronto('Acerto anotado', `<span class="muted">Você passou ${brl(f.valor)} pra empresa em ${dma(f.data)}. As vendas começam a contar de novo a partir de agora.</span>
      <span class="muted">Aproveite a visita: devolva o que não vendeu e tire foto da lista nova.</span>`,
      `<a class="btn btn-p" href="#/devolver">Devolver o que não vendi</a><a class="btn btn-s" href="#/foto">${IC.foto}Foto da lista nova</a><a class="btn btn-s" href="#/">Voltar ao início</a>`);
  }
  const periodo = vendasDoPeriodo();
  const vendi = soma(periodo, (v) => v.total);
  const ganho = soma(periodo, ganhoVenda);
  const clientesDevem = soma(periodo, devido);
  const u = ultimoAcerto();
  if (!V.init) Object.assign(V, { init: 1, valor: dec(vendi), data: hoje() });
  const valor = num(V.valor);
  return `<div class="screen">
  <header class="top">${voltar('#/', 'Início')}<h1>Acerto com a empresa</h1></header>
  <main class="main">
    <section class="card">
      <span class="muted small">${u ? 'Desde o último acerto (' + dma(u.data) + ')' : 'Desde o começo'} você fez ${plural(periodo.length, 'venda', 'vendas')}.</span>
      <div class="row"><span>Total vendido</span><strong style="font-size:24px">${brl(vendi)}</strong></div>
      <span class="muted small">Esse é o valor que vai inteiro pra empresa.</span>
      <div class="row line"><span>Seu ganho nessas vendas</span><span class="ok" style="font-size:20px">${brl(ganho)}</span></div>
      <span class="muted small">A empresa confere e te paga depois.</span>
      ${clientesDevem > 0 ? `<span class="small warn">Dessas vendas, as clientes ainda te devem ${brl(clientesDevem)}.</span>` : ''}
    </section>
    <div class="field"><label for="valor">Quanto você passou pra empresa?</label><input id="valor" class="money" inputmode="decimal" placeholder="R$ 0,00" value="${esc(V.valor)}" data-i="valor" autocomplete="off"></div>
    <div class="row"><label for="data" class="small" style="font-weight:700">Data da visita</label><input id="data" class="date" type="date" value="${esc(V.data)}" max="${hoje()}" data-c="acData"></div>
    <div data-r="aviso">${valor != null && Math.abs(valor - vendi) >= 0.01 ? `<span class="small warn">O valor é diferente do total vendido (${brl(vendi)}). Pode anotar assim mesmo.</span>` : ''}</div>
    <button type="button" class="btn btn-p" data-a="acSalvar">Anotar acerto</button>
  </main></div>`;
}

function tClientes() {
  V.q = V.q || '';
  V.so = V.so || 'todas';
  const q = norm(V.q.trim());
  const todas = S.clientes.map((c) => ({ c, s: saldo(c.id) }));
  const lista = todas.filter((x) => (!q || norm(x.c.nome).includes(q)) && (V.so === 'todas' || x.s > 0)).sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  return `<div class="screen">
  <header class="top"><div class="row"><h1>Clientes</h1><span class="small">A receber: <span class="owe">${brl(soma(todas, (x) => x.s))}</span></span></div>
    <div class="search">${IC.busca}<label class="sr" for="busca">Buscar cliente</label><input id="busca" type="search" placeholder="Digite o nome. Ex.: Maria" value="${esc(V.q)}" data-i="q" autocomplete="off"></div>
    <div class="chips"><button type="button" class="chip ${V.so === 'todas' ? 'on' : ''}" data-a="cliFiltro" data-v="todas">Todas</button><button type="button" class="chip ${V.so === 'devendo' ? 'on' : ''}" data-a="cliFiltro" data-v="devendo">Devendo (${todas.filter((x) => x.s > 0).length})</button></div>
  </header>
  <main class="main"><div class="col" data-r="lista">${lista.map((x) => {
    const u = ultimaCompra(x.c.id);
    return `<a class="item row" href="#/cliente/${encodeURIComponent(x.c.id)}"><div class="col" style="gap:2px;min-width:0"><strong>${esc(x.c.nome)}</strong><span class="muted small">${u ? 'Última compra ' + dm(u) : 'Ainda não comprou'}</span></div>
      ${x.s > 0 ? `<div class="col" style="align-items:flex-end;gap:0"><span class="muted small">Deve</span><span class="owe">${brl(x.s)}</span></div>` : '<span class="tag tag-ok">Em dia</span>'}</a>`;
  }).join('') || `<div class="item">${S.clientes.length ? 'Nenhuma cliente' + (V.q ? ' com “' + esc(V.q) + '”' : '') + '.' : 'Nenhuma cliente cadastrada ainda.'}</div>`}</div>
    <a class="btn btn-s" href="#/cliente-form">${IC.mais}Nova cliente</a>
  </main>${nav('clientes')}</div>`;
}

function tCliente(r) {
  const c = cliente(r.id);
  if (!c) return naoAchei('Cliente não encontrada.', '#/clientes', 'Voltar às clientes');
  const vendas = vendasDe(c.id);
  const s = saldo(c.id);
  const comprou = soma(vendas, (v) => v.total);
  const pagos = {};
  for (const p of S.pagamentos.filter((x) => x.clienteId === c.id)) for (const a of p.aloc) (pagos[a.vendaId] = pagos[a.vendaId] || []).push({ ...a, forma: p.forma, data: p.data });
  const fone = String(c.telefone || '').replace(/\D/g, '');
  const msg = `Oi, ${primeiroNome(c.nome)}! Tudo bem? Passando pra lembrar do valor em aberto das suas compras: ${brl(s)}. Pode me pagar quando der, por Pix ou dinheiro. Obrigada!`;
  const wa = 'https://wa.me/' + (fone ? (fone.length <= 11 ? '55' + fone : fone) : '') + '?text=' + encodeURIComponent(msg);
  const descPag = (v) => {
    const ps = pagos[v.id] || [];
    if (!v.pago) return 'pagou R$ 0,00';
    if (devido(v) <= 0 && ps.length === 1) return `pagou tudo (${formaTxt(ps[0].forma)}, ${dm(ps[0].data)})`;
    return 'pagou ' + brl(v.pago) + (ps.length ? ' (' + ps.map((p) => `${ps.length > 1 ? brl(p.valor) + ' ' : ''}${formaTxt(p.forma)}, ${dm(p.data)}`).join('; ') + ')' : '');
  };
  return `<div class="screen">
  <header class="top">${voltar('#/clientes', 'Clientes')}<div class="row"><h1>${esc(c.nome)}</h1><a href="#/cliente-form/${encodeURIComponent(c.id)}" class="linkbtn">Editar</a></div>
    <span class="muted small">${c.telefone ? esc(c.telefone) + ' · ' : ''}cliente desde ${dm(c.desde || hoje()).slice(3)}/${(c.desde || hoje()).slice(0, 4)}</span></header>
  <main class="main">
    <section class="card">
      <div class="col" style="align-items:center;gap:2px;padding:4px 0 8px">${s > 0 ? `<span class="muted">Está devendo</span><strong class="owe" style="font-size:36px">${brl(s)}</strong>` : '<span class="muted">Situação</span><strong class="ok" style="font-size:30px">Em dia</strong>'}</div>
      <div class="sum line"><div><span class="muted small">Comprou</span><strong>${brl(comprou)}</strong></div><div><span class="muted small">Pagou</span><strong class="ok">${brl(comprou - s)}</strong></div><div><span class="muted small">Compras</span><strong>${vendas.length}</strong></div></div>
    </section>
    <div class="col">
      ${s > 0 ? `<a class="btn btn-p" href="#/pagamento?c=${encodeURIComponent(c.id)}">Receber pagamento</a>` : ''}
      <div class="grid2"><a class="btn ${s > 0 ? 'btn-s' : 'btn-p'}" href="#/venda?c=${encodeURIComponent(c.id)}">Nova venda</a>${s > 0 ? `<a class="btn btn-s" href="${wa}" target="_blank" rel="noopener">Cobrar no WhatsApp</a>` : ''}</div>
    </div>
    <h2>O que ela comprou</h2>
    ${vendas.length ? vendas.map((v) => `<section class="card">
      <div class="row"><strong>${dm(v.data)}</strong><span class="tag ${devido(v) > 0 ? '' : 'tag-ok'}">${devido(v) > 0 ? 'Falta ' + brl(devido(v)) : 'Pago'}</span></div>
      ${v.itens.map((i) => `<div class="row small"><span>${i.qtd}× ${esc(i.nome)}</span><span>${brl(i.qtd * i.preco)}</span></div>`).join('')}
      <div class="row small line"><span class="muted">Total ${brl(v.total)} · ${descPag(v)}</span></div>
      <button type="button" class="linkbtn small" data-a="vendaApagar" data-v="${esc(v.id)}" style="align-self:flex-start;color:#9B1C1C">Apagar essa venda</button>
    </section>`).join('') : '<div class="item">Nenhuma compra ainda.</div>'}
  </main></div>`;
}
const formaTxt = (f) => ({ dinheiro: 'dinheiro', pix: 'Pix', cartao: 'cartão', hora: 'na hora da venda' }[f] || f || '');

function tClienteForm(r) {
  const c = r.id ? cliente(r.id) : null;
  if (r.id && !c) return naoAchei('Cliente não encontrada.', '#/clientes', 'Voltar às clientes');
  if (!V.init) Object.assign(V, { init: 1, nome: c ? c.nome : '', telefone: c ? c.telefone || '' : '' });
  const volta = c ? '#/cliente/' + encodeURIComponent(c.id) : r.q.volta === 'venda' ? '#/venda' : r.q.volta === 'pagamento' ? '#/pagamento' : '#/clientes';
  const temVenda = c && S.vendas.some((v) => v.clienteId === c.id);
  return `<div class="screen">
  <header class="top">${voltar(volta, 'Voltar')}<h1>${c ? 'Editar cliente' : 'Nova cliente'}</h1></header>
  <main class="main">
    <div class="field"><label for="nome">Nome</label><input id="nome" class="input" value="${esc(V.nome)}" data-i="nome" placeholder="Ex.: Maria Souza" autocomplete="off" ${c ? '' : 'data-auto'}></div>
    <div class="field"><label for="tel">WhatsApp (com DDD)</label><input id="tel" class="input" type="tel" inputmode="tel" value="${esc(V.telefone)}" data-i="telefone" placeholder="Ex.: (11) 98765-4321" autocomplete="off"></div>
    ${V.erro ? `<div class="erro" role="alert">${esc(V.erro)}</div>` : ''}
    <button type="button" class="btn btn-p" data-a="cliSalvar" data-v="${esc(r.q.volta || '')}">Salvar</button>
    ${c && !temVenda ? '<button type="button" class="btn btn-perigo" data-a="cliApagar">Apagar cliente</button>' : ''}
  </main></div>`;
}

// escolher cliente dentro da venda e do pagamento
function escolherCliente(sóDevendo, volta) {
  V.qc = V.qc || '';
  const q = norm(V.qc.trim());
  let lista = S.clientes.map((c) => ({ c, s: saldo(c.id) })).filter((x) => !sóDevendo || x.s > 0);
  lista = lista.filter((x) => !q || norm(x.c.nome).includes(q)).sort((a, b) => sóDevendo && !q ? b.s - a.s : a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  const corte = q || sóDevendo ? lista.slice(0, 8) : [];
  return `<div class="col">
    <div class="search">${IC.busca}<label class="sr" for="qc">Buscar cliente</label><input id="qc" type="search" placeholder="Nome da cliente" value="${esc(V.qc)}" data-i="qc" autocomplete="off" data-auto></div>
    <div data-r="sugcli" class="col">${corte.length ? `<div class="sug">${corte.map((x) => `<button type="button" data-a="pegaCliente" data-v="${esc(x.c.id)}"><strong>${esc(x.c.nome)}</strong>${x.s > 0 ? `<span class="owe">${brl(x.s)}</span>` : ''}</button>`).join('')}</div>`
      : q ? `<span class="muted">Nenhuma cliente com “${esc(V.qc)}”.</span>` : sóDevendo ? '<span class="muted">Ninguém está devendo agora.</span>' : '<span class="muted small">Comece a digitar o nome.</span>'}</div>
    <a class="btn btn-s" href="#/cliente-form?volta=${volta}">${IC.mais}Nova cliente</a></div>`;
}

function tVenda(r) {
  if (V.feito) {
    const f = V.feito;
    const c = cliente(f.cid);
    return pronto('Venda salva', `<span class="muted">Venda de ${brl(f.total)} pra ${esc(c ? c.nome : '')}. Os produtos já saíram do estoque.</span>
      ${f.saldo > 0 ? `<span>Agora ela deve <span class="owe">${brl(f.saldo)}</span> no total.</span>` : '<span class="ok">Ela não deve nada.</span>'}
      <span>Seu ganho nessa venda: <span class="ok">${brl(f.ganho)}</span></span>`,
      `<a class="btn btn-p" href="#/cliente/${encodeURIComponent(f.cid)}">Ver ficha da ${esc(primeiroNome(c ? c.nome : ''))}</a><button type="button" class="btn btn-s" data-a="vendaOutra">Fazer outra venda</button>`);
  }
  if (!V.init) Object.assign(V, { init: 1, cid: r.q.c && cliente(r.q.c) ? r.q.c : null, cart: [], q: '', modo: 'nada', parte: '' });
  const c = V.cid ? cliente(V.cid) : null;
  if (!c) {
    return `<div class="screen"><header class="top">${voltar('#/', 'Início')}<h1>Nova venda</h1><span class="muted">Pra quem é a venda?</span></header>
      <main class="main">${escolherCliente(false, 'venda')}</main>${nav('vender')}</div>`;
  }
  const q = norm(V.q.trim());
  const naVenda = (id) => (V.cart.find((x) => x.id === id) || { qtd: 0 }).qtd;
  const sug = q ? S.produtos.filter((p) => norm(p.nome).includes(q) || p.cod.includes(q)).sort((a, b) => (b.qtd > 0) - (a.qtd > 0)).slice(0, 6) : [];
  const cart = V.cart.map((x) => ({ ...x, p: produto(x.id) })).filter((x) => x.p);
  const total = soma(cart, (x) => x.qtd * x.p.preco);
  const ganho = soma(cart, (x) => (x.qtd * x.p.preco * x.p.com) / 100);
  const pago = V.modo === 'tudo' ? total : V.modo === 'parte' ? Math.min(num(V.parte) || 0, total) : 0;
  return `<div class="screen">
  <header class="top">${voltar('#/', 'Início')}<h1>Nova venda</h1></header>
  <main class="main">
    <div class="card row" style="flex-direction:row"><div class="col" style="gap:0"><span class="muted small">Pra quem</span><strong>${esc(c.nome)}</strong></div><button type="button" class="linkbtn" data-a="trocaCliente">Trocar</button></div>
    <div class="search">${IC.busca}<label class="sr" for="prod">Adicionar produto</label><input id="prod" type="search" placeholder="Adicionar produto: nome ou código" value="${esc(V.q)}" data-i="q" autocomplete="off" data-auto></div>
    <div data-r="sug" class="col">${sug.length ? `<div class="sug">${sug.map((p) => {
      const livre = p.qtd - naVenda(p.id);
      return `<button type="button" data-a="vendaAdd" data-v="${esc(p.id)}" ${livre > 0 ? '' : 'disabled'}><span class="col" style="gap:0"><strong>${esc(p.nome)}</strong><span class="muted small">Cód. ${esc(p.cod)} · ${p.qtd > 0 ? 'tem ' + p.qtd : 'acabou'}</span></span><span>${brl(p.preco)}</span></button>`;
    }).join('')}</div>` : q ? `<span class="muted">Nenhum produto com “${esc(V.q)}”. <a href="#/produto/novo">Cadastrar</a></span>` : ''}</div>
    <h2>Produtos da venda</h2>
    ${cart.length ? cart.map((x) => `<div class="card" style="padding:14px 16px">
      <div class="row" style="align-items:flex-start"><strong>${esc(x.p.nome)}</strong><span style="white-space:nowrap">${x.qtd} × ${brl(x.p.preco)}</span></div>
      <div class="row"><button type="button" class="step txt" data-a="vendaTirar" data-v="${esc(x.id)}">Tirar</button>${stepper('vendaMenos', 'vendaMais', x.qtd, `data-v="${esc(x.id)}"`)}</div>
      ${x.qtd >= x.p.qtd ? `<span class="small muted">Você tem ${plural(x.p.qtd, 'unidade', 'unidades')} desse no estoque.</span>` : ''}
    </div>`).join('') : '<span class="muted">Busque um produto acima pra começar.</span>'}
    <h2>Quanto ela pagou agora?</h2>
    <div class="grid3">${[['nada', 'Nada'], ['parte', 'Uma parte'], ['tudo', 'Tudo']].map(([k, t]) => `<button type="button" class="opt ${V.modo === k ? 'on' : ''}" data-a="vendaModo" data-v="${k}">${t}</button>`).join('')}</div>
    ${V.modo === 'parte' ? `<div class="field"><label for="valor">Valor que ela pagou</label><input id="valor" class="money" inputmode="decimal" placeholder="R$ 0,00" value="${esc(V.parte)}" data-i="parte" autocomplete="off"></div>` : ''}
  </main>
  <div class="foot" data-r="foot">
    <div class="row"><span>Total da venda</span><strong style="font-size:22px">${brl(total)}</strong></div>
    <div class="row small"><span class="muted">Pagou agora ${brl(pago)}</span><span class="owe">Fica devendo ${brl(total - pago)}</span></div>
    <div class="row small"><span class="muted">Meu ganho nessa venda</span><span class="ok">${brl(ganho)}</span></div>
    <button type="button" class="btn btn-p" data-a="vendaFinalizar" ${cart.length ? '' : 'disabled'}>Finalizar venda</button>
  </div></div>`;
}

function tPagamento(r) {
  if (V.feito) {
    const f = V.feito;
    const c = cliente(f.cid);
    return pronto('Pagamento anotado', `<span class="muted">${esc(c ? c.nome : '')} pagou ${brl(f.valor)} (${formaTxt(f.forma)}).</span>
      ${f.resta > 0 ? `<span>Ainda falta <span class="owe">${brl(f.resta)}</span>.</span>` : '<span class="ok">Ela não deve mais nada.</span>'}`,
      `<a class="btn btn-p" href="#/cliente/${encodeURIComponent(f.cid)}">Ver ficha da ${esc(primeiroNome(c ? c.nome : ''))}</a><a class="btn btn-s" href="#/">Voltar ao início</a>`);
  }
  if (!V.init) Object.assign(V, { init: 1, cid: r.q.c && cliente(r.q.c) ? r.q.c : null, valor: '', forma: 'pix' });
  const c = V.cid ? cliente(V.cid) : null;
  if (!c) {
    return `<div class="screen"><header class="top">${voltar('#/', 'Início')}<h1>Receber pagamento</h1><span class="muted">Quem está pagando?</span></header>
      <main class="main">${escolherCliente(true, 'pagamento')}</main></div>`;
  }
  const deve = saldo(c.id);
  const pago = Math.min(num(V.valor) || 0, deve);
  const resta = r2(deve - pago);
  return `<div class="screen">
  <header class="top">${voltar('#/cliente/' + encodeURIComponent(c.id), c.nome)}<h1>Receber pagamento</h1></header>
  <main class="main">
    <div class="card row" style="flex-direction:row"><div class="col" style="gap:0"><span class="muted small">${esc(c.nome)} deve</span><strong class="owe" style="font-size:26px">${brl(deve)}</strong></div><button type="button" class="linkbtn" data-a="trocaCliente">Trocar</button></div>
    ${deve > 0 ? `
    <div class="field"><label for="valor" style="font-size:18px">Quanto ela pagou?</label><input id="valor" class="money" style="font-size:28px;min-height:64px" inputmode="decimal" placeholder="R$ 0,00" value="${esc(V.valor)}" data-i="valor" autocomplete="off"></div>
    <div class="grid3">${deve > 50 ? '<button type="button" class="opt" data-a="pagValor" data-v="50">R$ 50</button>' : ''}${deve > 100 ? '<button type="button" class="opt" data-a="pagValor" data-v="100">R$ 100</button>' : ''}<button type="button" class="opt" data-a="pagValor" data-v="${deve}">Tudo</button></div>
    <h2>Como ela pagou?</h2>
    <div class="grid3">${[['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao', 'Cartão']].map(([k, t]) => `<button type="button" class="opt ${V.forma === k ? 'on' : ''}" data-a="pagForma" data-v="${k}">${t}</button>`).join('')}</div>
    <span class="muted small">O pagamento abate primeiro a compra mais antiga.</span>` : '<span class="ok">Ela não está devendo nada.</span>'}
  </main>
  ${deve > 0 ? `<div class="foot" data-r="foot">
    <div class="row"><span>Depois desse pagamento</span>${pago > 0 && resta <= 0 ? '<span class="ok">Fica tudo pago</span>' : `<span class="owe">Deve ${brl(resta)}</span>`}</div>
    ${(num(V.valor) || 0) > deve ? `<span class="small warn">O valor passa do que ela deve. Vou anotar só ${brl(deve)}.</span>` : ''}
    <button type="button" class="btn btn-p" data-a="pagConfirmar" ${pago > 0 ? '' : 'disabled'}>Confirmar pagamento</button></div>` : ''}</div>`;
}

function tAjustes() {
  if (!V.init) Object.assign(V, { init: 1, nome: S.cfg.nome || '', key: S.cfg.geminiKey || '', modelo: S.cfg.geminiModel || MODELO_PADRAO });
  return `<div class="screen">
  <header class="top">${voltar('#/', 'Início')}<h1>Ajustes</h1></header>
  <main class="main">
    <section class="card">
      <div class="field"><label for="nome">Seu nome (aparece no início)</label><input id="nome" class="input" value="${esc(V.nome)}" data-i="nome" autocomplete="off"></div>
      <div class="field"><label for="key">Chave do Gemini (pra ler a foto)</label><input id="key" class="input" type="password" value="${esc(V.key)}" data-i="key" autocomplete="off" placeholder="Cole a chave aqui"></div>
      <span class="muted small">A chave é gratuita: entre em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> com a sua conta Google, toque em “Criar chave” e cole aqui.</span>
      <details><summary class="small" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Avançado</summary>
        <div class="field"><label for="modelo">Modelo do Gemini</label><input id="modelo" class="input sm" value="${esc(V.modelo)}" data-i="modelo" autocomplete="off"></div></details>
      <button type="button" class="btn btn-p" data-a="ajSalvar">Salvar</button>
    </section>
    <section class="card">
      <h2 style="margin:0">Cópia de segurança</h2>
      <span class="muted small">${S.cfg.ultimoBackup ? 'Última cópia em ' + dma(S.cfg.ultimoBackup) + '.' : 'Nenhuma cópia feita ainda.'} A cópia é um arquivo com tudo: estoque, clientes, vendas, pagamentos e histórico. Guarde no Google Drive.</span>
      <button type="button" class="btn btn-p" data-a="backupEnviar">Enviar cópia (Drive, WhatsApp…)</button>
      <button type="button" class="btn btn-s" data-a="backupBaixar">Salvar cópia no celular</button>
      <label class="btn btn-s">Restaurar de uma cópia<input type="file" accept=".txt,.json,text/plain,application/json" class="sr" data-c="restaurar"></label>
      <span class="muted small">Restaurar troca tudo o que está no app pelo que está na cópia.</span>
    </section>
    <section class="card">
      <h2 style="margin:0">Senha (PIN)</h2>
      <button type="button" class="btn btn-s" data-a="pinTrocar">Trocar o PIN</button>
    </section>
    <span class="muted small" style="text-align:center">Os dados ficam só neste celular. Versão ${VERSAO_APP}.</span>
  </main></div>`;
}

function tPin() {
  const T = TRAVA;
  const titulos = { criar: 'Crie um PIN de 4 números', confirmar: 'Digite o PIN de novo', entrar: 'Digite seu PIN', atual: 'Digite o PIN atual' };
  return `<div class="screen"><main class="pin">
    <h1 style="text-align:center">${titulos[T.fase]}</h1>
    ${T.fase === 'criar' ? '<span class="muted" style="text-align:center">Ele protege o app. Guarde bem: sem ele não dá pra entrar.</span>' : ''}
    <div class="dots" aria-label="${T.dig.length} de 4 números">${[0, 1, 2, 3].map((i) => `<span class="dot ${i < T.dig.length ? 'on' : ''}"></span>`).join('')}</div>
    <span class="warn" role="alert" style="min-height:24px">${esc(T.erro || '')}</span>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="key" data-a="pinTecla" data-v="${n}">${n}</button>`).join('')}
      ${T.volta ? '<button type="button" class="key txt" data-a="pinCancelar">Cancelar</button>' : '<span></span>'}<button type="button" class="key" data-a="pinTecla" data-v="0">0</button><button type="button" class="key txt" data-a="pinApagar" aria-label="Apagar">Apagar</button></div>
  </main></div>`;
}

function naoAchei(txt, h, botao) {
  return `<div class="screen"><main class="done"><h1>${esc(txt)}</h1><a class="btn btn-p" href="${h}">${esc(botao)}</a></main></div>`;
}

const TELAS = { inicio: tInicio, estoque: tEstoque, produto: tProduto, foto: tFoto, conferir: tConferir, devolver: tDevolver, historico: tHistorico,
  acerto: tAcerto, clientes: tClientes, cliente: tCliente, 'cliente-form': tClienteForm, venda: tVenda, pagamento: tPagamento, ajustes: tAjustes };

// ================= leitura da foto (Gemini) =================
const MODELO_PADRAO = 'gemini-2.5-flash';
const PROMPT = `Esta é a foto de uma lista de mercadorias consignadas (moda íntima, lingerie, lençóis e parecidos) que uma revendedora recebeu.
O modelo mais comum se chama "RELAÇÃO DE PRODUTOS ENTREGUES", com as colunas: Código | Descrição | $ Unit. | Qtd. | Dev. | Ven. | Total.
Extraia cada produto, linha por linha, usando SÓ o texto impresso:
- codigo: o número da coluna Código (sem espaços).
- nome: a Descrição como está impressa, sem asteriscos e sem reticências no fim.
- asteriscos: true se a Descrição termina com asteriscos (ex.: "LENÇOL DE CASAL**"); senão false.
- quantidade: o número impresso na coluna Qtd. (inteiro). Às vezes ele está circulado à caneta; o número continua valendo.
- preco_venda: o valor da coluna $ Unit. (preço de UMA unidade). Use ponto como separador decimal (28,80 vira 28.8).
- comissao_percentual: só se a linha tiver um percentual de comissão próprio impresso; senão null.
As colunas Dev., Ven. e Total são preenchidas à mão depois: IGNORE tudo nelas. Ignore também qualquer coisa escrita à mão (riscos, tracinhos, vistos, "OK", números rabiscados entre as colunas, setas).
Além dos itens, extraia:
- data: a data da lista ("Data:" no topo), no formato AAAA-MM-DD.
- proxima_visita: a data de "Próxima Visita", no formato AAAA-MM-DD.
- comissao_geral: se houver um percentual escrito na folha valendo para a lista toda (por exemplo "25%" à mão perto do Total), o número (25). Senão null.
- total_quantidade: o total impresso de peças na linha "Total" (ex.: 64).
- total_valor: o valor total impresso da lista (ex.: 3.312,20 vira 3312.2).
Se algum campo não estiver legível ou não existir, use null. Não invente produtos nem valores. A linha "Total" não é produto.`;
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    data: { type: 'STRING', nullable: true },
    proxima_visita: { type: 'STRING', nullable: true },
    comissao_geral: { type: 'NUMBER', nullable: true },
    total_quantidade: { type: 'INTEGER', nullable: true },
    total_valor: { type: 'NUMBER', nullable: true },
    itens: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      codigo: { type: 'STRING', nullable: true }, nome: { type: 'STRING', nullable: true }, quantidade: { type: 'INTEGER', nullable: true },
      preco_venda: { type: 'NUMBER', nullable: true }, comissao_percentual: { type: 'NUMBER', nullable: true }, asteriscos: { type: 'BOOLEAN', nullable: true } } } }
  },
  required: ['itens']
};

async function lerLista(dataUrl) {
  const modelo = S.cfg.geminiModel || MODELO_PADRAO;
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.cfg.geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 }
      })
    });
  } catch (e) {
    throw new Error('Sem internet agora. Conecte o celular e tente de novo.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error.message || ''; } catch (e) { /* sem corpo */ }
    if (/api key|API_KEY|permission/i.test(msg) || res.status === 403) throw new Error('A chave do Gemini não funcionou. Confira em Ajustes.');
    if (res.status === 429) throw new Error('Muitas leituras seguidas. Espere um minuto e tente de novo.');
    if (res.status === 404) throw new Error('O modelo do Gemini configurado não existe mais. Em Ajustes › Avançado, troque o modelo.');
    throw new Error('Não consegui ler a foto agora (erro ' + res.status + '). Tente de novo daqui a pouco.');
  }
  const j = await res.json();
  const txt = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  try { return JSON.parse(txt); } catch (e) { throw new Error('Não entendi a foto. Tente outra foto, mais perto e com mais luz.'); }
}

function comprimir(file, max = 2000, qualidade = 0.85) {
  return new Promise((ok, erro) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Não consegui abrir essa foto.')); };
    img.src = url;
  });
}

// Na lista da empresa, produto com "**" (os lençóis) ganha 35%; o resto segue o percentual escrito na folha
const COM_ASTERISCOS = 35;
const pct = (c) => { if (c == null) return null; if (c > 0 && c < 1) c = Math.round(c * 100); return c > 0 && c < 100 ? c : null; };
function novoItem(x, comGeral = null) {
  const cod = String(x.codigo ?? '').replace(/\s/g, '');
  const p = prodPorCod(cod);
  const com = pct(x.comissao_percentual);
  // percentual escrito na folha pra lista toda: vale pros itens sem percentual próprio, com os botões à mostra pra trocar
  if (com == null && comGeral != null) return { ...novoItem({ ...x, comissao_percentual: comGeral }), lerCom: true };
  return {
    k: uid(), cod, nome: (x.nome || '').trim() || (p ? p.nome : ''),
    preco: x.preco_venda != null && x.preco_venda > 0 ? r2(x.preco_venda) : p ? p.preco : null,
    com: com ?? (p ? p.com : null), qtd: x.quantidade > 0 ? x.quantidade : 0,
    on: true, lerCom: com == null && !p, edit: false
  };
}

// ================= ações =================
const A = {
  filtro: (v) => { V.so = v; },
  cliFiltro: (v) => { V.so = v; },
  histFiltro: (v) => { V.filtro = v; V.aberto = null; },
  histAbrir: (v) => { V.aberto = V.aberto === v ? null : v; },
  verFoto: async (id) => { const f = await ler('fotos', id); if (!f) return toast('Foto não encontrada.'); V.foto = f.data; render(); return false; },
  fecharFoto: (v, el, ev) => { if (ev.target !== el) return false; V.foto = null; },

  // produto
  prodCom: (v) => { V.com = Number(v); },
  prodMenos: () => { V.qtd = Math.max(0, V.qtd - 1); },
  prodMais: () => { V.qtd += 1; },
  prodSalvar: async () => {
    const r = rota();
    const id = r.id && r.id !== 'novo' ? r.id : null;
    const cod = V.cod.trim().replace(/\s/g, '');
    const preco = num(V.preco);
    V.erro = !cod ? 'Coloque o código do produto.' : !V.nome.trim() ? 'Coloque o nome do produto.' : preco == null || preco <= 0 ? 'Coloque o preço de venda.' : V.com == null ? 'Escolha quanto você ganha: 25% ou 35%.' : '';
    const dono = prodPorCod(cod);
    if (!V.erro && dono && dono.id !== id) V.erro = `Já existe um produto com o código ${cod}: ${dono.nome}.`;
    if (V.erro) return;
    await commit([['produtos', { ...(id ? produto(id) : { id: uid(), criado: Date.now() }), cod, nome: V.nome.trim(), preco: r2(preco), com: V.com, qtd: V.qtd }]]);
    toast('Produto salvo.');
    ir('#/estoque');
    return false;
  },
  prodApagar: async () => {
    const p = produto(rota().id);
    if (!p || !confirm(`Apagar “${p.nome}” do estoque? As vendas já feitas continuam na ficha das clientes.`)) return false;
    await commit([['produtos', null, p.id]]);
    toast('Produto apagado.');
    ir('#/estoque');
    return false;
  },

  // foto e conferência
  fotoEscolhida: async (v, el) => {
    const file = el.files && el.files[0];
    if (!file) return false;
    const juntar = rota().q.juntar === '1' && LEITURA;
    try {
      const foto = await comprimir(file);
      V.estado = 'lendo'; V.preview = foto; V.erro = '';
      render();
      const r = await lerLista(foto);
      const comGeral = pct(r.comissao_geral);
      const itens = (r.itens || []).filter((x) => x && (x.nome || x.codigo)).map((x) => novoItem(x, x.asteriscos ? COM_ASTERISCOS : comGeral));
      const dataOk = r.data && /^\d{4}-\d{2}-\d{2}$/.test(r.data) && r.data <= hoje() ? r.data : null;
      const proxima = r.proxima_visita && /^\d{4}-\d{2}-\d{2}$/.test(r.proxima_visita) ? r.proxima_visita : null;
      const tot = r.total_quantidade > 0 && r.total_valor > 0 ? { qtd: r.total_quantidade, valor: r2(r.total_valor) } : null;
      if (juntar) {
        LEITURA.itens.push(...itens); LEITURA.fotos.push(foto);
        if (!LEITURA.dataLida && dataOk) Object.assign(LEITURA, { data: dataOk, dataLida: true });
        if (proxima) LEITURA.proxima = proxima;
        // cada foto traz seu total: soma os de todas; se uma não trouxer, não dá pra comparar
        LEITURA.total = LEITURA.total && tot ? { qtd: LEITURA.total.qtd + tot.qtd, valor: r2(LEITURA.total.valor + tot.valor) } : null;
      } else LEITURA = { data: dataOk || hoje(), dataLida: !!dataOk, itens, fotos: [foto], proxima, total: tot };
      if (!itens.length) toast('Não achei produtos nessa foto. Confira ou adicione à mão.');
      ir('#/conferir');
    } catch (e) {
      V.estado = null; V.erro = e.message; render();
    }
    return false;
  },
  digitarMao: () => {
    if (!LEITURA || rota().q.juntar !== '1') LEITURA = { data: hoje(), dataLida: false, itens: [], fotos: [], proxima: null, total: null };
    LEITURA.itens.push({ ...novoItem({}), edit: true, lerCom: true });
    ir('#/conferir');
    return false;
  },
  confCampo: (val, el) => {
    const it = LEITURA.itens.find((x) => x.k === el.dataset.k);
    if (!it) return;
    const f = el.dataset.f;
    if (f === 'preco') { it.precoTxt = val; const n = num(val); it.preco = n != null && n > 0 ? r2(n) : null; }
    else if (f === 'cod') {
      it.cod = val.replace(/\s/g, '');
      const p = prodPorCod(it.cod);
      if (p && it.com == null) it.com = p.com;
    } else it[f] = val;
  },
  confEditar: (k) => { const it = LEITURA.itens.find((x) => x.k === k); if (it) it.edit = true; },
  confOk: (k) => { const it = LEITURA.itens.find((x) => x.k === k); if (it) { it.edit = false; it.nome = it.nome.trim(); delete it.precoTxt; } },
  confCom: (v) => { const [k, c] = v.split('|'); const it = LEITURA.itens.find((x) => x.k === k); if (it) it.com = Number(c); },
  confMenos: (k) => { const it = LEITURA.itens.find((x) => x.k === k); if (it) it.qtd = Math.max(0, (it.qtd || 0) - 1); },
  confMais: (k) => { const it = LEITURA.itens.find((x) => x.k === k); if (it) it.qtd = (it.qtd || 0) + 1; },
  confChegou: (v, el) => { const it = LEITURA.itens.find((x) => x.k === el.dataset.k); if (it) it.on = el.checked; },
  confData: (v) => { if (v) LEITURA.data = v; },
  confAdd: () => { LEITURA.itens.push({ ...novoItem({}), edit: true, lerCom: true, qtd: 1 }); setTimeout(() => { const m = $app.querySelector('.main'); if (m) m.scrollTop = m.scrollHeight; }, 0); },
  confDescartar: () => { if (!confirm('Descartar essa lista? Nada vai entrar no estoque.')) return false; LEITURA = null; ir('#/estoque'); return false; },
  confConfirmar: async () => {
    const L = LEITURA;
    const incl = L.itens.filter((x) => x.on && x.qtd > 0);
    if (L.itens.some((x) => itemProblemas(x).length) || !incl.length) return;
    // mesmo código repetido na lista (ex.: duas fotos) vira um item só
    const porCod = new Map();
    for (const x of incl) {
      const j = porCod.get(x.cod);
      porCod.set(x.cod, j ? { ...j, qtd: j.qtd + x.qtd } : { cod: x.cod, nome: x.nome.trim(), preco: x.preco, com: x.com, qtd: x.qtd });
    }
    const ops = [];
    const novos = new Map();
    for (const x of porCod.values()) {
      const p = prodPorCod(x.cod) || novos.get(x.cod);
      const obj = p ? { ...p, qtd: p.qtd + x.qtd, preco: x.preco, com: x.com } : { id: uid(), criado: Date.now(), cod: x.cod, nome: x.nome, preco: x.preco, com: x.com, qtd: x.qtd };
      novos.set(x.cod, obj);
      ops.push(['produtos', obj]);
    }
    const fotos = L.fotos.map((data) => ({ id: uid(), data }));
    for (const f of fotos) ops.push(['fotos', f]);
    ops.push(['movimentos', { id: uid(), criado: Date.now(), tipo: 'chegou', data: L.data, itens: [...porCod.values()], fotos: fotos.map((f) => f.id) }]);
    if (L.proxima && L.proxima > L.data) ops.push(['config', { ...S.cfg, proximaVisita: L.proxima }]);
    await commit(ops);
    V.feito = { un: soma(incl, (x) => x.qtd), n: porCod.size, data: L.data, fotos: fotos.length };
    LEITURA = null;
  },

  // devolução
  devData: (v) => { if (v) V.data = v; },
  devMenos: (id) => { V.dev[id] = Math.max(0, (V.dev[id] || 0) - 1); },
  devMais: (id) => { const p = produto(id); V.dev[id] = Math.min(p ? p.qtd : 0, (V.dev[id] || 0) + 1); },
  devConfirmar: async () => {
    const sel = Object.entries(V.dev).filter(([, n]) => n > 0).map(([id, n]) => ({ p: produto(id), n })).filter((x) => x.p);
    if (!sel.length) return;
    const ops = sel.map((x) => ['produtos', { ...x.p, qtd: x.p.qtd - x.n }]);
    const itens = sel.map((x) => ({ cod: x.p.cod, nome: x.p.nome, preco: x.p.preco, com: x.p.com, qtd: x.n }));
    ops.push(['movimentos', { id: uid(), criado: Date.now(), tipo: 'devolvi', data: V.data, itens }]);
    await commit(ops);
    V.feito = { un: soma(itens, (i) => i.qtd), valor: soma(itens, (i) => i.qtd * i.preco), data: V.data };
  },

  // acerto com a empresa
  acData: (v) => { if (v) V.data = v; },
  acSalvar: async () => {
    const valor = num(V.valor);
    if (valor == null || valor < 0) { toast('Coloque quanto você passou pra empresa.'); return; }
    const periodo = vendasDoPeriodo();
    await commit([['movimentos', { id: uid(), criado: Date.now(), tipo: 'repasse', data: V.data, valor: r2(valor), itens: [],
      vendido: soma(periodo, (v) => v.total), ganho: soma(periodo, ganhoVenda), nVendas: periodo.length }]]);
    V.feito = { valor: r2(valor), data: V.data };
  },
  acApagar: async (id) => {
    if (!confirm('Apagar esse acerto? As vendas dele voltam a contar como não passadas pra empresa.')) return false;
    await commit([['movimentos', null, id]]);
    V.aberto = null;
    toast('Acerto apagado.');
  },

  // clientes
  cliSalvar: async (volta) => {
    const r = rota();
    const nome = V.nome.trim().replace(/\s+/g, ' ');
    if (!nome) { V.erro = 'Coloque o nome da cliente.'; return; }
    const outra = S.clientes.find((c) => norm(c.nome) === norm(nome) && c.id !== r.id);
    if (outra && !confirm(`Já existe uma cliente chamada ${outra.nome}. Salvar mesmo assim?`)) return false;
    const c = r.id ? { ...cliente(r.id), nome, telefone: V.telefone.trim() } : { id: uid(), nome, telefone: V.telefone.trim(), desde: hoje() };
    await commit([['clientes', c]]);
    toast('Cliente salva.');
    ir(volta === 'venda' ? '#/venda?c=' + encodeURIComponent(c.id) : volta === 'pagamento' ? '#/pagamento?c=' + encodeURIComponent(c.id) : '#/cliente/' + encodeURIComponent(c.id));
    return false;
  },
  cliApagar: async () => {
    const c = cliente(rota().id);
    if (!c || !confirm(`Apagar ${c.nome}?`)) return false;
    await commit([['clientes', null, c.id]]);
    ir('#/clientes');
    return false;
  },
  pegaCliente: (id) => { V.cid = id; V.qc = ''; },
  trocaCliente: () => { V.cid = null; V.qc = ''; },

  // venda
  vendaAdd: (id) => {
    const p = produto(id);
    const x = V.cart.find((c) => c.id === id);
    if (x) x.qtd = Math.min(p.qtd, x.qtd + 1); else V.cart.push({ id, qtd: 1 });
    V.q = '';
    setTimeout(() => { const el = document.getElementById('prod'); if (el) el.blur(); }, 0);
  },
  vendaMenos: (id) => { const x = V.cart.find((c) => c.id === id); if (x) x.qtd = Math.max(1, x.qtd - 1); },
  vendaMais: (id) => { const x = V.cart.find((c) => c.id === id); const p = produto(id); if (x && p) x.qtd = Math.min(p.qtd, x.qtd + 1); },
  vendaTirar: (id) => { V.cart = V.cart.filter((c) => c.id !== id); },
  vendaModo: (v) => { V.modo = v; },
  vendaFinalizar: async () => {
    const itens = V.cart.map((x) => ({ x, p: produto(x.id) })).filter((y) => y.p && y.x.qtd > 0);
    if (!itens.length) return;
    const falta = itens.find((y) => y.x.qtd > y.p.qtd);
    if (falta) { toast(`Só tem ${falta.p.qtd} de ${falta.p.nome} no estoque.`); return; }
    const total = soma(itens, (y) => y.x.qtd * y.p.preco);
    const pago = r2(V.modo === 'tudo' ? total : V.modo === 'parte' ? Math.min(num(V.parte) || 0, total) : 0);
    const venda = { id: uid(), criado: Date.now(), clienteId: V.cid, data: hoje(), total, pago,
      itens: itens.map((y) => ({ cod: y.p.cod, nome: y.p.nome, preco: y.p.preco, com: y.p.com, qtd: y.x.qtd })) };
    const ops = [['vendas', venda], ...itens.map((y) => ['produtos', { ...y.p, qtd: y.p.qtd - y.x.qtd }])];
    if (pago > 0) ops.push(['pagamentos', { id: uid(), criado: Date.now(), clienteId: V.cid, data: hoje(), valor: pago, forma: 'hora', aloc: [{ vendaId: venda.id, valor: pago }] }]);
    await commit(ops);
    V.feito = { cid: V.cid, total, ganho: ganhoVenda(venda), saldo: saldo(V.cid) };
  },
  vendaOutra: () => { V = {}; },
  vendaApagar: async (id) => {
    const v = S.vendas.find((x) => x.id === id);
    if (!v) return;
    const aviso = v.pago > 0 ? ` O que ela pagou nessa compra (${brl(v.pago)}) some junto.` : '';
    if (!confirm(`Apagar a venda de ${dm(v.data)} (${brl(v.total)})? Os produtos voltam pro estoque.${aviso}`)) return false;
    const ops = [['vendas', null, v.id]];
    for (const i of v.itens) {
      const p = prodPorCod(i.cod);
      const ja = ops.find((o) => o[0] === 'produtos' && o[1] && o[1].cod === i.cod);
      if (ja) ja[1].qtd += i.qtd; else if (p) ops.push(['produtos', { ...p, qtd: p.qtd + i.qtd }]);
    }
    for (const p of S.pagamentos.filter((x) => x.aloc.some((a) => a.vendaId === v.id))) {
      const aloc = p.aloc.filter((a) => a.vendaId !== v.id);
      ops.push(aloc.length ? ['pagamentos', { ...p, aloc, valor: soma(aloc, (a) => a.valor) }] : ['pagamentos', null, p.id]);
    }
    await commit(ops);
    toast('Venda apagada.');
  },

  // pagamento
  pagValor: (v) => { V.valor = dec(Number(v)); },
  pagForma: (v) => { V.forma = v; },
  pagConfirmar: async () => {
    const deve = saldo(V.cid);
    const valor = r2(Math.min(num(V.valor) || 0, deve));
    if (valor <= 0) return;
    const { aloc, vendas } = alocar(V.cid, valor);
    await commit([...vendas.map((v) => ['vendas', v]), ['pagamentos', { id: uid(), criado: Date.now(), clienteId: V.cid, data: hoje(), valor, forma: V.forma, aloc }]]);
    V.feito = { cid: V.cid, valor, forma: V.forma, resta: saldo(V.cid) };
  },

  // ajustes
  ajSalvar: async () => {
    await salvarCfg({ nome: V.nome.trim(), geminiKey: V.key.trim(), geminiModel: V.modelo.trim() || MODELO_PADRAO });
    toast('Ajustes salvos.');
  },
  backupEnviar: () => fazerBackup(true),
  backupBaixar: () => fazerBackup(false),
  restaurar: async (v, el) => {
    const file = el.files && el.files[0];
    if (!file) return false;
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== 'minha-revenda' || !j.dados) throw new Error();
      const d = j.dados;
      const resumo = `${(d.produtos || []).length} produtos, ${(d.clientes || []).length} clientes e ${(d.vendas || []).length} vendas`;
      if (!confirm(`Essa cópia é de ${dma(String(j.feitoEm).slice(0, 10))} e tem ${resumo}. Trocar tudo o que está no app por ela?`)) { el.value = ''; return false; }
      const ops = [];
      for (const s of ['produtos', 'clientes', 'vendas', 'pagamentos', 'movimentos', 'fotos']) for (const o of d[s] || []) ops.push([s, o]);
      await gravar(ops, ['produtos', 'clientes', 'vendas', 'pagamentos', 'movimentos', 'fotos']);
      await salvarCfg({ nome: S.cfg.nome || (j.config && j.config.nome) || '' });
      await carregar();
      toast('Cópia restaurada.');
      ir('#/');
    } catch (e) {
      toast('Esse arquivo não é uma cópia do app.');
    }
    el.value = '';
    return false;
  },

  // PIN
  pinTrocar: () => { TRAVA = { fase: 'atual', dig: '', volta: true }; },
  pinCancelar: () => { TRAVA = null; },
  pinApagar: () => { TRAVA.dig = TRAVA.dig.slice(0, -1); TRAVA.erro = ''; },
  pinTecla: async (n) => {
    const T = TRAVA;
    if (T.dig.length >= 4) return false;
    T.dig += n;
    T.erro = '';
    if (T.dig.length < 4) return;
    render();
    const h = await hashPin(T.dig);
    if (T.fase === 'criar') { Object.assign(T, { fase: 'confirmar', primeiro: h, dig: '' }); }
    else if (T.fase === 'confirmar') {
      if (h === T.primeiro) { await salvarCfg({ pinHash: h }); TRAVA = null; toast('PIN salvo.'); }
      else Object.assign(T, { fase: 'criar', dig: '', erro: 'Os dois não bateram. Comece de novo.' });
    } else if (h === S.cfg.pinHash) {
      if (T.fase === 'atual') Object.assign(T, { fase: 'criar', dig: '' });
      else TRAVA = null;
    } else Object.assign(T, { dig: '', erro: 'PIN errado. Tente de novo.' });
    render();
    return false;
  }
};

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('minha-revenda:' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fazerBackup(compartilhar) {
  const dados = {};
  for (const s of ['produtos', 'clientes', 'vendas', 'pagamentos', 'movimentos', 'fotos']) dados[s] = await ler(s);
  const json = JSON.stringify({ app: 'minha-revenda', versao: 1, feitoEm: new Date().toISOString(), config: { nome: S.cfg.nome || '' }, dados });
  // .txt porque o Android só deixa compartilhar alguns tipos de arquivo
  const nome = `revenda-copia-${hoje()}.txt`;
  const file = new File([json], nome, { type: 'text/plain' });
  let feito = false;
  if (compartilhar && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Cópia da revenda' }); feito = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!feito) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    if (compartilhar) toast('Arquivo salvo em Downloads. Envie ele pro seu Google Drive.');
  }
  await salvarCfg({ ultimoBackup: hoje() });
  if (feito || !compartilhar) toast('Cópia feita.');
  render();
}

// ================= eventos =================
async function executar(nome, v, el, ev) {
  const f = A[nome];
  if (!f) return;
  try {
    const r = await f(v, el, ev);
    if (r !== false) render();
  } catch (e) {
    console.error(e);
    toast('Algo deu errado: ' + (e.message || e));
  }
}
$app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  executar(el.dataset.a, el.dataset.v, el, ev);
});
$app.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.i) V[el.dataset.i] = el.value;
  if (el.dataset.set) A[el.dataset.set](el.value, el);
  if (el.dataset.i || el.dataset.set) render('parcial');
});
$app.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.c) executar(el.dataset.c, el.value, el, ev);
});
window.addEventListener('hashchange', () => { V = {}; render(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) escondidoEm = Date.now();
  else if (S.cfg.pinHash && !TRAVA && escondidoEm && Date.now() - escondidoEm > 3 * 60 * 1000) { TRAVA = { fase: 'entrar', dig: '' }; render(); }
});

// ================= início =================
const VERSAO_APP = '1.2';
(async function iniciar() {
  try {
    db = await abrirDB();
    await carregar();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    TRAVA = S.cfg.pinHash ? { fase: 'entrar', dig: '' } : { fase: 'criar', dig: '' };
    render();
  } catch (e) {
    $app.innerHTML = '<div class="done"><h1>Não consegui abrir o app</h1><span class="muted">' + esc(e.message || e) + '</span></div>';
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
