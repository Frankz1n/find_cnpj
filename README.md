# Orbyts Company Finder

A importação cruza clínicas da planilha com as empresas de saúde do município. O nome popular não é usado como razão social. O endereço, o telefone e os profissionais é que apontam o CNPJ. A Brasil API confirma o CNPJ escolhido.

## Como executar

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Coloque `APIFY_TOKEN` no `.env`. Sem ele, a importação para e não inventa empresa.

- Interface: http://localhost:5173
- Saúde da API: http://localhost:3333/health

O detalhe do módulo está em `docs/enriquecimento.md`.

## Estrutura

```text
apps/api     API Express, SQLite, Apify, IBGE e Brasil API.
apps/web     Importação, revisão, empresas e exportação.
docs         Arquitetura e o módulo de enriquecimento.
```
