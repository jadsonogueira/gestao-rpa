// server.js
require('dotenv').config();

const { exec } = require('child_process');
const util = require('util');
const execP = util.promisify(exec);

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const os = require('os');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse');

const { createWorker } = require('tesseract.js');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { exec: execShell } = require('child_process');
const PDFImage = require('pdf-image').PDFImage;

// ===== Google Drive =====
const { google } = require('googleapis');
const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth: driveAuth });
async function overwriteDriveFile(fileId, buffer, mimeType) {
  await drive.files.update({ fileId, media: { mimeType, body: buffer } });
}

// ===== Binaries checks (logs) =====
exec('convert -version', (err, out) => {
  if (err) console.error('ImageMagick não encontrado:', err.message);
  else console.log('ImageMagick:\n' + out);
});
exec('gs -version', (err, out) => {
  if (err) console.error('Ghostscript não encontrado:', err.message);
  else console.log('Ghostscript:\n' + out);
});

// ===== App base =====
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));

// ===== Rotas externas (se existirem) =====
try {
  const ingestRoutes = require('./routes/ingest');
  app.use('/api/ingest', ingestRoutes);
  console.log('Rota /api/ingest carregada.');
} catch (e) { console.warn('Rota /api/ingest não carregada:', e.message); }
try {
  const processesRoutes = require('./routes/processes');
  app.use('/api/processes', processesRoutes);
  console.log('Rota /api/processes carregada.');
} catch (e) { console.warn('Rota /api/processes não carregada:', e.message); }
try {
  const processDocumentsRoutes = require('./routes/processDocuments');
  app.use('/api/process-documents', processDocumentsRoutes);
  console.log('Rota /api/process-documents carregada.');
} catch (e) { console.warn('Rota /api/process-documents não carregada:', e.message); }

// ===== Helpers =====
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
function sanitizeFilename(filename) {
  return filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]/g, '_');
}
async function hasBinary(bin) {
  try { await execP(process.platform === 'win32' ? `where ${bin}` : `which ${bin}`); return true; }
  catch { return false; }
}
function escapeHtml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== MongoDB =====
if (!process.env.MONGODB_URL || !process.env.JWT_SECRET) {
  console.error('Defina MONGODB_URL e JWT_SECRET.'); process.exit(1);
}
mongoose.connect(process.env.MONGODB_URL,{ useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=>console.log('MongoDB conectado'))
  .catch(err=>{ console.error('Erro MongoDB', err); process.exit(1); });

// ===== Schemas =====
const userSchema = new mongoose.Schema({
  username:{type:String,required:true,unique:true},
  email:{type:String,required:true,unique:true},
  password:{type:String,required:true},
  role:{type:String,enum:['classe_a','classe_b','classe_c','classe_d','classe_e','admin'],default:'classe_a'}
});
const User = mongoose.model('User', userSchema);
const Usuario = User;

const usuarioExternoSchema = new mongoose.Schema({
  idExterno:{type:String,required:true,unique:true},
  nome:{type:String,required:true},
  empresa:{type:String,required:true},
});
const UsuarioExterno = mongoose.model('UsuarioExterno', usuarioExternoSchema);

const contratoSchema = new mongoose.Schema({ numero:{type:String,required:true,unique:true} });
const Contrato = mongoose.model('Contrato', contratoSchema);

const processSchema = new mongoose.Schema({
  seiNumber:String, seiNumberNorm:String, subject:String, title:String, type:String, tags:[String],
  unit:String, assignedTo:String, status:String, contracts:[String],
  updatedAtSEI:Date, updatedAt:Date, lastSyncedAt:Date,
  createdAt:{ type:Date, default:Date.now }
},{ collection:'processes' });
const Process = mongoose.models.Process || mongoose.model('Process', processSchema);

// ===== Rotas principais =====
app.get('/api/processes', async (req,res)=>{
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const p = Math.max(parseInt(page,10)||1,1);
    const l = Math.max(parseInt(limit,10)||10,1);
    let query = {};
    if (search && search.trim().length >= 2) {
      const term = search.trim();
      const normalizado = term.replace(/[.\-\/\s]/g,'');
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const rx = new RegExp(esc(term),'i');
      const rxNorm = new RegExp(esc(normalizado),'i');
      query = { $or:[
        { seiNumber: rx }, { seiNumberNorm: rxNorm },
        { title: rx }, { subject: rx }, { unit: rx }, { status: rx }, { tags: rx }
      ]};
    }
    const [items,total] = await Promise.all([
      Process.find(query).sort({ updatedAt:-1 }).skip((p-1)*l).limit(l).lean(),
      Process.countDocuments(query)
    ]);
    const totalPages = Math.max(Math.ceil(total/l),1);
    res.json({ items, page:p, totalPages, total });
  } catch (err) {
    console.error('GET /api/processes', err);
    res.status(500).json({ error:'internal_error' });
  }
});

