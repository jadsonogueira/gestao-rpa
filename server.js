<<<<<<< HEAD
=======

>>>>>>> ee581fbf74c8bea569a1fd4491f0f19690cc443c
require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto'); // Importação do módulo crypto

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
<<<<<<< HEAD
  process.exit(1);
=======
>>>>>>> ee581fbf74c8bea569a1fd4491f0f19690cc443c
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
<<<<<<< HEAD
  username: { type: String, unique: true },
=======
  username: { type: String, unique: true }, // Garantir que o username seja único
  email: { type: String, unique: true }, // Garantir que o e-mail seja único
>>>>>>> ee581fbf74c8bea569a1fd4491f0f19690cc443c
  password: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
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

// Cadastro (Signup)
app.post('/signup', async (req, res) => {
  try {
<<<<<<< HEAD
    const { username, password } = req.body;
=======
    const { username, email, password } = req.body;
>>>>>>> ee581fbf74c8bea569a1fd4491f0f19690cc443c

    // Verifica se o usuário já existe
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).send('Usuário já existe');

    // Verifica se o e-mail já está cadastrado
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).send('E-mail já cadastrado');

    // Validação de Complexidade da Senha
    const passwordErrors = [];
    if (password.length < 8) {
      passwordErrors.push('A senha deve ter pelo menos 8 caracteres.');
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push('A senha deve conter pelo menos uma letra maiúscula.');
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push('A senha deve conter pelo menos uma letra minúscula.');
    }
    if (!/[0-9]/.test(password)) {
      passwordErrors.push('A senha deve conter pelo menos um número.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      passwordErrors.push('A senha deve conter pelo menos um caractere especial (e.g., !@#$%^&*).');
    }

    if (passwordErrors.length > 0) {
      return res.status(400).send(passwordErrors.join(' '));
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Cria novo usuário
    const user = new User({
      username,
<<<<<<< HEAD
=======
      email,
>>>>>>> ee581fbf74c8bea569a1fd4491f0f19690cc443c
      password: hashedPassword,
    });

    await user.save();
    res.send('Usuário registrado com sucesso');
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Login
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
