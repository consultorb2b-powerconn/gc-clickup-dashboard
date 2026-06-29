/**
 * clickup.ts — leitura das OS no ClickUp para o dashboard.
 * Somente leitura (GET). Não cria nem altera nada.
 */

const CU_BASE = "https://api.clickup.com/api/v2";
const TOKEN = process.env.CLICKUP_TOKEN ?? "";

export interface CuTask {
  id: string;
  name: string;
  status: { status: string; type: string }; // type: open | custom | closed | done
  archived: boolean;
  custom_fields: { id: string; name: string; type: string; value?: unknown }[];
}

function headers() {
  return { Authorization: TOKEN, "Content-Type": "application/json" };
}

/** fetch com retry para 429 (rate limit do ClickUp). */
async function cuFetch(url: string, tentativas = 6): Promise<Response> {
  for (let i = 0; i < tentativas; i++) {
    const res = await fetch(url, { headers: headers() });
    if (res.status !== 429) return res;
    const espera = Number(res.headers.get("retry-after") ?? "2") * 1000 || 2000;
    await new Promise((r) => setTimeout(r, espera));
  }
  return fetch(url, { headers: headers() });
}

/**
 * Busca TODAS as tarefas (não arquivadas) de uma lista, incluindo fechadas.
 * Não inclui arquivadas de propósito: os cards legados migrados ficaram
 * arquivados na Avulso e não devem contar nas métricas.
 */
export async function fetchAllTasks(listId: string): Promise<CuTask[]> {
  const all: CuTask[] = [];
  let page = 0;
  for (;;) {
    const url = `${CU_BASE}/list/${listId}/task?page=${page}&include_closed=true&subtasks=false`;
    const res = await cuFetch(url);
    if (!res.ok) throw new Error(`ClickUp GET tasks (lista ${listId}, página ${page}) falhou: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { tasks: CuTask[]; last_page?: boolean };
    const tasks = data.tasks ?? [];
    all.push(...tasks);
    if (data.last_page || tasks.length === 0) break;
    page++;
  }
  return all;
}

/** Lê o valor (string) de um custom field pelo NOME (case-insensitive). */
export function campo(task: CuTask, nome: string): string | null {
  const n = nome.toLowerCase();
  const cf = task.custom_fields.find((f) => f.name.toLowerCase() === n);
  if (!cf || cf.value === undefined || cf.value === null || cf.value === "") return null;
  return String(cf.value).trim();
}

/** Lê um campo numérico (moeda/data). Retorna null se vazio/inválido. */
export function campoNum(task: CuTask, nome: string): number | null {
  const v = campo(task, nome);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