app.get('/usuarios', async (_req,res)=>{
  try { res.json(await Usuario.find({}, { password:0 })); }
  catch(e){ res.status(500).send('Erro ao buscar usuários'); }
});

app.delete('/usuarios-externos/:id', async (req,res)=>{
  try {
    const r = await UsuarioExterno.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message:'Usuário externo não encontrado' });
    res.json({ message:'Usuário externo removido com sucesso' });
  } catch(e){ res.status(500).json({ message:'Erro no servidor'}); }
});

app.use(express.static(path.join(__dirname,'public')));
app.get('/test-db', (_req,res)=> res.send('Conexão com o MongoDB funcionando.'));

app.post('/signup', express.json(), async (req,res)=>{
  try {
    const { username,email,password } = req.body;
    if (!username || !email || !password) return res.status(400).send('Todos os campos são obrigatórios');
    const exists = await User.findOne({ $or:[{username},{email}] });
    if (exists) return res.status(400).send('Usuário ou e-mail já cadastrado');
    const hashed = await bcrypt.hash(password,10);
    await new User({ username,email,password:hashed }).save();
    res.status(201).send('Usuário registrado com sucesso');
  } catch{ res.status(500).send('Erro no servidor'); }
});

app.post('/login', express.json(), async (req,res)=>{
  try {
    const { username,password } = req.body;
    if (!username || !password) return res.status(400).send('Todos os campos são obrigatórios');
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('Usuário não encontrado');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).send('Senha incorreta');
    const token = jwt.sign({ id:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn:'1h' });
    res.send({ token, role:user.role, nome:user.nome, email:user.email });
  } catch { res.status(500).send('Erro no servidor'); }
});

// ===== Upload config =====
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 50*1024*1024 } });

// ===== PDF MERGE =====
app.post('/merge-pdf', upload.array('pdfs'), async (req,res)=>{
  try{
    if (!req.files || req.files.length < 2) return res.status(400).send('Envie pelo menos dois PDFs');
    const arquivosOrdenados = [...req.files].sort((a,b)=> a.originalname.localeCompare(b.originalname,'pt',{numeric:true,sensitivity:'base'}));
    const baseName = path.parse(arquivosOrdenados[0].originalname).name;
    const safeBase = baseName.replace(/[^\w\-]+/g,'_');
    const downloadName = `${safeBase}_merge.pdf`;
    const mergedPdf = await PDFDocument.create();
    for (const file of arquivosOrdenados) {
      const isPdf = (file.mimetype||'').toLowerCase().includes('pdf') || /\.pdf$/i.test(file.originalname);
      if (!isPdf) return res.status(400).send(`Arquivo não é PDF: ${file.originalname}`);
      const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption:true });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p=>mergedPdf.addPage(p));
    }
    const buf = Buffer.from(await mergedPdf.save());
    res.set('Content-Type','application/pdf');
    res.set('Content-Length', String(buf.length));
    res.set('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.send(buf);
  } catch(err){ res.status(500).send('Erro ao unir PDFs: ' + err.message); }
});

