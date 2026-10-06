// Manda o aviso por todos os canais configurados (Telegram e WhatsApp).
// Basta um canal entregar; só dá erro se todos falharem.
import { enviarWhatsApp } from './whatsapp.mjs';

export function canaisConfigurados(env = process.env) {
  const canais = [];
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT_ID) canais.push('Telegram');
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_DESTINO) canais.push('WhatsApp');
  return canais;
}

export async function enviarAviso(mensagem, env = process.env) {
  if (env.SIMULAR === '1') {
    console.log('[simulação]', mensagem.join(' — '));
    return;
  }
  const canais = canaisConfigurados(env);
  if (!canais.length) throw new Error('nenhum canal de aviso configurado no cofre do GitHub');
  const envios = { Telegram: enviarTelegram, WhatsApp: enviarWhatsApp };
  const resultados = await Promise.allSettled(canais.map((c) => envios[c](mensagem, env)));
  const falhas = resultados
    .map((r, i) => (r.status === 'rejected' ? `${canais[i]}: ${r.reason.message}` : null))
    .filter(Boolean);
  for (const f of falhas) console.warn('Canal falhou —', f);
  if (falhas.length === canais.length) throw new Error(falhas.join(' | '));
}

async function enviarTelegram([titulo, detalhe], env) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `${titulo}\n\n${detalhe}` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Telegram respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
