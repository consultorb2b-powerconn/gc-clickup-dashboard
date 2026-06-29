# PENDENTE — Diag rápido: conflito de classificação de contrato

**Quando fazer:** antes de confiar 100% nos números por contrato do dashboard.

## O que investigar

Algumas OS podem estar na **lista de contrato errada** por conflito de sinais no
roteador (`contrato.ts`). Caso real encontrado:

- **OS 6104** — cliente **COELBA** (grupo NEOENERGIA), serviço "TAXA II - SERVIÇO -
  NEOENERGIA", mas o card está na lista **OS – Contrato CPFL**.
- Causa provável: o roteador dá prioridade ao **produto** (passo 1, override). A OS
  deve ter um produto marcado como `CONTRATO - CPFL` no GestãoClick (erro de digitação
  na origem), que venceu o cliente/serviço que indicam NEO.

## Diag a escrever

Um script (parecido com `diag-os-contrato.ts`) que varre as OS de contrato e
**lista os conflitos**: casos em que o destino pelo PRODUTO difere do destino pelo
CLIENTE/REGIÃO. Saída: OS, cliente, produto, serviço, e os dois vereditos.

## Decisão depois do diag

- Se forem poucos: correção pontual (ajustar no GestãoClick ou mover o card).
- Se forem muitos: **mudar a prioridade** do roteador — cliente acima do produto,
  ou exigir que produto e cliente concordem. Mexer em `routeContrato` no
  `gc-clickup-sync/src/contrato.ts` e rodar um backfill de reconciliação.

## Observação

Não é bug do código — é dado conflitante na origem (GestãoClick). O roteador faz o
que foi pedido; a questão é qual sinal deve ter prioridade quando eles divergem.