// ===== PDF SPLIT =====
function parseRanges(spec, totalPages) {
  const ranges=[]; if (!spec) return Array.from({length:totalPages},(_,i)=>({start:i+1,end:i+1}));
  const parts = spec.split(',').map(s=>s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [aStr,bStr] = part.split('-'); const a=+aStr, b=+bStr;
      if (!Number.isInteger(a)||!Number.isInteger(b)) throw new Error(`Faixa inválida: "${part}"`);
      if (a<1||b<1||a>totalPages||b>totalPages) throw new Error(`Faixa fora do total (${totalPages}): "${part}"`);
      ranges.push({ start: Math.min(a,b), end: Math.max(a,b) });
    } else {
      const p = +part; if (!Number.isInteger(p)||p<1||p>totalPages) throw new Error(`Página inválida: "${part}"`);
      ranges.push({ start:p, end:p });
    }
  }
  return ranges;
}
app.post('/split-pdf', upload.single('pdf'), async (req,res)=>{
  try{
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Envie um único arquivo "pdf" (application/pdf).');
    }
    const srcPdf = await PDFDocument.load(req.file.buffer);
    const totalPages = srcPdf.getPageCount();
    const rangesSpec = (req.body.ranges || req.query.ranges || '').trim();
    const ranges = rangesSpec ? parseRanges(rangesSpec, totalPages)
                              : Array.from({length:totalPages},(_,i)=>({start:i+1,end:i+1}));
    const zip = new AdmZip();
    for (const {start,end} of ranges) {
      const out = await PDFDocument.create();
      const idxs = Array.from({length:end-start+1},(_,i)=>(start-1)+i);
      const pages = await out.copyPages(srcPdf, idxs);
      pages.forEach(p=>out.addPage(p));
      const bytes = await out.save();
      const filename = start===end ? `page-${String(start).padStart(3,'0')}.pdf`
                                   : `pages-${String(start).padStart(3,'0')}-${String(end).padStart(3,'0')}.pdf`;
      zip.addFile(filename, Buffer.from(bytes));
    }
    const zipBuffer = zip.toBuffer();
    const baseName = path.parse(req.file.originalname).name;
    const safeBase = baseName.replace(/[^\w\-]+/g,'_');
    const downloadName = `${safeBase}_split.zip`;
    res.set('Content-Type','application/zip');
    res.set('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.send(zipBuffer);
  } catch(err){ res.status(400).send('Erro ao dividir PDF: ' + err.message); }
});

// ===== Contratos =====
app.post('/contratos', express.json(), async (req,res)=>{
  try{
    const { numero } = req.body;
    if (!numero) return res.status(400).send('O número do contrato é obrigatório.');
    await new Contrato({ numero }).save();
    res.status(201).send('Contrato cadastrado com sucesso');
  } catch(err){
    if (err.code === 11000) res.status(409).send('Contrato já existente.');
    else res.status(500).send('Erro ao cadastrar contrato');
  }
});
app.get('/contratos', async (_req,res)=>{
  try{ res.json(await Contrato.find().sort({ numero:1 })); }
  catch{ res.status(500).send('Erro ao buscar contratos'); }
});

// ===== Verify token =====
app.get('/verify-token', (req,res)=>{
  try{
    const auth = req.headers.authorization || '';
    const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const token = headerToken || req.query.token || null;
    if (!token) return res.json({ valid:false, error:'Token ausente' });
    try { const decoded = jwt.verify(token, process.env.JWT_SECRET); return res.json({ valid:true, userId:decoded.id, role:decoded.role }); }
    catch { return res.json({ valid:false, error:'Token inválido ou expirado' }); }
  } catch{ return res.json({ valid:false, error:'Erro interno' }); }
});
app.post('/verify-token', (req,res)=>{
  let body=''; req.on('data', c=> body+=c);
  req.on('end', ()=>{
    try{
      const { token } = JSON.parse(body||'{}');
      if (!token) return res.status(400).json({ valid:false, error:'Token ausente' });
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if (err) return res.status(401).json({ valid:false, error:'Token inválido ou expirado' });
        res.json({ valid:true, userId:decoded.id, role:decoded.role });
      });
    } catch{ res.status(500).json({ valid:false, error:'Erro interno no servidor' }); }
  });
});

