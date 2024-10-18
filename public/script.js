// public/script.js

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

// Definir a lista de assinantes
const listaAssinantes = [
  { valor: 'bruno_medeiros', nome: 'Bruno Moreira de Medeiros' },
  { valor: 'francisco_jailson', nome: 'Francisco Jailson Nascimento dos Santos' },
  { valor: 'jose_joaquim', nome: 'José Joaquim da Silva Júnior' },
  { valor: 'lucas_lasmar', nome: 'Lucas Veloso Facury Lasmar' },
  { valor: 'natalia_battaglini', nome: 'Natália Maria do Carmo Lopes Guimarães Battaglini' },
  { valor: 'wagner_cunha', nome: 'Wagner Ferreira da Cunha' },
];

// Definir a lista de contratos SEI
const listaContratosSei = [
  { valor: '00 00121', nome: '00 00121' },
  { valor: '12 00088', nome: '12 00088' },
  { valor: '12 00101', nome: '12 00101' },
  { valor: '12 00212', nome: '12 00212' },
  { valor: '12 00426', nome: '12 00426' },
  { valor: '12 00449', nome: '12 00449' },
  { valor: '12 00458', nome: '12 00458' },
];

// Cadastro (Signup)
// ... (permanece igual)

// Login
// ... (permanece igual)

// Funções do Dashboard
function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  modalTitle.innerText = fluxo;

  const fluxoForm = document.getElementById('fluxoForm');
  fluxoForm.innerHTML = ''; // Limpa o formulário

  // Define os campos do formulário com base no fluxo
  let campos = [];

  if (fluxo === 'Consultar empenho') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      {
        id: 'contratoSei',
        placeholder: 'Contrato SEI',
        type: 'select',
        options: listaContratosSei,
      },
    ];
  } else if (fluxo === 'Liberar assinatura externa') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      {
        id: 'assinante',
        placeholder: 'Assinante',
        type: 'select',
        options: listaAssinantes,
      },
      { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
    ];
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

  // Adiciona o botão de envio
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block';
  fluxoForm.appendChild(submitButton);

  // Adiciona o evento de submit
  fluxoForm.onsubmit = enviarFormulario;

  // Exibe o modal
  $('#fluxoModal').modal('show');
}

async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;

  const dados = {};

  // Coleta os dados do formulário
  const inputs = e.target.querySelectorAll('input, select');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

  // Se o fluxo for 'Liberar assinatura externa', substituir 'assinante' pelo nome completo
  if (fluxo === 'Liberar assinatura externa') {
    const assinanteSelecionado = listaAssinantes.find(
      (assinante) => assinante.valor === dados.assinante
    );
    dados.assinante = assinanteSelecionado ? assinanteSelecionado.nome : '';
  }

  // Se o fluxo for 'Consultar empenho', ajustar o contrato SEI
  if (fluxo === 'Consultar empenho') {
    const contratoSelecionado = listaContratosSei.find(
      (contrato) => contrato.valor === dados.contratoSei
    );
    dados.contratoSei = contratoSelecionado ? contratoSelecionado.valor : '';
  }

  const token = localStorage.getItem('token');

  // Exibe um indicador de carregamento (opcional)
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
    showAlert('Erro ao enviar o formulário. Tente novamente mais tarde.', 'danger');
  } finally {
    // Oculta o indicador de carregamento
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar';
    // Fecha o modal
    $('#fluxoModal').modal('hide');
  }
}

// Verificar se o usuário está autenticado ao carregar o dashboard
// ... (permanece igual)

// Evento para logout
// ... (permanece igual)
