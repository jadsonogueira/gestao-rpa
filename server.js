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
const { exec, exec: execShell } = require('child_process');
const multer        = require('multer');
const AdmZip        = require('adm-zip');
const pdfParse      = require('pdf-parse');
const PDFMerger     = require('pdf-merger-js');
const { PDFImage }  = require('pdf-image');
const { google }    = require('googleapis');

// -------------------------
// Environment validation
// -------------------------
const requiredEnvs = ['MONGODB_URL','JWT_SECRET','EMAIL_USER','EMAIL_PASS','GOOGLE_SERVICE_ACCOUNT_JSON'];
for (const key of requiredEnvs) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

// -------------------------
// App and middleware setup
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
function sanitizeFilename(filename) {
  return filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\-]/g, '_');
}

async function overwriteDriveFile(fileId, buffer, mimeType) {
  return drive.files.update({ fileId, media: { mimeType, body: buffer } });
}

async function compressPDFIfNeeded(file) {
  const MAX_SIZE = 4 * 1024 * 1024;
  if (file.buffer.length <= MAX_SIZE) return file.buffer;

  const safeName = sanitizeFilename(file.originalname);
  const ts = Date.now();
  const tmpIn  = `/tmp/${ts}_${safeName}`;
  const tmpOut = `/tmp/compressed_${ts}_${safeName}`;
  fs.writeFileSync(tmpIn, file.buffer);

  const cmd = [
    'gs -sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/screen',
    '-dDownsampleColorImages=true',
    '-dColorImageResolution=72',
    '-dNOPAUSE -dQUIET -dBATCH',
    `-sOutputFile="${tmpOut}"`,
    `"${tmpIn}"`
  ].join(' ');
  await new Promise((r,rej) => execShell(cmd, err => err?rej(err):r()));

  const compressed = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpIn);
  fs.unlinkSync(tmpOut);
  return compressed;
}

// Verify ImageMagick & Ghostscript availability
exec('convert -version', (err,stdout) => err
  ? console.error('ImageMagick not found')
  : console.log('ImageMagick:', stdout)
);
exec('gs -version', (err,stdout) => err
  ? console.error('Ghostscript not found')
  : console.log('Ghostscript:', stdout)
);

// -------------------------
// MongoDB connection & models
// -------------------------
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB error', err); process.exit(1); });

const userSchema = new mongoose.Schema({
  username: String, email: String, password: String,
  role: { type: String, enum: ['classe_a','classe_b','classe_c','classe_d','classe_e','admin'], default: 'classe_a' }
});
const User            = mongoose.model('User', userSchema);
const UsuarioExterno  = mongoose.model('UsuarioExterno', new mongoose.Schema({ idExterno:String, nome:String, empresa:String }));
const Contrato        = mongoose.model('Contrato', new mongoose.Schema({ numero:String }));

// -------------------------
// File upload config (Multer)
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
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send('Invalid token');
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
}

// -------------------------
// Routes
// -------------------------
// -- Auth & User management
app.post('/signup', async (req,res) => {
  const { username,email,password } = req.body;
  if (!username||!email||!password) return res.status(400).send('Missing fields');
  if (await User.exists({ $or:[{username},{email}] })) return res.status(400).send('User/email exists');
  const hash = await bcrypt.hash(password,10);
  await new User({ username,email,password:hash }).save();
  res.status(201).send('User registered');
});

app.post('/login', async (req,res) => {
  const { username,password } = req.body;
  if (!username||!password) return res.status(400).send('Missing fields');
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password,user.password))
    return res.status(400).send('Invalid credentials');
  const token = jwt.sign({ id:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn:'1h' });
  res.send({ token, role:user.role, nome:user.username, email:user.email });
});

app.post('/verify-token', (req,res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ valid:false, error:'Token missing' });
  jwt.verify(token, process.env.JWT_SECRET, (err,decoded) => {
    if (err) return res.status(401).json({ valid:false, error:'Invalid/expired' });
    res.json({ valid:true, userId:decoded.id, role:decoded.role });
  });
});

// -- Testing DB connection
app.get('/test-db', (req,res) => res.send('MongoDB OK'));

