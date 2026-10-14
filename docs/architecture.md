# Arquitetura

A importação envia as linhas da planilha. A API agrupa por município e CNAE, consulta a Apify uma vez por grupo e cruza localmente. A Brasil API confirma o CNPJ que passou da nota média.

Não há ORM nem fila externa. O SQLite do Node guarda jobs, resultados, cache da Receita e municípios. O processamento roda no processo da API, com no máximo 3 execuções da Apify ao mesmo tempo.

## Fluxo

```text
Interface
  -> POST /api/enrichment/jobs
       -> Zod valida a planilha
       -> o job responde 202 e continua em segundo plano
       -> IBGE resolve o município
       -> Apify lista o CNAE, ou o cache de 30 dias responde
       -> o cruzamento grava nota, justificativa e alternativas
       -> Brasil API confirma confiança alta ou média
  -> GET /api/enrichment/jobs/:id
  -> POST .../decision
  -> GET .../export
```

Nenhum CNPJ é inventado quando a Apify não devolve a empresa.

## Onde cada regra mora

| Pasta | Responsabilidade |
| --- | --- |
| `apps/api/src/modules/enrichment` | Normalização, nota, Apify, IBGE, cache e job |
| `apps/api/src/modules/integrations/brasilapi` | Confirmação do CNPJ escolhido |
| `apps/api/src/modules/search/cnpj.ts` | Dígitos verificadores |
| `apps/web/src/features/enrichment` | Mapeamento, revisão e exportação |

O token da Apify fica só em `APIFY_TOKEN`.
