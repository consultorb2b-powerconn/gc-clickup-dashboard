/* app.js — lê metrics.json (gerado pela Action) e desenha o painel. Sem backend. */

const brl = (n) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brlShort = (n) => (n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : brl(n));
const corLista = (c) => (c === "cpfl" ? "f-cpfl" : c === "neo" ? "f-neo" : "f-grey");
const el = (id) => document.getElementById(id);

let periodoAtual = "mes";
let empresaFiltro = "todas";
let DATA = null;

async function carregar() {
  el("upd").textContent = "carregando…";
  el("erro").innerHTML = "";
  try {
    const r = await fetch("metrics.json?t=" + Date.now());
    if (!r.ok) throw new Error("metrics.json não encontrado (a Action já rodou?)");
    DATA = await r.json();
    render();
    const h = new Date(DATA.geradoEm).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    el("upd").textContent = "atualizado " + h;
  } catch (e) {
    el("erro").innerHTML = '<div class="err">' + e.message + '</div>';
    el("upd").textContent = "";
  }
}

function render() {
  const m = DATA;
  el("kpi-aberto").textContent = m.kpis.emAberto.toLocaleString("pt-BR");
  el("kpi-split").innerHTML =
    '<span><i style="background:var(--avulso)"></i>' + m.kpis.porLista.avulso + '</span>' +
    '<span><i style="background:var(--cpfl)"></i>' + m.kpis.porLista.cpfl + '</span>' +
    '<span><i style="background:var(--neo)"></i>' + m.kpis.porLista.neo + '</span>';
  el("kpi-entradas").textContent = m.kpis.entradasMes.toLocaleString("pt-BR");
  el("kpi-saidas").textContent = m.kpis.saidasMes.toLocaleString("pt-BR");
  const saldo = m.kpis.entradasMes - m.kpis.saidasMes;
  el("kpi-saldo").textContent = (saldo >= 0 ? "saldo +" : "saldo ") + saldo + " na fila";
  el("kpi-receber").textContent = brlShort(m.kpis.valorReceberTotal);

  const serie = m.series[periodoAtual];
  el("serie-sub").textContent = "por " + serie.periodo + " · últimos " + serie.pontos.length;
  desenharChart(serie.pontos);

  desenharEmpresa(m.porEmpresa);

  const maxT = Math.max(1, ...m.porTecnico.map((t) => t.total));
  el("tecnico-bars").innerHTML = m.porTecnico.map((t) => barRow(t.nome, t.total, maxT, t.nome === "Sem técnico" ? "f-grey" : "f-prim")).join("");

  desenharDonut(m.valoresReceber);

  const maxE = Math.max(1, ...m.esteira.map((e) => e.total));
  el("esteira").innerHTML = m.esteira.map((e) => {
    const cls = e.tipo === "closed" || e.tipo === "done" ? "done" : /aguardando|faturar|ag\. nf/i.test(e.status) ? "warn" : "";
    return '<div class="fl"><span class="s" title="' + e.status + '">' + e.status + '</span>' +
      '<div class="t"><div class="f ' + cls + '" style="width:' + Math.round((e.total / maxE) * 100) + '%"></div></div>' +
      '<span class="c tnum">' + e.total + '</span></div>';
  }).join("");
}

function barRow(nome, valor, max, cls) {
  const w = Math.round((valor / max) * 100);
  return '<div class="brow"><span class="nm" title="' + nome + '">' + nome + '</span>' +
    '<div class="track"><div class="fill ' + cls + '" style="width:' + w + '%"></div></div>' +
    '<span class="v tnum">' + valor.toLocaleString("pt-BR") + '</span></div>';
}

function desenharEmpresa(lista) {
  const chips = ["todas", "cpfl", "neo"];
  const rotulo = { todas: "Todas", cpfl: "CPFL", neo: "NEO" };
  el("empresa-chips").innerHTML = chips.map((c) => '<span class="chip ' + (c === empresaFiltro ? "on" : "") + '" data-f="' + c + '">' + rotulo[c] + '</span>').join("");
  el("empresa-chips").querySelectorAll(".chip").forEach((ch) =>
    ch.addEventListener("click", () => { empresaFiltro = ch.dataset.f; desenharEmpresa(DATA.porEmpresa); }));
  const filtrada = empresaFiltro === "todas" ? lista : lista.filter((e) => e.contrato === empresaFiltro);
  const top = filtrada.slice(0, 7);
  const max = Math.max(1, ...top.map((e) => e.total));
  el("empresa-bars").innerHTML = top.map((e) => barRow(e.nome, e.total, max, corLista(e.contrato))).join("")
    || '<div class="sub" style="padding:8px 0">Sem dados para este filtro.</div>';
}

