require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Verificação de variáveis de ambiente essenciais
if (!process.env.MONGODB_URL || !process.env.JWT_SECRET || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
  process.exit(1);
}

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

// Rota para envio de e-mails com upload de anexo
app.post('/send-email', upload.single('anexo'), (req, res) => {
  const { fluxo, dados } = req.body;

  if (!dados.email) {
    return res.status(400).send('O campo de e-mail é obrigatório.');
  }

  let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;
  mailContent += `Requerente: ${dados.requerente || ''}\n`;
  mailContent += `Email: ${dados.email || ''}\n`;
  mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;

  // Verifique se o arquivo foi recebido corretamente
  console.log("Arquivo de anexo:", req.file);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'jadson.pena@dnit.gov.br', // ou dados.email, conforme necessário
    subject: `${fluxo}`,
    text: mailContent,
    attachments: req.file ? [{
      filename: req.file.originalname,
      path: req.file.path
    }] : []
  };

  transporter.sendMail(mailOptions, (error, info) => {
    // Remover o arquivo do servidor após o envio do e-mail
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Erro ao deletar o arquivo:', err);
      });
    }

    if (error) {
      console.error('Erro ao enviar o e-mail:', error);
      return res.status(500).send('Erro ao enviar o e-mail');
    }

    res.send('E-mail enviado com sucesso');
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
