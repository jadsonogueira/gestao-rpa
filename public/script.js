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

// Cadastro (Signup)
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Validação simples
    if (!username || !password) {
      showAlert('Por favor, preencha todos os campos.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.text();
      if (res.ok) {
        showAlert('Usuário registrado com sucesso. Redirecionando para a página de login...', 'success');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      } else {
        showAlert(data || 'Erro ao registrar. Tente novamente mais tarde.', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao registrar. Tente novamente mais tarde.', 'danger');
    }
  });
}

// Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Validação simples
    if (!username || !password) {
      showAlert('Por favor, preencha todos os campos.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        showAlert('Login bem-sucedido. Redirecionando para o dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      } else {
        showAlert(data || 'Usuário ou senha incorretos.', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao fazer login. Tente novamente mais tarde.', 'danger');
    }
  });
}

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
      { id: 'contratoSei', placeholder: 'Contrato SEI', type: 'text' },
    ];
  } else if (fluxo === 'Liberar assinatura externa') {
    campos = [
      { id: 'requerente', placeholder: 'Requerente', type: 'text' },
      { id: 'email', placeholder: 'Email', type: 'email' },
      { id: 'assinante', placeholder: 'Assinante', type: 'text' },
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

    const input = document.createElement('input');
    input.type = campo.type;
    input.id = campo.id;
    input.name = campo.id;
    input.className = 'form-control';
    input.placeholder = campo.placeholder;
    input.required = true;

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
  const inputs = e.target.querySelectorAll('input');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

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
if (window.location.pathname.endsWith('dashboard.html')) {
  const token = localStorage.getItem('token');
  if (!token) {
    // Redireciona para a página de login se não estiver autenticado
    window.location.href = 'login.html';
  } else {
    // Exibe o nome de usuário (se disponível)
    // Você pode armazenar o nome de usuário no localStorage após o login
  }
}

// Evento para logout
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  });
}