// ===== Utils imagem/PDF =====
async function optimizeJpegBuffer(inputBuffer, maxWidth = 1500, quality = 85) {
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(),'jpg-opt-'));
    const inPath = path.join(tmpDir,'in.jpg');
    const outPath = path.join(tmpDir,'out.jpg');
    fs.writeFileSync(inPath, inputBuffer);
    const IM_BIN = process.platform === 'win32' ? 'magick' : 'convert';
    const safeMax = Math.max(600, Math.min(4000, Number(maxWidth)||1500));
    const cmd = `${IM_BIN} "${inPath}" -resize ${safeMax}x${safeMax}> -sampling-factor 4:2:0 -strip -interlace JPEG -quality ${quality} "${outPath}"`;
    await new Promise((resolve,reject)=> exec(cmd,(err,_o,stderr)=> err ? reject(new Error(stderr||String(err))) : resolve()));
    const out = fs.readFileSync(outPath);
    fs.rmSync(tmpDir,{recursive:true,force:true});
    return out;
  } catch(e){ return inputBuffer; }
}
async function compressPDFIfNeeded(file) {
  const MAX_SIZE = 4*1024*1024;
  if (!file || !file.buffer) return file?.buffer || Buffer.alloc(0);
  if (file.buffer.length <= MAX_SIZE) return file.buffer;
  try { if (!(await hasBinary('gs'))) return file.buffer; } catch { return file.buffer; }
  const safeName = sanitizeFilename(file.originalname || `in_${Date.now()}.pdf`);
  const ts = Date.now();
  const tmpIn  = `/tmp/${ts}_${safeName}`;
  const tmpOut = `/tmp/compressed_${ts}_${safeName}`;
  fs.writeFileSync(tmpIn, file.buffer);
  const cmd = [
    'gs -sDEVICE=pdfwrite','-dCompatibilityLevel=1.4','-dPDFSETTINGS=/screen',
    '-dDownsampleColorImages=true','-dColorImageResolution=72',
    '-dDownsampleGrayImages=true','-dGrayImageResolution=72',
    '-dDownsampleMonoImages=true','-dMonoImageResolution=72','-dNOPAUSE -dQUIET -dBATCH',
    `-sOutputFile="${tmpOut}"`,`"${tmpIn}"`
  ].join(' ');
  try {
    await new Promise((resolve,reject)=> execShell(cmd, err=> err ? reject(err) : resolve()));
    const compressed = fs.readFileSync(tmpOut);
    return compressed.length ? compressed : file.buffer;
  } catch { return file.buffer; }
  finally { try{fs.unlinkSync(tmpIn);}catch{} try{fs.unlinkSync(tmpOut);}catch{} }
}

// ===== OCR (abreviado) =====
async function getWorker(langs='por') {
  const worker = await createWorker();
  try { await worker.loadLanguage('por'); await worker.initialize('por'); }
  catch { await worker.loadLanguage('eng'); await worker.initialize('eng'); }
  return worker;
}
async function makePdfSearchable(inBuffer, langs='por+eng') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(),'ocr-'));
  const inPath = path.join(tmpDir,'input.pdf');
  fs.writeFileSync(inPath, inBuffer);
  try {
    const hasPdftoppm = await hasBinary('pdftoppm'); if (!hasPdftoppm) throw new Error('pdftoppm ausente');
    const parsed = await pdfParse(inBuffer);
    const numPages = parsed.numpages || 1;
    const imgPaths = [];
    for (let i=1;i<=numPages;i++){
      const outPrefix = path.join(tmpDir, `page_${i}`);
      await execP(`pdftoppm -png -f ${i} -l ${i} "${inPath}" "${outPrefix}"`);
      const p = `${outPrefix}-1.png`; if (!fs.existsSync(p)) throw new Error('pdftoppm não gerou imagem'); imgPaths.push(p);
    }
    const merged = await PDFDocument.create();
    const ocrFont = await merged.embedFont(StandardFonts.Helvetica);
    let worker; try {
      worker = await getWorker(langs);
      for (const imgPath of imgPaths) {
        const { data } = await worker.recognize(imgPath);
        const bytes = fs.readFileSync(imgPath);
        const embedded = await merged.embedPng(bytes);
        const { width,height } = embedded.size();
        const page = merged.addPage([width,height]);
        page.drawImage(embedded,{x:0,y:0,width,height});
        const words = Array.isArray(data?.words) ? data.words : [];
        for (const w of words) {
          const bb = w?.bbox, txt=(w?.text??'').trim();
          if (!bb || !txt) continue;
          const x0=+bb.x0,y0=+bb.y0,x1=+bb.x1,y1=+bb.y1;
          if (![x0,y0,x1,y1].every(Number.isFinite)) continue;
          const h=Math.max(1,y1-y0), yPdf=height-(y0+h), size=Math.max(6, Math.min(36,h));
          page.drawText(txt,{x:x0,y:yPdf,size,font:ocrFont});
        }
      }
    } finally { if (worker) try{ await worker.terminate(); } catch{} }
    const outBytes = await merged.save();
    fs.rmSync(tmpDir,{recursive:true,force:true});
    return Buffer.from(outBytes);
  } catch(e){ fs.rmSync(tmpDir,{recursive:true,force:true}); throw e; }
}

