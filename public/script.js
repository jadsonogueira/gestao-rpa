// Define a URL da API com base no ambiente
const apiUrl = window.location.origin;

// Função para exibir alertas
function showAlert(message, type = 'success') {
  const alertPlaceholder = document.getElementById('alertPlaceholder');
  if (alertPlaceholder) {
    alertPlaceholder.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Fechar">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    `;
  } else {
    alert(message);
  }
}

// Funções para mostrar/esconder o overlay "Aguarde"
function showLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex'; // "flex" para centralizar o conteúdo
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Listas para seleção
const listaUsuarios = [
  'Antônio Sílvio Rabelo Neto',
  'Bruno Moreira de Medeiros',
  'Bruno Zafalon Martins Ferreira',
  'Francisco Jailson Nascimento dos Santos',
  'José Joaquim da Silva Júnior',
  'Lucas Veloso Facury Lasmar',
  'Natália Maria do Carmo Lopes Guimarães Battaglini',
  'Pablo Garcia Fernandes de Souza',
  'Rodrigo Emanuel Tahan',
  'Wagner Ferreira da Cunha'
];

const listacontratos = [
  '00 00121',
  '12 00121',
  '12 00088',
  '12 00101',
  '12 00212',
  '12 00426',
  '12 00449',
  '12 00458',
  '12 00594'
];

// Instruções específicas para cada fluxo
const fluxoInstrucoes = {
  'Consultar empenho': 'Preencha os campos e selecione o contrato SEI correto. Você receberá um email com o resultado.',
  'Liberar assinatura externa': 'Informe os dados e o número do DOC_SEI no formato numérico (ex.: 12345678).',
  'Liberar acesso externo': 'Preencha os campos. O número do processo SEI deve estar no formato: 50600.001234/2024-00.',
  'Alterar ordem de documentos': 'Informe o número do processo SEI e descreva detalhadamente a ordem desejada.',
  'Inserir anexo em doc SEI': 'Preencha os campos e anexe o arquivo.',
  'Inserir imagem em doc SEI': 'Escolha o método de upload: Imagens Individuais, Arquivo ZIP ou PDF para JPG.',
  'Assinatura em doc SEI': 'Preencha os dados para assinar o Doc SEI.',
  'Criar Doc SEI Externo': 'Crie um documento SEI do tipo EXTERNO.',
  'Criar Doc SEI Editável': 'Crie um documento SEI do tipo Editável.',
  'Analise de processo': 'Preencha os campos para análise do processo SEI.',
  'Unir PDFs': 'Selecione dois ou mais arquivos PDF para juntá-los em um único documento.',
  'PDF para JPG': 'Selecione um PDF. Cada página será convertida em uma imagem JPG.',
  // ✅ Novo
  'Dividir PDF': 'Selecione um PDF e, opcionalmente, informe faixas (ex.: 1-3,5,7-9). Se não informar, dividiremos página a página.'
};

