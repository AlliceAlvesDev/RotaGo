# RotaGo

Aplicação responsiva para motoristas e entregadores planejarem contas e acompanharem resultados de rotas na 99, Uber e Shopee.

## Funcionalidades

- Planejamento de contas, vencimentos, combustível, reservas e dias de folga.
- Meta diária calculada com base nos dias de trabalho restantes.
- Registro de várias rotas por dia, com hodômetro inicial/final ou distância rodada.
- Desconto de combustível, reservas e gastos extras para calcular o saldo para contas.
- Atualização automática do planejamento ao criar, editar ou excluir rotas.
- Relatórios diários, semanais e mensais, com médias por hora e quilômetro.
- Temas claro e escuro, logo responsiva, exportação CSV e backup JSON.

## Executar localmente

Não há dependências de compilação. Com Python 3 instalado:

```sh
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000 no navegador.

## Estrutura

- `dist/index.html`: estrutura da aplicação.
- `dist/style.css`: estilos, temas e adaptação a celulares e tablets.
- `dist/app.js`: cálculos, formulários, relatórios e armazenamento local.
- `dist/logo-full.png` e `dist/logo-symbol.png`: logos originais.
- `.openai/hosting.json`: configuração da publicação existente no Sites.

## Dados e uso comercial

Esta versão armazena dados em `localStorage`, no navegador de cada dispositivo. Não há backend, login de usuários, sincronização entre aparelhos ou cobrança de assinaturas. Exporte backups para preservar seus registros.

Os dados financeiros cadastrados pelo usuário não são incluídos neste repositório.

## Site

https://rotago-planejamento.yenmegeh.chatgpt.site
