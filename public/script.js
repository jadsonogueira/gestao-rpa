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

// Lista de usuários para os campos de seleção
const listaUsuarios = [
  'Bruno Moreira de Medeiros',
  'Francisco Jailson Nascimento dos Santos',
  'Jadson Nogueira Pena',
  'José Joaquim da Silva Júnior',
  'Lucas Veloso Facury Lasmar',
  'Natália Maria do Carmo Lopes Guimarães Battaglini',
  'Wagner Ferreira da Cunha'
];

const listacontratos = [
  '00 00121',
  '12 00088',
  '12 00101',
  '12 00212',
  '12 00426',
  '12 00449',
  '12 00458',
  '12 00594'
];

// Objeto com instruções específicas para cada fluxo
const fluxoInstrucoes = {
  'Consultar empenho': 'Por favor, preencha todos os campos. Certifique-se de selecionar o contrato SEI correto da lista disponível. Após o processamento, você receberá um email com o resultado da pesquisa.',
  'Liberar assinatura externa': 'Por favor, preencha todos os campos. O número do DOC_SEI deve ser informado no formato numérico (exemplo: 12345678). Envie uma solicitação para cada documento.',
  'Liberar acesso externo': 'Por favor, preencha todos os campos. O número do processo SEI deve seguir o formato: 50600.001234/2024-00.',
  'Alterar ordem de documentos': 'Por favor, preencha todos os campos. No campo de instruções, descreva detalhadamente a ordem desejada dos documentos na árvore do processo SEI digitado.',
  'Inserir imagem em doc SEI': 'Por favor, preencha todos os campos. Escolha o método de upload: imagens individuais ou arquivo ZIP contendo as imagens.'
};

