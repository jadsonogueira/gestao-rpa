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
  'Inserir imagem em doc SEI': 'Por favor, preencha todos os campos. Selecione o número de imagens que deseja inserir e faça o upload dos arquivos correspondentes.'
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
      { id: 'numeroImagens', placeholder: 'Número de Imagens', type: 'select', options: Array.from({ length: 31 }, (_, i) => i + 1) },
      // Os inputs de imagem serão gerados dinamicamente
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

      // Se o campo for 'numeroImagens', adiciona o listener para gerar os inputs de arquivo
      if (campo.id === 'numeroImagens') {
        input.addEventListener('change', function() {
          const numImagens = parseInt(this.value);
          const imagensContainer = document.getElementById('imagensContainer');
          // Remove inputs anteriores
          imagensContainer.innerHTML = '';
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
            imagensContainer.appendChild(formGroup);
          }
        });
      }

    } else if (campo.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = campo.type;
    }

    input.id = campo.id;
    input.name = campo.id;
    input.className = 'form-control';
    input.placeholder = campo.placeholder;
    input.required = true;

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fluxoForm.appendChild(formGroup);
  });

  // Se o fluxo for 'Inserir imagem em doc SEI', adiciona o container para as imagens
  if (fluxo === 'Inserir imagem em doc SEI') {
    const imagensContainer = document.createElement('div');
    imagensContainer.id = 'imagensContainer';
    fluxoForm.appendChild(imagensContainer);
  }

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block mt-3';
  fluxoForm.appendChild(submitButton);

  fluxoForm.onsubmit = enviarFormulario;

  $('#fluxoModal').modal('show');
}

// Função para enviar o formulário
async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;

  const formData = new FormData();

  // Inclui o fluxo no formData
  formData.append('fluxo', fluxo);

  // Coleta todos os inputs, inclusive os inputs de arquivo dinâmicos
  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    if (input.type === 'file' && input.files.length > 0) {
      formData.append(input.name, input.files[0]);
    } else if (input.type !== 'file') {
      formData.append(input.name, input.value.trim());
    }
  });

  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.text();
    if (res.ok) {
      showAlert('Solicitação enviada com sucesso.', 'success');
    } else {
      showAlert(`Erro ao enviar a solicitação: ${data}`, 'danger');
    }
  } catch (error) {
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
  } finally {
    $('#fluxoModal').modal('hide');
  }
}
