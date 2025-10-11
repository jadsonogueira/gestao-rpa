// ==================== script.js (com agendamento em todos os serviços + busca global de processos) ====================
'use strict';

// Base da API
const apiUrl = window.location.origin;
console.log('[script.js] carregado');

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

// ---------- Helpers de data ----------
function hojeYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function agoraParaDatetimeLocalMin() {
  // "YYYY-MM-DDTHH:MM" (sem segundos) no fuso local
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5); // buffer de 5 min
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ---------- Busca Global de Processos ----------
async function buscarProcessosGlobais(term, page = 1, limit = 10) {
  if (!term || term.trim().length < 2) return { items: [], page: 1, pages: 1, total: 0 };
  const params = new URLSearchParams({ search: term.trim(), page, limit });
  const url = `${apiUrl}/api/processes?${params.toString()}`;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    let items = [];
    let currentPage = 1, totalPages = 1, total = 0;

    if (Array.isArray(json)) {
      items = json;
      total = items.length;
    } else {
      items = json.items || json.data || json.results || json.docs || [];
      currentPage = json.page || json.currentPage || 1;
      totalPages = json.totalPages || 1;
      total = json.total || json.count || json.totalDocs || items.length;
    }
    return { items, page: currentPage, pages: totalPages, total };
  } catch (e) {
    console.error('Falha ao buscar processos:', e);
    return { items: [], page: 1, pages: 1, total: 0 };
  }
}

// Mapeia processo para campos mais estáveis
function mapProcRow(p) {
  const numero = p.seiNumber || p.seiNumberNorm || p.processNumber || p.numero || p.sei || '';
  const atrib  = p.unit || p.assignedTo || p.unidade || p.atribuicao || '';
  const tipo   = Array.isArray(p.tags) && p.tags.length ? (p.tags[0] || '') : (p.type || p.tipo || '');
  const titulo = p.title || p.spec || p.description || p.descricao || p.especificacao || '';
  return { numero, atrib, tipo, titulo };
}

