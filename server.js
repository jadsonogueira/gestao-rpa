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
const fs = require("fs");
const os = require("os");

// Importa a classe PDFImage do pdf-image
const PDFImage = require("pdf-image").PDFImage;

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------
// Função para remover acentos e caracteres especiais do nome do arquivo
function sanitizeFilename(filename) {
  return filename
    // Separa acentos
    .normalize("NFD")
    // Remove acentos (faixa U+0300 a U+036f)
    .replace(/[\u0300-\u036f]/g, "")
    // Substitui qualquer caractere fora de [a-zA-Z0-9._-] por underscore
    .replace(/[^\w.\-]/g, "_");
}
// -----------------------------------------------------

// Verifica variáveis de ambiente obrigatórias
if (
  !process.env.MONGODB_URL ||
  !process.env.JWT_SECRET ||
  !process.env.EMAIL_USER ||
  !process.env.EMAIL_PASS
) {
  console.error('Erro: Variáveis de ambiente não configuradas corretamente.');
  process.exit(1);
}

// Conexão com MongoDB
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

// Schema e Model de usuário
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
  type: String,
  enum: ['classe_a', 'classe_b', 'classe_c', 'classe_d', 'classe_e', 'admin'],
  default: 'classe_a'}
});
const User = mongoose.model('User', userSchema);

// Modelo de dados para usuários (já existe, vamos reaproveitar)
const Usuario = User; // para manter coerência com /usuarios

// Schema e model para usuários externos autorizados
const usuarioExternoSchema = new mongoose.Schema({
  idExterno: { type: String, required: true, unique: true },
  nome:      { type: String, required: true },
  empresa:   { type: String, required: true },
});
const UsuarioExterno = mongoose.model('UsuarioExterno', usuarioExternoSchema);

// Schema e model para contratos SEI
const contratoSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
});
const Contrato = mongoose.model('Contrato', contratoSchema);

// Rota para listar usuários (sem a senha)
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { password: 0 });
    res.json(usuarios);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).send('Erro ao buscar usuários');
  }
});

