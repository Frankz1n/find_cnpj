# Enriquecimento de CNPJ

A importação não busca o CNPJ pelo nome da planilha. Ela puxa, por município e CNAE, as empresas da Receita e cruza localmente com endereço, telefone e nomes.

## Configurar a Apify

1. No Apify Console, abra Settings → API & Integrations → Personal API tokens.
2. Coloque o token em `APIFY_TOKEN` no `.env` da raiz. O arquivo já está no `.gitignore`.
3. Opcional: `APIFY_MAX_CHARGE_USD` limita cada execução. O padrão é `1`.
4. Opcional: `APIFY_PRICE_PER_RESULT_USD` estima o custo mostrado no fim. O padrão é `0.0015`.

Sem token, a importação falha com uma mensagem e não inventa CNPJ.

A Brasil API continua confirmando o CNPJ escolhido. Ela não usa chave.

## Ajustar os CNAEs

A lista inicial fica na tabela `cnae_catalog` (código de 7 dígitos e descrição). O banco é o SQLite em `ENRICHMENT_DATABASE_PATH`, por padrão `data/enrichment.sqlite`, criado na pasta de onde a API sobe.

A especialidade da planilha escolhe os CNAEs da primeira varredura. Odontologia e implante usam `8630504` e `8640205`. Se nenhum candidato passar de 50, a varredura segue para o restante do catálogo.

## Como ler a nota

| Nota | Significado |
| --- | --- |
| 80 a 100, Alta | Endereço e outros sinais fortes. A linha já entra como aceita. |
| 50 a 79, Média | Revisar. Se o melhor candidato estiver nessa faixa, uma consulta extra traz os sócios. |
| Abaixo de 50, Baixa | Os sinais não bastam. |
| Não encontrado | Não houve candidato ativo. Um CNPJ baixado ou inapto pode aparecer só como alternativa. |

O endereço igual vale 50. Telefone igual, nome fantasia e profissional valem 25 cada. Instagram vale 10. CNPJ baixado ou inapto perde 40. A nota para em 100.

Um telefone que aparece em mais de 3 CNPJs do município é tratado como telefone de escritório e não conta como evidência.
