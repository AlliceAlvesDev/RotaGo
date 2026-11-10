# RotaGo Android — dados locais

APK Android independente do site RotaGo e do Rotas Yenme. Usa os mesmos formulários e cálculos, com armazenamento exclusivamente no celular de cada instalação. O APK é distribuído separadamente e não altera os sites publicados.

## Instalar

Baixe `RotaGo-1.0.0.apk` na seção Releases, abra o arquivo no Android e autorize a instalação por esse navegador/gerenciador quando o Android solicitar. Compatível com Android 8.0 ou superior e Android System WebView atualizado. Não é um aplicativo para iPhone.

## Dados

- Cada instalação começa vazia. Nenhum dado financeiro do criador está incluído.
- Rotas, planejamentos, folgas, metas e configurações ficam salvos no armazenamento privado do aplicativo.
- Fechar e reabrir o aplicativo não apaga os registros.
- Não há login, sincronização, publicidade ou solicitação de permissão de internet.
- Desinstalar ou limpar os dados apaga os registros locais. Use Exportar backup no rodapé e guarde o JSON fora do app; Restaurar backup importa apenas o arquivo escolhido e substitui os dados locais após confirmação.
- Backups JSON contêm informações financeiras em texto legível. Compartilhe somente com quem deve receber esses dados.

## Compilar

Linux, Node.js >=22.13, Java >=21, `keytool`, `curl` e Python 3:

```sh
python3 build.py
```

O script baixa ferramentas oficiais do Android e o compilador Eclipse ECJ com verificação de integridade, instala as dependências web e cria um APK assinado em `release/`.

A primeira execução gera a identidade de assinatura em `.signing/`. **Guarde essa pasta de forma privada**: futuras atualizações precisam da mesma chave. Não envie `.signing/` ao GitHub ou junto com o APK.

## Testes executados

- Armazenamento, reinício, edição, instalações independentes e backup.
- Formulários de rota e planejamento em Chromium com tela de celular; nenhuma chamada a servidor.
- Compilação Android, alinhamento e assinatura APK v2/v3 verificados.

Esta primeira versão ainda precisa ser testada em aparelho Android físico, especialmente os seletores nativos de arquivo e o comportamento ao instalar atualizações.
