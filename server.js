require('dotenv').config();
const jwt = require('jsonwebtoken');
const { User } = require('./models/User'); // ajuste o path se necessário

const { exec } = require('child_process');
const { google } = require('googleapis');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const os = require('os');

// Middleware para extrair userId do token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido ou expirado' });
    req.userId = decoded.id;
    next();
  });
}

// Configuração Google Drive
const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth: driveAuth });

async function overwriteDriveFile(fileId, buffer, mimeType) {
  await drive.files.update({
    fileId,
    media: { mimeType, body: buffer }
  });
}

// Verificações de ferramentas externas
exec('convert -version', (error, stdout) => {
  if (error) {
    console.error(`ImageMagick não está instalado ou não está no PATH: ${error.message}`);
  } else {
    console.log(`ImageMagick:\n${stdout}`);
  }
});
exec('gs -version', (error, stdout) => {
  if (error) {
    console.error(`Ghostscript não está instalado ou não está no PATH: ${error.message}`);
  } else {
    console.log(`Ghostscript:\n${stdout}`);
  }
});

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// -----------------------------------------------------
// Helper para sanitizar nomes de arquivos
function sanitizeFilename(filename) {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]/g, '_');
}
// -----------------------------------------------------

// Verifica variáveis de ambiente obrigatórias
if (!process.env.MONGODB_URL ||
    !process.env.JWT_SECRET ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS) {
  console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
  process.exit(1);
}

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => {
  console.error('Erro ao conectar ao MongoDB:', err);
  process.exit(1);
});

// Reaproveita o model importado como "Usuario" para rotas /usuarios
const Usuario = User;

// Model para usuários externos
const usuarioExternoSchema = new mongoose.Schema({
  idExterno: { type: String, required: true, unique: true },
  nome:      { type: String, required: true },
  empresa:   { type: String, required: true }
});
const UsuarioExterno = mongoose.model('UsuarioExterno', usuarioExternoSchema);

// Model para contratos SEI
const contratoSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }
});
const Contrato = mongoose.model('Contrato', contratoSchema);

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ========== ROTAS ==========

// Listar usuários (sem senha)
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { password: 0 }).sort({ username: 1 });
    res.json(usuarios);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).send('Erro ao buscar usuários');
  }
});

// Inserir usuário externo
app.post('/usuarios-externos', async (req, res) => {
  try {
    const usuarios = req.body;
    if (!Array.isArray(usuarios)) {
      return res.status(400).send('Esperado um array de usuários externos.');
    }
    const inseridos = await UsuarioExterno.insertMany(usuarios, { ordered: false });
    res.status(201).send(`Inseridos ${inseridos.length} usuários externos`);
  } catch (err) {
    console.error('Erro ao inserir usuários externos:', err);
    if (err.code === 11000) return res.status(409).send('ID de usuário externo duplicado.');
    res.status(500).send('Erro no servidor');
  }
});

// Listar usuários externos
app.get('/usuarios-externos', async (req, res) => {
  try {
    const lista = await UsuarioExterno.find().sort({ nome: 1 });
    res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar usuários externos:', err);
    res.status(500).send('Erro ao buscar usuários externos');
  }
});