// ---------- UI builders ----------
function buildSelectOptions(selectEl, options) {
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.disabled = true;
  opt0.selected = true;
  opt0.textContent = 'Selecione uma opção';
  selectEl.appendChild(opt0);

  (options || []).forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;       // agora é o nome, para ir no e-mail
    opt.textContent = o.label; // exibe só o nome
    if (o.id) opt.dataset.id = o.id;
    if (o.idExterno) opt.dataset.idexterno = o.idExterno;
    selectEl.appendChild(opt);
  });
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

  // -------------- Buscador Global quando há número de processo --------------
  const campoNumeroProc = fluxoForm.querySelector('#processoSei, #processo_sei');
  if (campoNumeroProc) {
    const grp = document.createElement('div');
    grp.className = 'form-group';

    const lbl = document.createElement('label');
    lbl.textContent = 'Buscar processo (qualquer campo)';
    lbl.htmlFor = 'buscaProcGlobal';

    const row = document.createElement('div');
    row.className = 'd-flex';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control';
    inp.id = 'buscaProcGlobal';
    inp.placeholder = 'Digite parte do número, título, tipo, atribuição...';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary ml-2';
    btn.textContent = 'Buscar';

    row.appendChild(inp);
    row.appendChild(btn);
    grp.appendChild(lbl);
    grp.appendChild(row);

    const resWrap = document.createElement('div');
    resWrap.id = 'procResults';
    resWrap.className = 'mt-2';
    grp.appendChild(resWrap);

    // Coloca a busca no topo do form (acima de tudo)
    fluxoForm.insertBefore(grp, fluxoForm.firstChild);

    let pagina = 1;
    const limite = 10;

    async function executarBusca(page = 1) {
      const term = inp.value.trim();
      if (term.length < 2) {
        resWrap.innerHTML = '<div class="text-muted">Digite pelo menos 2 caracteres.</div>';
        return;
      }
      resWrap.innerHTML = '<div class="text-muted">Buscando…</div>';
      const { items, page: p, pages, total } = await buscarProcessosGlobais(term, page, limite);
      if (!items.length) {
        resWrap.innerHTML = '<div class="text-muted">Nenhum processo encontrado.</div>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm table-hover table-bordered';
      table.innerHTML = `
        <thead class="thead-light">
          <tr>
            <th style="min-width:160px;">Número</th>
            <th style="min-width:160px;">Atribuição</th>
            <th style="min-width:120px;">Tipo</th>
            <th style="min-width:240px;">Título/Especificação</th>
            <th style="width:90px;">Selecionar</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');
      items.forEach(proc => {
        const m = mapProcRow(proc);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${m.numero}</td>
          <td>${m.atrib}</td>
          <td>${m.tipo}</td>
          <td>${m.titulo}</td>
          <td><button type="button" class="btn btn-primary btn-sm">Usar</button></td>
        `;
        const useBtn = tr.querySelector('button');
        useBtn.addEventListener('click', () => {
          campoNumeroProc.value = m.numero;
          showAlert(`Processo selecionado: ${m.numero}`, 'success');
          campoNumeroProc.scrollIntoView({ behavior: 'smooth', block: 'center' });
          campoNumeroProc.classList.add('is-valid');
          setTimeout(() => campoNumeroProc.classList.remove('is-valid'), 1500);
        });
        tbody.appendChild(tr);
      });

      const pager = document.createElement('div');
      pager.className = 'd-flex align-items-center mt-2';
      const prev = document.createElement('button');
      prev.className = 'btn btn-light btn-sm mr-2';
      prev.textContent = '◀';
      prev.disabled = p <= 1;

      const info = document.createElement('span');
      info.className = 'text-muted mr-2';
      info.textContent = `Página ${p} / ${pages} — ${total} itens`;

      const next = document.createElement('button');
      next.className = 'btn btn-light btn-sm';
      next.textContent = '▶';
      next.disabled = p >= pages;

      prev.addEventListener('click', () => { if (pagina > 1) { pagina--; executarBusca(pagina); } });
      next.addEventListener('click', () => { if (pagina < pages) { pagina++; executarBusca(pagina); } });

      resWrap.innerHTML = '';
      resWrap.appendChild(table);
      const pagWrap = document.createElement('div');
      pagWrap.appendChild(prev);
      pagWrap.appendChild(info);
      pagWrap.appendChild(next);
      resWrap.appendChild(pagWrap);
    }

    btn.addEventListener('click', () => { pagina = 1; executarBusca(pagina); });
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        pagina = 1;
        executarBusca(pagina);
      }
    });
  }

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

  // ====== BLOCO DE AGENDAMENTO (presente para todos os serviços) ======
  const agGroup = document.createElement('div');
  agGroup.className = 'form-group';
  agGroup.id = 'agendamentoGroup';

  const agLegend = document.createElement('label');
  agLegend.textContent = 'Agendamento do envio';
  agLegend.style.display = 'block';
  agLegend.style.fontWeight = '500';

  const agRadios = document.createElement('div');
  agRadios.className = 'd-flex align-items-center';

  const rImediatoId = 'envio_imediato';
  const rAgendarId = 'envio_agendar';

  const rImediato = document.createElement('input');
  rImediato.type = 'radio';
  rImediato.name = 'envio';
  rImediato.id = rImediatoId;
  rImediato.value = 'imediato';
  rImediato.className = 'mr-2';
  rImediato.checked = true; // padrão

  const lImediato = document.createElement('label');
  lImediato.htmlFor = rImediatoId;
  lImediato.className = 'mr-4 mb-0';
  lImediato.textContent = 'Imediato';

  const rAgendar = document.createElement('input');
  rAgendar.type = 'radio';
  rAgendar.name = 'envio';
  rAgendar.id = rAgendarId;
  rAgendar.value = 'agendar';
  rAgendar.className = 'mr-2';

  const lAgendar = document.createElement('label');
  lAgendar.htmlFor = rAgendarId;
  lAgendar.className = 'mr-3 mb-0';
  lAgendar.textContent = 'Agendar';

  const quandoWrap = document.createElement('div');
  quandoWrap.className = 'ml-2';
  quandoWrap.style.display = 'none';

  const quandoInput = document.createElement('input');
  quandoInput.type = 'datetime-local';
  quandoInput.id = 'quando';
  quandoInput.name = 'quando';
  quandoInput.className = 'form-control';
  quandoInput.style.maxWidth = '260px';
  quandoInput.min = agoraParaDatetimeLocalMin();

  quandoWrap.appendChild(quandoInput);

  agRadios.appendChild(rImediato);
  agRadios.appendChild(lImediato);
  agRadios.appendChild(rAgendar);
  agRadios.appendChild(lAgendar);
  agRadios.appendChild(quandoWrap);

  agGroup.appendChild(agLegend);
  agGroup.appendChild(agRadios);
  fluxoForm.appendChild(agGroup);

  // alterna exibição do campo "quando"
  agGroup.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'envio') {
      const isAgendar = e.target.value === 'agendar';
      quandoWrap.style.display = isAgendar ? 'block' : 'none';
      quandoInput.required = isAgendar;
      if (!isAgendar) quandoInput.value = '';
      if (isAgendar && !quandoInput.min) quandoInput.min = agoraParaDatetimeLocalMin();
    }
  });

  // Botão enviar
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Enviar';
  submitButton.className = 'btn btn-primary btn-block mt-3';
  fluxoForm.appendChild(submitButton);

  fluxoForm.onsubmit = enviarFormularioAxios;

  // Abre modal
  try {
    if (window.$ && $('#fluxoModal').length) {
      $('#fluxoModal').modal('show');
    } else {
      // fallback básico sem jQuery/Bootstrap (se necessário)
      const modal = document.getElementById('fluxoModal');
      if (modal) modal.style.display = 'block';
    }
  } catch (err) {
    console.error('Falha ao abrir modal:', err);
  }
}

