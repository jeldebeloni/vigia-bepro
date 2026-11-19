import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarBackupMac, LIMITE_MS } from './backup-mac.mjs';

const agora = Date.parse('2026-11-20T12:00:00Z');
const ha = (h) => new Date(agora - h * 3_600_000).toISOString();

test('sem arquivo e nunca visto: espera 48 h, depois cobra o primeiro sinal', () => {
  const r1 = avaliarBackupMac(null, {}, agora);
  assert.equal(r1.mensagem, null);
  assert.equal(r1.estado.monitoradoDesde, agora);
  assert.equal(avaliarBackupMac(null, r1.estado, agora + 47 * 3_600_000).mensagem, null);
  const r2 = avaliarBackupMac(null, r1.estado, agora + 49 * 3_600_000);
  assert.match(r2.mensagem[1], /nunca recebeu/);
  assert.equal(avaliarBackupMac(null, r2.estado, agora + 50 * 3_600_000).mensagem, null);
});

test('leitura falhando: só avisa quando o último sinal guardado passou de 48 h', () => {
  const visto = { visto: true, ultimoSinal: ha(10), ultimoCompleto: ha(10), monitoradoDesde: agora - 9e8 };
  assert.equal(avaliarBackupMac(null, visto, agora, undefined, { leituraFalhou: true }).mensagem, null);
  const velho = { ...visto, ultimoSinal: ha(49), ultimoCompleto: ha(49) };
  assert.match(avaliarBackupMac(null, velho, agora, undefined, { leituraFalhou: true }).mensagem[1], /Não consegui confirmar/);
});

test('sinal recente e cofre completo: não avisa', () => {
  const r = avaliarBackupMac({ enviado_em: ha(2), cofre_completo_em: ha(3), cofre_estado: 'ok' }, {}, agora);
  assert.equal(r.mensagem, null);
  assert.equal(r.estado.visto, true);
});

test('Mac sem sinal há mais de 48 h: avisa, lembra só depois de 24 h e avisa a volta', () => {
  const r1 = avaliarBackupMac({ enviado_em: ha(50), cofre_completo_em: ha(50) }, {}, agora);
  assert.match(r1.mensagem[0], /PARADO/);
  assert.match(r1.mensagem[1], /não manda sinal do backup há 50 h/);
  assert.equal(avaliarBackupMac({ enviado_em: ha(51), cofre_completo_em: ha(51) }, r1.estado, agora + 3_600_000).mensagem, null);
  const r3 = avaliarBackupMac({ enviado_em: ha(50), cofre_completo_em: ha(50) }, r1.estado, agora + 25 * 3_600_000);
  assert.match(r3.mensagem[0], /AINDA PARADO/);
  const r4 = avaliarBackupMac({ enviado_em: ha(1), cofre_completo_em: ha(1) }, r3.estado, agora);
  assert.match(r4.mensagem[0], /VOLTOU/);
  assert.equal(r4.estado.avisadoEm, undefined);
});

test('Mac ligado mas cofre incompleto há mais de 48 h: avisa com o estado', () => {
  const r = avaliarBackupMac({ enviado_em: ha(1), cofre_completo_em: ha(60), cofre_estado: 'incomplete' }, {}, agora);
  assert.match(r.mensagem[1], /sem cópia completa há 60 h \(estado: incomplete\)/);
});

test('arquivo sumiu depois de visto: usa o último sinal guardado', () => {
  const visto = { visto: true, ultimoSinal: ha(49), ultimoCompleto: ha(49) };
  assert.match(avaliarBackupMac(null, visto, agora).mensagem[1], /não manda sinal/);
  assert.ok(LIMITE_MS > 0);
});
