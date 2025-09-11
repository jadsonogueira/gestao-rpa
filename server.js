require('dotenv').config();
const { exec } = require('child_process');

// importe o google:
const { google } = require('googleapis');

// ...

// agora use JSON.parse na variável de ambiente:
const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/drive']
});


// 2) Cliente da API Drive v3
const drive = google.drive({ version: 'v3', auth: driveAuth });

/**
 * Sobrescreve um arquivo no Drive (mantém o mesmo fileId)
 * @param {string} fileId    ID do arquivo no Drive (driveItem ID)
 * @param {Buffer} buffer    Conteúdo do PDF
 * @param {string} mimeType  Tipo MIME (ex.: 'application/pdf')
 */
async function overwriteDriveFile(fileId, buffer, mimeType) {
  await drive.files.update({
    fileId,
    media: { mimeType, body: buffer }
  });
}

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
const { exec: execShell } = require('child_process');
const util = require('util');
const execP = util.promisify(exec);
const { PDFDocument } = require('pdf-lib');
const { createWorker } = require('tesseract.js');

function normalizeLangs(input) {
  if (!input) return 'por+eng';
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean).join('+');
  let s = String(input).trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(x => String(x).trim()).filter(Boolean).join('+');
    } catch {}
  }
  return s.split('+').map(t => t.trim()).filter(Boolean).join('+');
}

function toLangArray(input) {
  if (Array.isArray(input)) return input.filter(Boolean).map(String);
  return String(input || 'eng').split('+').map(s => s.trim()).filter(Boolean);
}

async function getWorker(langs = 'por+eng') {
  const langArr = toLangArray(langs);
  const primary = langArr[0] || 'eng';   // usa só o primeiro

  const worker = await createWorker({
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    cachePath: '/tmp',
  });

  // ✅ inicializa com 1 idioma para eliminar a causa do erro
  await worker.loadLanguage(primary);
  await worker.initialize(primary);
  return worker;
}



/**
 * Torna um PDF pesquisável (OCR):
 * A) ocrmypdf (se instalado)
 * B) tesseract CLI + pdftoppm (se instalados)
 * C) tesseract.js (WASM) + pdftoppm (sempre disponível no Render Free)
 */
