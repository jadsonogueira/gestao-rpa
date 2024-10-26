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


// Função para abrir o formulário de acordo com o fluxo selecionado
function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const fluxoForm = document.getElementById('fluxoForm');

  if (!modalTitle || !fluxoForm) {
    console.error("Erro: Elementos 'modalTitle' ou 'fluxoForm' não encontrados.");
    return;
  }

  modalTitle.innerText = fluxo;
  fluxoForm.innerHTML = ''; // Limpa o formulário

  let campos = [];

  if (fluxo === 'Consultar empenho') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'contratoSei', placeholder: 'Contrato SEI', type: 'text' },
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
      { id: 'assinante', placeholder: 'Assinante', type: 'select', options: listaUsuarios },
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
    ];
  } else if (fluxo === 'Alterar ordem de documentos') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'instrucoes', placeholder: 'Instruções', type: 'textarea' },
    ];
  } else {
    console.warn("Fluxo não reconhecido:", fluxo);
    return;
  }

  campos.forEach((campo) => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.htmlFor = campo.id;
    label.textContent = campo.placeholder;

    let input;
    if (campo.type === 'textarea') {
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

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block';
  fluxoForm.appendChild(submitButton);

  fluxoForm.onsubmit = enviarFormulario;

  $('#fluxoModal').modal('show');
}

// Função para enviar o formulário
async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle')?.innerText;

  if (!fluxo) {
    console.error("Erro: Título do fluxo não encontrado.");
    return;
  }

  const dados = {};
  const inputs = e.target.querySelectorAll('input, textarea');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fluxo, dados }),
    });

    const data = await res.text();
    if (res.ok) {
      showAlert('Solicitação enviada com sucesso.', 'success');
    } else {
      showAlert(`Erro ao enviar a solicitação: ${data}`, 'danger');
      console.error("Erro ao enviar a solicitação:", data);
    }
  } catch (error) {
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
    console.error("Erro ao enviar o formulário:", error);
  } finally {
    $('#fluxoModal').modal('hide');
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
        option.value = opcao.valor;
        option.textContent = opcao.nome;
        input.appendChild(option);
      });
    } else if (campo.type === 'textarea') {
      input = document.createElement('textarea');
      input.id = campo.id;
      input.name = campo.id;
      input.className = 'form-control';
      input.placeholder = campo.placeholder;
      input.required = true;
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

  // Adiciona o botão de envio
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block';
  fluxoForm.appendChild(submitButton);

  // Define a função de envio para o formulário
  fluxoForm.onsubmit = enviarFormulario;

  // Exibe o modal
  $('#fluxoModal').modal('show');
}

// Função para enviar o formulário
async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;

  const dados = {};
  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

  // Envio dos dados para a API
  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fluxo, dados })
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
