require('dotenv').config();
const { exec } = require('child_process');

// Verifica se o ImageMagick está instalado
exec('convert -version', (error, stdout, stderr) => {
  if (error) {
    console.error(`ImageMagick não está instalado ou não está no PATH: ${error.message}`);
  } else {
    console.log(`ImageMagick:\n${stdout}`);
  }
});

// Verifica se o Ghostscript está instalado
exec('gs -version', (error, stdout, stderr) => {
  if (error) {
    console.error(`Ghostscript não está instalado ou não está no PATH: ${error.message}`);
  } else {
    console.log(`Ghostscript:\n${stdout}`);
  }
});

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const pdfParse = require("pdf-parse");

// Importa a classe PDFImage do pdf-image
const PDFImage = require("pdf-image").PDFImage;

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

if (
 !process.env.MONGODB_URL ||
 !process.env.JWT_SECRET ||
 !process.env.EMAIL_USER ||
 !process.env.EMAIL_PASS
) {
console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
process.exit(1);
}

mongoose
 .connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
 })
  .then(() => console.log('MongoDB conectado'))
  .catch((err) => {
  console.error('Erro ao conectar ao MongoDB:', err);
process.exit(1);
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test-db', (req, res) => {
  res.send('Conexão com o MongoDB funcionando.');
});

app.post('/signup', express.json(), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).send('Todos os campos são obrigatórios');
    }
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
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
    if (!isMatch) return res.status(400).send('Senha incorreta');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.send({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/send-email', upload.any(), async (req, res) => {
  try {
    const fluxo = req.body.fluxo;
    const dados = req.body;
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
    } else if (fluxo === 'Analise de processo') {
      mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;
    } else if (fluxo === 'Alterar ordem de documentos') {
      mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
      mailContent += `Instruções: ${dados.instrucoes || ''}\n`;
    } else if (fluxo === 'Inserir anexo em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    } else if (fluxo === 'Inserir imagem em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    } else if (fluxo === 'Assinatura em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    } else if (fluxo === 'Criar Doc SEI Editável') {
      mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
      mailContent += `Tipo do Documento: ${dados.tipoDocumento || ''}\n`;
      mailContent += `Número: ${dados.numero || ''}\n`;
      mailContent += `Nome na Árvore: ${dados.nomeArvore || ''}\n`;
    } else if (fluxo === 'Criar Doc SEI Externo') {
      const agora = new Date();
      agora.setHours(agora.getHours() - 3);
      const dia = String(agora.getDate()).padStart(2, '0');
      const mes = String(agora.getMonth() + 1).padStart(2, '0');
      const ano = agora.getFullYear();
      const dataFormatada = `${dia}/${mes}/${ano}`;
      mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
      mailContent += `Data: ${dataFormatada}\n`;
      mailContent += `Tipo do Documento: ${dados.tipoDocumento || ''}\n`;
      mailContent += `Número: ${dados.numero || ''}\n`;
      mailContent += `Nome na Árvore: ${dados.nomeArvore || ''}\n`;
    }
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'jadson.pena@dnit.gov.br',
      subject: `${fluxo}`,
      text: mailContent,
    };
    
    const attachments = [];
    
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname.startsWith('imagem')) {
          if (!file.mimetype.startsWith('image/')) {
            return res.status(400).send(`Tipo de arquivo não permitido: ${file.originalname}`);
          }
          if (file.size > 5 * 1024 * 1024) {
            return res.status(400).send(`Arquivo muito grande: ${file.originalname}`);
          }
          attachments.push({ filename: file.originalname, content: file.buffer });
        } else if (file.fieldname === 'arquivoZip') {
          try {
            const zip = new AdmZip(file.buffer);
            const zipEntries = zip.getEntries();
            if (attachments.length + zipEntries.length > 100) {
              return res.status(400).send('O total de arquivos excede o limite de 100.');
            }
            for (const entry of zipEntries) {
              if (entry.isDirectory) continue;
              const extension = path.extname(entry.entryName).toLowerCase();
              const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
              if (!allowedExtensions.includes(extension)) {
                return res.status(400).send(`Tipo de arquivo não permitido no ZIP: ${entry.entryName}`);
              }
              const fileContent = entry.getData();
              if (fileContent.length > 5 * 1024 * 1024) {
                return res.status(400).send(`Arquivo muito grande no ZIP: ${entry.entryName}`);
              }
              attachments.push({ filename: entry.entryName, content: fileContent });
            }
          } catch (error) {
            console.error('Erro ao processar o arquivo ZIP:', error);
            return res.status(400).send('Erro ao processar o arquivo ZIP.');
          }
        } else if (file.fieldname === 'arquivo') {
          attachments.push({ filename: file.originalname, content: file.buffer });
        } else if (file.fieldname === 'arquivoPdf') {
          try {
            const fs = require("fs");
            const os = require("os");
            // Grava o buffer em um arquivo temporário
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, `temp_${Date.now()}.pdf`);
            fs.writeFileSync(tempFilePath, file.buffer);
            
            // Configura as opções para pdf-image (ImageMagick e Ghostscript devem estar instalados)
            const pdfImageOptions = {
              convertOptions: {
                "-density": "72",
                "-background": "white",
                "-alpha": "remove",
                "-resize": "800",
                "-quality": "80"
              }
            };
            const pdfImage = new PDFImage(tempFilePath, pdfImageOptions);
            
            // Contar páginas usando pdf-parse
            const parsedData = await pdfParse(file.buffer);
            const numPages = parsedData.numpages;
            console.log(`PDF possui ${numPages} páginas.`);
            
            // Converter cada página (as páginas são indexadas a partir de 0)
            let promises = [];
            for (let i = 0; i < numPages; i++) {
              promises.push(pdfImage.convertPage(i));
            }
            const imagePaths = await Promise.all(promises);
            console.log(`Conversão concluída para ${imagePaths.length} páginas.`);
            
            // Ler cada imagem convertida e anexar
            for (let i = 0; i < imagePaths.length; i++) {
              const imageBuffer = fs.readFileSync(imagePaths[i]);
              attachments.push({
                filename: `${file.originalname.replace(/\.pdf$/i, '')}_page_${i + 1}.jpg`,
                content: imageBuffer
              });
              // Remove a imagem temporária
              fs.unlinkSync(imagePaths[i]);
            }
            // Remove o arquivo temporário do PDF
            fs.unlinkSync(tempFilePath);
          } catch (error) {
            console.error("Erro na conversão de PDF para JPG usando pdf-image:", error.message);
            return res.status(400).send("Erro na conversão do PDF para JPG: " + error.message);
          }
        }
      }
    }
    
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
