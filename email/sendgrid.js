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
 * @param {string|string[]} p.to
 * @param {string} p.subject
 * @param {string} [p.html]
 * @param {string} [p.text]
 * @param {Array<{filename:string, contentBase64:string, contentType?:string}>} [p.attachments]
 */
async function sendWithSendGrid(p) {
  const { to, subject, html, text, attachments = [] } = p;

  if (!process.env.FROM_EMAIL) {
    throw new Error('FROM_EMAIL não definido nas variáveis de ambiente.');
  }

  const msg = {
    to,
    from: process.env.FROM_EMAIL, // deve ser o mesmo e-mail verificado no Single Sender
    subject,
    text: text || (html ? html.replace(/<[^>]+>/g, ' ').slice(0, 4000) : undefined),
    html,
    attachments: attachments.map(a => ({
      filename: a.filename,
      type: a.contentType || 'application/octet-stream',
      content: a.contentBase64, // já em Base64
      disposition: 'attachment'
    }))
  };

  await sgMail.send(msg);
}

module.exports = { sendWithSendGrid };