async function makePdfSearchable(inBuffer, langs = 'por+eng') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  const inPath = path.join(tmpDir, 'input.pdf');
  fs.writeFileSync(inPath, inBuffer);

  try {
    // --- Caminho A: OCRmyPDF
    if (await hasBinary('ocrmypdf')) {
      console.log('[OCR] Usando ocrmypdf');
      const outPath = path.join(tmpDir, 'output.pdf');
      const cmd = `ocrmypdf --skip-text -l ${langs} --optimize 1 "${inPath}" "${outPath}"`;
      await execP(cmd);
      const out = fs.readFileSync(outPath);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return out;
    }

    // --- Caminho B: Tesseract CLI + pdftoppm
    const hasPdftoppm = await hasBinary('pdftoppm');
    const hasTesseract = await hasBinary('tesseract');
    if (hasPdftoppm && hasTesseract) {
      console.log('[OCR] Usando tesseract CLI + pdftoppm');
      const parsed = await pdfParse(inBuffer);
      const numPages = parsed.numpages || 1;
      console.log(`[OCR] Páginas: ${numPages}`);

      const pagePdfBuffers = [];
      for (let i = 1; i <= numPages; i++) {
        const ppmPrefix = path.join(tmpDir, `page_${i}`);
        await execP(`pdftoppm -tiff -f ${i} -l ${i} "${inPath}" "${ppmPrefix}"`);
        const tiffPath = `${ppmPrefix}-1.tif`;
        const pageOut = path.join(tmpDir, `ocr_page_${i}`);
        await execP(`tesseract "${tiffPath}" "${pageOut}" -l ${langs} pdf`);
        pagePdfBuffers.push(fs.readFileSync(`${pageOut}.pdf`));
      }

      const merged = await PDFDocument.create();
      for (const buf of pagePdfBuffers) {
        const part = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(part, part.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const mergedBytes = await merged.save();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return Buffer.from(mergedBytes);
    }

    // --- Caminho C: Tesseract.js (WASM) + pdftoppm
    if (!hasPdftoppm) {
      throw new Error('Nenhuma rota de OCR disponível: falta pdftoppm.');
    }
    console.log('[OCR] Usando tesseract.js (WASM) + pdftoppm');

    const parsed = await pdfParse(inBuffer);
    const numPages = parsed.numpages || 1;
    console.log(`[OCR] Páginas: ${numPages}`);

    const imgPaths = [];
    for (let i = 1; i <= numPages; i++) {
      const outPrefix = path.join(tmpDir, `page_${i}`);
      await execP(`pdftoppm -png -f ${i} -l ${i} "${inPath}" "${outPrefix}"`);
      imgPaths.push(`${outPrefix}-1.png`);
    }

    const worker = await getWorker(langs); // ✅ já inicializado

    const merged = await PDFDocument.create();
    for (const pngPath of imgPaths) {
      const imageBytes = fs.readFileSync(pngPath);
      const { data } = await worker.recognize(imageBytes);

      const embeddedPng = await merged.embedPng(imageBytes);
      const { width, height } = embeddedPng.size();
      const page = merged.addPage([width, height]);
      page.drawImage(embeddedPng, { x: 0, y: 0, width, height });

      for (const w of (data.words || [])) {
        const { x0, y0, x1, y1 } = w.bbox;
        const h = Math.max(1, y1 - y0);
        const yPdf = height - (y0 + h);
        const size = Math.max(6, Math.min(72, h));
        page.drawText(w.text, {
          x: x0,
          y: yPdf,
          size,
          opacity: 0.01, // invisível e pesquisável
        });
      }
    }

    await worker.terminate();
    const mergedBytes = await merged.save();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return Buffer.from(mergedBytes);
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error('[OCR] Falhou:', e.message);
    throw e;
  }
}


// === Helper: otimiza/resize JPG mantendo nitidez ===
async function optimizeJpegBuffer(inputBuffer, maxWidth = 1500, quality = 82) {
  try {
    const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'jpg-opt-'));
    const inPath  = path.join(tmpDir, 'in.jpg');
    const outPath = path.join(tmpDir, 'out.jpg');
    fs.writeFileSync(inPath, inputBuffer);

    // Windows usa "magick"; Linux/macOS geralmente "convert"
    const IM_BIN = process.platform === 'win32' ? 'magick' : 'convert';
    const safeMax = Math.max(600, Math.min(4000, Number(maxWidth) || 1500));

    // -resize Wx> só reduz (não amplia); mantém proporção
    const cmd =
    `${IM_BIN} "${inPath}" -resize ${safeMax}x${safeMax}>` + // limita LADO MAIOR a 1500
    ` -sampling-factor 4:2:0 -strip -interlace JPEG -quality ${quality} "${outPath}"`;


    await new Promise((resolve, reject) =>
      exec(cmd, (err, _o, stderr) => err ? reject(new Error(stderr || String(err))) : resolve())
    );

    const out = fs.readFileSync(outPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Failsafe: se não ficar menor, mantém o original
    return out;
  } catch (e) {
    console.error('optimizeJpegBuffer falhou; usando original:', e.message);
    return inputBuffer;
  }
}



/**
 * Se o PDF for maior que 4 MB, comprime via Ghostscript.
 * Caso contrário, retorna o buffer original.
 */
/**
 * Se o PDF for maior que 4 MB, tenta comprimir com Ghostscript.
 * Se não houver GS ou der erro, retorna o buffer original.
 */
