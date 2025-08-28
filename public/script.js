// ==================== script.js (substituição completa) ====================

// Base da API
const apiUrl = window.location.origin;

// ---------- UI helpers ----------
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

// ---------- Fetch helpers (JWT) ----------
async function fetchJSON(path) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    let txt = '';
    try { txt = await res.text(); } catch {}
    throw new Error(`Falha ao buscar ${path}: ${res.status} ${txt}`);
  }
  return res.json();
}

async function carregarUsuariosExternos() {
  // [{ _id, idExterno, nome, empresa }]
  const lista = await fetchJSON('/usuarios-externos');
  // value será o NOME (para o e-mail ir com o nome, não com o _id)
  return lista.map(u => ({
    value: u.nome,
    label: u.nome,
    id: u._id,
    idExterno: u.idExterno
  }));
}

async function carregarContratos() {
  // [{ _id, numero }]
  const lista = await fetchJSON('/contratos');
  return lista.map(c => ({ value: c.numero, label: c.numero }));
}

// ---------- Instruções por fluxo ----------
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
  'Unir PDFs': 'Selecione dois ou mais arquivos PDF para juntá-los em um único documento.',
  'PDF para JPG': 'Selecione um PDF. Cada página será convertida em uma imagem JPG.',
  'PDF pesquisável (OCR)': 'Envie um PDF e receba o mesmo arquivo com camada de texto (OCR).',
  'Dividir PDF': 'Selecione um PDF e, opcionalmente, informe faixas (ex.: 1-3,5,7-9). Se não informar, dividiremos página a página.'
};

// ---------- UI builders ----------
function buildSelectOptions(selectEl, options) {
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.disabled = true;
  opt0.selected = true;
  opt0.textContent = 'Selecione uma opção';
  selectEl.appendChild(opt0);

  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;       // agora é o nome, para ir no e-mail
    opt.textContent = o.label; // exibe só o nome
    // se quiser usar ids depois sem enviar por e-mail:
    if (o.id) opt.dataset.id = o.id;
    if (o.idExterno) opt.dataset.idexterno = o.idExterno;
    selectEl.appendChild(opt);
  });
}