// -- User listings
app.get('/usuarios', async (req,res) => {
  const list = await User.find({}, { password:0 }).sort({ username:1 });
  res.json(list);
});

// -- External users
app.post('/usuarios-externos', async (req,res) => {
  if (!Array.isArray(req.body)) return res.status(400).send('Expected array');
  try {
    const inserted = await UsuarioExterno.insertMany(req.body, { ordered:false });
    res.status(201).send(`Inserted ${inserted.length}`);
  } catch(err) {
    if (err.code===11000) return res.status(409).send('Duplicate ID');
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

// -- Contracts
app.post('/contratos', async (req,res) => {
  if (!req.body.numero) return res.status(400).send('Missing numero');
  try {
    await new Contrato({ numero:req.body.numero }).save();
    res.status(201).send('Contract registered');
  } catch(err) {
    if (err.code===11000) return res.status(409).send('Exists');
    res.status(500).send('Server error');
  }
});
app.get('/contratos', async (req,res) => res.json(await Contrato.find().sort({ numero:1 }));

// -- PDF merge
app.post('/merge-pdf', upload.array('pdfs'), async (req,res) => {
  try {
    const merger = new PDFMerger();
    for (const f of req.files) merger.add(f.buffer);
    const merged = await merger.saveAsBuffer();
    res
      .type('application/pdf')
      .set('Content-Disposition','attachment; filename=merged.pdf')
      .send(merged);
  } catch(err) {
    res.status(500).send('PDF merge error');
  }
});

// -- PDF to JPG/ZIP
app.post('/pdf-to-jpg', upload.single('arquivoPdf'), async (req,res) => {
  try {
    const file = req.file;
    if (!file || file.mimetype!=='application/pdf') return res.status(400).send('Invalid PDF');
    const pdfPath = path.join(os.tmpdir(), `pdf_${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, file.buffer);
    const options = { convertFileType:'jpg', convertOptions:{ '-density':'300','-background':'white','-flatten':null,'-strip':null,'-filter':'Lanczos','-resize':'1300','-sharpen':'0x1.0' }};
    const pdfImg = new PDFImage(pdfPath, options);
    const pages = (await pdfParse(file.buffer)).numpages;
    const base = sanitizeFilename(path.basename(file.originalname, '.pdf'));

    if (pages===1) {
      const imgPath = await pdfImg.convertPage(0);
      const imgBuff = fs.readFileSync(imgPath);
      res
        .type('image/jpeg')
        .set('Content-Disposition',`attachment; filename="${base}.jpg"`)
        .send(imgBuff);
      fs.unlinkSync(imgPath);
    } else {
      const zip = new AdmZip();
      for (let i=0;i<pages;i++) {
        const pth = await pdfImg.convertPage(i);
        const buf = fs.readFileSync(pth);
        zip.addFile(`page_${i+1}.jpg`, buf);
        fs.unlinkSync(pth);
      }
      fs.unlinkSync(pdfPath);
      const zipBuff = zip.toBuffer();
      res
        .type('application/zip')
        .set('Content-Disposition','attachment; filename=images.zip')
        .send(zipBuff);
    }
  } catch(err) {
    res.status(500).send('Conversion error');
  }
});

// -- Main email endpoint
app.post('/send-email', authMiddleware, upload.any(), async (req,res) => {
  try {
    const { fluxo, ...dados } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).send('User not found');

    let content = `Fluxo: ${fluxo}\nRequerente: ${user.username}\nEmail: ${user.email}\n`;
    const attachments = [];

    // Handle special fluxo cases...
    // e.g. if (fluxo==='Analise de processo') { ... overwriteDriveFile ... }
    // Attach images, zip, arquivos, PDFs, compress if needed

    // Send mail
    const mailOptions = { from: process.env.EMAIL_USER, to:'jadson.pena@dnit.gov.br', subject:fluxo, text:content, attachments };
    transporter.sendMail(mailOptions, (err,info) => {
      if (err) return res.status(500).send('Mail error');
      res.send('Mail sent');
    });
  } catch(err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// -- Serve dashboard
app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname,'public','dashboard.html'));
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
