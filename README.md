# Vigia BePro

Confere a cada 5 minutos se as plataformas estão no ar e avisa no Telegram (e no WhatsApp, enquanto o número de teste valer) quando alguma cai ou volta.

## O que ele faz

- **Confere 8 pontos:** loja BePro, site jeldebeloni.com.br, Manychato, Termos, Seminovos, feed do catálogo Meta e os dois bancos (Supabase). A lista fica em `sites.json`.
- **Confirma antes de avisar:** só avisa se a queda se repetir 30 segundos depois.
- **Diz de quem é a culpa:** lê a página de status da Vercel, do Supabase ou da Nuvemshop. Também diz quando foi a última publicação.
- **Avisa só o que mudou:** quando cai, quando volta e um lembrete a cada 3 h se continuar fora.
- **Bom dia diário:** às 8 h manda "Vigia ativo". Se essa mensagem não chegar, o vigia parou.
- **Dois canais + e-mail reserva:** basta o Telegram ou o WhatsApp entregar. Se os dois falharem, a rodada falha e o GitHub manda e-mail.

## Botão de voltar versão

No GitHub (site ou app do celular): **Actions → Voltar versão → Run workflow**. Escolha a plataforma e a ação.

- **Voltar para a versão anterior:** coloca no ar a publicação anterior. Enquanto isso, publicações novas não entram no ar sozinhas.
- **Desfazer a volta:** põe de novo no ar a versão mais nova e religa a publicação automática.

Serve só para as plataformas da Vercel. Não resolve quando a culpa é do fornecedor.

## Cofre do GitHub (Settings → Secrets and variables → Actions)

| Nome | Tipo | O que é |
|---|---|---|
| `TELEGRAM_TOKEN` | segredo | Token do bot criado no @BotFather |
| `TELEGRAM_CHAT_ID` | segredo | ID da conversa do Jelde com o bot (o @userinfobot mostra) |
| `WHATSAPP_TOKEN` | segredo | Token permanente do usuário do sistema da Meta com permissão de WhatsApp |
| `WHATSAPP_PHONE_ID` | segredo | ID do número que envia (número de teste da Meta) |
| `WHATSAPP_DESTINO` | segredo | Número que recebe, só dígitos com 55 e DDD |
| `VERCEL_TOKEN` | segredo | Token da Vercel com acesso ao time jelde-centralizador |
| `VERCEL_TEAM_ID` | variável | `team_…` do time jelde-centralizador |
| `WHATSAPP_MODELO` | variável | Opcional. Nome do modelo de mensagem (padrão `aviso_vigia`) |

## Modelo de mensagem na Meta

Nome `aviso_vigia`, categoria **Utilidade**, idioma **Português (BR)**. Corpo:

```
Aviso do vigia BePro: {{1}}

{{2}}

Mensagem automática de monitoramento das plataformas.
```

## Testar sem enviar

```
SIMULAR=1 node vigia.mjs
```

Este repositório é público para o GitHub rodar de graça a cada 5 minutos. Senhas e tokens ficam só no cofre e nunca vão para os arquivos.
