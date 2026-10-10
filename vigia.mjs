// Vigia BePro: confere se cada plataforma está no ar e avisa no Telegram e no WhatsApp
// quando alguma cai ou volta. Roda no GitHub Actions a cada 5 minutos.
import { readFile, writeFile } from 'node:fs/promises';
import { enviarAviso, canaisConfigurados } from './avisos.mjs';

const SITES = JSON.parse(await readFile(new URL('./sites.json', import.meta.url), 'utf8'));
const ARQ_ESTADO = new URL('./estado.json', import.meta.url);

const FORNECEDORES = {
  vercel: { nome: 'Vercel', api: 'https://www.vercel-status.com/api/v2/summary.json' },
  supabase: { nome: 'Supabase', api: 'https://status.supabase.com/api/v2/summary.json' },
  nuvemshop: { nome: 'Nuvemshop', api: 'https://status.nuvemshop.com.br/api/v2/summary.json' },
};

const ESPERA_RECONFERIR_MS = 30_000; // confirma a queda antes de avisar
const LEMBRETE_MS = 3 * 60 * 60 * 1000; // relembra a cada 3 h se continuar fora
const HORA_BOM_DIA = 8; // mensagem diária "vigia ativo", horário de Brasília
const MAX_TENTATIVAS_ENVIO = 3;

const env = process.env;
const agora = Date.now();

// Rodada manual de teste: só manda uma mensagem e sai.
if (env.TESTE === '1') {
  await enviarAviso([
    '🧪 Teste',
    `Se você recebeu esta mensagem, os avisos de emergência estão funcionando. Enviado às ${hora(agora)}.`,
  ]);
  console.log('Mensagem de teste enviada.');
  process.exit(0);
}

const estado = await lerEstado();
estado.sites ??= {};
estado.pendentes ??= [];

// 1) Confere todos; quem falhar é conferido de novo 30 s depois.
let resultados = await Promise.all(SITES.map(async (s) => [s, await checar(s)]));
if (resultados.some(([, r]) => !r.ok)) {
  await new Promise((ok) => setTimeout(ok, ESPERA_RECONFERIR_MS));
  resultados = await Promise.all(
    resultados.map(async ([s, r]) => [s, r.ok ? r : await checar(s)]),
  );
}

// 2) Compara com a rodada anterior e monta os avisos.
const caiu = [];
const voltou = [];
const continuaFora = [];
for (const [site, r] of resultados) {
  const antes = estado.sites[site.id] ?? { ok: true };
  if (r.ok && !antes.ok) {
    voltou.push({ site, duracao: agora - antes.desde });
    estado.sites[site.id] = { ok: true };
  } else if (!r.ok && antes.ok) {
    caiu.push({ site, motivo: r.motivo });
    estado.sites[site.id] = { ok: false, desde: agora, motivo: r.motivo, avisadoEm: agora };
  } else if (!r.ok && agora - (antes.avisadoEm ?? 0) >= LEMBRETE_MS) {
    continuaFora.push({ site, desde: antes.desde, motivo: r.motivo });
    estado.sites[site.id] = { ...antes, motivo: r.motivo, avisadoEm: agora };
  }
}

const mensagens = [];

if (caiu.length) {
  const diagnosticos = await Promise.all(caiu.map((c) => diagnosticar(c.site)));
  const detalhes = caiu.map((c, i) => `${c.site.nome}: ${c.motivo}. ${diagnosticos[i]}`);
  mensagens.push([
    `🔴 FORA DO AR: ${caiu.map((c) => c.site.nome).join(', ')}`,
    `${detalhes.join(' | ')} Conferido 2 vezes às ${hora(agora)}.`,
  ]);
}

if (continuaFora.length) {
  mensagens.push([
    `🟠 AINDA FORA DO AR: ${continuaFora.map((c) => c.site.nome).join(', ')}`,
    continuaFora.map((c) => `${c.site.nome} está fora há ${duracao(agora - c.desde)} (${c.motivo}).`).join(' '),
  ]);
}