// Função para abrir o modal e gerar o formulário
function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.querySelector('.modal-body');
  if (!modalTitle || !modalBody) {
    console.error("Elementos do modal não encontrados.");
    return;
  }
  modalTitle.innerText = fluxo;

  // Instruções
  const instrucaoText = document.createElement('p');
  instrucaoText.textContent = fluxoInstrucoes[fluxo] || 'Preencha todos os campos.';
  
  modalBody.innerHTML = '';
  modalBody.appendChild(instrucaoText);

  // Criação do formulário
  const fluxoForm = document.createElement('form');
  fluxoForm.id = 'fluxoForm';
  fluxoForm.enctype = 'multipart/form-data';
  modalBody.appendChild(fluxoForm);

  // Define os campos de acordo com o fluxo
  let campos = [];
  if (fluxo === 'Consultar empenho') {
    campos = [
      { id: 'contratoSei', placeholder: 'Contrato SEI', type: 'select', options: listacontratos },
    ];
  } else if (fluxo === 'Liberar assinatura externa') {
    campos = [
      { id: 'assinante', placeholder: 'Assinante', type: 'select', options: listaUsuarios },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
    ];
  } else if (fluxo === 'Liberar acesso externo') {
    campos = [
      { id: 'user', placeholder: 'Usuário', type: 'select', options: listaUsuarios },
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
    ];
  } else if (fluxo === 'Analise de processo') {
    campos = [
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'memoriaCalculo', placeholder: 'Memória de Cálculo (PDF)', type: 'file', accept: 'application/pdf' },
      { id: 'diarioObra', placeholder: 'Diário de Obra (PDF)', type: 'file', accept: 'application/pdf' },
      { id: 'relatorioFotografico', placeholder: 'Relatório Fotográfico (PDF)', type: 'file', accept: 'application/pdf' }
    ];
  } else if (fluxo === 'Alterar ordem de documentos') {
    campos = [
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'instrucoes', placeholder: 'Instruções', type: 'textarea' },
    ];
  } else if (fluxo === 'Inserir anexo em doc SEI') {
    campos = [
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
    ];
  } else if (fluxo === 'Inserir imagem em doc SEI') {
    campos = [
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
    ];
  } else if (fluxo === 'Assinatura em doc SEI') {
    campos = [
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'user', placeholder: 'Usuário', type: 'text' },
      { id: 'key', placeholder: 'Senha', type: 'text' },
    ];
  } else if (fluxo === 'Unir PDFs') {
    campos = [
      { id: 'pdfs', placeholder: 'Arquivos PDF para unir', type: 'file', accept: '.pdf', multiple: true }
    ];
  } else if (fluxo === 'PDF para JPG') {
    campos = [
      { id: 'arquivoPdf', placeholder: 'Selecione o arquivo PDF', type: 'file', accept: '.pdf' }
    ];
  // ✅ Novo fluxo: Dividir PDF
  } else if (fluxo === 'Dividir PDF') {
    campos = [
      { id: 'pdf', placeholder: 'Selecione o arquivo PDF', type: 'file', accept: '.pdf' }, // nome "pdf" para bater com o backend
      { id: 'ranges', placeholder: 'Faixas (ex.: 1-3,5,7-9) — opcional', type: 'text', required: false }
    ];
  } else if (fluxo === 'Criar Doc SEI Externo') {
    campos = [
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'tipoDocumento', placeholder: 'Tipo do Documento', type: 'text' },
      { id: 'dataFormatada', placeholder: 'Data', type: 'date' },
      { id: 'numero', placeholder: 'Número', type: 'text' },
      { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
      { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
    ];
  } else if (fluxo === 'Criar Doc SEI Editável') {
    campos = [
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { 
        id: 'tipoDocumento', 
        placeholder: 'Tipo do Documento', 
        type: 'select', 
        options: ['Planilha', 'Nota(s) Fiscal(is)', 'Curva S','Diário de Obras', 'Boletim de Desempenho Parcial - Medições']
      },
      { id: 'numero', placeholder: 'Número', type: 'text', value: '-' },
      { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
      { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
    ];
  } else {
    console.warn("Fluxo não reconhecido:", fluxo);
    return;
  }

  // Cria os campos dinamicamente
  campos.forEach((campo) => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.htmlFor = campo.id;
    label.textContent = campo.placeholder;

    let input;
    if (campo.type === 'select') {
      input = document.createElement('select');
      input.id = campo.id;
      input.name = campo.id;
      input.className = 'form-control';
      input.required = campo.required !== false;

      const optionInicial = document.createElement('option');
      optionInicial.value = '';
      optionInicial.disabled = true;
      optionInicial.selected = true;
      optionInicial.textContent = 'Selecione uma opção';
      input.appendChild(optionInicial);

      campo.options.forEach((opcao) => {
        const option = document.createElement('option');
        option.value = opcao;
        option.textContent = opcao;
        input.appendChild(option);
      });
    } else if (campo.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
      input.className = 'form-control';
      input.required = campo.required !== false;
      input.placeholder = campo.placeholder;
    } else if (campo.type === 'radio') {
      input = document.createElement('div');
      input.id = campo.id;
      campo.options.forEach((optionText, index) => {
        const optionId = `${campo.id}_${index}`;
        const radioDiv = document.createElement('div');
        radioDiv.className = 'form-check';

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.id = optionId;
        radioInput.name = campo.id;
        radioInput.value = optionText;
        radioInput.className = 'form-check-input';
        radioInput.required = true;

        const radioLabel = document.createElement('label');
        radioLabel.htmlFor = optionId;
        radioLabel.className = 'form-check-label';
        radioLabel.textContent = optionText;

        radioDiv.appendChild(radioInput);
        radioDiv.appendChild(radioLabel);
        input.appendChild(radioDiv);
      });

      // Listener para exibir containers (Imagens, ZIP, PDF) dependendo do método
      input.addEventListener('change', function(e) {
        const metodo = e.target.value;
        const imagensContainer = document.getElementById('imagensContainer');
        const zipContainer = document.getElementById('zipContainer');
        const pdfContainer = document.getElementById('pdfContainer');
        const zipInput = document.getElementById('arquivoZip');
        const numeroImagensSelect = document.getElementById('numeroImagens');
        const pdfInput = document.getElementById('arquivoPdf');

        if (metodo === 'Imagens Individuais') {
          imagensContainer.style.display = 'block';
          zipContainer.style.display = 'none';
          pdfContainer.style.display = 'none';
          zipInput.required = false;
          zipInput.value = '';
          numeroImagensSelect.required = true;
          if (pdfInput) {
            pdfInput.required = false;
            pdfInput.value = '';
          }
          const imageInputs = document.querySelectorAll('#arquivosContainer input[type="file"]');
          imageInputs.forEach(inp => inp.required = true);
        } else if (metodo === 'Arquivo ZIP') {
          imagensContainer.style.display = 'none';
          zipContainer.style.display = 'block';
          pdfContainer.style.display = 'none';
          zipInput.required = true;
          numeroImagensSelect.required = false;
          numeroImagensSelect.value = '';
          if (pdfInput) {
            pdfInput.required = false;
            pdfInput.value = '';
          }
          const imageInputs = document.querySelectorAll('#arquivosContainer input[type="file"]');
          imageInputs.forEach(inp => { inp.required = false; inp.value = ''; });
        } else if (metodo === 'PDF para JPG') {
          imagensContainer.style.display = 'none';
          zipContainer.style.display = 'none';
          pdfContainer.style.display = 'block';
          zipInput.required = false;
          zipInput.value = '';
          numeroImagensSelect.required = false;
          numeroImagensSelect.value = '';
          const imageInputs = document.querySelectorAll('#arquivosContainer input[type="file"]');
          imageInputs.forEach(inp => { inp.required = false; inp.value = ''; });
          if (pdfInput) pdfInput.required = true;
        }
      });
    } else {
      // input padrão (text, email, file, etc.)
      input = document.createElement('input');
      input.type = campo.type;
      input.className = 'form-control';
      input.required = campo.required !== false;
      input.placeholder = campo.placeholder;
      if (campo.multiple) input.multiple = true;
      if (campo.accept) input.accept = campo.accept;
      if (campo.value) input.value = campo.value;
    }

    input.id = campo.id;
    input.name = campo.id;
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fluxoForm.appendChild(formGroup);
  });

  // Container para Imagens Individuais
  const imagensContainer = document.createElement('div');
  imagensContainer.id = 'imagensContainer';
  imagensContainer.style.display = 'none';
  fluxoForm.appendChild(imagensContainer);

  const numeroImagensGroup = document.createElement('div');
  numeroImagensGroup.className = 'form-group';
  const numeroImagensLabel = document.createElement('label');
  numeroImagensLabel.htmlFor = 'numeroImagens';
  numeroImagensLabel.textContent = 'Número de Imagens';

  const numeroImagensSelect = document.createElement('select');
  numeroImagensSelect.id = 'numeroImagens';
  numeroImagensSelect.name = 'numeroImagens';
  numeroImagensSelect.className = 'form-control';
  numeroImagensSelect.required = false;

  const optionInicial = document.createElement('option');
  optionInicial.value = '';
  optionInicial.disabled = true;
  optionInicial.selected = true;
  optionInicial.textContent = 'Selecione o número de imagens';
  numeroImagensSelect.appendChild(optionInicial);

  for (let i = 1; i <= 100; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    numeroImagensSelect.appendChild(option);
  }

  numeroImagensGroup.appendChild(numeroImagensLabel);
  numeroImagensGroup.appendChild(numeroImagensSelect);
  imagensContainer.appendChild(numeroImagensGroup);

  numeroImagensSelect.addEventListener('change', function() {
    const numImagens = parseInt(this.value);
    const arquivosContainer = document.getElementById('arquivosContainer');
    arquivosContainer.innerHTML = '';
    for (let i = 1; i <= numImagens; i++) {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';

      const label = document.createElement('label');
      label.htmlFor = 'imagem' + i;
      label.textContent = 'Imagem ' + i;

      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'imagem' + i;
      input.name = 'imagem' + i;
      input.className = 'form-control-file';
      input.accept = 'image/*';
      input.required = true;

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      arquivosContainer.appendChild(formGroup);
    }
  });

  const arquivosContainer = document.createElement('div');
  arquivosContainer.id = 'arquivosContainer';
  imagensContainer.appendChild(arquivosContainer);

  // Container para ZIP
  const zipContainer = document.createElement('div');
  zipContainer.id = 'zipContainer';
  zipContainer.style.display = 'none';
  fluxoForm.appendChild(zipContainer);

  const zipGroup = document.createElement('div');
  zipGroup.className = 'form-group';
  const zipLabel = document.createElement('label');
  zipLabel.htmlFor = 'arquivoZip';
  zipLabel.textContent = 'Selecione o arquivo ZIP';

  const zipInput = document.createElement('input');
  zipInput.type = 'file';
  zipInput.id = 'arquivoZip';
  zipInput.name = 'arquivoZip';
  zipInput.className = 'form-control-file';
  zipInput.accept = '.zip';
  zipInput.required = false;

  zipGroup.appendChild(zipLabel);
  zipGroup.appendChild(zipInput);
  zipContainer.appendChild(zipGroup);

  // Container para PDF
  const pdfContainer = document.createElement('div');
  pdfContainer.id = 'pdfContainer';
  pdfContainer.style.display = 'none';
  fluxoForm.appendChild(pdfContainer);

  const pdfGroup = document.createElement('div');
  pdfGroup.className = 'form-group';
  const pdfLabel = document.createElement('label');
  pdfLabel.htmlFor = 'arquivoPdf';
  pdfLabel.textContent = 'Selecione o(s) arquivo(s) PDF';

  const pdfInput = document.createElement('input');
  pdfInput.type = 'file';
  pdfInput.id = 'arquivoPdf';
  pdfInput.name = 'arquivoPdf';
  pdfInput.className = 'form-control-file';
  pdfInput.accept = '.pdf';
  pdfInput.required = false;

  pdfGroup.appendChild(pdfLabel);
  pdfGroup.appendChild(pdfInput);
  pdfContainer.appendChild(pdfGroup);

  // Botão de submit
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block mt-3';
  fluxoForm.appendChild(submitButton);

  // Evento de submit do formulário
  fluxoForm.onsubmit = enviarFormularioAxios;

  // Abre o modal
  $('#fluxoModal').modal('show');
}

// Envia o formulário usando Axios, com overlay "Aguarde"
function enviarFormularioAxios(e) {
  e.preventDefault();

  // Exibe overlay de "Processando, aguarde..."
  showLoadingOverlay();

  const fluxo = document.getElementById('modalTitle').innerText;
  const formData = new FormData();
  formData.append('fluxo', fluxo);

  // Coleta inputs do form
  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    if (input.type === 'file' && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        const keyName = input.name; // importante: "pdf" no Dividir PDF, "pdfs" no Unir
        formData.append(keyName, input.files[i]);
      }
    } else if (input.type !== 'file' && input.type !== 'radio') {
      formData.append(input.name, (input.value || '').trim());
    } else if (input.type === 'radio' && input.checked) {
      formData.append(input.name, input.value);
    }
  });

  const url = fluxo === 'Unir PDFs'
    ? `${apiUrl}/merge-pdf`
    : fluxo === 'PDF para JPG'
    ? `${apiUrl}/pdf-to-jpg`
    : fluxo === 'Dividir PDF'
    ? `${apiUrl}/split-pdf`
    : `${apiUrl}/send-email`;

  const responseType = (fluxo === 'Unir PDFs' || fluxo === 'PDF para JPG' || fluxo === 'Dividir PDF')
    ? 'blob'
    : 'json';
  
  const token = localStorage.getItem('token');

 axios.post(url, formData, {
  responseType,
  headers: { Authorization: `Bearer ${token}` }
})
.then(response => {
  hideLoadingOverlay();

  if (['Unir PDFs', 'PDF para JPG', 'Dividir PDF'].includes(fluxo)) {
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // 1) tenta pegar o nome do header
    const cd = response.headers['content-disposition'] || '';
    let filename = null;
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
    if (m) {
      try { filename = decodeURIComponent(m[1] || m[2]); }
      catch { filename = (m[1] || m[2]); }
    }

    // 2) fallbacks por fluxo
    if (!filename) {
      if (fluxo === 'Unir PDFs') {
        const first = e.target.querySelector('input[name="pdfs"]')?.files?.[0]?.name || 'merged.pdf';
        filename = first.replace(/\.[^.]+$/, '') + '_merge.pdf';
      } else if (fluxo === 'Dividir PDF') {
        const first = e.target.querySelector('input[name="pdf"]')?.files?.[0]?.name || 'split.zip';
        filename = first.replace(/\.[^.]+$/, '') + '_split.zip';
      } else if (fluxo === 'PDF para JPG') {
        const base = (e.target.querySelector('input[name="arquivoPdf"]')?.files?.[0]?.name || 'arquivo').replace(/\.pdf$/i, '');
        filename = contentType.includes('zip') ? `${base}.zip` : `${base}.jpg`;
      } else {
        const ext = contentType.includes('pdf') ? 'pdf'
                 : contentType.includes('zip') ? 'zip'
                 : contentType.includes('jpeg') ? 'jpg'
                 : 'bin';
        filename = `resultado.${ext}`;
      }
    }

    // 3) baixa com o nome certo
    const blob = new Blob([response.data], { type: contentType });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);

    showAlert(`✅ Operação concluída com sucesso! Arquivo: ${filename}`, 'success');
  } else {
    showAlert('✅ Solicitação enviada com sucesso.', 'success');
  }

})
.catch(error => {
  hideLoadingOverlay();
  console.error('Erro ao enviar:', error);
  showAlert('❌ Ocorreu um erro no envio do formulário.', 'danger');
})
.finally(() => {
  $('#fluxoModal').modal('hide');
});
}
  

// Expõe a função abrirFormulario no escopo global (para o HTML)
window.abrirFormulario = abrirFormulario;
