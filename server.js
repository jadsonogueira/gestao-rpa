const express = require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/send-email', upload.single('anexo'), (req, res) => {
  const { fluxo, requerente, email, assinante, numeroDocSei } = req.body;

  let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\nRequerente: ${requerente}\nEmail: ${email}\nAssinante: ${assinante}\nNúmero do DOC_SEI: ${numeroDocSei}`;

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
    subject: fluxo,
    text: mailContent,
    attachments: req.file ? [{ path: req.file.path }] : []
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send('Erro ao enviar o e-mail');
    }
    res.send('E-mail enviado com sucesso');
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
