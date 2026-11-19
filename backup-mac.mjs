// Backup do Mac (19/11/2026): o Mac grava a hora do último cofre completo no ramo
// `batimento-mac` deste repositório a cada 12 h (só horários e estados, sem senha).
// Se passar de 48 h sem sinal ou sem cópia completa, o vigia avisa por e-mail.
export const URL_BATIMENTO = 'https://raw.githubusercontent.com/jeldebeloni/vigia-bepro/batimento-mac/backup-mac.json';
export const LIMITE_MS = 48 * 60 * 60 * 1000;
export const LEMBRETE_MS = 24 * 60 * 60 * 1000;

// dados: o JSON do Mac, ou null se o arquivo não existe (404) ou não deu para ler (leituraFalhou).
// Devolve a mensagem (ou null) e o estado novo.
export function avaliarBackupMac(dados, antes = {}, agora = Date.now(), duracao = (ms) => `${Math.round(ms / 3_600_000)} h`, { leituraFalhou = false } = {}) {
  const estado = { ...antes };
  estado.monitoradoDesde ??= agora;
  if (!dados) {
    if (!antes.visto) {
      // O primeiro sinal nunca chegou: cobra depois de 48 h de vigia, para não ficar mudo para sempre.
      if (agora - estado.monitoradoDesde <= LIMITE_MS) return { mensagem: null, estado };
      if (antes.avisadoEm && agora - antes.avisadoEm < LEMBRETE_MS) return { mensagem: null, estado };
      estado.avisadoEm = agora;
      return { mensagem: ['🔴 BACKUP DO MAC SEM SINAL', `O vigia ${leituraFalhou ? 'não consegue ler' : 'nunca recebeu'} o sinal do backup do Mac em ${duracao(agora - estado.monitoradoDesde)}. Peça ao Claude para verificar o backup do BRAIN.`], estado };
    }
    dados = { enviado_em: antes.ultimoSinal, cofre_completo_em: antes.ultimoCompleto, cofre_estado: antes.ultimoEstado };
  } else {
    estado.ultimoEstado = dados.cofre_estado;
  }
  const sinal = Date.parse(dados.enviado_em ?? '') || 0;
  const completo = Date.parse(dados.cofre_completo_em ?? '') || 0;
  estado.visto = true;
  if (sinal) estado.ultimoSinal = new Date(sinal).toISOString();
  if (completo) estado.ultimoCompleto = new Date(completo).toISOString();
  let problema = null;
  if (leituraFalhou && (!sinal || agora - sinal > LIMITE_MS)) {
    problema = `Não consegui confirmar o backup do Mac: o último sinal lido foi há ${sinal ? duracao(agora - sinal) : 'muito tempo'} e a leitura agora falhou. Pode ser só o GitHub; se repetir, peça ao Claude para verificar.`;
  } else if (!sinal || agora - sinal > LIMITE_MS) {
    problema = `O Mac não manda sinal do backup há ${sinal ? duracao(agora - sinal) : 'muito tempo'}. Pode estar desligado, sem internet ou com o backup parado. Ligue o Mac e peça ao Claude para verificar o backup do BRAIN.`;
  } else if (!completo || agora - completo > LIMITE_MS) {
    problema = `O Mac está ligado, mas o cofre do Drive está sem cópia completa há ${completo ? duracao(agora - completo) : 'muito tempo'} (estado: ${dados.cofre_estado ?? 'desconhecido'}). Peça ao Claude para verificar o backup do BRAIN.`;
  }
  if (problema) {
    if (antes.avisadoEm && agora - antes.avisadoEm < LEMBRETE_MS) return { mensagem: null, estado };
    estado.avisadoEm = agora;
    estado.desde ??= agora;
    return { mensagem: [antes.avisadoEm ? '🟠 BACKUP DO MAC AINDA PARADO' : '🔴 BACKUP DO MAC PARADO', problema], estado };
  }
  if (antes.avisadoEm) {
    delete estado.avisadoEm;
    delete estado.desde;
    return { mensagem: ['🟢 BACKUP DO MAC VOLTOU', 'O cofre do Drive voltou a ter cópia completa.'], estado };
  }
  return { mensagem: null, estado };
}