if (voltou.length) {
  mensagens.push([
    `🟢 VOLTOU: ${voltou.map((v) => v.site.nome).join(', ')}`,
    voltou.map((v) => `${v.site.nome} ficou fora por ${duracao(v.duracao)}.`).join(' ') +
      ` Voltou às ${hora(agora)}.`,
  ]);
}

// 3) Uma vez por dia, depois das 8 h: prova de que o vigia está vivo.
const hoje = dataBrasilia(agora);
if (horaBrasilia(agora) >= HORA_BOM_DIA && estado.bomDia !== hoje) {
  const fora = resultados.filter(([, r]) => !r.ok).map(([s]) => s.nome);
  const total = resultados.length;
  mensagens.push([
    '✅ Vigia ativo',
    fora.length
      ? `${total - fora.length} de ${total} plataformas no ar às ${hora(agora)}. Fora: ${fora.join(', ')}.`
      : `${total} de ${total} plataformas no ar às ${hora(agora)}. Se esta mensagem não chegar amanhã, o vigia parou.`,
  ]);
  estado.bomDia = hoje;
}

// 3b) Manychato: muita gente mandando a mesma palavra sem receber a automação (ou DMs falhando).
//     O Manychato decide o que avisar e não repete o mesmo alerta por 6 h.
if (env.MANYCHATO_ALERTS_SECRET) {
  try {
    const r = await fetch('https://manychato.jeldebeloni.com.br/api/scheduled/automation-alerts', {
      headers: { authorization: `Bearer ${env.MANYCHATO_ALERTS_SECRET}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`respondeu ${r.status}`);
    const { alerts = [] } = await r.json();
    for (const a of alerts) mensagens.push([a.titulo, a.detalhe]);
    console.log(`Alertas do Manychato: ${alerts.length}`);
  } catch (e) {
    // Manychato fora do ar já é avisado pela conferência dos sites; aqui só registra.
    console.warn('Alertas do Manychato não consultados:', e.message);
  }
}

// 3c) Manychato: reenvia as DMs que a Meta barrou por limite (fila de reenvio).
if (env.MANYCHATO_ALERTS_SECRET) {
  try {
    const r = await fetch('https://manychato.jeldebeloni.com.br/api/scheduled/retry-queue', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MANYCHATO_ALERTS_SECRET}` },
      signal: AbortSignal.timeout(50_000),
    });
    if (!r.ok) throw new Error(`respondeu ${r.status}`);
    const f = await r.json();
    console.log(`Fila de reenvio do Manychato: ${f.processed} itens, ${f.succeeded} enviados, ${f.requeued} para depois, ${f.failed} desistidos`);
  } catch (e) {
    console.warn('Fila de reenvio do Manychato não processada:', e.message);
  }
}

// 4) Envia (inclusive avisos que falharam antes) e guarda o estado.
const fila = [...estado.pendentes, ...mensagens.map((m) => ({ m, tentativas: 0 }))];
estado.pendentes = [];
let falhou = false;
const configurado = env.SIMULAR === '1' || canaisConfigurados(env).length > 0;
if (!configurado) {
  // Durante a montagem: sem canal de aviso, só a queda real vira e-mail do GitHub.
  for (const item of fila) console.warn('Nenhum canal de aviso configurado. Não enviado:', item.m.join(' — '));
  falhou = caiu.length > 0;
  fila.length = 0;
}
for (const item of fila) {
  try {
    await enviarAviso(item.m);
    console.log('Enviado:', item.m.join(' — '));
  } catch (e) {
    item.tentativas += 1;
    console.error(`Falha ao enviar (tentativa ${item.tentativas}):`, e.message, '—', item.m.join(' — '));
    if (item.tentativas < MAX_TENTATIVAS_ENVIO) estado.pendentes.push(item);
    falhou = true;
  }
}

for (const [site, r] of resultados) console.log(`${r.ok ? 'OK  ' : 'FORA'} ${site.nome}${r.ok ? '' : ` — ${r.motivo}`}`);