// Função para abrir o formulário de acordo com o fluxo selecionado
function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.querySelector('.modal-body');

  if (!modalTitle || !modalBody) {
    console.error("Erro: Elementos não encontrados.");
    return;
  }

  modalTitle.innerText = fluxo;
  
  // Atualiza as instruções específicas do formulário
  const instrucaoText = document.createElement('p');
  instrucaoText.textContent = fluxoInstrucoes[fluxo] || 'Por favor, preencha todos os campos.';
  
  // Limpa o conteúdo anterior do modal
  modalBody.innerHTML = '';
  modalBody.appendChild(instrucaoText);

  // Cria o formulário
  const fluxoForm = document.createElement('form');
  fluxoForm.id = 'fluxoForm';
  fluxoForm.enctype = 'multipart/form-data';

  modalBody.appendChild(fluxoForm);

  let campos = [];

  if (fluxo === 'Consultar empenho') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'contratoSei', placeholder: 'Contrato SEI', type: 'select', options: listacontratos },
    ];
  } else if (fluxo === 'Liberar assinatura externa') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'assinante', placeholder: 'Assinante', type: 'select', options: listaUsuarios },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
    ];
  } else if (fluxo === 'Liberar acesso externo') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'user', placeholder: 'Usuário', type: 'select', options: listaUsuarios },
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
    ];
  } else if (fluxo === 'Alterar ordem de documentos') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'instrucoes', placeholder: 'Instruções', type: 'textarea' },
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
      // Campo para selecionar o método de upload
      { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP'] },
      // Os inputs de imagem ou zip serão gerados dinamicamente
    ];
  } else if (fluxo === 'Criar Doc SEI Externo') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'numero', placeholder: 'Número', type: 'text' },
      { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
      { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
    ];
  } else {
    console.warn("Fluxo não reconhecido:", fluxo);
    return;
  }

  // Gera os campos do formulário
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

      // Adiciona a opção inicial
      const optionInicial = document.createElement('option');
      optionInicial.value = '';
      optionInicial.disabled = true;
      optionInicial.selected = true;
      optionInicial.textContent = 'Selecione uma opção';
      input.appendChild(optionInicial);

      // Adiciona as opções do select
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

      // Listener para mostrar/ocultar campos com base na seleção
      input.addEventListener('change', function(e) {
        const metodo = e.target.value;
        const imagensContainer = document.getElementById('imagensContainer');
        const zipContainer = document.getElementById('zipContainer');
        const zipInput = document.getElementById('arquivoZip');
        const numeroImagensSelect = document.getElementById('numeroImagens');

        if (metodo === 'Imagens Individuais') {
          // Mostrar campos para imagens individuais
          imagensContainer.style.display = 'block';
          zipContainer.style.display = 'none';

          // Ajusta os campos required
          zipInput.required = false;
          zipInput.value = ''; // Limpa o campo ZIP

          numeroImagensSelect.required = true;

          // Se os inputs de imagem já foram gerados, marca-os como required
          const imageInputs = document.querySelectorAll('#arquivosContainer input[type="file"]');
          imageInputs.forEach(input => {
            input.required = true;
          });
        } else if (metodo === 'Arquivo ZIP') {
          // Mostrar campo para arquivo ZIP
          imagensContainer.style.display = 'none';
          zipContainer.style.display = 'block';

          // Ajusta os campos required
          zipInput.required = true;

          numeroImagensSelect.required = false;
          numeroImagensSelect.value = ''; // Reseta a seleção

          // Remove o required dos inputs de imagem
          const imageInputs = document.querySelectorAll('#arquivosContainer input[type="file"]');
          imageInputs.forEach(input => {
            input.required = false;
            input.value = ''; // Limpa os inputs de imagem
          });
        }
      });

    } else {
      input = document.createElement('input');
      input.type = campo.type;
      input.className = 'form-control';
      input.required = true;
      input.placeholder = campo.placeholder;
    }

    input.id = campo.id;
    input.name = campo.id;

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fluxoForm.appendChild(formGroup);
  });

  // Adiciona os containers para imagens e zip
  // Container para imagens individuais
  const imagensContainer = document.createElement('div');
  imagensContainer.id = 'imagensContainer';
  imagensContainer.style.display = 'none'; // Inicialmente oculto
  fluxoForm.appendChild(imagensContainer);

  // Campo para selecionar o número de imagens
  const numeroImagensGroup = document.createElement('div');
  numeroImagensGroup.className = 'form-group';

  const numeroImagensLabel = document.createElement('label');
  numeroImagensLabel.htmlFor = 'numeroImagens';
  numeroImagensLabel.textContent = 'Número de Imagens';

  const numeroImagensSelect = document.createElement('select');
  numeroImagensSelect.id = 'numeroImagens';
  numeroImagensSelect.name = 'numeroImagens';
  numeroImagensSelect.className = 'form-control';
  numeroImagensSelect.required = false; // Inicialmente não é required

  // Adiciona a opção inicial
  const optionInicial = document.createElement('option');
  optionInicial.value = '';
  optionInicial.disabled = true;
  optionInicial.selected = true;
  optionInicial.textContent = 'Selecione o número de imagens';
  numeroImagensSelect.appendChild(optionInicial);

  // Adiciona as opções de 1 a 100
  for (let i = 1; i <= 100; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    numeroImagensSelect.appendChild(option);
  }

  numeroImagensGroup.appendChild(numeroImagensLabel);
  numeroImagensGroup.appendChild(numeroImagensSelect);
  imagensContainer.appendChild(numeroImagensGroup);

  // Listener para gerar os inputs de arquivo
  numeroImagensSelect.addEventListener('change', function() {
    const numImagens = parseInt(this.value);
    const arquivosContainer = document.getElementById('arquivosContainer');
    // Remove inputs anteriores
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
      input.required = true; // Marca como required

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      arquivosContainer.appendChild(formGroup);
    }
  });

  // Container para os inputs de arquivo
  const arquivosContainer = document.createElement('div');
  arquivosContainer.id = 'arquivosContainer';
  imagensContainer.appendChild(arquivosContainer);

  // Container para o upload do arquivo ZIP
  const zipContainer = document.createElement('div');
  zipContainer.id = 'zipContainer';
  zipContainer.style.display = 'none'; // Inicialmente oculto
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
  zipInput.required = false; // Inicialmente não é required

  zipGroup.appendChild(zipLabel);
  zipGroup.appendChild(zipInput);
  zipContainer.appendChild(zipGroup);

  // Adiciona o indicador de progresso
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress mt-3';
  progressContainer.id = 'uploadProgressContainer';
  progressContainer.style.display = 'none';
  progressContainer.style.height = '20px'; // Define a altura da barra

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.id = 'uploadProgressBar';
  progressBar.role = 'progressbar';
  progressBar.style.width = '0%';
  progressBar.setAttribute('aria-valuenow', '0');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');

  progressContainer.appendChild(progressBar);
  fluxoForm.appendChild(progressContainer);

  // Botão de submit
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block mt-3';
  fluxoForm.appendChild(submitButton);

  // Evento de submit do formulário
  fluxoForm.onsubmit = enviarFormulario;

  $('#fluxoModal').modal('show');
}

// Função para enviar o formulário com indicador de progresso
function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;

  const formData = new FormData();

  // Inclui o fluxo no formData
  formData.append('fluxo', fluxo);

  // Coleta todos os inputs, inclusive os inputs de arquivo dinâmicos
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

  // Exibe o indicador de progresso
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressBar.setAttribute('aria-valuenow', '0');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${apiUrl}/send-email`);

  xhr.upload.addEventListener('progress', function (e) {
    console.log('Evento de progresso disparado:', e);
    if (e.lengthComputable) {
      const percentCompleted = Math.round((e.loaded * 100) / e.total);
      progressBar.style.width = percentCompleted + '%';
      progressBar.setAttribute('aria-valuenow', percentCompleted);
      console.log(`Progresso: ${percentCompleted}%`);
    } else {
      console.log('Não é possível computar o progresso');
    }
  });
  

  xhr.onload = function () {
    progressContainer.style.display = 'none';
    const data = xhr.responseText;
    if (xhr.status === 200) {
      showAlert('Solicitação enviada com sucesso.', 'success');
    } else {
      showAlert(`Erro ao enviar a solicitação: ${data}`, 'danger');
    }
    $('#fluxoModal').modal('hide');
  };

  xhr.onerror = function () {
    progressContainer.style.display = 'none';
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
    $('#fluxoModal').modal('hide');
  };

  xhr.send(formData);
}

// Torna as funções globais para serem acessíveis no HTML
window.abrirFormulario = abrirFormulario;
