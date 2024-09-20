// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');

// Configurações
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Conexão ao banco de dados MongoDB
mongoose.connect('mongodb://localhost/gestao-rpa', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Esquemas do Mongoose
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model('User', UserSchema);

// Middleware de autenticação
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Acesso Negado');
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secreto');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Token Inválido');
  }
};

// Rotas
app.post('/signup', async (req, res) => {
  // Verifica se o usuário já existe
  const userExists = await User.findOne({ username: req.body.username });
  if (userExists) return res.status(400).send('Usuário já existe');

  // Hash da senha
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  // Cria novo usuário
  const user = new User({
    username: req.body.username,
    password: hashedPassword,
  });

  try {
    await user.save();
    res.send('Usuário registrado com sucesso');
  } catch (err) {
    res.status(400).send(err);
  }
});

app.post('/login', async (req, res) => {
  // Verifica se o usuário existe
  const user = await User.findOne({ username: req.body.username });
  if (!user) return res.status(400).send('Usuário ou senha incorretos');

  // Verifica a senha
  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) return res.status(400).send('Usuário ou senha incorretos');

  // Cria e atribui um token
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secreto');
  res.header('authorization', token).send({ token });
});

// Rota /send-email
app.post('/send-email', verifyToken, async (req, res) => {
  const { fluxo, dados } = req.body;

  // Formata os dados do formulário para o corpo do email
  let conteudoEmail = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;

  for (const [key, value] of Object.entries(dados)) {
    conteudoEmail += `${key}: ${value}\n`;
  }

  // Configuração do transporte de email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Configuração do email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'jadson.pena@dnit.gov.br', // Altere para o email que aciona o fluxo RPA
    subject: `Acionar Fluxo: ${fluxo}`,
    text: conteudoEmail,
  };

  // Envia o email
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log('Erro ao enviar o email:', error);
      res.status(500).send('Erro ao enviar o email');
    } else {
      console.log('Email enviado: ' + info.response);
      res.send('Email enviado com sucesso');
    }
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
