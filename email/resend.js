// email/resend.js
const axios = require('axios');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendWithResend({ to, subject, text, html, attachments = [] }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY não definido nas variáveis de ambiente.');
  }

  const files = attachments.map(a => ({
    filename: a.filename,
    content: Buffer.isBuffer(a.content)
      ? a.content.toString('base64')
      : Buffer.from(String(a.content || ''), 'utf8').toString('base64'),
    contentType:
      a.contentType ||
      (a.filename && /\.pdf$/i.test(a.filename)  ? 'application/pdf' :
       a.filename && /\.png$/i.test(a.filename)  ? 'image/png' :
       a.filename && /\.jpe?g$/i.test(a.filename) ? 'image/jpeg' :
       'application/octet-stream'),
  }));

  const payload = {
    from: process.env.FROM_EMAIL,
    to,
    subject,
    text,
    html,
    attachments: files,
  };

  const response = await axios.post(
    'https://api.resend.com/emails',
    payload,
    {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data;
}

module.exports = { sendWithResend };