async function compressPDFIfNeeded(file) {
  const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
  if (!file || !file.buffer) return file?.buffer || Buffer.alloc(0);
  if (file.buffer.length <= MAX_SIZE) return file.buffer;

  // Se GS não existir, não falha o fluxo
  try {
    if (typeof hasBinary === 'function') {
      const ok = await hasBinary('gs');
      if (!ok) {
        console.warn('[compressPDFIfNeeded] Ghostscript ausente; pulando compressão.');
        return file.buffer;
      }
    }
  } catch {
    console.warn('[compressPDFIfNeeded] Erro checando gs; pulando compressão.');
    return file.buffer;
  }

  const safeName = sanitizeFilename(file.originalname || `in_${Date.now()}.pdf`);
  const timestamp = Date.now();
  const tmpIn  = `/tmp/${timestamp}_${safeName}`;
  const tmpOut = `/tmp/compressed_${timestamp}_${safeName}`;
  fs.writeFileSync(tmpIn, file.buffer);

  const cmd = [
    'gs -sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/screen',
    '-dDownsampleColorImages=true',
    '-dColorImageResolution=72',
    '-dDownsampleGrayImages=true',
    '-dGrayImageResolution=72',
    '-dDownsampleMonoImages=true',
    '-dMonoImageResolution=72',
    '-dNOPAUSE -dQUIET -dBATCH',
    `-sOutputFile="${tmpOut}"`,
    `"${tmpIn}"`
  ].join(' ');

  try {
    await new Promise((resolve, reject) =>
      execShell(cmd, err => err ? reject(err) : resolve())
    );
    const compressed = fs.readFileSync(tmpOut);
    return compressed.length ? compressed : file.buffer;
  } catch (e) {
    console.error('[compressPDFIfNeeded] Falha Ghostscript, usando original:', e.message);
    return file.buffer;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// Importa a classe PDFImage do pdf-image
const PDFImage = require("pdf-image").PDFImage;

const app = express();
app.use(cors({
  exposedHeaders: ['Content-Disposition']
}));
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

async function hasBinary(bin) {
  try {
    await execP(process.platform === 'win32' ? `where ${bin}` : `which ${bin}`);
    return true;
  } catch { return false; }
}


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

app.get('/_debug/ocr-binaries', async (req, res) => {
  try {
    const out = {
      ocrmypdf: typeof hasBinary === 'function' ? await hasBinary('ocrmypdf') : false,
      tesseract: typeof hasBinary === 'function' ? await hasBinary('tesseract') : false,
      pdftoppm: typeof hasBinary === 'function' ? await hasBinary('pdftoppm') : false,
      gs: typeof hasBinary === 'function' ? await hasBinary('gs') : false,
      convert: typeof hasBinary === 'function' ? await hasBinary(process.platform === 'win32' ? 'magick' : 'convert') : false,
    };
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
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

    // Gera o token JWT com o ID e o nível de acesso (role)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Envia o token e a role; se quiser pode incluir também nome e email
    res.send({
      token,
      role: user.role,
      nome: user.nome,
      email: user.email
    });

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/merge-pdf', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).send('É necessário enviar pelo menos dois arquivos PDF');
    }

    // Ordena por nome para padronizar a base do arquivo final
    const arquivosOrdenados = [...req.files].sort((a, b) =>
      a.originalname.localeCompare(b.originalname, 'pt', { numeric: true, sensitivity: 'base' })
    );

    // Gera nome de download a partir do primeiro
    const baseName = path.parse(arquivosOrdenados[0].originalname).name;
    const safeBase = baseName.replace(/[^\w\-]+/g, '_');
    const downloadName = `${safeBase}_merge.pdf`;

    const mergedPdf = await PDFDocument.create();

    for (const file of arquivosOrdenados) {
      const isPdf =
        (file.mimetype && file.mimetype.toLowerCase().includes('pdf')) ||
        /\.pdf$/i.test(file.originalname);

      if (!isPdf) {
        return res.status(400).send(`Arquivo não é PDF: ${file.originalname}`);
      }

      // ignoreEncryption ajuda quando o PDF tem “permissões” mas sem senha interativa
      const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }

    const buf = Buffer.from(await mergedPdf.save());

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', String(buf.length));
    // filename + filename* para lidar com UTF-8 corretamente
    res.set('Content-Disposition',
      `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );

    return res.send(buf);
  } catch (err) {
    console.error('Erro no merge-pdf:', err);
    return res.status(500).send(`Erro ao unir PDFs: ${err.message}`);
  }
});

// --- Helper: interpreta "ranges" do split (ex.: "1-3,5,7-9") ---
function parseRanges(spec, totalPages) {
  const ranges = [];
  if (!spec) {
    return Array.from({ length: totalPages }, (_, i) => ({ start: i + 1, end: i + 1 }));
  }
  const parts = spec.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [aStr, bStr] = part.split('-');
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        throw new Error(`Faixa inválida: "${part}"`);
      }
      if (a < 1 || b < 1 || a > totalPages || b > totalPages) {
        throw new Error(`Faixa fora do total de páginas (${totalPages}): "${part}"`);
      }
      const start = Math.min(a, b);
      const end   = Math.max(a, b);
      ranges.push({ start, end });
    } else {
      const p = parseInt(part, 10);
      if (!Number.isInteger(p) || p < 1 || p > totalPages) {
        throw new Error(`Página inválida ou fora do total (${totalPages}): "${part}"`);
      }
      ranges.push({ start: p, end: p });
    }
  }

  return ranges;
}



app.post('/split-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Envie um único arquivo com field "pdf" (application/pdf).');
    }

    const srcPdf = await PDFDocument.load(req.file.buffer);
    const totalPages = srcPdf.getPageCount();

    const rangesSpec = (req.body.ranges || req.query.ranges || '').trim();
    const ranges = rangesSpec
      ? parseRanges(rangesSpec, totalPages)
      : Array.from({ length: totalPages }, (_, i) => ({ start: i + 1, end: i + 1 }));

    const zip = new AdmZip();

    for (const { start, end } of ranges) {
      const out = await PDFDocument.create();
      const idxsZeroBased = Array.from({ length: end - start + 1 }, (_, i) => (start - 1) + i);
      const pages = await out.copyPages(srcPdf, idxsZeroBased);
      pages.forEach(p => out.addPage(p));

      const bytes = await out.save();
      const filename = start === end
        ? `page-${String(start).padStart(3, '0')}.pdf`
        : `pages-${String(start).padStart(3, '0')}-${String(end).padStart(3, '0')}.pdf`;

      zip.addFile(filename, Buffer.from(bytes));
    }

    const zipBuffer = zip.toBuffer();

    // Base do nome: arquivo enviado, sem extensão
    const baseName = path.parse(req.file.originalname).name;
    const safeBase = baseName.replace(/[^\w\-]+/g, '_');
    const downloadName = `${safeBase}_split.zip`;

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${downloadName}"`);
    return res.send(zipBuffer);


  } catch (err) {
    console.error('Erro no split-pdf:', err);
    res.status(400).send(`Erro ao dividir PDF: ${err.message}`);
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



app.post('/send-email', upload.any(), async (req, res) => {
  console.log('Dados recebidos no formulário:', req.body);
  try {
    const fluxo = req.body.fluxo;
    const dados = req.body;
   // if (!dados.email) {
   //   return res.status(400).send('O campo de e-mail é obrigatório.');
   // }

      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).send("Token não fornecido.");

      let userId;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        return res.status(401).send("Token inválido.");
      }

      const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).send("Usuário não encontrado.");
    }

    let mailContent = `Fluxo: ${fluxo}\n\nDados do formulário:\n`;

    
// === Agendamento para o Power Automate (sempre envia "Agendamento:") ===
const { envio, quando, quandoUtc } = req.body;

// Converte "YYYY-MM-DDTHH:MM" OU "YYYY-MM-DD HH:MM" (24h)
// OU "YYYY-MM-DD HH:MM AM/PM" assumindo America/Sao_Paulo (-03:00) -> ISO UTC (...:SSZ)
function spToUtcIso(localStr) {
  if (!localStr) return null;

  // 24h com 'T' ou espaço
  let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(localStr);
  if (!m) {
    // 12h com AM/PM
    const m12 = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(localStr);
    if (!m12) return null;
    let hh = (+m12[4]) % 12;
    if (/pm/i.test(m12[6])) hh += 12;
    m = [null, m12[1], m12[2], m12[3], String(hh).padStart(2,'0'), m12[5]];
  }

  const y  = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mi = +m[5];
  const ms = Date.UTC(y, mo - 1, d, hh - 1, mi, 0); // SP (-03:00) -> UTC
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Enviamos SEMPRE "Agendamento:" para o Flow
let agIso = null;
if (envio === 'agendar') {
  // tenta parsear o input; se não der, usa quandoUtc do front
  agIso = spToUtcIso(quando)
       || (quandoUtc && (() => {
            const d = new Date(quandoUtc);
            return isNaN(d) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
          })());
} else {
  // imediato -> agora + 5s (buffer p/ nunca cair no passado)
  agIso = new Date(Date.now() + 5 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

if (agIso) {
  mailContent += `Agendamento: ${agIso}\n`;
}
// === fim bloco de agendamento ===



    
    mailContent += `Requerente: ${usuario?.username || 'Desconhecido'}\n`;
    mailContent += `Email: ${usuario?.email || 'Não informado'}\n`;

    const attachments = []; // <-- precisa estar aqui no começo do try

    if (fluxo === 'Liberar assinatura externa') {
      mailContent += `Assinante: ${dados.assinante || ''}\n`;
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;

    } else if (fluxo === 'Consultar empenho') {
      mailContent += `Contrato SEI: ${dados.contratoSei || ''}\n`;

    } else if (fluxo === 'Liberar acesso externo') {
      mailContent += `Usuário: ${dados.user || ''}\n`;
      mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;
//***//
      
       } else if (fluxo === 'Analise de processo') {
  mailContent += `Número do Processo SEI: ${dados.processo_sei || ''}\n`;

  // Mapeia fieldname → fileId
  const idMap = {
    memoriaCalculo: process.env.MEMORIA_FILE_ID,
    diarioObra:     process.env.DIARIO_FILE_ID,
    relatorioFotografico: process.env.RELATORIO_FILE_ID
  };

  for (const file of req.files) {
    const fileId = idMap[file.fieldname];
    if (!fileId) continue;              // ignora outros campos
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).send(`Tipo inválido: ${file.originalname}`);
    }
    // sobrescreve no Drive
    await overwriteDriveFile(fileId, file.buffer, file.mimetype);
    console.log(`Atualizado no Drive: ${file.fieldname} (fileId=${fileId})`);
  }

//***//

  } else if (fluxo === 'Alterar ordem de documentos') {
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

        }else if (file.fieldname === 'arquivo') {
          // Anexa o PDF (ou qualquer arquivo) sem compressão
          attachments.push({ filename: safeOriginalName, content: file.buffer });
        
       } else if (file.fieldname === 'arquivoPdf') {
  const deveConverterPDF = ['Criar Doc SEI Editável', 'Inserir imagem em doc SEI', 'PDF para JPG'].includes(fluxo);

  try {
    if (!/application\/pdf/i.test(file.mimetype)) {
      return res.status(400).send(`Arquivo inválido (esperado PDF): ${file.originalname}`);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
    const inputPath = path.join(tempDir, 'input.pdf');
    fs.writeFileSync(inputPath, file.buffer);

    const TARGET = 1500; // lado maior
    const safeBase = sanitizeFilename(file.originalname.replace(/\.pdf$/i, ''));
    const outputPrefix = path.join(tempDir, 'page'); // gera page-1.jpg, page-2.jpg, ...

    // 🔹 Gera TODAS as páginas de uma vez
    const command = `pdftoppm -jpeg -scale-to ${TARGET} -jpegopt quality=82 "${inputPath}" "${outputPrefix}"`;
    await new Promise((resolve, reject) => {
      exec(command, (error, _stdout, stderr) =>
        error ? reject(new Error(stderr || error.message)) : resolve()
      );
    });

    // 🔹 Coleta todos os arquivos gerados
    const allFiles = fs.readdirSync(tempDir)
      .filter(name => /^page-\d+\.jpg$/i.test(name))
      .sort((a, b) => {
        const ai = parseInt(a.match(/^page-(\d+)\.jpg$/i)[1], 10);
        const bi = parseInt(b.match(/^page-(\d+)\.jpg$/i)[1], 10);
        return ai - bi;
      });

    if (allFiles.length === 0) {
      throw new Error('Nenhuma imagem gerada pelo pdftoppm');
    }

    // 🔹 Anexa todas, otimizando cada uma
    for (const fname of allFiles) {
      const imagePath = path.join(tempDir, fname);
      const imgBuffer = fs.readFileSync(imagePath);
      const optimized = await optimizeJpegBuffer(imgBuffer, TARGET, 82);

      const n = parseInt(fname.match(/^page-(\d+)\.jpg$/i)[1], 10);
      attachments.push({
        filename: `${safeBase}_page_${String(n).padStart(3, '0')}.jpg`,
        content: optimized,
        contentType: 'image/jpeg'
      });

      try { fs.unlinkSync(imagePath); } catch {}
    }

    console.log(`[send-email][arquivoPdf] Geradas ${allFiles.length} imagens para ${file.originalname}. attachments total=${attachments.length}`);

    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.rmdirSync(tempDir, { recursive: true }); } catch {}

  } catch (error) {
    console.error("Erro na conversão de PDF para JPG (send-email/arquivoPdf):", error.message);
    return res.status(400).send("Erro na conversão do PDF para JPG: " + error.message);
  }
} // <-- fecha corretamente o else if
        
      } // <-- fecha o for (const file of req.files)
    }   // <-- fecha o if (req.files && req.files.length > 0)


    // Se houver anexos, adiciona ao e-mail
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

  

    const totalBytes = attachments
      .map(a => a.content.length)
      .reduce((sum, n) => sum + n, 0);
        console.log(`Total de bytes nos attachments (raw): ${totalBytes}`);
      console.log(`Total estimado com Base64 (~4/3): ${Math.round(totalBytes * 4/3)}`);
         console.log('Attachments nomes:', (mailOptions.attachments || []).map(a => a.filename));

    
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


app.post('/pdf-to-jpg', upload.single('arquivoPdf'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Arquivo inválido ou ausente');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
    const inputPath = path.join(tempDir, 'input.pdf');
    fs.writeFileSync(inputPath, req.file.buffer);

    // Conta as páginas do PDF
    const parsed = await pdfParse(req.file.buffer);
    const numPages = parsed.numpages;

    const baseName = path.basename(req.file.originalname, '.pdf');
    const safeBase = sanitizeFilename(baseName);

    const attachments = [];

    for (let i = 1; i <= numPages; i++) {
      const outputPrefix = path.join(tempDir, `page_${i}`);

     const TARGET = 1500; // lado maior em px
const command = `pdftoppm -jpeg -scale-to ${TARGET} -jpegopt quality=82 -f ${i} -l ${i} "${inputPath}" "${outputPrefix}"`;


      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Erro ao converter página ${i}: ${stderr}`));
          } else {
            resolve();
          }
        });
      });

      const imagePath = `${outputPrefix}-${i}.jpg`;
      if (fs.existsSync(imagePath)) {
        const imgBuffer = fs.readFileSync(imagePath);
        const optimized = await optimizeJpegBuffer(imgBuffer, 1500, 82);
        attachments.push({ filename: `${safeBase}_page_${i}.jpg`, content: optimized });

        fs.unlinkSync(imagePath);
      }
    }

    fs.unlinkSync(inputPath);
    fs.rmdirSync(tempDir, { recursive: true });

   // Retorna como ZIP se mais de uma página
if (attachments.length > 1) {
  const zip = new AdmZip();
  attachments.forEach(att => zip.addFile(att.filename, att.content));
  const zipBuffer = zip.toBuffer();

  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="${safeBase}.zip"`);
  return res.send(zipBuffer);
} else {
  // JPG único
  res.set('Content-Type', 'image/jpeg');
  res.set('Content-Disposition', `attachment; filename="${attachments[0].filename}"`);
  return res.send(attachments[0].content);
}

  } catch (err) {
    console.error('Erro na conversão de PDF para JPG:', err);
    res.status(500).send('Erro ao converter PDF: ' + err.message);
  }
});


// OCR
app.post('/pdf-make-searchable', upload.single('arquivoPdf'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Envie um "arquivoPdf" (application/pdf).');
    }

   const langs = normalizeLangs(
  req.body.lang ?? req.query.lang ?? process.env.OCR_LANGS ?? 'por+eng'
);


    // Opcional: comprimir antes se >4MB (você já tem esse helper)
    const inputBuffer = await compressPDFIfNeeded(req.file);

    const searchable = await makePdfSearchable(inputBuffer, langs);

    const baseName = path.parse(req.file.originalname).name;
    const safeBase = sanitizeFilename(baseName);
    const downloadName = `${safeBase}_pesquisavel.pdf`;

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', String(searchable.length));
    res.set('Content-Disposition',
      `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
    return res.send(searchable);
  } catch (err) {
    console.error('Erro no /pdf-make-searchable:', err);
    return res.status(500).send('Erro ao tornar PDF pesquisável: ' + err.message);
  }
});



// Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
