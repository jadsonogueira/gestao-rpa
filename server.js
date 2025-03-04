const fs = require('fs');
const os = require('os');
const pdfPoppler = require('pdf-poppler'); // Biblioteca para converter PDF em imagem

// Rota para envio de e-mails com conversão de PDF para JPG
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

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'jadson.pena@dnit.gov.br', // Ajuste o destinatário conforme necessário
      subject: `${fluxo}`,
      text: mailContent,
    };

    const attachments = [];

    // Processar os arquivos enviados
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname === 'arquivo') {
          if (file.mimetype === 'application/pdf') {
            // Criar diretório temporário para conversão
            const tempDir = fs.mkdtempSync(os.tmpdir() + path.sep);
            const pdfPath = path.join(tempDir, file.originalname);
            const outputPath = path.join(tempDir, 'converted');

            // Salvar o PDF temporariamente
            fs.writeFileSync(pdfPath, file.buffer);

            // Configuração da conversão PDF para JPG
            const opts = {
              format: 'jpeg',
              out_dir: tempDir,
              out_prefix: 'converted',
              page: null, // Converte todas as páginas
            };

            try {
              // Converter PDF para JPG
              await pdfPoppler.convert(pdfPath, opts);

              // Adicionar todas as imagens convertidas aos anexos
              const convertedImages = fs.readdirSync(tempDir).filter((f) => f.endsWith('.jpg'));
              for (const img of convertedImages) {
                attachments.push({
                  filename: img,
                  path: path.join(tempDir, img),
                });
              }

              console.log(`PDF convertido com sucesso: ${convertedImages.length} imagens geradas.`);
            } catch (conversionError) {
              console.error('Erro ao converter PDF:', conversionError);
              return res.status(500).send('Erro ao converter PDF para imagem.');
            }
          } else {
            // Caso não seja um PDF, anexar o arquivo normalmente
            attachments.push({
              filename: file.originalname,
              content: file.buffer,
            });
          }
        }
      }
    }

    // Verificar se há anexos para adicionar
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    // Enviar e-mail
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
