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
  if (overlay) overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Busca de dados externos
async function buscarUsuariosExternos() {
  try {
    const response = await fetch(`${apiUrl}/usuarios-externos`);
    const usuarios = await response.json();
    return usuarios.map(u => u.nome);
  } catch (error) {
    console.error('Erro ao buscar usuários externos:', error);
    return [];
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

// Instruções por fluxo
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
  'Unir PDFs': 'Selecione dois ou mais arquivos PDF para juntá-los em um único documento.'
};

function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('fluxoForm');
  if (!modalTitle || !form) return;

  modalTitle.innerText = fluxo;
  form.innerHTML = '';

  const instrucao = fluxoInstrucoes[fluxo] || '';
  if (instrucao) {
    const divInstrucao = document.createElement('div');
    divInstrucao.classList.add('mb-3');
    divInstrucao.innerHTML = `<p class="text-muted">${instrucao}</p>`;
    form.appendChild(divInstrucao);
  }

  if (fluxo === 'Unir PDFs') {
    const campoArquivo = document.createElement('div');
    campoArquivo.classList.add('form-group');
    campoArquivo.innerHTML = `
      <label for="arquivos">Selecionar arquivos PDF</label>
      <input type="file" class="form-control" name="arquivos" id="arquivos" multiple required accept=".pdf">
    `;
    form.appendChild(campoArquivo);
  } else if (fluxo === 'Criar Doc SEI Externo' || fluxo === 'Criar Doc SEI Editável') {
    form.innerHTML += `
      <div class="form-group">
        <label for="titulo">Título do Documento</label>
        <input type="text" class="form-control" name="titulo" required>
      </div>
      <div class="form-group">
        <label for="conteudo">Conteúdo</label>
        <textarea class="form-control" name="conteudo" rows="4" required></textarea>
      </div>
    `;
  } else {
    form.innerHTML += `
      <div class="form-group">
        <label for="mensagem">Mensagem</label>
        <textarea class="form-control" name="mensagem" rows="3" required></textarea>
      </div>
      <div class="form-group">
        <label for="anexo">Anexar Arquivo (opcional)</label>
        <input type="file" class="form-control" name="anexo">
      </div>
    `;
  }

  const botao = document.createElement('button');
  botao.type = 'submit';
  botao.classList.add('btn', 'btn-primary', 'btn-block');
  botao.innerText = 'Enviar';

  form.appendChild(botao);
  form.onsubmit = enviarFormularioAxios;
  $('#fluxoModal').modal('show');
}

function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('fluxoForm');
  if (!modalTitle || !form) return;

  modalTitle.innerText = fluxo;
  form.innerHTML = '';

  const instrucao = fluxoInstrucoes[fluxo] || '';
  if (instrucao) {
    const divInstrucao = document.createElement('div');
    divInstrucao.classList.add('mb-3');
    divInstrucao.innerHTML = `<p class="text-muted">${instrucao}</p>`;
    form.appendChild(divInstrucao);
  }

  const campos = {
    'Consultar empenho': `
      <div class="form-group">
        <label for="email">Seu e-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
      <div class="form-group">
        <label for="contratoSei">Número do Contrato SEI</label>
        <input type="text" class="form-control" name="contratoSei" required>
      </div>
    `,
    'Liberar assinatura externa': `
      <div class="form-group">
        <label for="email">Seu e-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
      <div class="form-group">
        <label for="assinante">Assinante</label>
        <input type="text" class="form-control" name="assinante" required>
      </div>
      <div class="form-group">
        <label for="numeroDocSei">Número do DOC_SEI</label>
        <input type="text" class="form-control" name="numeroDocSei" required>
      </div>
    `,
    'Liberar acesso externo': `
      <div class="form-group">
        <label for="email">Seu e-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
      <div class="form-group">
        <label for="user">Usuário Externo</label>
        <input type="text" class="form-control" name="user" required>
      </div>
      <div class="form-group">
        <label for="processo_sei">Número do Processo SEI</label>
        <input type="text" class="form-control" name="processo_sei" required>
      </div>
    `,
    'Analise de processo': `
      <div class="form-group">
        <label for="email">Seu e-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
      <div class="form-group">
        <label for="processo_sei">Número do Processo SEI</label>
        <input type="text" class="form-control" name="processo_sei" required>
      </div>
      <div class="form-group">
        <label>Memória de Cálculo (PDF)</label>
        <input type="file" name="memoriaCalculo" accept=".pdf" required class="form-control">
      </div>
      <div class="form-group">
        <label>Diário de Obra (PDF)</label>
        <input type="file" name="diarioObra" accept=".pdf" required class="form-control">
      </div>
      <div class="form-group">
        <label>Relatório Fotográfico (PDF)</label>
        <input type="file" name="relatorioFotografico" accept=".pdf" required class="form-control">
      </div>
    `,
    'Unir PDFs': `
      <div class="form-group">
        <label>Selecionar arquivos PDF</label>
        <input type="file" class="form-control" name="pdfs" multiple required accept=".pdf">
      </div>
    `
  };

  // Campos comuns
  if (campos[fluxo]) {
    form.innerHTML += campos[fluxo];
  } else {
    form.innerHTML += `
      <div class="form-group">
        <label for="email">Seu e-mail</label>
        <input type="email" class="form-control" name="email" required>
      </div>
    `;
  }

  const botao = document.createElement('button');
  botao.type = 'submit';
  botao.classList.add('btn', 'btn-primary', 'btn-block');
  botao.innerText = 'Enviar';
  form.appendChild(botao);

  form.onsubmit = enviarFormularioAxios;
  $('#fluxoModal').modal('show');
}


// Expõe globalmente
window.abrirFormulario = abrirFormulario;
