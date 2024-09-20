// public/script.js

const apiUrl = 'http://localhost:3000';

// Cadastro (Signup)
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Validação simples
    if (!username || !password) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.text();
      alert(data);
      if (res.ok) {
        window.location.href = 'login.html';
      }
    } catch (error) {
      alert('Erro ao registrar. Tente novamente mais tarde.');
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
      alert('Por favor, preencha todos os campos.');
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
        window.location.href = 'dashboard.html';
      } else {
        alert('Usuário ou senha incorretos');
      }
    } catch (error) {
      alert('Erro ao fazer login. Tente novamente mais tarde.');
    }
  });
}

// Funções do Dashboard
function abrirFormulario(fluxo) {
  const modal = document.getElementById('modal');
  modal.style.display = 'block';
  document.getElementById('fluxoTitulo').innerText = fluxo;

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
    const input = document.createElement('input');
    input.type = campo.type;
    input.id = campo.id;
    input.name = campo.id;
    input.placeholder = campo.placeholder;
    input.required = true;
    fluxoForm.appendChild(input);
  });

  // Adiciona o botão de envio
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  fluxoForm.appendChild(submitButton);

  // Adiciona o evento de submit
  fluxoForm.onsubmit = enviarFormulario;

  // Permite fechar o modal com a tecla Esc
  document.addEventListener('keydown', teclaEscParaFecharModal);
}

function fecharFormulario() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';

  // Remove o listener da tecla Esc
  document.removeEventListener('keydown', teclaEscParaFecharModal);
}

function teclaEscParaFecharModal(event) {
  if (event.key === 'Escape') {
    fecharFormulario();
  }
}

async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('fluxoTitulo').innerText;

  const dados = {};

  // Coleta os dados do formulário
  const inputs = e.target.querySelectorAll('input');
  inputs.forEach((input) => {
    dados[input.id] = input.value.trim();
  });

  const token = localStorage.getItem('token');

  // Exibe um indicador de carregamento (opcional)
  // Por exemplo, você pode mostrar um spinner aqui

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
      alert('Solicitação enviada com sucesso.');
    } else {
      alert('Erro ao enviar a solicitação: ' + data);
    }
  } catch (error) {
    alert('Erro ao enviar o formulário. Tente novamente mais tarde.');
  } finally {
    // Oculta o indicador de carregamento (se houver)
    fecharFormulario();
  }
}

// Verificar se o usuário está autenticado ao carregar o dashboard
if (window.location.pathname.endsWith('dashboard.html')) {
  const token = localStorage.getItem('token');
  if (!token) {
    // Redireciona para a página de login se não estiver autenticado
    window.location.href = 'login.html';
  }
}
