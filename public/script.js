// Define a URL da API com base no ambiente
const apiUrl = 'https://gestao-rpa.onrender.com';

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

function showLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

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

  switch (fluxo) {
    case 'Consultar empenho':
      form.innerHTML += `
        <div class="form-group">
          <label for="contratoSei">Contrato SEI</label>
          <input type="text" class="form-control" name="contratoSei" required>
        </div>
        <div class="form-group">
          <label for="email">E-mail</label>
          <input type="email" class="form-control" name="email" required>
        </div>`;
      break;

    case 'Liberar assinatura externa':
      form.innerHTML += `
        <div class="form-group">
          <label for="assinante">Assinante</label>
          <input type="text" class="form-control" name="assinante" required>
        </div>
        <div class="form-group">
          <label for="numeroDocSei">Número do DOC_SEI</label>
          <input type="text" class="form-control" name="numeroDocSei" required>
        </div>
        <div class="form-group">
          <label for="email">E-mail</label>
          <input type="email" class="form-control" name="email" required>
        </div>`;
      break;

    case 'Unir PDFs':
      form.innerHTML += `
        <div class="form-group">
          <label for="arquivos">Selecionar arquivos PDF</label>
          <input type="file" class="form-control" name="pdfs" multiple required accept=".pdf">
        </div>`;
      break;

    default:
      form.innerHTML += `
        <div class="form-group">
          <label for="mensagem">Mensagem</label>
          <textarea class="form-control" name="mensagem" rows="3" required></textarea>
        </div>
        <div class="form-group">
          <label for="anexo">Anexar Arquivo (opcional)</label>
          <input type="file" class="form-control" name="anexo">
        </div>`;
      break;
  }

  const botao = document.createElement('button');
  botao.type = 'submit';
  botao.classList.add('btn', 'btn-primary', 'btn-block');
  botao.innerText = 'Enviar';
  form.appendChild(botao);

  form.onsubmit = enviarFormularioAxios;
  $('#fluxoModal').modal('show');
}

function enviarFormularioAxios(e) {
  e.preventDefault();
  showLoadingOverlay();

  const fluxo = document.getElementById('modalTitle').innerText;
  const formData = new FormData();
  formData.append('fluxo', fluxo);

  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
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

  let url = `${apiUrl}/send-email`;
  if (fluxo === 'Unir PDFs') url = `${apiUrl}/merge-pdf`;

  axios.post(url, formData, { responseType: fluxo === 'Unir PDFs' ? 'blob' : 'json' })
    .then(response => {
      hideLoadingOverlay();

      if (fluxo === 'Unir PDFs') {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = 'pdf_unido.pdf';
        link.click();
        showAlert('PDF unido gerado com sucesso!', 'success');
      } else {
        showAlert('Solicitação enviada com sucesso.', 'success');
      }

      $('#fluxoModal').modal('hide');
    })
    .catch(error => {
      hideLoadingOverlay();
      if (error.response) {
        showAlert(`Erro ao enviar: ${error.response.data}`, 'danger');
      } else {
        showAlert(`Erro ao enviar o formulário: ${error.message}`, 'danger');
      }
      $('#fluxoModal').modal('hide');
    });
}

window.abrirFormulario = abrirFormulario;