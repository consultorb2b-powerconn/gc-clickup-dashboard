# gc-clickup-dashboard

**Painel do Gestor — Centro de Reparos (Powerconn).**
Mostra entrada×saída, OS por empresa, carga por técnico, valores a receber e a esteira por status — lendo as Ordens de Serviço do ClickUp.

Arquitetura **100% GitHub** (sem servidor): uma **GitHub Action** roda a cada 30 min, lê o ClickUp, gera `public/metrics.json` e publica tudo no **GitHub Pages**. A página é estática e lê esse JSON. O `CLICKUP_TOKEN` só existe dentro da Action (Secret) — nunca vai pro navegador.

> Por enquanto **público**. Para fechar depois: tornar o repositório privado exige GitHub Pages em plano pago (ou trocar por outra hospedagem). A troca é só de configuração — o código não muda.

## Como funciona

```
ClickUp API ─▶ src/clickup.ts ─▶ src/metrics.ts ─▶ src/build.ts ─▶ public/metrics.json
                                                                         │
                          GitHub Action (cron 30 min) ─▶ deploy GitHub Pages
                                                                         │
                                            público abre a página ─▶ app.js lê metrics.json
```

- `src/clickup.ts` — busca as tarefas das 3 listas (paginado, retry de 429, só leitura).
- `src/metrics.ts` — agrega nas métricas do painel.
- `src/build.ts` — gera `public/metrics.json` (dia/semana/mês num arquivo só).
- `public/` — página estática (index.html + styles.css + app.js).
- `.github/workflows/dashboard.yml` — agenda + publica no Pages.

## Setup (uma vez)

1. Suba este diretório como repositório no GitHub (pode ser o mesmo dono do gc-clickup-sync).
2. **Secret:** Settings → Secrets and variables → Actions → New repository secret →
   `CLICKUP_TOKEN` = o `pk_…` (o mesmo do gc-clickup-sync).
3. **Pages:** Settings → Pages → Source = **GitHub Actions**.
4. Dispare a primeira geração: aba **Actions** → workflow **dashboard** → **Run workflow**.
5. O link sai em Settings → Pages (algo como `https://<dono>.github.io/<repo>/`).

> O arquivo `.github/workflows/dashboard.yml` precisa existir no repositório. Se o seu
> PAT não tem escopo `workflow`, crie/edite esse arquivo pela **interface web** do GitHub.

## Rodar localmente (opcional)

```bash
npm install
# defina o token na sessão e gere o JSON + sirva a pasta public
# Windows PowerShell:  $env:CLICKUP_TOKEN="pk_..."; npm run dev
npm run dev    # gera metrics.json e sobe um servidor estático em public/
```

## Métricas e de onde saem

| Painel | Fonte |
|---|---|
| OS em aberto (por lista) | status não-fechado de cada lista |
| Entradas / Saídas | campos **Data de Recebimento** / **Data de Saída** |
| OS por empresa | campo **Cliente** (filtro por contrato) |
| Carga por técnico | campo **Técnico** (OS em aberto) |
| Valores a receber | soma de **Valor Total OS** em status pendente de NF, contrato/avulso |
| Esteira por status | status das listas de contrato |

## Pontos de ajuste

- **`STATUS_A_RECEBER`** em `src/metrics.ts`: confirme os nomes exatos dos status da lista
  **Avulso** que contam como "a receber" (os de contrato já estão certos).
- **Valores a receber** depende de **Valor Total OS** preenchido; OS sem orçamento entram como
  zero. Se a cobrança do contrato for fixa por OS, troque a regra aqui.
- **Atualização** a cada 30 min (cron da Action) — não é tempo real, é o mesmo ritmo do sync.

## Pendência relacionada

Ver `DIAG_pendente_classificacao.md` — há OS que podem estar na lista de contrato errada
por conflito de sinais no roteador (ex.: OS 6104 COELBA na lista CPFL). Resolver antes de
confiar 100% nos números por contrato.
