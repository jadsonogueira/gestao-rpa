// Define a URL da API com base no ambiente
const apiUrl = 'https://gestao-rpa.onrender.com';

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

async function buscarUsuariosExternos() {
  try {
    const response = await fetch(`${apiUrl}/usuarios-externos`);
    const usuarios = await response.json();
    return usuarios.map(u => u.nome); // retorna só os nomes
  } catch (error) {
    console.error('Erro ao buscar usuários externos:', error);
    return []; // retorna lista vazia em caso de erro
  }
}

async function buscarContratos() {
  try {
    const response = await fetch(`${apiUrl}/contratos`);
    const contratos = await response.json();
    return contratos.map(c => c.numero);
  } catch (error) {
    console.error('Erro ao buscar contratos:', error);
    return [];
  }
}

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
  'Analise de processo': 'Preencha os campos para análise do processo SEI.'
  'Unir PDFs': 'Selecione dois ou mais arquivos PDF para unir em um único documento.',
};

// Função para abrir o modal e gerar o formulário
async function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.querySelector('.modal-body');
  if (!modalTitle || !modalBody) {
    console.error("Elementos do modal não encontrados.");
    return;
  }
  modalTitle.innerText = fluxo;

  // Busca usuários externos se necessário
  let listaUsuarios = [];
  if (fluxo === 'Liberar assinatura externa' || fluxo === 'Liberar acesso externo') {
    listaUsuarios = await buscarUsuariosExternos();
  }

  let listaContratos = [];
  if (fluxo === 'Consultar empenho') {
    listaContratos = await buscarContratos();
  }
  
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
  if (fluxo === 'Liberar assinatura externa') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' }, // vírgula corrigida aqui ✅
      { id: 'assinante', placeholder: 'Assinante', type: 'select', options: listaUsuarios },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
    ];
    } else if (fluxo === 'Consultar empenho') {
  campos = [
    { id: 'requerente', placeholder: 'Requerente', type: 'text' },
    { id: 'email', placeholder: 'Email', type: 'email' },
    { id: 'contratoSei', placeholder: 'Contrato SEI', type: 'select', options: listaContratos },
  ];
   } else if (fluxo === 'Liberar acesso externo') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'user', placeholder: 'Usuário', type: 'select', options: listaUsuarios },
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
    ];
  } else if (fluxo === 'Analise de processo') {
  campos = [
    { id: 'requerente', placeholder: 'Requerente', type: 'text' },
    { id: 'email', placeholder: 'Email', type: 'email' },
    { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
    { id: 'memoriaCalculo', placeholder: 'Memória de Cálculo (PDF)', type: 'file', accept: '.pdf' },
    { id: 'diarioObra', placeholder: 'Diário de Obra (PDF)', type: 'file', accept: '.pdf' },
    { id: 'relatorioFotografico', placeholder: 'Relatório Fotográfico (PDF)', type: 'file', accept: '.pdf' },
  ];
  } else if (fluxo === 'Inserir anexo em doc SEI') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
    ];
  } else if (fluxo === 'Inserir imagem em doc SEI') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
    ];
  } else if (fluxo === 'Assinatura em doc SEI') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'user', placeholder: 'Usuário', type: 'text' },
      { id: 'key', placeholder: 'Senha', type: 'text' },
    ];
  } else if (fluxo === 'Criar Doc SEI Externo') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'tipoDocumento', placeholder: 'Tipo do Documento', type: 'text' },
      { id: 'dataFormatada', placeholder: 'Data', type: 'date' },
      { id: 'numero', placeholder: 'Número', type: 'text' },
      { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
      { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
    ];
  } else if (fluxo === 'Criar Doc SEI Editável') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { 
        id: 'tipoDocumento', 
        placeholder: 'Tipo do Documento', 
        type: 'select', 
        options: ['Planilha', 'Nota(s) Fiscal(is)', 'Curva S','Diário de Obras', 'Boletim de Desempenho Parcial - Medições']
      },
      { id: 'numero', placeholder: 'Número', type: 'text' },
      { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
      { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
    ];

    } else if (fluxo === 'Unir PDFs') {
  campos = [
    { id: 'pdfs', placeholder: 'Selecione os arquivos PDF', type: 'file', accept: '.pdf', multiple: true }
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
      input.required = true;

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
      input.required = true;
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
      input.required = true;
      input.placeholder = campo.placeholder;
      if (campo.multiple) input.multiple = true;
      if (campo.accept) input.accept = campo.accept;
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

function enviarFormularioAxios(e) {
  e.preventDefault();
  showLoadingOverlay();

  const fluxo = document.getElementById('modalTitle').innerText;

  const formData = new FormData();
  formData.append('fluxo', fluxo);

  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    if (input.type === 'file' && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        formData.append(input.name, input.files[i]);
      }
    } else if (input.type !== 'file' && input.type !== 'radio') {
      formData.append(input.name, input.value.trim());
    } else if (input.type === 'radio' && input.checked) {
      formData.append(input.name, input.value);
    }
  });

  // 🚨 Se for o fluxo de Unir PDFs, envia para /merge-pdf
  if (fluxo === 'Unir PDFs') {
    axios.post(`${apiUrl}/merge-pdf`, formData, { responseType: 'blob' })
      .then(response => {
        hideLoadingOverlay();

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();

        showAlert('PDFs unidos com sucesso!', 'success');
        $('#fluxoModal').modal('hide');
      })
      .catch(error => {
        hideLoadingOverlay();
        const msg = error.response?.data || error.message;
        showAlert(`Erro ao unir PDFs: ${msg}`, 'danger');
        $('#fluxoModal').modal('hide');
      });

    return; // impede que outros fluxos sejam executados
  }

  // Todos os outros fluxos seguem normalmente para /send-email
  axios.post(`${apiUrl}/send-email`, formData)
    .then(response => {
      hideLoadingOverlay();
      if (response.status === 200) {
        showAlert('Solicitação enviada com sucesso.', 'success');
      } else {
        showAlert(`Erro ao enviar a solicitação: ${response.data}`, 'danger');
      }
      $('#fluxoModal').modal('hide');
    })
    .catch(error => {
      hideLoadingOverlay();
      const msg = error.response?.data || error.message;
      showAlert(`Erro ao enviar: ${msg}`, 'danger');
      $('#fluxoModal').modal('hide');
    });
}

// Expõe a função abrirFormulario no escopo global (para o HTML)
window.abrirFormulario = abrirFormulario;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      try {
        const response = await fetch(`${apiUrl}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });

        const msg = await response.text();

        if (response.ok) {
          showAlert('✅ Usuário cadastrado com sucesso!', 'success');
          form.reset();
        } else {
          showAlert('❌ Erro no cadastro: ' + msg, 'danger');
        }
      } catch (err) {
        showAlert('❌ Erro na conexão com o servidor.', 'danger');
        console.error(err);
      }
    });
  }
});
