
require('dotenv').config();

// -------------------------
// Module imports
// -------------------------
const express       = require('express');
const mongoose      = require('mongoose');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const nodemailer    = require('nodemailer');
const cors          = require('cors');
const path          = require('path');
const fs            = require('fs');
const os            = require('os');
const { exec }      = require('child_process');
const multer        = require('multer');
const AdmZip        = require('adm-zip');
const pdfParse      = require('pdf-parse');
const PDFMerger     = require('pdf-merger-js');
const { PDFImage }  = require('pdf-image');
const { google }    = require('googleapis');

// -------------------------
// Environment validation
// -------------------------
['MONGODB_URL','JWT_SECRET','EMAIL_USER','EMAIL_PASS','GOOGLE_SERVICE_ACCOUNT_JSON']
  .forEach(key => {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      process.exit(1);
    }
  });

// -------------------------
// Express app setup
// -------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------
// Google Drive client
// -------------------------
const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth: driveAuth });

// -------------------------
// Helper functions
// -------------------------
function sanitizeFilename(name) {
  return name.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\-]/g, '_');
}

async function overwriteDriveFile(fileId, buffer, mimeType) {
  return drive.files.update({ fileId, media: { mimeType, body: buffer } });
}

async function compressPDFIfNeeded(file) {
  const MAX = 4 * 1024 * 1024;
  if (file.buffer.length <= MAX) return file.buffer;

  const safe = sanitizeFilename(file.originalname);
  const ts = Date.now();
  const inPath  = `/tmp/${ts}_${safe}`;
  const outPath = `/tmp/compressed_${ts}_${safe}`;
  fs.writeFileSync(inPath, file.buffer);

  const cmd = [
    'gs -sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/screen',
    '-dDownsampleColorImages=true',
    '-dColorImageResolution=72',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile="${outPath}"`,
    `"${inPath}"`
  ].join(' ');

  await new Promise((res, rej) => exec(cmd, err => err ? rej(err) : res()));
  const buf = fs.readFileSync(outPath);
  fs.unlinkSync(inPath);
  fs.unlinkSync(outPath);
  return buf;
}

// Verify ImageMagick & Ghostscript
exec('convert -version', (e) => e ? console.error('ImageMagick not found') : console.log('ImageMagick ok'));
exec('gs -version', (e) => e ? console.error('Ghostscript not found') : console.log('Ghostscript ok'));

// -------------------------
// MongoDB connection & models
// -------------------------
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB error', err); process.exit(1); });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['classe_a','classe_b','classe_c','classe_d','classe_e','admin'], default: 'classe_a' }
});
const User           = mongoose.model('User', userSchema);
const UsuarioExterno = mongoose.model('UsuarioExterno', new mongoose.Schema({ idExterno:String, nome:String, empresa:String }));
const Contrato       = mongoose.model('Contrato', new mongoose.Schema({ numero:String }));

// -------------------------
// Multer for uploads
// -------------------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50*1024*1024 } });

// -------------------------
// Email transporter
// -------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// -------------------------
// Auth middleware
// -------------------------
function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).send('Token missing');
  const token = hdr.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, dec) => {
    if (err) return res.status(401).send('Invalid token');
    req.userId = dec.id;
    req.userRole = dec.role;
    next();
  });
}

// -------------------------
// Routes
// -------------------------
// Auth
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username||!email||!password) return res.status(400).send('Missing fields');
  if (await User.exists({ $or:[{username},{email}] })) return res.status(400).send('User/email exists');
  const hash = await bcrypt.hash(password, 10);
  await new User({ username, email, password: hash }).save();
  res.status(201).send('User registered');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username||!password) return res.status(400).send('Missing fields');
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password))
    return res.status(400).send('Invalid credentials');
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, role: user.role, username: user.username, email: user.email });
});

app.post('/verify-token', (req,res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ valid:false, error:'Missing token' });
  jwt.verify(token, process.env.JWT_SECRET, (err, dec) => {
    if (err) return res.status(401).json({ valid:false, error:'Invalid/expired' });
    res.json({ valid:true, userId: dec.id, role: dec.role });
  });
});

// Users listing
app.get('/usuarios', async (req, res) => {
  const list = await User.find({}, { password:0 }).sort({ username:1 });
  res.json(list);
});

// External users
app.post('/usuarios-externos', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).send('Expected array');
  try {
    const ins = await UsuarioExterno.insertMany(req.body, { ordered:false });
    res.status(201).send(`Inserted ${ins.length}`);
  } catch (e) {
    if (e.code===11000) return res.status(409).send('Duplicate ID');
    res.status(500).send('Server error');
  }
});
app.get('/usuarios-externos', async (req,res) => {
  const list = await UsuarioExterno.find().sort({ nome:1 });
  res.json(list);
});
app.delete('/usuarios-externos/:id', async (req,res) => {
  const del = await UsuarioExterno.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ message:'Not found' });
  res.json({ message:'Deleted' });
});

// Contracts
app.post('/contratos', async (req,res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).send('Missing numero');
  try {
    await new Contrato({ numero }).save();
    res.status(201).send('Contract registered');
  } catch(e) {
    if (e.code===11000) return res.status(409).send('Exists');
    res.status(500).send('Server error');
  }
});
app.get('/contratos', async (req,res) => {
  const list = await Contrato.find().sort({ numero:1 });
  res.json(list);
});

// PDF merge
app.post('/merge-pdf', upload.array('pdfs'), async (req,res) => {
  try {
    const merger = new PDFMerger();
    for (const f of req.files) merger.add(f.buffer);
    const buf = await merger.saveAsBuffer();
    res.type('application/pdf')
       .set('Content-Disposition','attachment; filename=merged.pdf')
       .send(buf);
  } catch(e) {
    res.status(500).send('PDF merge error');
  }
});

// PDF to JPG/ZIP
app.post('/pdf-to-jpg', upload.single('arquivoPdf'), async (req,res) => {
  try {
    const file = req.file;
    if (!file || file.mimetype!=='application/pdf') return res.status(400).send('Invalid PDF');

    const pdfPath = path.join(os.tmpdir(), `pdf_${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, file.buffer);
    const pdfImg = new PDFImage(pdfPath,{ convertFileType:'jpg', convertOptions:{ '-density':'300','-background':'white','-flatten':null,'-strip':null,'-resize':'1300'} });
    const { numpages } = await pdfParse(file.buffer);

    if (numpages===1) {
      const imgPath = await pdfImg.convertPage(0);
      const imgBuff = fs.readFileSync(imgPath);
      fs.unlinkSync(imgPath);
      res.type('image/jpeg').set('Content-Disposition', `attachment; filename="${sanitizeFilename(path.basename(file.originalname, '.pdf'))}.jpg"`).send(imgBuff);
    } else {
      const zip = new AdmZip();
      for (let i=0; i<numpages; i++) {
        const p = await pdfImg.convertPage(i);
        const b = fs.readFileSync(p);
        zip.addFile(`page_${i+1}.jpg`, b);
        fs.unlinkSync(p);
      }
      fs.unlinkSync(pdfPath);
      const zipBuff = zip.toBuffer();
      res.type('application/zip').set('Content-Disposition','attachment; filename=images.zip').send(zipBuff);
    }
  } catch(e) {
    res.status(500).send('Conversion error');
  }
});

// Main email endpoint
app.post('/send-email', authMiddleware, upload.any(), async (req,res) => {
  try {
    const { fluxo, ...dados } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).send('User not found');

    let content = `Fluxo: ${fluxo}\nRequerente: ${user.username}\nEmail: ${user.email}\n`;
    const attachments = [];

    // Handle specific fluxos...
    if (fluxo==='Analise de processo') {
      const idMap = { memoriaCalculo:process.env.MEMORIA_FILE_ID, diarioObra:process.env.DIARIO_FILE_ID, relatorioFotografico:process.env.RELATORIO_FILE_ID };
      for (const file of req.files) {
        const fid = idMap[file.fieldname];
        if (fid && file.mimetype==='application/pdf') await overwriteDriveFile(fid, file.buffer, file.mimetype);
      }
    }

    await transporter.sendMail({ from: process.env.EMAIL_USER, to:'jadson.pena@dnit.gov.br', subject: fluxo, text: content, attachments });
    res.send('Mail sent');
  } catch(e) {
    res.status(500).send('Server error');
  }
});

// Serve dashboard
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','dashboard.html')));

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
