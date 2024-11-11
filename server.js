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

// Conexão ao MongoDB
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log('MongoDB conectado'))
  .catch((error) => console.error('Erro ao conectar ao MongoDB:', error));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Modelo de Usuário
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

// Rota para Signup
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).send('Usuário já existe');

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).send('E-mail já cadastrado');

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.send('Usuário registrado com sucesso');
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('Usuário não encontrado');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Senha incorreta');

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para envio de e-mails com upload de anexo
app.post('/send-email', upload.single('anexo'), (req, res) => {
  const { fluxo } = req.body;
  const dados = JSON.parse(req.body.dados); // Parse the JSON string into an object

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
    mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
    mailContent += `Instruções: ${dados.instrucoes || ''}\n`;
  } else if (fluxo === 'Inserir anexo em doc SEI') {
    mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
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
    attachments: req.file
      ? [{
          filename: req.file.originalname,
          path: req.file.path
        }]
      : []
  };

  transporter.sendMail(mailOptions, (error, info) => {
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

// Servir a página inicial (index.html) ao acessar a rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