// Rota para remover um usuário externo pelo ID
app.delete('/usuarios-externos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await UsuarioExterno.findByIdAndDelete(id);

    if (!resultado) {
      return res.status(404).json({ message: 'Usuário externo não encontrado' });
    }

    res.json({ message: 'Usuário externo removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover usuário externo:', err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota de teste da DB
app.get('/test-db', (req, res) => {
  res.send('Conexão com o MongoDB funcionando.');
});

// Rota de cadastro
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
    if (!isMatch) return res.status(400).send('Senha incorreta');

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

    res.send({ token, role: user.role });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para inserir usuários externos
app.post('/usuarios-externos', express.json(), async (req, res) => {
  try {
    const usuarios = req.body;

    if (!Array.isArray(usuarios)) {
      return res.status(400).send('Esperado um array de usuários externos.');
    }

    const inseridos = await UsuarioExterno.insertMany(usuarios, { ordered: false });
    res.status(201).send(`Inseridos ${inseridos.length} usuários externos`);
  } catch (err) {
    console.error('Erro ao inserir usuários externos:', err);
    if (err.code === 11000) {
      res.status(409).send('ID de usuário externo duplicado.');
    } else {
      res.status(500).send('Erro no servidor');
    }
  }
});


// Rota para listar todos os usuários externos
app.get('/usuarios-externos', async (req, res) => {
  try {
    const lista = await UsuarioExterno.find().sort({ nome: 1 }); // ordena por nome
    res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar usuários externos:', err);
    res.status(500).send('Erro ao buscar usuários externos');
  }
});

    app.post('/contratos', express.json(), async (req, res) => {
  try {
    const { numero } = req.body;
    if (!numero) {
      return res.status(400).send('O número do contrato é obrigatório.');
    }
    const novoContrato = new Contrato({ numero });
    await novoContrato.save();
    res.status(201).send('Contrato cadastrado com sucesso');
  } catch (err) {
    console.error('Erro ao cadastrar contrato:', err);
    if (err.code === 11000) {
      res.status(409).send('Contrato já existente.');
    } else {
      res.status(500).send('Erro ao cadastrar contrato');
    }
  }
});

// Rota para listar contratos (GET)
app.get('/contratos', async (req, res) => {
  try {
    const contratos = await Contrato.find().sort({ numero: 1 });
    res.json(contratos);
  } catch (err) {
    console.error('Erro ao buscar contratos:', err);
    res.status(500).send('Erro ao buscar contratos');
  }
});

// Configuração do multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Rota principal de envio de e-mail
app.post('/send-email', upload.any(), async (req, res) => {
  console.log('Dados recebidos no formulário:', req.body);
  try {
    const fluxo = req.body.fluxo;
    const dados = req.body;
    if (!dados.email) {
      return res.status(400).send('O campo de e-mail é obrigatório.');
    }

    // Monta conteúdo do e-mail
    let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;
    mailContent += `Requerente: ${dados.requerente || ''}\n`;
    mailContent += `Email: ${dados.email || ''}\n`;
    // Ajusta campos conforme o fluxo
    if (fluxo === 'Liberar assinatura externa') {
  mailContent += `Assinante: ${dados.assinante || ''}\n`;
  mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;

    } else if (fluxo === 'Consultar empenho') {
      mailContent += `Contrato SEI: ${dados.contratoSei || ''}\n`;
    } else if (fluxo === 'Liberar acesso externo') {
  mailContent += `Usuário: ${dados.user || ''}\n`;
  mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;
    } 
    
    } else if (fluxo === 'Analise de processo') {
  mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;

  const arquivosEsperados = ['memoriaCalculo', 'diarioObra', 'relatorioFotografico'];
  console.log('📎 Arquivos recebidos:', req.files.map(f => f.fieldname));

  try {
    for (const nomeCampo of arquivosEsperados) {
      const arquivo = req.files.find(f => f.fieldname === nomeCampo);

      if (arquivo) {
        if (arquivo.mimetype !== 'application/pdf') {
          return res.status(400).send(`Tipo inválido: ${arquivo.originalname}`);
        }
        if (arquivo.size > 10 * 1024 * 1024) {
          return res.status(400).send(`Arquivo muito grande: ${arquivo.originalname}`);
        }

        attachments.push({
          filename: sanitizeFilename(arquivo.originalname),
          content: arquivo.buffer
        });
      } else {
        console.warn(`⚠️ Arquivo opcional '${nomeCampo}' não enviado.`);
      }
    }
  } catch (error) {
    console.error('Erro ao processar anexos da análise:', error);
    return res.status(500).send('Erro ao processar anexos da análise.');
  }
}
  
    else if (fluxo === 'Alterar ordem de documentos') {
      mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
      mailContent += `Instruções: ${dados.instrucoes || ''}\n`;
    } else if (fluxo === 'Inserir anexo em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    } else if (fluxo === 'Inserir imagem em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    } else if (fluxo === 'Assinatura em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
      mailContent += `Usuário: ${dados.user || ''}\n`;
      mailContent += `Senha: ${dados.key || ''}\n`;
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

    // Configura o transporte de e-mail
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

    // Array para anexos
    const attachments = [];

    // Verifica se há arquivos enviados
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Sanitiza o nome do arquivo enviado
        const safeOriginalName = sanitizeFilename(file.originalname);

        if (file.fieldname.startsWith('imagem')) {
          // Valida se é imagem
          if (!file.mimetype.startsWith('image/')) {
            return res.status(400).send(`Tipo de arquivo não permitido: ${file.originalname}`);
          }
          // Limite de 5 MB
          if (file.size > 5 * 1024 * 1024) {
            return res.status(400).send(`Arquivo muito grande: ${file.originalname}`);
          }
          attachments.push({ filename: safeOriginalName, content: file.buffer });

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
              // Sanitiza o nome de cada arquivo dentro do ZIP
              const safeZipName = sanitizeFilename(entry.entryName);
              attachments.push({ filename: safeZipName, content: fileContent });
            }
          } catch (error) {
            console.error('Erro ao processar o arquivo ZIP:', error);
            return res.status(400).send('Erro ao processar o arquivo ZIP.');
          }

        } else if (file.fieldname === 'arquivo') {
          // Apenas anexa o arquivo diretamente, com nome sanitizado
          attachments.push({ filename: safeOriginalName, content: file.buffer });

        } else if (file.fieldname === 'arquivoPdf') {
          // Conversão de PDF em JPG
          try {
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, `temp_${Date.now()}.pdf`);
            fs.writeFileSync(tempFilePath, file.buffer);

            const pdfImageOptions = {
            convertFileType: "png",
            convertOptions: {
              "-density": "300",
              "-background": "white",
              "-flatten": null,
              "-strip": null,
              "-filter": "Lanczos",
              "-resize": "1300",
              "-sharpen": "0x1.0"
            }
          };
               
            const pdfImage = new PDFImage(tempFilePath, pdfImageOptions);

            // Conta as páginas usando pdf-parse
            const parsedData = await pdfParse(file.buffer);
            const numPages = parsedData.numpages;
            console.log(`PDF possui ${numPages} páginas.`);

            // Converte cada página de forma SEQUENCIAL
            const imagePaths = [];
            for (let i = 0; i < numPages; i++) {
              console.log(`Convertendo página ${i + 1} de ${numPages}...`);
              const convertedPath = await pdfImage.convertPage(i);
              imagePaths.push(convertedPath);
            }
            console.log(`Conversão concluída para ${imagePaths.length} páginas.`);

            // Lê cada imagem e anexa
            // Gera um nome base sem ".pdf"
            const baseName = file.originalname.replace(/\.pdf$/i, '');
            const safeBase = sanitizeFilename(baseName);

            for (let i = 0; i < imagePaths.length; i++) {
              const imageBuffer = fs.readFileSync(imagePaths[i]);
              // Nome final ex.: "Documento_page_1.jpg"
              attachments.push({
                filename: `${safeBase}_page_${i + 1}.png`,
                content: imageBuffer
              });
              // Remove o arquivo de imagem temporário
              fs.unlinkSync(imagePaths[i]);
            }
            // Remove o PDF temporário
            fs.unlinkSync(tempFilePath);

          } catch (error) {
            console.error("Erro na conversão de PDF para JPG usando pdf-image:", error.message);
            return res.status(400).send("Erro na conversão do PDF para JPG: " + error.message);
          }
        }
      }
    }

    // Se houver anexos, adiciona ao e-mail
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
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

// Rota para a página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota para verificação do token JWT
app.post('/verify-token', (req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      if (!token) return res.status(400).json({ valid: false, error: 'Token ausente' });

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).json({ valid: false, error: 'Token inválido ou expirado' });
        }
        res.json({ valid: true, userId: decoded.id, role: decoded.role });
      });
    } catch (err) {
      console.error('Erro ao verificar token:', err);
      res.status(500).json({ valid: false, error: 'Erro interno no servidor' });
    }
  });
});

app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await User.find({}, { password: 0 }).sort({ username: 1 }); // exclui senha
    res.json(usuarios);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).send('Erro ao buscar usuários');
  }
});


// Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
