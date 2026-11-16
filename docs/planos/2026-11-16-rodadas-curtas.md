# Vigia em rodadas curtas a cada 15 minutos

## 1. Como está hoje (medido em 16/11/2026)

- Uma rodada fica ~5h40 ligada, confere a cada 5 min (`sleep` entre as conferências) e no fim dispara a próxima (`gh workflow run`). O agendamento de hora em hora (minuto 17) só religa se a corrente quebrar.
- Feito assim em 22/10/2026 porque o agendador do GitHub rodou a cada 3 a 6 h e o aviso das DMs do Manychato não saiu.
- Espera parada conta minuto (o GitHub cobra o tempo de relógio do job). Mas o repositório é **público** desde a criação (06/10) e, em repositório público, o Actions é grátis e sem limite. Os ~35.800 min/30 dias aparecem no relatório, mas não descontam do plano.
- O agendador do GitHub continua falhando: dos 168 disparos de hora em hora esperados de 09 a 16/11, só 26 aconteceram; atraso mediano de 32 min e buraco de até 11 h.

## 2. O que muda

- Cada rodada confere os 8 pontos **uma vez** e termina (~1 min). Sem `sleep`, sem ciclo e sem disparar a próxima.
- **Despertador principal fora do GitHub:** o `pg_cron` do Supabase chama a cada 15 min o despertador que já existe na Vercel (`/api/disparar/vigia`, mesmo esquema dos outros robôs), que manda o GitHub rodar o Vigia.
- **Reserva:** o agendamento do próprio GitHub passa para a cada 15 min (`7,22,37,52 * * * *`). Se os dois dispararem, a fila do `concurrency` evita rodada dupla ao mesmo tempo.
- Gasto esperado: ~96 rodadas/dia ≈ 2.900 min/mês (continua grátis por ser público).

## 3. O que não muda

- Os 8 pontos de `sites.json`, a confirmação 30 s depois, o diagnóstico de culpa, o lembrete a cada 3 h, o "bom dia" das 8 h e os avisos do Manychato e da plataforma de compras.
- Aviso só por e-mail, do mesmo remetente para o mesmo destino.
- O botão "Voltar versão".

## 4. O que o Jelde precisa saber ou decidir

1. **Não há economia em dinheiro**: o Vigia já era grátis. O ganho é parar de ocupar um robô 24 h e deixar o relatório de minutos limpo.
2. **Aviso mais lento**: uma queda passa a ser vista em até 15 min (hoje até 5 min).
3. **Banco do Manychato ganha um agendamento** (`pg_cron` + `pg_net`, extensões do Supabase) com o segredo do despertador guardado no cofre do Supabase. Se esse banco cair, o despertador para junto; a reserva do GitHub e o "bom dia" das 8 h cobrem esse caso, mais devagar.
4. A chave `GITHUB_DISPARO` da Vercel precisa alcançar o repositório `vigia-bepro` (conferir; se não alcançar, **o Jelde gera uma chave nova**).
5. Mexe em banco e em agendamento: passa pelo Codex em modo só leitura antes de dar por pronto.

## 5. Como conferir

- Uma rodada manual (`Run workflow`) termina em ~1 min e o `estado.json` é salvo.
- Teste de e-mail (`teste = true`) chega.
- Em 24 h: pelo menos 90 rodadas no Actions, nenhum buraco maior que 30 min, "bom dia" chegou às 8 h.
- Teste de queda simulada (`SIMULAR=1`) antes de publicar.

## 6. Como voltar

- `git revert` do commit do `vigia.yml` volta o ciclo de 5h40 (1 passo).
- `select cron.unschedule('vigia-bepro');` no Supabase desliga o despertador.

## 7. Situação

Aguardando ok do Jelde (16/11/2026).
