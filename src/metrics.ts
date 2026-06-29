/**
 * metrics.ts — transforma as tarefas do ClickUp nas métricas do painel.
 *
 * Campos lidos (nomes exatos no ClickUp):
 *   "Cliente", "Técnico", "Situação GestãoClick",
 *   "Data de Recebimento" (epoch ms), "Data de Saída" (epoch ms),
 *   "Valor Total OS" (moeda).
 */

import { fetchAllTasks, campo, campoNum, type CuTask } from "./clickup.js";

const LISTS = {
  avulso: process.env.CLICKUP_LIST_AVULSO ?? "901327620288",
  cpfl: process.env.CLICKUP_LIST_CPFL ?? "901327620289",
  neo: process.env.CLICKUP_LIST_NEOENERGIA ?? "901327620291",
};

/**
 * Status considerados "a receber" (serviço feito, aguardando NF/faturamento).
 * AJUSTE conforme a operação. Os de contrato vêm dos 17 status; os de avulso
 * precisam ser confirmados (nomes exatos da lista Avulso).
 */
const STATUS_A_RECEBER = new Set(
  [
    // contrato
    "serv. fim – ag. nf",
    "nf retorno autorizada",
    "faturar contrato",
    // avulso (CONFIRMAR nomes reais na lista Avulso)
    "faturar avulso",
    "serv. fim - ag. nf",
  ].map((s) => s.toLowerCase()),
);

type Periodo = "dia" | "semana" | "mes";

/** Uma OS finalizada quando o status é do grupo fechado/concluído. */
function finalizada(t: CuTask): boolean {
  const tipo = t.status?.type ?? "";
  return tipo === "closed" || tipo === "done";
}

function dataMs(t: CuTask, nome: string): Date | null {
  const ms = campoNum(t, nome);
  return ms ? new Date(ms) : null;
}

/** Chave de período. dia=YYYY-MM-DD, mes=YYYY-MM, semana=YYYY-Www (ISO simplificado). */
function chavePeriodo(d: Date, p: Periodo): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (p === "mes") return `${y}-${m}`;
  if (p === "dia") return `${y}-${m}-${String(d.getUTCDate()).padStart(2, "0")}`;
  // semana (número da semana no ano, aproximado)
  const inicioAno = new Date(Date.UTC(y, 0, 1));
  const dias = Math.floor((d.getTime() - inicioAno.getTime()) / 86_400_000);
  const semana = String(Math.ceil((dias + inicioAno.getUTCDay() + 1) / 7)).padStart(2, "0");
  return `${y}-W${semana}`;
}

function rotuloMes(chave: string): string {
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [, m] = chave.split("-");
  return nomes[Number(m) - 1] ?? chave;
}

export interface Metrics {
  geradoEm: string;
  kpis: {
    emAberto: number;
    porLista: { avulso: number; cpfl: number; neo: number };
    entradasMes: number;
    saidasMes: number;
    valorReceberTotal: number;
  };
  serie: { periodo: Periodo; pontos: { chave: string; rotulo: string; entradas: number; saidas: number }[] };
  porEmpresa: { nome: string; total: number; contrato: "cpfl" | "neo" | "avulso" }[];
  porTecnico: { nome: string; total: number }[];
  valoresReceber: { contrato: number; avulso: number; porStatus: { status: string; valor: number }[] };
  esteira: { status: string; total: number; tipo: string }[];
}

