# RotaGo

Planejamento de contas por vencimento, registro de jornadas e relatórios para motoristas e entregadores.

Esta versão usa a mesma base funcional do Rotas Yenme, com marca RotaGo, atualização automática dos valores disponíveis para contas e gastos extras por jornada. O Rotas Yenme permanece independente.

## Funcionalidades

- Planejamento mensal com contas por vencimento, valores separados manualmente e folgas selecionadas no calendário.
- Progresso automático das contas com o líquido das jornadas, descontando combustível, manutenção, investimento, outros gastos e reserva diária uma vez por dia.
- Meta automática do planejamento na aba Rota / Meta; metas manuais quando não há plano ativo.
- Jornadas 99, Shopee e Uber; distância rodada ou hodômetro inicial/final.
- Gastos extras com descrição e valor, incluídos nos relatórios diários, semanais e mensais.
- Temas claro/escuro e logos originais adaptadas ao espaço disponível.
- Armazenamento na nuvem em Cloudflare D1, separado do site de referência.

## Desenvolvimento

Node.js >=22.13.0 e Linux:

```sh
npm run install:ci
npm run db:generate # somente após mudar o schema
npm run dev
npm run build
```

O projeto usa React, Vinext e Cloudflare Workers. `.openai/hosting.json` identifica exclusivamente a publicação do RotaGo. As migrações SQL ficam em `drizzle/`.

## Dados anteriores

A versão anterior do RotaGo continua acessível em `/versao-anterior/`, na mesma origem, para consultar e exportar os dados armazenados no navegador. Esses dados não são importados automaticamente para o novo banco. Dados do Rotas Yenme não foram copiados.

## Acesso e comercialização

O site mantém acesso privado pelo Sites. Esta base não implementa assinaturas ou isolamento de registros entre clientes comerciais; esses recursos precisam ser desenvolvidos antes de disponibilizar a aplicação para vários clientes.

Site: https://rotago-planejamento.yenmegeh.chatgpt.site
