require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');

// Captura de erros globais
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição de promessa não tratada:', promise, 'Razão:', reason);
});

// Verificação das variáveis de ambiente necessárias
const requiredEnvVars = ['MONGODB_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
let missingVars = [];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
});

if (missingVars.length > 0) {
  console.error(`Erro: As seguintes variáveis de ambiente não estão definidas: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Configurações
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Conexão ao banco de dados MongoDB
mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Conectado ao MongoDB');
  })
  .catch((error) => {
    console.error('Erro ao conectar ao MongoDB:', error);
  });

// Esquemas do Mongoose
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});

const User = mongoose.model('User', UserSchema);

// Middleware de autenticação
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Acesso Negado');
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Token Inválido');
  }
};

// Configuração do transporte de email - movido para fora das rotas
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true, // Habilita o uso de pool de conexões
  maxConnections: 5, // Número máximo de conexões simultâneas
  maxMessages: 100, // Número máximo de mensagens por conexão
});

// Rotas
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Verifica se o usuário já existe
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).send('Usuário já existe');

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Cria novo usuário
    const user = new User({
      username,
      password: hashedPassword,
    });

    await user.save();
    res.send('Usuário registrado com sucesso');
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).send('Erro no servidor');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Verifica se o usuário existe
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('Usuário ou senha incorretos');

    // Verifica a senha
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).send('Usuário ou senha incorretos');

    // Cria e atribui um token
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    res.header('authorization', token).send({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota /send-email
app.post('/send-email', verifyToken, async (req, res) => {
  try {
    const { fluxo, dados } = req.body;

    // Formata os dados do formulário para o corpo do email
    let conteudoEmail = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;

    for (const [key, value] of Object.entries(dados)) {
      conteudoEmail += `${key}: ${value}\n`;
    }

    // Configuração do email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'jadson.pena@dnit.gov.br', // Altere para o email que aciona o fluxo RPA
      subject: fluxo, // Ajuste o assunto conforme necessário
      text: conteudoEmail,
    };

    // Envia a resposta ao cliente imediatamente
    res.send('Sua solicitação foi recebida e está sendo processada');

    // Envia o email de forma assíncrona
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Erro ao enviar o email:', error);
      } else {
        console.log('Email enviado: ' + info.response);
      }
    });
  } catch (err) {
    console.error('Erro na rota /send-email:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota GET para '/'
app.get('/', (req, res) => {
  res.send('Aplicativo funcionando!');
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