await writeFile(ARQ_ESTADO, JSON.stringify(estado, null, 2) + '\n');

// Falhar a rodada faz o GitHub mandar e-mail: é o aviso reserva se nenhum canal entregar.
if (falhou) process.exitCode = 1;

// ---------------------------------------------------------------------------

async function checar(site) {
  const limite = (site.timeoutSeg ?? 20) * 1000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limite);
  try {
    const r = await fetch(site.url, {
      method: site.metodo ?? 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': 'vigia-bepro/1.0 (+monitoramento)',
        'cache-control': 'no-cache',
        // sem compressão o servidor informa o tamanho real do arquivo
        ...(site.tamanhoMinimo && { 'accept-encoding': 'identity' }),
      },
    });
    const aceitos = site.status ?? [200];
    if (!aceitos.includes(r.status)) {
      await r.body?.cancel();
      return { ok: false, motivo: `respondeu com erro ${r.status}` };
    }
    if (site.tamanhoMinimo && Number(r.headers.get('content-length') ?? 0) < site.tamanhoMinimo) {
      return { ok: false, motivo: 'arquivo veio menor que o normal' };
    }
    if (site.contem) {
      const texto = await r.text();
      if (!texto.includes(site.contem)) return { ok: false, motivo: 'abriu, mas com conteúdo diferente do esperado' };
    } else {
      await r.body?.cancel();
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      motivo: ctrl.signal.aborted ? `não respondeu em ${limite / 1000} s` : 'não foi possível conectar',
    };
  } finally {
    clearTimeout(timer);
  }
}

// Diz de quem é provavelmente a culpa: do fornecedor ou nossa.
async function diagnosticar(site) {
  const partes = [];
  const f = FORNECEDORES[site.fornecedor];
  if (f) {
    try {
      const s = await (await fetch(f.api, { signal: AbortSignal.timeout(10_000) })).json();
      const incidentes = (s.incidents ?? []).filter((i) => i.status !== 'resolved').map((i) => i.name);
      if (s.status?.indicator && s.status.indicator !== 'none') {
        partes.push(
          `A ${f.nome} informa falha (${s.status.description}${incidentes.length ? `: ${incidentes.join('; ')}` : ''}). Provável culpa do fornecedor, voltar versão não resolve.`,
        );
      } else {
        partes.push(`A ${f.nome} diz que está tudo normal, então o problema deve ser nosso.`);
      }
    } catch {
      partes.push(`Não consegui ler o status da ${f.nome}.`);
    }
  }
  if (site.vercel && env.VERCEL_TOKEN) {
    try {
      const qs = new URLSearchParams({ app: site.vercel, target: 'production', limit: '1' });
      if (env.VERCEL_TEAM_ID) qs.set('teamId', env.VERCEL_TEAM_ID);
      const r = await fetch(`https://api.vercel.com/v6/deployments?${qs}`, {
        headers: { authorization: `Bearer ${env.VERCEL_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      });
      const ultima = (await r.json()).deployments?.[0];
      if (ultima) {
        const ha = agora - ultima.created;
        partes.push(
          ha < 6 * 60 * 60 * 1000
            ? `Última publicação foi há ${duracao(ha)}: pode ser ela. Para voltar a versão anterior, rode "Voltar versão" no GitHub.`
            : `Última publicação foi há ${duracao(ha)}, então não parece ser versão nova.`,
        );
      }
    } catch {
      // sem a data da publicação, segue só com o status do fornecedor
    }
  }
  return partes.join(' ');
}

async function lerEstado() {
  try {
    return JSON.parse(await readFile(ARQ_ESTADO, 'utf8'));
  } catch {
    return {};
  }
}

function hora(ms) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(ms);
}

function horaBrasilia(ms) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(ms));
}

function dataBrasilia(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(ms);
}

function duracao(ms) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h < 48) return resto ? `${h} h ${resto} min` : `${h} h`;
  return `${Math.round(h / 24)} dias`;
}
