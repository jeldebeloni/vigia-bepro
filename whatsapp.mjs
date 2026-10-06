// Envia um aviso pelo modelo de mensagem "aviso_vigia" (título + detalhe).
export async function enviarWhatsApp([titulo, detalhe], env = process.env) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_DESTINO } = env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !WHATSAPP_DESTINO) {
    throw new Error('faltam as chaves do WhatsApp no cofre do GitHub');
  }
  const modelo = env.WHATSAPP_MODELO || 'aviso_vigia';
  const limpar = (t) => t.replace(/\s+/g, ' ').trim().slice(0, 900); // a Meta recusa quebra de linha em variável
  const r = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSAO || 'v25.0'}/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: WHATSAPP_DESTINO,
        type: 'template',
        template: modelo === 'hello_world'
          ? { name: 'hello_world', language: { code: 'en_US' } } // modelo pronto da Meta, só para teste
          : {
          name: modelo,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: limpar(titulo) },
                { type: 'text', text: limpar(detalhe) },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!r.ok) throw new Error(`Meta respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
}
