// email/sendgrid.js
const sgMail = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
  console.warn('[EMAIL] SENDGRID_API_KEY ausente. Configure no Render.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Envia e-mail via SendGrid Web API.
 * @param {Object} p
 * @param {string|string[]} p.to - Destinatário(s)
 * @param {string} p.subject     - Assunto
 * @param {string} [p.html]      - Corpo HTML
 * @param {string} [p.text]      - Corpo texto simples
 * @param {Array<{filename:string, contentBase64:string, contentType?:string}>} [p.attachments]
 * @param {string} [p.replyTo]   - Opcional: endereço para resposta
 */
async function sendWithSendGrid(p) {
  const { to, subject, html, text, attachments = [], replyTo } = p;

  if (!process.env.FROM_EMAIL) {
    throw new Error('FROM_EMAIL não definido nas variáveis de ambiente.');
  }

  const msg = {
    to,
    from: process.env.FROM_EMAIL, // precisa ser Single Sender verificado OU domínio autenticado
    subject,
    text: text || (html ? html.replace(/<[^>]+>/g, ' ').slice(0, 4000) : undefined),
    html,
    replyTo,
    attachments: attachments.map(a => ({
      filename: a.filename,
      type: a.contentType || 'application/octet-stream',
      content: a.contentBase64, // já em Base64
      disposition: 'attachment'
    }))
  };

  try {
    const [resp] = await sgMail.send(msg);
    console.log('[SendGrid] status=%s x-message-id=%s',
      resp?.statusCode,
      resp?.headers?.['x-message-id'] || resp?.headers?.['x-message-id'.toLowerCase()]
    );
    return resp;
  } catch (err) {
    console.error('[SendGrid] ERROR:',
      err?.response?.statusCode || err?.code,
      JSON.stringify(err?.response?.body || err, null, 2)
    );
    throw err;
  }
}

module.exports = { sendWithSendGrid };
