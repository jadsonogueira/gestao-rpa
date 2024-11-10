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

const fluxoInstrucoes = {
  'Consultar empenho': 'Por favor, preencha todos os campos corretamente.',
  'Liberar assinatura externa': 'Informe o DOC_SEI e escolha um assinante.',
  'Liberar acesso externo': 'Preencha o campo de usuário e processo SEI.',
  'Alterar ordem de documentos': 'Especifique a ordem desejada no processo SEI.',
  'Inserir anexo em Doc SEI': 'Anexe o documento e informe o DOC_SEI.'
};

// Função para abrir o formulário de acordo com o fluxo selecionado
function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const formInstructions = document.getElementById('formInstructions');
  const fluxoForm = document.getElementById('fluxoForm');

  modalTitle.innerText = fluxo;
  formInstructions.textContent = fluxoInstrucoes[fluxo] || 'Por favor, preencha todos os campos.';
  fluxoForm.innerHTML = ''; // Limpa o formulário

  let campos = [];

  if (fluxo === 'Inserir anexo em Doc SEI') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'assinante', placeholder: 'Assinante', type: 'select', options: listaUsuarios },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      { id: 'anexo', placeholder: 'Anexo', type: 'file' }
    ];
  }

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
    } else {
      input = document.createElement('input');
      input.type = campo.type;
      input.id = campo.id;
      input.name = campo.id;
      input.className = 'form-control';
      input.placeholder = campo.placeholder;
      input.required = true;
    }

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fluxoForm.appendChild(formGroup);
  });

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

  const inputs = e.target.querySelectorAll('input, select');
  inputs.forEach((input) => {
    if (input.type === 'file') {
      formData.append(input.id, input.files[0]);
    } else {
      formData.append(input.id, input.value.trim());
    }
  });
  formData.append('fluxo', fluxo);

  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      showAlert('Solicitação enviada com sucesso.', 'success');
    } else {
      showAlert('Erro ao enviar a solicitação.', 'danger');
    }
  } catch (error) {
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
  } finally {
    $('#fluxoModal').modal('hide');
  }
}
