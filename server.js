// server.js
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
  // Opcional: Em vez de encerrar o processo, você pode continuar a execução e lidar com a ausência das variáveis conforme necessário.
  // process.exit(1);
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
  username: { type: String, unique: true }, // Garantir que o username seja único
  email: { type: String, unique: true }, // Garantir que o e-mail seja único
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
    const { username, email, password } = req.body;

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
      email,
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
    // Verifica se o usuário existe
    const user = await User.findOne({ username: req.body.username });
    if (!user) return res.status(400).send('Usuário ou senha incorretos');

    // Verifica a senha
    const validPass = await bcrypt.compare(req.body.password, user.password);
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

// Rota /forgot-password
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Verifica se o e-mail está cadastrado
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send('E-mail não encontrado.');
    }

    // Gera um token de redefinição de senha
    const token = crypto.randomBytes(20).toString('hex');

    // Define o token e a data de expiração (1 hora)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora

    await user.save();

    // Envia o e-mail com o link de redefinição de senha
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Redefinição de Senha',
      text: `Você está recebendo este e-mail porque uma solicitação de redefinição de senha foi feita para a sua conta.\n\n` +
            `Por favor, clique no link a seguir ou cole-o no seu navegador para concluir o processo:\n\n` +
            `${resetUrl}\n\n` +
            `Se você não solicitou esta alteração, por favor, ignore este e-mail.\n`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Erro ao enviar o e-mail de redefinição de senha:', err);
        return res.status(500).send('Erro ao enviar o e-mail.');
      }
      res.send('E-mail de redefinição de senha enviado com sucesso.');
    });
  } catch (err) {
    console.error('Erro na rota /forgot-password:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota /reset-password/:token
app.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Encontra o usuário com o token válido e não expirado
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send('Token inválido ou expirado.');
    }

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

    // Atualiza a senha do usuário
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Envia um e-mail de confirmação
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Sua senha foi redefinida',
      text: `Olá,\n\n` +
            `Esta é uma confirmação de que a senha da sua conta ${user.email} foi redefinida com sucesso.\n`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Erro ao enviar o e-mail de confirmação:', err);
        return res.status(500).send('Erro ao enviar o e-mail de confirmação.');
      }
      res.send('Senha redefinida com sucesso.');
    });
  } catch (err) {
    console.error('Erro na rota /reset-password:', err);
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
