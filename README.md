# Vigia BePro

Confere a cada 15 minutos se as plataformas estão no ar e avisa por e-mail (jelde@timebeloni.com) quando alguma cai ou volta.

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

## Como ele roda a cada 15 minutos

Desde 16/11/2026 cada rodada confere tudo uma vez e termina (~1 min). Quem acorda o Vigia é o `pg_cron` do banco do Manychato (tarefa `vigia-bepro`), que a cada 15 min chama o despertador da Vercel (`processos-br`, `/api/disparar/vigia`, chave `VIGIA_SECRET`). O agendamento do próprio GitHub (minutos 7, 22, 37 e 52) fica de reserva, porque ele atrasa e pula disparos (09 a 16/11: só 26 de 168). Antes disso, cada rodada ficava ~5h40 em ciclo; ver `docs/planos/2026-11-16-rodadas-curtas.md`.

Para parar de vez: Actions → Vigia → "Disable workflow" e, no Supabase do Manychato, `select cron.unschedule('vigia-bepro');`.

Este repositório é público para o GitHub Actions rodar de graça e sem limite de minutos. Senhas e tokens ficam só no cofre e nunca vão para os arquivos.
