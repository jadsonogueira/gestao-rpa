app.post('/send-email', upload.single('anexo'), (req, res) => {
  try {
    console.log('Body recebido:', req.body);
    console.log('Arquivo recebido:', req.file);
    
    const { fluxo } = req.body;
    
    // Verifica se dados existe
    if (!req.body.dados) {
      console.error('Campo dados não encontrado no body');
      return res.status(400).send('Campo dados é obrigatório');
    }

    let dados;
    try {
      dados = JSON.parse(req.body.dados);
    } catch (error) {
      console.error('Erro ao fazer parse dos dados:', error);
      return res.status(400).send('Formato de dados inválido');
    }

    if (!dados.email) {
      console.error('Email não encontrado nos dados');
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
    } else if (fluxo === 'Alterar ordem de documentos') {
      mailContent += `Número do Processo SEI: ${dados.processoSei || ''}\n`;
      mailContent += `Instruções: ${dados.instrucoes || ''}\n`;
    } else if (fluxo === 'Inserir anexo em doc SEI') {
      mailContent += `Número do DOC_SEI: ${dados.numeroDocSei || ''}\n`;
    }

    // Verifica se as variáveis de ambiente existem
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Credenciais de email não configuradas');
      return res.status(500).send('Erro na configuração do servidor de email');
    }

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
      attachments: req.file
        ? [{
            filename: req.file.originalname,
            path: req.file.path
          }]
        : []
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Erro ao deletar o arquivo:', err);
        });
      }

      if (error) {
        console.error('Erro ao enviar o e-mail:', error);
        return res.status(500).send('Erro ao enviar o e-mail: ' + error.message);
      }

      console.log('Email enviado com sucesso:', info);
      res.send('E-mail enviado com sucesso');
    });

  } catch (error) {
    console.error('Erro geral na rota:', error);
    res.status(500).send(`Erro no servidor: ${error.message}`);
  }
});