function desenharChart(pontos) {
  const svg = el("chart");
  if (!pontos || !pontos.length) { svg.innerHTML = ""; return; }
  const X0 = 40, X1 = 590, Y0 = 20, Y1 = 180;
  const max = Math.max(10, ...pontos.flatMap((p) => [p.entradas, p.saidas]));
  const nice = Math.ceil(max / 50) * 50 || 50;
  const x = (i) => X0 + (i * (X1 - X0)) / Math.max(1, pontos.length - 1);
  const y = (v) => Y1 - (v / nice) * (Y1 - Y0);
  const linha = (k) => pontos.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p[k]).toFixed(1)).join(" ");
  const area = (k) => linha(k) + " L" + x(pontos.length - 1).toFixed(1) + "," + Y1 + " L" + X0 + "," + Y1 + " Z";
  const labels = pontos.map((p, i) => '<text class="axis" x="' + (x(i) - 8) + '" y="200">' + p.rotulo + '</text>').join("");
  svg.innerHTML =
    '<defs>' +
    '<linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10B5AC" stop-opacity=".28"/><stop offset="1" stop-color="#10B5AC" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F59E0B" stop-opacity=".22"/><stop offset="1" stop-color="#F59E0B" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X1 + '" y2="' + Y0 + '" stroke="#EEF2F7"/>' +
    '<line x1="' + X0 + '" y1="' + ((Y0 + Y1) / 2) + '" x2="' + X1 + '" y2="' + ((Y0 + Y1) / 2) + '" stroke="#EEF2F7"/>' +
    '<line x1="' + X0 + '" y1="' + Y1 + '" x2="' + X1 + '" y2="' + Y1 + '" stroke="#E3E9F0"/>' +
    '<text class="axis" x="8" y="' + (Y0 + 4) + '">' + nice + '</text>' +
    '<text class="axis" x="8" y="' + ((Y0 + Y1) / 2 + 4) + '">' + Math.round(nice / 2) + '</text>' +
    '<text class="axis" x="22" y="' + (Y1 + 4) + '">0</text>' +
    '<path d="' + area("saidas") + '" fill="url(#gSai)"/><path d="' + linha("saidas") + '" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="' + area("entradas") + '" fill="url(#gEnt)"/><path d="' + linha("entradas") + '" fill="none" stroke="#10B5AC" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    labels;
}

function desenharDonut(rec) {
  const total = rec.contrato + rec.avulso;
  el("donut-total").textContent = brlShort(total);
  const r = 62, C = 2 * Math.PI * r;
  const fr = total > 0 ? rec.contrato / total : 0;
  const seg = (fr * C).toFixed(1);
  el("donut").innerHTML =
    '<circle cx="85" cy="85" r="' + r + '" fill="none" stroke="#EEF2F7" stroke-width="20"/>' +
    '<circle cx="85" cy="85" r="' + r + '" fill="none" stroke="var(--avulso)" stroke-width="20" stroke-dasharray="' + C.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 85 85)"/>' +
    '<circle cx="85" cy="85" r="' + r + '" fill="none" stroke="url(#gd)" stroke-width="20" stroke-linecap="round" stroke-dasharray="' + seg + ' ' + C.toFixed(1) + '" transform="rotate(-90 85 85)"/>' +
    '<defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#10B5AC"/></linearGradient></defs>';
  const linhas = [
    '<div class="item"><span class="lbl"><i style="background:var(--cpfl)"></i>Contrato (CPFL + NEO)</span><span class="amt tnum">' + brl(rec.contrato) + '</span></div>',
    '<div class="item"><span class="lbl"><i style="background:var(--avulso)"></i>Avulso</span><span class="amt tnum">' + brl(rec.avulso) + '</span></div>',
  ];
  (rec.porStatus || []).slice(0, 3).forEach((s) =>
    linhas.push('<div class="item"><span class="lbl" style="color:var(--faint)">↳ ' + s.status + '</span><span class="amt" style="font-size:13px;color:var(--muted)">' + brl(s.valor) + '</span></div>'));
  el("receber-br").innerHTML = linhas.join("");
}

el("seg-periodo").querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => {
    el("seg-periodo").querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    periodoAtual = b.dataset.p;
    if (DATA) render();
  }));

carregar();
