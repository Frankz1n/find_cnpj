# Integrações

A pesquisa por nome, telefone ou CNPJ em Data Stone, Catta e CNPJ.IA.BR saiu. O fluxo atual lista empresas da Receita por município e CNAE, cruza com a planilha e confirma o CNPJ na Brasil API.

## Apify

Documentação do ator: `johnatan029/cnpj-empresas-brasil-scraper`.

O token fica em `APIFY_TOKEN`, só no servidor, no header `Authorization: Bearer`. Cada execução envia `maxTotalChargeUsd`. O discovery usa a chamada síncrona. Se ela estourar o tempo, a execução segue em modo assíncrono. Há até 3 tentativas em HTTP 429, 5xx, FAILED e TIMED-OUT. No máximo 3 execuções ao mesmo tempo.

O resultado de `(município IBGE, CNAE)` fica em `receita_cache` por 30 dias.

## IBGE

`GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`

O nome da cidade é comparado sem acento. A tabela `ibge_municipio` guarda o código para sempre. Sem UF na linha, vale a UF padrão da importação.

## Brasil API

Documentação: https://brasilapi.com.br/docs

Depois do cruzamento, cada CNPJ de confiança alta ou média é conferido em `GET /api/cnpj/v1/{cnpj}`. A situação, a razão social e o endereço oficiais substituem os campos vazios ou desatualizados da lista. Um 429 interrompe as confirmações seguintes, sem nova tentativa. A nota do cruzamento não muda.