export async function buildMetrics(periodo: Periodo = "mes"): Promise<Metrics> {
  const [avulso, cpfl, neo] = await Promise.all([
    fetchAllTasks(LISTS.avulso),
    fetchAllTasks(LISTS.cpfl),
    fetchAllTasks(LISTS.neo),
  ]);
  const marcados: { t: CuTask; lista: "avulso" | "cpfl" | "neo" }[] = [
    ...avulso.map((t) => ({ t, lista: "avulso" as const })),
    ...cpfl.map((t) => ({ t, lista: "cpfl" as const })),
    ...neo.map((t) => ({ t, lista: "neo" as const })),
  ];

  // ---- KPIs (em aberto = não finalizada) ----
  const abertos = marcados.filter((x) => !finalizada(x.t));
  const porLista = {
    avulso: abertos.filter((x) => x.lista === "avulso").length,
    cpfl: abertos.filter((x) => x.lista === "cpfl").length,
    neo: abertos.filter((x) => x.lista === "neo").length,
  };

  // ---- Série entrada × saída ----
  const mapaEnt = new Map<string, number>();
  const mapaSai = new Map<string, number>();
  for (const { t } of marcados) {
    const ent = dataMs(t, "Data de Recebimento");
    if (ent) mapaEnt.set(chavePeriodo(ent, periodo), (mapaEnt.get(chavePeriodo(ent, periodo)) ?? 0) + 1);
    const sai = dataMs(t, "Data de Saída");
    if (sai) mapaSai.set(chavePeriodo(sai, periodo), (mapaSai.get(chavePeriodo(sai, periodo)) ?? 0) + 1);
  }
  const chaves = Array.from(new Set([...mapaEnt.keys(), ...mapaSai.keys()])).sort();
  const ultimas = chaves.slice(-6);
  const pontos = ultimas.map((k) => ({
    chave: k,
    rotulo: periodo === "mes" ? rotuloMes(k) : k.slice(5),
    entradas: mapaEnt.get(k) ?? 0,
    saidas: mapaSai.get(k) ?? 0,
  }));
  const chaveMesAtual = chavePeriodo(new Date(), "mes");
  const entradasMes = Array.from(mapaEnt.entries()).filter(([k]) => k.startsWith(chaveMesAtual.slice(0, 7))).reduce((a, [, v]) => a + v, 0);
  const saidasMes = Array.from(mapaSai.entries()).filter(([k]) => k.startsWith(chaveMesAtual.slice(0, 7))).reduce((a, [, v]) => a + v, 0);

  // ---- Por empresa (cliente) ----
  const empresa = new Map<string, { total: number; lista: "cpfl" | "neo" | "avulso" }>();
  for (const { t, lista } of marcados) {
    const c = campo(t, "Cliente");
    if (!c) continue;
    const cur = empresa.get(c) ?? { total: 0, lista };
    cur.total++;
    empresa.set(c, cur);
  }
  const porEmpresa = Array.from(empresa.entries())
    .map(([nome, v]) => ({ nome, total: v.total, contrato: v.lista }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // ---- Carga por técnico (em aberto) ----
  const tecnico = new Map<string, number>();
  for (const { t } of abertos) {
    const tec = campo(t, "Técnico") ?? "Sem técnico";
    tecnico.set(tec, (tecnico.get(tec) ?? 0) + 1);
  }
  const porTecnico = Array.from(tecnico.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ---- Valores a receber ----
  let recContrato = 0, recAvulso = 0;
  const recPorStatus = new Map<string, number>();
  for (const { t, lista } of marcados) {
    const st = (t.status?.status ?? "").toLowerCase();
    if (!STATUS_A_RECEBER.has(st)) continue;
    const valor = campoNum(t, "Valor Total OS") ?? 0;
    if (valor <= 0) continue;
    if (lista === "avulso") recAvulso += valor; else recContrato += valor;
    recPorStatus.set(t.status.status, (recPorStatus.get(t.status.status) ?? 0) + valor);
  }
  const valoresReceber = {
    contrato: recContrato,
    avulso: recAvulso,
    porStatus: Array.from(recPorStatus.entries()).map(([status, valor]) => ({ status, valor })).sort((a, b) => b.valor - a.valor),
  };

  // ---- Esteira por status (listas de contrato) ----
  const esteiraMap = new Map<string, { total: number; tipo: string }>();
  for (const { t, lista } of marcados) {
    if (lista === "avulso") continue;
    const s = t.status?.status ?? "?";
    const cur = esteiraMap.get(s) ?? { total: 0, tipo: t.status?.type ?? "" };
    cur.total++;
    esteiraMap.set(s, cur);
  }
  const esteira = Array.from(esteiraMap.entries()).map(([status, v]) => ({ status, total: v.total, tipo: v.tipo }));

  return {
    geradoEm: new Date().toISOString(),
    kpis: {
      emAberto: abertos.length,
      porLista,
      entradasMes,
      saidasMes,
      valorReceberTotal: recContrato + recAvulso,
    },
    serie: { periodo, pontos },
    porEmpresa,
    porTecnico,
    valoresReceber,
    esteira,
  };
}