function hojeYYYYMMDD() {
  const d = new Date();
  // ajuste fuso se necessário
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- Form modal ----------
async function abrirFormulario(fluxo) {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.querySelector('.modal-body');
  if (!modalTitle || !modalBody) {
    console.error('Elementos do modal não encontrados.');
    return;
  }

  modalTitle.innerText = fluxo;
  modalBody.innerHTML = '';

  const instrucaoText = document.createElement('p');
  instrucaoText.textContent = fluxoInstrucoes[fluxo] || 'Preencha todos os campos.';
  modalBody.appendChild(instrucaoText);

  const fluxoForm = document.createElement('form');
  fluxoForm.id = 'fluxoForm';
  fluxoForm.enctype = 'multipart/form-data';
  modalBody.appendChild(fluxoForm);

  let campos = [];

  try {
    if (fluxo === 'Consultar empenho') {
      const contratos = await carregarContratos().catch(() => []);
      campos = [{ id: 'contratoSei', placeholder: 'Contrato SEI', type: 'select', options: contratos }];

    } else if (fluxo === 'Liberar assinatura externa') {
      const usuarios = await carregarUsuariosExternos().catch(() => []);
      campos = [
        { id: 'assinante', placeholder: 'Assinante', type: 'select', options: usuarios },
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
      ];

    } else if (fluxo === 'Liberar acesso externo') {
      const usuarios = await carregarUsuariosExternos().catch(() => []);
      campos = [
        { id: 'user', placeholder: 'Usuário externo', type: 'select', options: usuarios },
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
      ];

    } else if (fluxo === 'Analise de processo') {
      campos = [
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text' },
        { id: 'memoriaCalculo', placeholder: 'Memória de Cálculo (PDF)', type: 'file', accept: 'application/pdf' },
        { id: 'diarioObra', placeholder: 'Diário de Obra (PDF)', type: 'file', accept: 'application/pdf' },
        { id: 'relatorioFotografico', placeholder: 'Relatório Fotográfico (PDF)', type: 'file', accept: 'application/pdf' }
      ];

    } else if (fluxo === 'Alterar ordem de documentos') {
      campos = [
        { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
        { id: 'instrucoes', placeholder: 'Instruções', type: 'textarea' },
      ];

    } else if (fluxo === 'Inserir anexo em doc SEI') {
      campos = [
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
        { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
      ];

    } else if (fluxo === 'Inserir imagem em doc SEI') {
      campos = [
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
        { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
      ];

    } else if (fluxo === 'Assinatura em doc SEI') {
      campos = [
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
        { id: 'user', placeholder: 'Usuário', type: 'text' },
        { id: 'key', placeholder: 'Senha', type: 'text' },
      ];

      } else if (fluxo === 'PDF pesquisável (OCR)') {
  campos = [
    { id: 'arquivoPdf', placeholder: 'Selecione o arquivo PDF', type: 'file', accept: '.pdf' },
    { id: 'lang', placeholder: 'Idiomas do OCR (ex.: por+eng)', type: 'text', required: false }
  ];


    } else if (fluxo === 'Unir PDFs') {
      campos = [{ id: 'pdfs', placeholder: 'Arquivos PDF para unir', type: 'file', accept: '.pdf', multiple: true }];

    } else if (fluxo === 'PDF para JPG') {
      campos = [{ id: 'arquivoPdf', placeholder: 'Selecione o arquivo PDF', type: 'file', accept: '.pdf' }];

    } else if (fluxo === 'Dividir PDF') {
      campos = [
        { id: 'pdf', placeholder: 'Selecione o arquivo PDF', type: 'file', accept: '.pdf' },
        { id: 'ranges', placeholder: 'Faixas (ex.: 1-3,5,7-9) — opcional', type: 'text', required: false }
      ];

    // ✅ Faltavam estes dois:
    } else if (fluxo === 'Criar Doc SEI Externo') {
      campos = [
        { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
        { id: 'tipoDocumento', placeholder: 'Tipo do Documento', type: 'text' },
        { id: 'dataFormatada', placeholder: 'Data', type: 'date', value: hojeYYYYMMDD() },
        { id: 'numero', placeholder: 'Número', type: 'text', value: '-' },
        { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
        { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' }
      ];

    } else if (fluxo === 'Criar Doc SEI Editável') {
      campos = [
        { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text' },
        {
          id: 'tipoDocumento',
          placeholder: 'Tipo do Documento',
          type: 'select',
          options: [
            { value: 'Planilha', label: 'Planilha' },
            { value: 'Nota(s) Fiscal(is)', label: 'Nota(s) Fiscal(is)' },
            { value: 'Curva S', label: 'Curva S' },
            { value: 'Diário de Obras', label: 'Diário de Obras' },
            { value: 'Boletim de Desempenho Parcial - Medições', label: 'Boletim de Desempenho Parcial - Medições' }
          ]
        },
        { id: 'numero', placeholder: 'Número', type: 'text', value: '-' },
        { id: 'nomeArvore', placeholder: 'Nome na Árvore', type: 'text' },
        { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] }
      ];
    }
  } catch (e) {
    console.error('Erro ao montar campos do fluxo:', e);
    showAlert('Falha ao carregar dados para o formulário.', 'danger');
    return;
  }

  // Renderiza campos
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
      input.required = campo.required !== false;
      buildSelectOptions(input, campo.options || []);
    } else if (campo.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
      input.className = 'form-control';
      input.required = campo.required !== false;
      input.placeholder = campo.placeholder;
    } else if (campo.type === 'radio') {
      input = document.createElement('div');
      input.id = campo.id;
      (campo.options || []).forEach((optionText, index) => {
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

      // comportamentos dos métodos de upload
      input.addEventListener('change', function(e) {
        const metodo = e.target.value;
        const imagensContainer = document.getElementById('imagensContainer');
        const zipContainer = document.getElementById('zipContainer');
        const pdfContainer = document.getElementById('pdfContainer');
        const zipInput = document.getElementById('arquivoZip');
        const numeroImagensSelect = document.getElementById('numeroImagens');
        const pdfInput = document.getElementById('arquivoPdf');

        if (metodo === 'Imagens Individuais') {
          imagensContainer.style.display = 'block';
          zipContainer.style.display = 'none';
          pdfContainer.style.display = 'none';
          if (zipInput) { zipInput.required = false; zipInput.value = ''; }
          if (numeroImagensSelect) numeroImagensSelect.required = true;
          if (pdfInput) { pdfInput.required = false; pdfInput.value = ''; }
          document.querySelectorAll('#arquivosContainer input[type="file"]').forEach(inp => inp.required = true);
        } else if (metodo === 'Arquivo ZIP') {
          imagensContainer.style.display = 'none';
          zipContainer.style.display = 'block';
          pdfContainer.style.display = 'none';
          if (zipInput) zipInput.required = true;
          if (numeroImagensSelect) { numeroImagensSelect.required = false; numeroImagensSelect.value = ''; }
          if (pdfInput) { pdfInput.required = false; pdfInput.value = ''; }
          document.querySelectorAll('#arquivosContainer input[type="file"]').forEach(inp => { inp.required = false; inp.value = ''; });
        } else if (metodo === 'PDF para JPG') {
          imagensContainer.style.display = 'none';
          zipContainer.style.display = 'none';
          pdfContainer.style.display = 'block';
          if (zipInput) { zipInput.required = false; zipInput.value = ''; }
          if (numeroImagensSelect) { numeroImagensSelect.required = false; numeroImagensSelect.value = ''; }
          document.querySelectorAll('#arquivosContainer input[type="file"]').forEach(inp => { inp.required = false; inp.value = ''; });
          if (pdfInput) pdfInput.required = true;
        }
      });
    } else {
      // input padrão (text, file, etc.)
      input = document.createElement('input');
      input.type = campo.type;
      input.className = 'form-control';
      input.required = campo.required !== false;
      input.placeholder = campo.placeholder;
      if (campo.multiple) input.multiple = true;
      if (campo.accept) input.accept = campo.accept;
      if (campo.value) input.value = campo.value;
      input.id = campo.id;
      input.name = campo.id;
    }

    input.id = campo.id;
    input.name = campo.id;
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    fluxoForm.appendChild(formGroup);
  });

  // ----- Containers extras (iguais ao seu código) -----
  // Imagens individuais
  const imagensContainer = document.createElement('div');
  imagensContainer.id = 'imagensContainer';
  imagensContainer.style.display = 'none';
  fluxoForm.appendChild(imagensContainer);

  const numeroImagensGroup = document.createElement('div');
  numeroImagensGroup.className = 'form-group';
  const numeroImagensLabel = document.createElement('label');
  numeroImagensLabel.htmlFor = 'numeroImagens';
  numeroImagensLabel.textContent = 'Número de Imagens';

  const numeroImagensSelect = document.createElement('select');
  numeroImagensSelect.id = 'numeroImagens';
  numeroImagensSelect.name = 'numeroImagens';
  numeroImagensSelect.className = 'form-control';
  numeroImagensSelect.required = false;

  const optionInicial = document.createElement('option');
  optionInicial.value = '';
  optionInicial.disabled = true;
  optionInicial.selected = true;
  optionInicial.textContent = 'Selecione o número de imagens';
  numeroImagensSelect.appendChild(optionInicial);

  for (let i = 1; i <= 100; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    numeroImagensSelect.appendChild(option);
  }

  numeroImagensGroup.appendChild(numeroImagensLabel);
  numeroImagensGroup.appendChild(numeroImagensSelect);
  imagensContainer.appendChild(numeroImagensGroup);

  numeroImagensSelect.addEventListener('change', function() {
    const numImagens = parseInt(this.value);
    const arquivosContainer = document.getElementById('arquivosContainer');
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
      input.required = true;

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      arquivosContainer.appendChild(formGroup);
    }
  });

  const arquivosContainer = document.createElement('div');
  arquivosContainer.id = 'arquivosContainer';
  imagensContainer.appendChild(arquivosContainer);

  // ZIP
  const zipContainer = document.createElement('div');
  zipContainer.id = 'zipContainer';
  zipContainer.style.display = 'none';
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
  zipInput.required = false;

  zipGroup.appendChild(zipLabel);
  zipGroup.appendChild(zipInput);
  zipContainer.appendChild(zipGroup);

  // PDF para JPG
  const pdfContainer = document.createElement('div');
  pdfContainer.id = 'pdfContainer';
  pdfContainer.style.display = 'none';
  fluxoForm.appendChild(pdfContainer);

  const pdfGroup = document.createElement('div');
  pdfGroup.className = 'form-group';
  const pdfLabel = document.createElement('label');
  pdfLabel.htmlFor = 'arquivoPdf';
  pdfLabel.textContent = 'Selecione o(s) arquivo(s) PDF';

  const pdfInput = document.createElement('input');
  pdfInput.type = 'file';
  pdfInput.id = 'arquivoPdf';
  pdfInput.name = 'arquivoPdf';
  pdfInput.className = 'form-control-file';
  pdfInput.accept = '.pdf';
  pdfInput.required = false;

  pdfGroup.appendChild(pdfLabel);
  pdfGroup.appendChild(pdfInput);
  pdfContainer.appendChild(pdfGroup);

  // Botão enviar
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block mt-3';
  fluxoForm.appendChild(submitButton);

  fluxoForm.onsubmit = enviarFormularioAxios;

  // Abre modal
  $('#fluxoModal').modal('show');
}

// ---------- Submit ----------
function enviarFormularioAxios(e) {
  e.preventDefault();
  showLoadingOverlay();

  const fluxo = document.getElementById('modalTitle').innerText;
  const formData = new FormData();
  formData.append('fluxo', fluxo);

  const inputs = e.target.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    if (input.type === 'file' && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        formData.append(input.name, input.files[i]);
      }
    } else if (input.type !== 'file' && input.type !== 'radio') {
      formData.append(input.name, (input.value || '').trim());
    } else if (input.type === 'radio' && input.checked) {
      formData.append(input.name, input.value);
    }
  });

  const url = fluxo === 'Unir PDFs'
  ? `${apiUrl}/merge-pdf`
  : fluxo === 'PDF para JPG'
  ? `${apiUrl}/pdf-to-jpg`
  : fluxo === 'Dividir PDF'
  ? `${apiUrl}/split-pdf`
  : fluxo === 'PDF pesquisável (OCR)'
  ? `${apiUrl}/pdf-make-searchable`
  : `${apiUrl}/send-email`;


  const responseType = (['Unir PDFs','PDF para JPG','Dividir PDF','PDF pesquisável (OCR)'].includes(fluxo))
  ? 'blob'
  : 'json';


  const token = localStorage.getItem('token');

  axios.post(url, formData, {
    responseType,
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(response => {
    hideLoadingOverlay();

   if (['Unir PDFs', 'PDF para JPG', 'Dividir PDF', 'PDF pesquisável (OCR)'].includes(fluxo)) {
  const contentType = response.headers['content-type'] || 'application/octet-stream';
  const cd = response.headers['content-disposition'] || '';
  let filename = null;
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
  if (m) {
    try { filename = decodeURIComponent(m[1] || m[2]); }
    catch { filename = (m[1] || m[2]); }
  }

  if (!filename) {
    if (fluxo === 'Unir PDFs') {
      const first = e.target.querySelector('input[name="pdfs"]')?.files?.[0]?.name || 'merged.pdf';
      filename = first.replace(/\.[^.]+$/, '') + '_merge.pdf';
    } else if (fluxo === 'Dividir PDF') {
      const first = e.target.querySelector('input[name="pdf"]')?.files?.[0]?.name || 'split.zip';
      filename = first.replace(/\.[^.]+$/, '') + '_split.zip';
    } else if (fluxo === 'PDF para JPG') {
      const base = (e.target.querySelector('input[name="arquivoPdf"]')?.files?.[0]?.name || 'arquivo').replace(/\.pdf$/i, '');
      filename = contentType.includes('zip') ? `${base}.zip` : `${base}.jpg`;
    } else if (fluxo === 'PDF pesquisável (OCR)') {
      const base = (e.target.querySelector('input[name="arquivoPdf"]')?.files?.[0]?.name || 'arquivo').replace(/\.pdf$/i, '');
      filename = `${base}_pesquisavel.pdf`;
    } else {
      const ext = contentType.includes('pdf') ? 'pdf'
               : contentType.includes('zip') ? 'zip'
               : contentType.includes('jpeg') ? 'jpg'
               : 'bin';
      filename = `resultado.${ext}`;
    }
  }

  const blob = new Blob([response.data], { type: contentType });
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);

  showAlert(`✅ Operação concluída com sucesso! Arquivo: ${filename}`, 'success');
} else {
  showAlert('✅ Solicitação enviada com sucesso.', 'success');
}

})
.catch(error => {
  hideLoadingOverlay();
  console.error('Erro ao enviar:', error);
  showAlert('❌ Ocorreu um erro no envio do formulário.', 'danger');
})
.finally(() => {
  $('#fluxoModal').modal('hide');
});
} // <-- fecha a função abrirFormulario

// Expor no escopo global (cards chamam isso pelo onclick do HTML)
window.abrirFormulario = abrirFormulario;

// ==================== fim script.js ====================