// Excluir usuário externo
app.delete('/usuarios-externos/:id', async (req, res) => {
  try {
    const resultado = await UsuarioExterno.findByIdAndDelete(req.params.id);
    if (!resultado) return res.status(404).json({ message: 'Usuário externo não encontrado' });
    res.json({ message: 'Usuário externo removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover usuário externo:', err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Cadastrar contrato
app.post('/contratos', async (req, res) => {
  try {
    const { numero } = req.body;
    if (!numero) return res.status(400).send('O número do contrato é obrigatório.');
    await new Contrato({ numero }).save();
    res.status(201).send('Contrato cadastrado com sucesso');
  } catch (err) {
    console.error('Erro ao cadastrar contrato:', err);
    if (err.code === 11000) return res.status(409).send('Contrato já existente.');
    res.status(500).send('Erro ao cadastrar contrato');
  }
});

// Listar contratos
app.get('/contratos', async (req, res) => {
  try {
    const contratos = await Contrato.find().sort({ numero: 1 });
    res.json(contratos);
  } catch (err) {
    console.error('Erro ao buscar contratos:', err);
    res.status(500).send('Erro ao buscar contratos');
  }
});

// Merge de PDFs
app.post('/merge-pdf', upload.array('pdfs'), async (req, res) => {
  try {
    const merger = new (require('pdf-merger-js'))();
    for (const file of req.files) {
      await merger.add(file.buffer);
    }
    const mergedPdf = await merger.saveAsBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(mergedPdf);
  } catch (err) {
    console.error('Erro ao unir PDFs:', err);
    res.status(500).send('Erro ao unir PDFs');
  }
});

// Envio de e-mail
app.post(
  '/send-email',
  authenticateToken,
  upload.any(),
  async (req, res) => {
    try {
      const fluxo = req.body.fluxo;
      const dbUser = await User.findById(req.userId);
      if (!dbUser) return res.status(404).send('Usuário não encontrado');

      const requesterName  = dbUser.username;
      const requesterEmail = dbUser.email;

      let mailContent = `Fluxo: ${fluxo}\n\n`;
      mailContent += `Usuário solicitante: ${requesterName}\n`;
      mailContent += `E-mail solicitante:   ${requesterEmail}\n\n`;

      const attachments = [];

      // Campos específicos de cada fluxo
      if (fluxo === 'Liberar assinatura externa') {
        mailContent += `Assinante: ${req.body.assinante || ''}\n`;
        mailContent += `Número do DOC_SEI: ${req.body.numeroDocSei || ''}\n`;

      } else if (fluxo === 'Consultar empenho') {
        mailContent += `Contrato SEI: ${req.body.contratoSei || ''}\n`;

      } else if (fluxo === 'Liberar acesso externo') {
        mailContent += `Usuário: ${req.body.user || ''}\n`;
        mailContent += `Número do Processo SEI: ${req.body.processo_sei || ''}\n`;

      } else if (fluxo === 'Analise de processo') {
        mailContent += `Número do Processo SEI: ${req.body.processo_sei || ''}\n`;

        const idMap = {
          memoriaCalculo:         process.env.MEMORIA_FILE_ID,
          diarioObra:             process.env.DIARIO_FILE_ID,
          relatorioFotografico:   process.env.RELATORIO_FILE_ID
        };
        for (const file of req.files) {
          const fileId = idMap[file.fieldname];
          if (!fileId) continue;
          if (file.mimetype !== 'application/pdf') {
            return res.status(400).send(`Tipo inválido: ${file.originalname}`);
          }
          await overwriteDriveFile(fileId, file.buffer, file.mimetype);
        }

      } else if (fluxo === 'Alterar ordem de documentos') {
        mailContent += `Número do Processo SEI: ${req.body.processoSei || ''}\n`;
        mailContent += `Instruções: ${req.body.instrucoes || ''}\n`;

      } else if (fluxo === 'Inserir anexo em doc SEI') {
        mailContent += `Número do DOC_SEI: ${req.body.numeroDocSei || ''}\n`;

      } else if (fluxo === 'Inserir imagem em doc SEI') {
        mailContent += `Número do DOC_SEI: ${req.body.numeroDocSei || ''}\n`;

      } else if (fluxo === 'Assinatura em doc SEI') {
        mailContent += `Número do DOC_SEI: ${req.body.numeroDocSei || ''}\n`;
        mailContent += `Usuário: ${req.body.user || ''}\n`;
        mailContent += `Senha: ${req.body.key || ''}\n`;

      } else if (fluxo === 'Criar Doc SEI Editável') {
        mailContent += `Número do Processo SEI: ${req.body.processoSei || ''}\n`;
        mailContent += `Tipo do Documento: ${req.body.tipoDocumento || ''}\n`;
        mailContent += `Número: ${req.body.numero || ''}\n`;
        mailContent += `Nome na Árvore: ${req.body.nomeArvore || ''}\n`;

      } else if (fluxo === 'Criar Doc SEI Externo') {
        const agora = new Date();
        agora.setHours(agora.getHours() - 3);
        const dia  = String(agora.getDate()).padStart(2, '0');
        const mes  = String(agora.getMonth() + 1).padStart(2, '0');
        const ano  = agora.getFullYear();
        mailContent += `Número do Processo SEI: ${req.body.processoSei || ''}\n`;
        mailContent += `Data: ${dia}/${mes}/${ano}\n`;
        mailContent += `Tipo do Documento: ${req.body.tipoDocumento || ''}\n`;
        mailContent += `Número: ${req.body.numero || ''}\n`;
        mailContent += `Nome na Árvore: ${req.body.nomeArvore || ''}\n`;
      }

      // Processamento geral de anexos
      if (req.files?.length) {
        for (const file of req.files) {
          const safeName = sanitizeFilename(file.originalname);

          if (file.fieldname.startsWith('imagem')) {
            if (!file.mimetype.startsWith('image/')) {
              return res.status(400).send(`Tipo não permitido: ${file.originalname}`);
            }
            if (file.size > 5 * 1024 * 1024) {
              return res.status(400).send(`Arquivo muito grande: ${file.originalname}`);
            }
            attachments.push({ filename: safeName, content: file.buffer });

          } else if (file.fieldname === 'arquivoZip') {
            try {
              const zip = new AdmZip(file.buffer);
              const entries = zip.getEntries();
              for (const entry of entries) {
                if (entry.isDirectory) continue;
                const ext = path.extname(entry.entryName).toLowerCase();
                if (!['.jpg','.jpeg','.png','.gif','.bmp'].includes(ext)) {
                  return res.status(400).send(`Tipo não permitido no ZIP: ${entry.entryName}`);
                }
                const data = entry.getData();
                if (data.length > 5 * 1024 * 1024) {
                  return res.status(400).send(`Arquivo ZIP muito grande: ${entry.entryName}`);
                }
                attachments.push({ filename: sanitizeFilename(entry.entryName), content: data });
              }
            } catch {
              return res.status(400).send('Erro ao processar ZIP');
            }

          } else if (file.fieldname === 'arquivoPdf') {
            try {
              const pdfImage = new (require('pdf-image').PDFImage)(file.buffer);
              const parsed = await pdfParse(file.buffer);
              for (let i = 0; i < parsed.numpages; i++) {
                const imgPath = await pdfImage.convertPage(i);
                const imgBuf = fs.readFileSync(imgPath);
                attachments.push({ filename: `${sanitizeFilename(path.basename(file.originalname, '.pdf'))}_page_${i+1}.jpg`, content: imgBuf });
                fs.unlinkSync(imgPath);
              }
            } catch (err) {
              return res.status(400).send('Erro ao converter PDF');
            }

          } else {
            // campo genérico "arquivo"
            attachments.push({ filename: safeName, content: file.buffer });
          }
        }
      }

      // Configura e envia e-mail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      const mailOptions = {
        from: `"${requesterName}" <${process.env.EMAIL_USER}>`,
        replyTo: requesterEmail,
        to: 'jadson.pena@dnit.gov.br',
        subject: fluxo,
        text: mailContent,
        attachments: attachments.length ? attachments : undefined
      };

      transporter.sendMail(mailOptions, (error) => {
        if (error) {
          console.error('Erro ao enviar o e-mail:', error);
          return res.status(500).send('Erro ao enviar o e-mail');
        }
        res.send('E-mail enviado com sucesso');
      });

    } catch (err) {
      console.error('Erro em /send-email:', err);
      res.status(500).send('Erro no servidor');
    }
  }
);

// Dashboard e rota de verificação de token
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.post('/verify-token', (req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      if (!token) return res.status(400).json({ valid: false, error: 'Token ausente' });
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ valid: false, error: 'Token inválido ou expirado' });
        res.json({ valid: true, userId: decoded.id, role: decoded.role });
      });
    } catch {
      res.status(500).json({ valid: false, error: 'Erro interno' });
    }
  });
});

// Conversão PDF → JPG
app.post('/pdf-to-jpg', upload.single('arquivoPdf'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Arquivo inválido ou ausente');
    }
    const PDFImage = require('pdf-image').PDFImage;
    const pdfImage = new PDFImage(req.file.buffer);
    const parsed = await pdfParse(req.file.buffer);
    if (parsed.numpages === 1) {
      const imgPath = await pdfImage.convertPage(0);
      const imgBuf = fs.readFileSync(imgPath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(path.basename(req.file.originalname, '.pdf'))}.jpg"`);
      res.send(imgBuf);
      fs.unlinkSync(imgPath);
    } else {
      const zip = new AdmZip();
      for (let i = 0; i < parsed.numpages; i++) {
        const imgPath = await pdfImage.convertPage(i);
        const imgBuf = fs.readFileSync(imgPath);
        zip.addFile(`pagina_${i+1}.jpg`, imgBuf);
        fs.unlinkSync(imgPath);
      }
      const zipBuf = zip.toBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=imagens.zip');
      res.send(zipBuf);
    }
  } catch (err) {
    console.error('Erro na conversão de PDF para JPG:', err);
    res.status(500).send('Erro ao converter PDF');
  }
});

// Inicia servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
