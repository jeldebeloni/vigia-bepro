// Manda o aviso por e-mail (Gmail com senha de app) para jelde@timebeloni.com.
// Decisão do Jelde (20/10/2026): só e-mail; WhatsApp e Telegram desligados.
import { spawnSync } from 'node:child_process';

const DESTINO = 'jelde@timebeloni.com';

export function canaisConfigurados(env = process.env) {
  return env.GMAIL_USUARIO && env.GMAIL_SENHA_APP ? ['E-mail'] : [];
}

export async function enviarAviso(mensagem, env = process.env) {
  if (env.SIMULAR === '1') {
    console.log('[simulação]', mensagem.join(' — '));
    return;
  }
  if (!canaisConfigurados(env).length) throw new Error('GMAIL_USUARIO e GMAIL_SENHA_APP faltam no cofre do GitHub');
  enviarEmail(mensagem, env);
}

// O runner do GitHub já tem Python; o smtplib evita instalar pacote no Node.
function enviarEmail([titulo, detalhe], env) {
  const script = `
import os, smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
msg = MIMEText(os.environ['CORPO'], 'plain', 'utf-8')
msg['Subject'] = os.environ['ASSUNTO']
msg['From'] = formataddr(('Vigia BePro', os.environ['GMAIL_USUARIO']))
msg['To'] = os.environ['DESTINO']
with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=30) as s:
    s.login(os.environ['GMAIL_USUARIO'], os.environ['GMAIL_SENHA_APP'])
    s.sendmail(os.environ['GMAIL_USUARIO'], [os.environ['DESTINO']], msg.as_string())
`;
  const r = spawnSync('python3', ['-c', script], {
    env: { ...env, DESTINO, ASSUNTO: `Vigia BePro: ${titulo}`, CORPO: `${titulo}\n\n${detalhe}\n\nMensagem automática do vigia das plataformas.` },
    encoding: 'utf8',
    timeout: 45_000,
  });
  if (r.status !== 0) throw new Error(`E-mail não saiu: ${(r.stderr || r.error?.message || '').trim().split('\n').pop()}`);
}
