/**
 * build.ts — roda na GitHub Action: lê o ClickUp e gera public/metrics.json.
 *
 * Estrutura gerada:
 *   {
 *     geradoEm,
 *     // foto do agora (independe do período):
 *     emAberto, porLista, porTecnico, valoresReceber, esteira, porEmpresa,
 *     // por período (o filtro Dia/Semana/Mês escolhe qual usar):
 *     periodos: { mes:{serie,entradas,saidas}, semana:{...}, dia:{...} }
 *   }
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

  // os campos "foto" são iguais nos três; uso os do mês.
  const out = {
    geradoEm: mes.geradoEm,
    emAberto: mes.emAberto,
    porLista: mes.porLista,
    porTecnico: mes.porTecnico,
    valoresReceber: mes.valoresReceber,
    esteira: mes.esteira,
    porEmpresa: mes.porEmpresa,
    periodos: {
      mes: { serie: mes.serie, entradas: mes.entradas, saidas: mes.saidas },
      semana: { serie: semana.serie, entradas: semana.entradas, saidas: semana.saidas },
      dia: { serie: dia.serie, entradas: dia.entradas, saidas: dia.saidas },
    },
  };

  const dir = join(__dirname, "..", "public");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "metrics.json"), JSON.stringify(out), "utf8");
  console.log(`[build] metrics.json gerado em ${out.geradoEm} — em aberto: ${out.emAberto}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
