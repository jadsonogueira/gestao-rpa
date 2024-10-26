// Define a URL da API com base no ambiente
const apiUrl = window.location.origin;

// Função para exibir mensagens de alerta usando Bootstrap
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

// Verificação de opções válidas
const listaAssinantes = [ /* lista de assinantes */ ];
const listaContratosSei = [ /* lista de contratos SEI */ ];

function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  if (!modalTitle) {
    showAlert('Erro ao abrir o modal: Título não encontrado.', 'danger');
    return;
  }

  modalTitle.innerText = fluxo;
  const fluxoForm = document.getElementById('fluxoForm');
  if (!fluxoForm) {
    showAlert('Erro ao abrir o modal: Formulário não encontrado.', 'danger');
    return;
  }
  fluxoForm.innerHTML = '';

  let campos = [];
  if (fluxo === 'Mudar ordem de documento em um processo SEI') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
      { id: 'instrucoes', placeholder: 'Instruções', type: 'text' },
    ];
  }
  
  // Geração dinâmica dos campos
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
        option.value = opcao.valor;
        option.textContent = opcao.nome;
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
  submitButton.className = 'btn btn-primary btn-block';
  fluxoForm.appendChild(submitButton);

  fluxoForm.onsubmit = enviarFormulario;
  $('#fluxoModal').modal('show');
}

// Função para enviar formulário
async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;
  const dados = {};

  const inputs = e.target.querySelectorAll('input, select');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

  const token = localStorage.getItem('token');
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando...';

  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({ fluxo, dados }),
    });

    const data = await res.text();
    if (res.ok) {
      showAlert('Solicitação enviada com sucesso.', 'success');
    } else {
      showAlert('Erro ao enviar a solicitação: ' + data, 'danger');
    }
  } catch (error) {
    console.error('Erro ao enviar formulário:', error);
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar';
    $('#fluxoModal').modal('hide');
  }
}
