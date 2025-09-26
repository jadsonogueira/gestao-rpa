// oauth_generate_token.js
// 1) npm i googleapis open
import { google } from 'googleapis';
import open from 'open';
import readline from 'node:readline';

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  // use o padrão do OAuth Playground para simplificar:
  GMAIL_REDIRECT_URI = 'https://developers.google.com/oauthplayground',
} = process.env;

// === AJUSTE AQUI: escopos que permitem enviar e-mail ===
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error('Defina GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET nas variáveis de ambiente.');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );

  // 2) Gera a URL de consentimento
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // importante para receber refresh_token
    prompt: 'consent',      // força a emissão do refresh_token
    scope: SCOPES,
  });

  console.log('\nAbra a URL abaixo para autorizar sua conta Gmail:');
  console.log(authUrl, '\n');

  // tenta abrir no navegador automaticamente
  try { await open(authUrl); } catch {}

  // 3) Cole aqui o "code" que o Google vai te dar
  const code = await prompt('Cole aqui o "code" da URL de callback: ');

  // 4) Troca o code por tokens (access + refresh)
  const { tokens } = await oAuth2Client.getToken(code.trim());
  console.log('\n=== TOKENS RECEBIDOS ===');
  console.log(JSON.stringify(tokens, null, 2));

  if (!tokens.refresh_token) {
    console.warn('\nNão veio refresh_token. Tente novamente usando prompt: "consent" e access_type: "offline".');
  } else {
    console.log('\nCopie o valor de refresh_token e salve no Render como GMAIL_REFRESH_TOKEN.');
  }
}

main().catch(err => {
  console.error('Falha ao obter tokens:', err);
  process.exit(1);
});
