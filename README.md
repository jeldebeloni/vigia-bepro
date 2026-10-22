# Vigia BePro

Confere a cada 5 minutos se as plataformas estão no ar e avisa por e-mail (jelde@timebeloni.com) quando alguma cai ou volta.

## O que ele faz

- **Confere 8 pontos:** loja BePro, site jeldebeloni.com.br, Manychato, Termos, Seminovos, feed do catálogo Meta e os dois bancos (Supabase). A lista fica em `sites.json`.
- **Confirma antes de avisar:** só avisa se a queda se repetir 30 segundos depois.
- **Diz de quem é a culpa:** lê a página de status da Vercel, do Supabase ou da Nuvemshop. Também diz quando foi a última publicação.
- **Avisa só o que mudou:** quando cai, quando volta e um lembrete a cada 3 h se continuar fora.
- **Bom dia diário:** às 8 h manda "Vigia ativo". Se essa mensagem não chegar, o vigia parou.
- **Só e-mail (20/10/2026):** sai do Gmail jeldepessoal@gmail.com para jelde@timebeloni.com. Se o e-mail falhar, a rodada falha e o GitHub manda o e-mail de erro dele.

## Botão de voltar versão

No GitHub (site ou app do celular): **Actions → Voltar versão → Run workflow**. Escolha a plataforma e a ação.

- **Voltar para a versão anterior:** coloca no ar a publicação anterior. Enquanto isso, publicações novas não entram no ar sozinhas.
- **Desfazer a volta:** põe de novo no ar a versão mais nova e religa a publicação automática.

Serve só para as plataformas da Vercel. Não resolve quando a culpa é do fornecedor.

## Cofre do GitHub (Settings → Secrets and variables → Actions)

| Nome | Tipo | O que é |
|---|---|---|
| `GMAIL_USUARIO` | segredo | Conta que envia (jeldepessoal@gmail.com) |
| `GMAIL_SENHA_APP` | segredo | Senha de app dessa conta (a mesma do bepro-relatorios) |
| `VERCEL_TOKEN` | segredo | Token da Vercel com acesso ao time jelde-centralizador |
| `VERCEL_TEAM_ID` | variável | `team_…` do time jelde-centralizador |

## Testar sem enviar

```
SIMULAR=1 node vigia.mjs
```

## Como ele roda a cada 5 minutos

O agendamento do GitHub atrasa horas (22/10/2026: rodou a cada 3 a 6 h e não avisou a queda das DMs do Manychato). Por isso cada rodada fica ~5h40 em ciclo, conferindo a cada 5 min, e no fim chama a próxima (`gh workflow run`). O agendamento de hora em hora (minuto 17) só religa a corrente se ela quebrar. Para parar de vez: cancelar a rodada em andamento não religa; desligue o workflow em Actions → Vigia → "Disable workflow".

Este repositório é público para o GitHub rodar de graça a cada 5 minutos. Senhas e tokens ficam só no cofre e nunca vão para os arquivos.
