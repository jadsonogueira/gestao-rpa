require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');

// Substituímos pdf2pic pelo pdf-poppler
const { convert } = require('pdf-poppler');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Se quiser receber JSON no corpo da requisição em todas as rotas:
app.use(express.json());

// Verifica variáveis de ambiente
if (!process.env.MONGODB_URL || !process.env.JWT_SECRET || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
  process.exit(1);
}

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB conectado'))
  .catch((err) => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1);
  });

// Definição de Schema e Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Rota de teste da DB
app.get('/test-db', (req, res) => {
  res.send('Conexão com o MongoDB funcionando.');
});

// Rota de cadastro (signup)
app.post('/signup', express.json(), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).send('Todos os campos são obrigatórios');
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).send('Usuário ou e-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).send('Usuário registrado com sucesso');
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota de login
app.post('/login', express.json(), async (req, res) => {
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
    if (!isMatch) {
      return res.status(400).send('Senha incorreta');
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Função para converter PDF em JPG usando pdf-poppler
async function convertPdfToJpg(pdfBuffer) {
  // Cria pasta temporária se não existir
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Cria um arquivo PDF temporário
  const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  // Opções para o pdf-poppler
  const options = {
    format: 'jpeg',
    out_dir: tempDir,
    out_prefix: `converted_${Date.now()}`,
    page: null, // null => converte todas as páginas
  };

  try {
    // convert() retorna um array de caminhos dos arquivos gerados
    const result = await convert(tempPdfPath, options);
    return result; // ex.: [ 'temp/converted_1234-1.jpg', 'temp/converted_1234-2.jpg', ... ]
  } catch (error) {
    console.error('Erro ao converter PDF:', error);
    return [];
  } finally {
    // Remove o PDF temporário (opcional)
    fs.unlinkSync(tempPdfPath);
  }
}

// Rota para enviar e-mail
app.post('/send-email', upload.any(), async (req, res) => {
  try {
    const fluxo = req.body.fluxo;
    const dados = req.body;

    if (!dados.email) {
      return res.status(400).send('O campo de e-mail é obrigatório.');
    }

    // Monta o conteúdo do e-mail
    let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;
    mailContent += `Requerente: ${dados.requerente || ''}\n`;
    mailContent += `Email: ${dados.email || ''}\n`;

    if (fluxo === 'Inserir imagem em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    }

    // Configura transportador (Nodemailer)
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
      attachments: [],
    };

    // Processa arquivos recebidos
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Se for PDF, converte para JPG
        if (file.mimetype === 'application/pdf') {
          console.log(`Convertendo PDF: ${file.originalname}`);
          const imagePaths = await convertPdfToJpg(file.buffer);

          if (imagePaths.length > 0) {
            imagePaths.forEach((imgPath) => {
              mailOptions.attachments.push({
                filename: path.basename(imgPath),
                path: imgPath,
              });
            });
          } else {
            return res.status(500).send('Erro ao converter o PDF para imagem.');
          }
        }
        // Se for imagem (campo "imagem"), anexa direto
        else if (file.fieldname.startsWith('imagem')) {
          mailOptions.attachments.push({
            filename: file.originalname,
            content: file.buffer,
          });
        }
        // Se for ZIP, extrai e processa
        else if (file.fieldname === 'arquivoZip') {
          try {
            const zip = new AdmZip(file.buffer);
            const zipEntries = zip.getEntries();

            if (zipEntries.length > 100) {
              return res.status(400).send('O total de arquivos excede o limite de 100.');
            }

            for (const entry of zipEntries) {
              if (entry.isDirectory) continue;
              const allowedExtensions = ['.jpg', '.jpeg', '.png'];
              if (!allowedExtensions.includes(path.extname(entry.entryName).toLowerCase())) {
                return res.status(400).send(`Tipo de arquivo não permitido no ZIP: ${entry.entryName}`);
              }
              mailOptions.attachments.push({
                filename: entry.entryName,
                content: entry.getData(),
              });
            }
          } catch (error) {
            console.error('Erro ao processar o arquivo ZIP:', error);
            return res.status(400).send('Erro ao processar o arquivo ZIP.');
          }
        }
      }
    }

    // Envia o e-mail
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Erro ao enviar o e-mail:', error);
        return res.status(500).send('Erro ao enviar o e-mail');
      }
      res.send('E-mail enviado com sucesso');
    });
  } catch (err) {
    console.error('Erro ao processar o envio de e-mail:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota principal (dashboard.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