// ===== PDF → JPG =====
app.post('/pdf-to-jpg', upload.single('arquivoPdf'), async (req,res)=>{
  try{
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Arquivo inválido ou ausente');
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(),'pdf-'));
    const inputPath = path.join(tempDir,'input.pdf');
    fs.writeFileSync(inputPath, req.file.buffer);
    const parsed = await pdfParse(req.file.buffer);
    const numPages = parsed.numpages;
    const baseName = path.basename(req.file.originalname,'.pdf');
    const safeBase = sanitizeFilename(baseName);
    let attachments=[];
    for (let i=1;i<=numPages;i++){
      const outputPrefix = path.join(tempDir, `page_${i}`);
      const TARGET = 1500;
      const command = `pdftoppm -jpeg -scale-to ${TARGET} -jpegopt quality=82 -f ${i} -l ${i} "${inputPath}" "${outputPrefix}"`;
      await new Promise((resolve,reject)=> exec(command,(error,_o,stderr)=> error ? reject(new Error(`Erro página ${i}: ${stderr}`)) : resolve()));
      const imagePath = `${outputPrefix}-${i}.jpg`;
      if (fs.existsSync(imagePath)) {
        const imgBuffer = fs.readFileSync(imagePath);
        const optimized = await optimizeJpegBuffer(imgBuffer,1500,82);
        attachments.push({ filename:`${safeBase}_page_${i}.jpg`, content:optimized });
        fs.unlinkSync(imagePath);
      }
    }
    fs.unlinkSync(inputPath);
    fs.rmdirSync(tempDir,{recursive:true});
    if (attachments.length>1) {
      const zip = new AdmZip(); attachments.forEach(att=> zip.addFile(att.filename, att.content));
      const zipBuffer = zip.toBuffer();
      res.set('Content-Type','application/zip');
      res.set('Content-Disposition', `attachment; filename="${safeBase}.zip"`);
      return res.send(zipBuffer);
    } else {
      res.set('Content-Type','image/jpeg');
      res.set('Content-Disposition', `attachment; filename="${attachments[0].filename}"`);
      return res.send(attachments[0].content);
    }
  } catch(err){ res.status(500).send('Erro ao converter PDF: '+err.message); }
});

// ===== OCR endpoint =====
app.post('/pdf-make-searchable', upload.single('arquivoPdf'), async (req,res)=>{
  try{
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).send('Envie "arquivoPdf" (application/pdf).');
    }
    const langs = normalizeLangs(req.body.lang ?? req.query.lang ?? process.env.OCR_LANGS ?? 'por+eng');
    const inputBuffer = await compressPDFIfNeeded(req.file);
    const searchable = await makePdfSearchable(inputBuffer, langs);
    const baseName = path.parse(req.file.originalname).name;
    const safeBase = sanitizeFilename(baseName);
    const downloadName = `${safeBase}_pesquisavel.pdf`;
    res.set('Content-Type','application/pdf');
    res.set('Content-Length', String(searchable.length));
    res.set('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.send(searchable);
  } catch(err){ res.status(500).send('Erro ao tornar PDF pesquisável: '+err.message); }
});

// ===== SEND EMAIL =====
app.use((req,res,next)=>{ if (req.path === '/send-email') console.log('[DEBUG] chegou em /send-email - método', req.method); next(); });

