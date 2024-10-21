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

// Definir o esquema do usuário
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para testar a conexão com o MongoDB
app.get('/test-db', (req, res) => {
  res.send('Conexão com o MongoDB funcionando.');
});

// Rota para Signup
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send('Todos os campos são obrigatórios');
    }

    // Verifica se o usuário ou email já existe
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).send('Usuário ou e-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar o novo usuário no banco de dados
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).send('Usuário registrado com sucesso');
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send('Todos os campos são obrigatórios');
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('Usuário não encontrado');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Senha incorreta');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota de exemplo para proteger rotas autenticadas
app.get('/protected', (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Acesso negado, token não fornecido');

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    res.send('Você tem acesso autorizado!');
  } catch (err) {
    res.status(400).send('Token inválido');
  }
});

// Rota para envio de e-mails
app.post('/send-email', (req, res) => {
  const { fluxo, dados } = req.body;

  if (!dados.email) {
    return res.status(400).send('O campo de e-mail é obrigatório.');
  }

  let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;
  mailContent += `requerente: ${dados.requerente || ''}\n`;
  mailContent += `email: ${dados.email || ''}\n`;

  if (fluxo === 'Liberar assinatura externa') {
    mailContent += `assinante: ${dados.assinante || ''}\n`;
    mailContent += `numeroDocSei: ${dados.numeroDocSei || ''}\n`;
  } else if (fluxo === 'Consultar empenho') {
    mailContent += `contratoSEI: ${dados.contratoSei || ''}\n`;
  } else if (fluxo === 'Liberar acesso externo') {
    mailContent += `user: ${dados.user || ''}\n`;
    mailContent += `processo_sei: ${dados.processo_sei || ''}\n`;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Fixando o destinatário do e-mail
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'jadson.pena@dnit.gov.br', // E-mail fixo
    subject: `${fluxo}`,
    text: mailContent,
  };
  console.log('Enviando e-mail para: jadson.pena@dnit.gov.br');
  
  transporter.sendMail(mailOptions, (error, info) => {
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
