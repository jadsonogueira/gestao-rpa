require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Verificação de variáveis de ambiente essenciais
if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE || !process.env.JWT_SECRET || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
  process.exit(1);
}

// Conexão ao MySQL
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

// Conectar ao MySQL
connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    process.exit(1); // Fecha o servidor se a conexão falhar
  }
  console.log('MySQL conectado');
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para testar a conexão com o MySQL
app.get('/test-db', (req, res) => {
  connection.query('SELECT 1 + 1 AS solution', (err, results) => {
    if (err) {
      console.error('Erro ao consultar o MySQL:', err);
      return res.status(500).send('Erro ao consultar o MySQL.');
    }
    res.send('Conexão com o MySQL funcionando.');
  });
});

// Rota para Signup
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send('Todos os campos são obrigatórios');
    }

    // Verifica se o usuário ou email já existe
    const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
    connection.query(query, [username, email], async (err, results) => {
      if (err) {
        console.error('Erro ao consultar o banco de dados:', err);
        return res.status(500).send('Erro no servidor');
      }

      if (results.length > 0) {
        return res.status(400).send('Usuário ou e-mail já cadastrado');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Inserir o novo usuário no banco de dados
      const insertQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      connection.query(insertQuery, [username, email, hashedPassword], (err, result) => {
        if (err) {
          console.error('Erro ao inserir o usuário no MySQL:', err);
          return res.status(500).send('Erro no servidor');
        }

        res.status(201).send('Usuário registrado com sucesso');
      });
    });
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

    const query = 'SELECT * FROM users WHERE username = ?';
    connection.query(query, [username], async (err, results) => {
      if (err) {
        console.error('Erro ao consultar o banco de dados:', err);
        return res.status(500).send('Erro no servidor');
      }

      if (results.length === 0) {
        return res.status(400).send('Usuário não encontrado');
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).send('Senha incorreta');

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });
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
<<<<<<< HEAD

=======
// Adicionando o log para ver o envio do e-mail
>>>>>>> 17fa5260271fbeec22b50e77e5251593d16b39fa
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
