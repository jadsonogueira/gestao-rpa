require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão ao MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => {
  console.error('Erro ao conectar ao MongoDB:', err);
  process.exit(1);
});

// Rota para envio de e-mails
app.post('/send-email', (req, res) => {
  const { fluxo, dados } = req.body;

  if (!dados.email) {
    return res.status(400).send('O campo de e-mail é obrigatório.');
  }

  let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;
  mailContent += `Requerente: ${dados.requerente || ''}\n`;
  mailContent += `Email: ${dados.email || ''}\n`;

  if (fluxo === 'Liberar assinatura externa') {
    mailContent += `Assinante: ${dados.assinante || ''}\n`;
    mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
  } else if (fluxo === 'Consultar empenho') {
    mailContent += `Contrato SEI: ${dados.contratoSei || ''}\n`;
  } else if (fluxo === 'Liberar acesso externo') {
    mailContent += `Usuário: ${dados.user || ''}\n`;
    mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;
  } else if (fluxo === 'Alterar ordem de documentos') {
    mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;
    mailContent += `Instruções: ${dados.instrucoes || ''}\n`;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'jadson.pena@dnit.gov.br',
    subject: `${fluxo}`,
    text: mailContent,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error('Erro ao enviar o e-mail:', error);
      return res.status(500).send('Erro ao enviar o e-mail');
    }
    res.send('E-mail enviado com sucesso');
  });
});

// Servir arquivos estáticos e iniciar servidor
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