// ---------- Submit ----------
function enviarFormularioAxios(e) {
  e.preventDefault();

  // Validação simples do agendamento antes de enviar
  const envioSelecionado = (e.target.querySelector('input[name="envio"]:checked') || {}).value || 'imediato';
  if (envioSelecionado === 'agendar') {
    const quandoEl = e.target.querySelector('#quando');
    if (!quandoEl || !quandoEl.value) {
      showAlert('Informe a data e hora do agendamento.', 'warning');
      return;
    }
    // valida mínimo
    const min = quandoEl.min ? new Date(quandoEl.min) : null;
    const escolhido = new Date(quandoEl.value);
    if (min && escolhido < min) {
      showAlert('Escolha um horário de agendamento no futuro (mínimo alguns minutos à frente).', 'warning');
      return;
    }
  }

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

  // Anexa versão UTC do agendamento (ajuda o backend a evitar problemas de fuso)
  if (envioSelecionado === 'agendar') {
    const whenEl = e.target.querySelector('#quando');
    if (whenEl && whenEl.value) {
      formData.append('quandoUtc', new Date(whenEl.value).toISOString());
    }
  }

  // Decide endpoint
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

      if (window.$ && $('#fluxoModal').length) {
        $('#fluxoModal').modal('hide');
      }
    } else {
      showAlert('✅ Solicitação enviada com sucesso.', 'success');

      if (window.$ && $('#fluxoModal').length) {
        $('#fluxoModal').modal('hide');
      }
    }
  })
  .catch(err => {
    console.error(err);
    showAlert('Falha ao processar sua solicitação.', 'danger');
  })
  .finally(() => {
    hideLoadingOverlay();
  });
}

// Expor no escopo global (cards chamam isso pelo onclick do HTML)
window.abrirFormulario = abrirFormulario;

// ==================== fim script.js ====================
