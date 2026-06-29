/**
 * build.ts — gera public/metrics.json a partir do ClickUp.
 * Rodado pela GitHub Action a cada 30 min. Não há servidor: a página é estática
 * e lê esse JSON. O CLICKUP_TOKEN só existe dentro da Action (Secret), nunca no navegador.
 *
 * Gera os três períodos (dia/semana/mês) num único arquivo, pra a página
 * alternar sem precisar de backend.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildMetrics } from "./metrics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.CLICKUP_TOKEN) throw new Error("CLICKUP_TOKEN ausente.");

  const [mes, semana, dia] = await Promise.all([
    buildMetrics("mes"),
    buildMetrics("semana"),
    buildMetrics("dia"),
  ]);

  // Um arquivo só, com as séries dos três períodos.
  const out = {
    geradoEm: mes.geradoEm,
    kpis: mes.kpis,
    porEmpresa: mes.porEmpresa,
    porTecnico: mes.porTecnico,
    valoresReceber: mes.valoresReceber,
    esteira: mes.esteira,
    series: { mes: mes.serie, semana: semana.serie, dia: dia.serie },
  };

  const dir = join(__dirname, "..", "public");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "metrics.json"), JSON.stringify(out), "utf8");
  console.log(`[build] metrics.json gerado em ${out.geradoEm} — em aberto: ${out.kpis.emAberto}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