app.post('/send-email', upload.any(), async (req,res)=>{
  console.log('[DEBUG] chegou no /send-email - método POST');
  try {
    const dados = req.body;
    const fluxo = String(dados.fluxo || '');

    // --- auth ---
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).send('Token não fornecido.');
    let userId; try { userId = jwt.verify(token, process.env.JWT_SECRET).id; }
    catch { return res.status(401).send('Token inválido.'); }
    const usuario = await Usuario.findById(userId);
    if (!usuario) return res.status(404).send('Usuário não encontrado.');

    // === destino/assunto (compatível) ===
    const to = dados.to || dados.destinatario || dados.destinatarios || process.env.MAIL_FALLBACK_TO || 'jadsonpena@gmail.com';
    let subject = dados.subject || dados.assunto || `Fluxo: ${fluxo || 'Mensagem do AppDNIT'}`;

    // === construtor de corpo estável (CRLF) ===
    const crlfJoin = (lines) => lines.join('\r\n');
    function buildMailContent(fluxo, dados, usuario) {
      const name  = usuario?.username || usuario?.nome || usuario?.name || 'usuario';
      const email = usuario?.email || '';
      const sei   = dados.sei || dados.numeroSei || dados.numero_sei || dados['Número do processo SEI'] || '';
      const ag    = dados.agendamento || dados.Agendamento || ''; // só usa se vier do front

      const lines = [
        `Fluxo: ${fluxo || ''}`,
        '',
        'Dados do formulário:'
      ];
      if (ag) lines.push(`Agendamento: ${ag}`);
      lines.push(`Requerente: ${name}`);
      lines.push(`Email: ${email}`);

      switch (fluxo) {
        case 'Consultar empenho': {
          lines.push(`Contrato SEI: ${dados.contratoSei || ''}`);
          break;
        }
        case 'Atualizar lista de documentos': {
          if (sei) lines.push(`Número do processo SEI: ${sei}`);
          if (sei && !/SEI/i.test(subject)) subject += ` — SEI ${sei}`;
          break;
        }
        case 'Analise de processo': {
          if (sei) lines.push(`Número do Processo SEI: ${sei}`);
          break;
        }
        default: {
          // deixe vazio para não poluir com campos técnicos
          break;
        }
      }
      return crlfJoin(lines);
    }

    const mailContent =
      (typeof dados.text === 'string' && dados.text.trim())
        ? dados.text
        : buildMailContent(fluxo, dados, usuario);

    // === anexos + fluxos especiais ===
    let attachments = [];

    if (fluxo === 'Analise de processo' && Array.isArray(req.files)) {
      const idMap = {
        memoriaCalculo: process.env.MEMORIA_FILE_ID,
        diarioObra: process.env.DIARIO_FILE_ID,
        relatorioFotografico: process.env.RELATORIO_FILE_ID
      };
      for (const file of req.files) {
        const fileId = idMap[file.fieldname];
        if (!fileId) continue;
        if (file.mimetype !== 'application/pdf') {
          return res.status(400).send(`Tipo inválido: ${file.originalname}`);
        }
        await overwriteDriveFile(fileId, file.buffer, file.mimetype);
        console.log(`Atualizado no Drive: ${file.fieldname} (fileId=${fileId})`);
      }
    }

    if (req.files && req.files.length) {
      for (const file of req.files) {
        const safeOriginalName = sanitizeFilename(file.originalname);
        if (file.fieldname.startsWith('imagem')) {
          if (!file.mimetype.startsWith('image/')) return res.status(400).send(`Tipo não permitido: ${file.originalname}`);
          if (file.size > 5*1024*1024) return res.status(400).send(`Arquivo muito grande: ${file.originalname}`);
          attachments.push({ filename: safeOriginalName, content: file.buffer });
        } else if (file.fieldname === 'arquivoZip') {
          try {
            const zip = new AdmZip(file.buffer);
            const zipEntries = zip.getEntries();
            if (attachments.length + zipEntries.length > 100) return res.status(400).send('Limite de 100 arquivos.');
            for (const entry of zipEntries) {
              if (entry.isDirectory) continue;
              const ext = path.extname(entry.entryName).toLowerCase();
              const allowed = ['.jpg','.jpeg','.png','.gif','.bmp'];
              if (!allowed.includes(ext)) return res.status(400).send(`Tipo não permitido no ZIP: ${entry.entryName}`);
              const content = entry.getData();
              if (content.length > 5*1024*1024) return res.status(400).send(`Arquivo muito grande no ZIP: ${entry.entryName}`);
              attachments.push({ filename: sanitizeFilename(entry.entryName), content });
            }
          } catch{ return res.status(400).send('Erro ao processar o arquivo ZIP.'); }
        } else if (file.fieldname === 'arquivo') {
          attachments.push({ filename: safeOriginalName, content: file.buffer });
        } else if (file.fieldname === 'arquivoPdf') {
          if (!/application\/pdf/i.test(file.mimetype)) return res.status(400).send(`Arquivo inválido (esperado PDF): ${file.originalname}`);
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(),'pdf-'));
          const inputPath = path.join(tempDir,'input.pdf');
          fs.writeFileSync(inputPath, file.buffer);
          const TARGET = 1500;
          const safeBase = sanitizeFilename(file.originalname.replace(/\.pdf$/i,''));
          const outputPrefix = path.join(tempDir,'page');
          const command = `pdftoppm -jpeg -scale-to ${TARGET} -jpegopt quality=82 "${inputPath}" "${outputPrefix}"`;
          await new Promise((resolve,reject)=> exec(command,(error,_o,stderr)=> error ? reject(new Error(stderr||error.message)) : resolve()));
          const allFiles = fs.readdirSync(tempDir).filter(n=>/^page-\d+\.jpg$/i.test(n)).sort((a,b)=>{
            const ai = parseInt(a.match(/^page-(\d+)\.jpg$/i)[1],10);
            const bi = parseInt(b.match(/^page-(\d+)\.jpg$/i)[1],10);
            return ai-bi;
          });
          if (!allFiles.length) return res.status(400).send('Nenhuma imagem gerada pelo pdftoppm');
          for (const fname of allFiles) {
            const imagePath = path.join(tempDir, fname);
            const imgBuffer = fs.readFileSync(imagePath);
            const optimized = await optimizeJpegBuffer(imgBuffer, TARGET, 82);
            const n = parseInt(fname.match(/^page-(\d+)\.jpg$/i)[1],10);
            attachments.push({ filename: `${safeBase}_page_${String(n).padStart(3,'0')}.jpg`, content: optimized, contentType:'image/jpeg' });
            try{ fs.unlinkSync(imagePath);}catch{}
          }
          try{ fs.unlinkSync(inputPath);}catch{} try{ fs.rmdirSync(tempDir,{recursive:true}); }catch{}
        }
      }
    }

    console.log('[EMAIL] to=%s subject=%s', to, subject);
    const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
    if (provider === 'sendgrid') {
      const { sendWithSendGrid } = require('./email/sendgrid');
      const sgAttachments = (attachments||[]).map(a=>({
        filename:a.filename,
        contentBase64: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content||''),
        contentType: a.contentType ||
          (a.filename && /\.pdf$/i.test(a.filename) ? 'application/pdf' :
           a.filename && /\.png$/i.test(a.filename) ? 'image/png' :
           a.filename && /\.jpe?g$/i.test(a.filename) ? 'image/jpeg' : 'application/octet-stream')
      }));
      await sendWithSendGrid({
        to, subject, text: mailContent,
        html: `<pre>${escapeHtml(mailContent)}</pre>`,
        attachments: sgAttachments
      });
      return res.send('E-mail enviado com sucesso');
    } else {
      const transporter = nodemailer.createTransport({
        service:'gmail',
        auth:{ user:process.env.EMAIL_USER, pass:process.env.EMAIL_PASS }
      });
      const mailOptions = { from:process.env.EMAIL_USER, to, subject, text:mailContent, attachments };
      transporter.sendMail(mailOptions)
        .then(info=>{ console.log('[SEND] ok messageId=', info && info.messageId); res.send('E-mail enviado com sucesso'); })
        .catch(err=>{ const msg=(err && (err.response||err.message))||String(err); console.error('[SEND][SMTP ERROR]', msg); res.status(500).type('text/plain').send(`Erro ao enviar o e-mail: ${msg}`); });
    }
  } catch(err){
    console.error('Erro /send-email', err);
    res.status(500).send('Erro no servidor');
  }
});

// ===== Rotas finais =====
app.get('/', (_req,res)=> res.sendFile(path.join(__dirname,'public','dashboard.html')));

// ===== Start =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=> console.log('Servidor rodando na porta ' + PORT));
