// Botão de emergência: volta uma plataforma da Vercel para a versão anterior,
// ou desfaz a volta publicando de novo a versão mais nova.
// Rodado à mão pelo GitHub (Actions > Voltar versão), nunca sozinho.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { enviarWhatsApp } from './whatsapp.mjs';

const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_TIME = 'jelde-centralizador', PLATAFORMA, ACAO } = process.env;
if (!VERCEL_TOKEN) throw new Error('Falta a chave da Vercel (VERCEL_TOKEN) no cofre do GitHub.');

const sites = JSON.parse(await readFile(new URL('./sites.json', import.meta.url), 'utf8'));
const site = sites.find((s) => s.nome === PLATAFORMA && s.vercel);
if (!site) throw new Error(`Plataforma desconhecida ou fora da Vercel: ${PLATAFORMA}`);

const desfazer = ACAO?.startsWith('Desfazer');
const time = VERCEL_TEAM_ID ? `teamId=${VERCEL_TEAM_ID}` : '';

const projeto = await vercelApi(`/v9/projects/${site.vercel}?${time}`);
const atual = projeto.targets?.production?.id;
const { deployments } = await vercelApi(
  `/v6/deployments?app=${site.vercel}&target=production&state=READY&limit=20&${time}`,
);
const iAtual = deployments.findIndex((d) => d.uid === atual);

const alvo = desfazer ? deployments[0] : deployments[iAtual + 1];
if (iAtual < 0 || !alvo) throw new Error('Não achei uma versão para onde ir.');
if (alvo.uid === atual) {
  console.log('A versão mais nova já é a que está no ar. Nada a fazer.');
  process.exit(0);
}

const comando = desfazer ? 'promote' : 'rollback';
console.log(`${site.nome}: ${comando} de ${atual} para ${alvo.uid} (publicada em ${new Date(alvo.created).toISOString()})`);
if (process.env.SIMULAR === '1') process.exit(0);
const r = spawnSync(
  'npx',
  ['--yes', 'vercel@latest', comando, alvo.uid, '--token', VERCEL_TOKEN, '--scope', VERCEL_TIME, '--yes'],
  { stdio: 'inherit' },
);
if (r.status !== 0) throw new Error(`A Vercel recusou o ${comando}.`);

const quando = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(alvo.created);
await enviarWhatsApp(
  desfazer
    ? [`↪️ Volta desfeita: ${site.nome}`, `A versão mais nova (de ${quando}) está no ar de novo e as próximas publicações voltam a entrar sozinhas.`]
    : [`↩️ Versão voltada: ${site.nome}`, `Está no ar a versão de ${quando}. Enquanto a volta não for desfeita, publicações novas NÃO entram no ar sozinhas.`],
).catch((e) => console.error('Aviso no WhatsApp não saiu:', e.message));

async function vercelApi(caminho) {
  const r = await fetch(`https://api.vercel.com${caminho}`, {
    headers: { authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!r.ok) throw new Error(`Vercel respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
