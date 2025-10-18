// ==================== script.js (com agendamento em todos os serviços + busca global de processos) ====================
'use strict';

// Base da API
const apiUrl = window.location.origin;
console.log('[script.js] carregado');

// Injeta CSS do buscador de processos no <head> sem precisar editar o HTML
(function injectProcessSearchCSS() {
  const css = `
    /* Bloco de busca dentro do modal (tema claro) */
    #fluxoForm .proc-search-group {
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    /* Linha com input e botão */
    #fluxoForm .proc-search-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    /* Container dos resultados com rolagem e cabeçalho fixo */
    #fluxoForm #procResults {
      margin-top: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: visible;
      background: #ffffff;
    }
    #fluxoForm #procResults .results-scroll {
      max-height: 240px;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      background: #ffffff; /* fundo do corpo da lista */
    }

    /* Tabela compacta e legível (tema claro) */
    #fluxoForm #procResults table.table {
      margin-bottom: 0;
      font-size: 0.8rem; /* reduzido ~2 pontos conforme solicitado (antes 0.9rem) */
      color: #111827;
      background-color: transparent;
      table-layout: fixed;
    }

    /* Cabeçalho fixo e claro */
    #fluxoForm #procResults thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      color: #111827;
      background: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
    }

    /* Linhas e células (tema claro) */
    #fluxoForm #procResults tbody tr {
      color: #111827;
      background-color: #ffffff;
      cursor: pointer; /* linha clicável */
    }
    #fluxoForm #procResults tbody tr:hover {
      background: #f9fafb;
    }
    #fluxoForm #procResults td,
    #fluxoForm #procResults th {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      border-color: #e5e7eb;
      vertical-align: middle;
    }

    /* ======= Nova coluna de ação (botão '+') como primeira coluna ======= */
    #fluxoForm #procResults td.col-action,
    #fluxoForm #procResults th.th-action {
      width: 38px;
      text-align: center;
      padding: 4px 6px;
    }

    /* estilo do botão expand docs: pequeno, só o '+' */
    #fluxoForm #procResults .btn-expand-docs {
      padding: 2px 6px;
      font-weight: 700;
      font-size: 1rem;
      line-height: 1;
      border: none;
      background: transparent;
      color: #374151;
      cursor: pointer;
    }

    /* Larguras das colunas (ordem: Action, Número, Título/Especificação, Atribuição) */
    /* Número do processo maior e mais proeminente */
    #fluxoForm #procResults td.col-numero { min-width: 340px; font-weight: 600; font-size: 0.95rem; }
    #fluxoForm #procResults th.th-numero { min-width: 340px; font-weight: 600; font-size: 0.95rem; }

    /* Título/especificação maior */
    #fluxoForm #procResults td.col-title { min-width: 420px; padding: 0; font-size: 0.95rem; }
    #fluxoForm #procResults th.th-title  { min-width: 420px; font-size: 0.95rem; }

    /* Atribuição menor e mais discreta */
    #fluxoForm #procResults td.col-atrib { max-width: 150px; font-size: 0.78rem; color: #4b5563; }
    #fluxoForm #procResults th.th-atrib  { min-width: 130px; font-size: 0.78rem; color: #4b5563; }

    /* Conteúdo rolável horizontal APENAS dentro da célula de especificação */
    #fluxoForm #procResults .title-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
      padding: 6px 8px;           /* repõe o padding removido da td */
      -webkit-overflow-scrolling: touch;
    }

    /* Paginação clara e discreta, alinhada à direita */
    #fluxoForm #procResults .pager,
    #fluxoForm #procResults .d-flex.align-items-center.mt-2 {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px;
      background: #fafafa;
      color: #374151;
      border-top: 1px solid #e5e7eb;
    }
    #fluxoForm #procResults .pager .btn.btn-light.btn-sm,
    #fluxoForm #procResults .d-flex.align-items-center.mt-2 .btn.btn-light.btn-sm {
      color: #111827;
      background-color: #f3f4f6;
      border-color: #e5e7eb;
    }

    /* Espaço entre o bloco de busca e o resto do formulário */
    #fluxoForm .after-search-spacer { height: 8px; }

    /* Opcional: zebra striping leve para leitura */
    #fluxoForm #procResults tbody tr:nth-child(odd) {
      background: #ffffff;
    }
    #fluxoForm #procResults tbody tr:nth-child(even) {
      background: #fcfcfd;
    }

    /* Em telas largas, ajustar espaços */
    @media (min-width: 1200px) {
      #fluxoForm #procResults th.th-numero { min-width: 380px; }
      #fluxoForm #procResults td.col-numero { max-width: 420px; }
      #fluxoForm #procResults th.th-title { min-width: 460px; }
      #fluxoForm #procResults td.col-title { max-width: 560px; }
    }

    /* Mensagens vazias/estado no container de resultados - tema claro */
    #fluxoForm #procResults .text-muted,
    #fluxoForm #procResults .empty-state,
    #fluxoForm #procResults .no-results,
    #fluxoForm #procResults .loading-state {
      color: #374151 !important;      /* texto cinza-escuro legível */
      background: #ffffff;            /* fundo branco */
      padding: 8px 10px;
      border-radius: 4px;
    }

    /* Opcional: dar uma leve borda para destacar a mensagem */
    #fluxoForm #procResults .text-muted {
      border: 1px dashed #e5e7eb;
    }

    /* ====== Estilos para a lista de documentos dentro do trDocs ====== */
    #fluxoForm .docs-container {
      padding: 6px;
      background: #fff;
    }

    #fluxoForm .docs-container table {
      font-size: 0.75rem; /* diminuir 2 pontos em relação à lista principal */
      table-layout: fixed;
    }

    #fluxoForm .docs-container thead th {
      background: #ffffff;
      color: #111827;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    /* coluna do número do doc bem estreita */
    #fluxoForm .docs-container td.col-doc-number,
    #fluxoForm .docs-container th.col-doc-number {
      width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      font-size: 0.72rem;
    }

    #fluxoForm .docs-container td.col-doc-title,
    #fluxoForm .docs-container th.col-doc-title {
      font-size: 0.75rem;
      padding-left: 6px;
      white-space: normal;
    }

    /* pequenas melhorias de responsividade para o docs container */
    @media (max-width: 480px) {
      #fluxoForm #procResults table.table { font-size: 0.75rem; }
      #fluxoForm #procResults td.col-numero { min-width: 260px; }
      #fluxoForm .docs-container td.col-doc-number { width: 90px; font-size: 0.68rem; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.type = 'text/css';
  styleEl.setAttribute('data-injected', 'proc-search-css');
  styleEl.appendChild(document.createTextNode(css));
  document.head.appendChild(styleEl);
})();
 
///

function normalizeSeiNumber(seiNumber) {
  return seiNumber.replace(/[.\-\/\s]/g, '');
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

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
  const lista = await fetchJSON('/usuarios-externos');
  return lista.map(u => ({
    value: u.nome,
    label: u.nome,
    id: u._id,
    idExterno: u.idExterno
  }));
}

async function carregarContratos() {
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

// ---------- Helpers ----------
function hojeYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function agoraParaDatetimeLocalMin() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ---------- Normalização de texto ----------
// Tenta decodificar URL-encoding e também converte '+' em espaço quando apropriado.
function decodePossiblyEncoded(str) {
  if (!str) return '';
  const s = String(str);
  const seemsPercentEncoded = /%[0-9A-Fa-f]{2}/.test(s);
  let candidate = s.replace(/\+/g, ' ');
  if (seemsPercentEncoded) {
    try { candidate = decodeURIComponent(candidate); } catch {}
  }
  return candidate.trim();
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
    console.log('Resposta da API:', json);
    
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

// Mapeia processo com normalização do título/especificação
function mapProcRow(p) {
  const numero = p.seiNumber || p.seiNumberNorm || p.processNumber || p.numero || p.sei || '';
  const atrib  = p.unit || p.assignedTo || p.unidade || p.atribuicao || '';
  const rawTitulo = p.title || p.spec || p.description || p.descricao || p.especificacao || '';
  const titulo = decodePossiblyEncoded(rawTitulo);
  return { numero, atrib, titulo };
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
    opt.value = o.value;
    opt.textContent = o.label;
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
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text', required: false },
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
        { id: 'processoSei', placeholder: 'Número do Processo SEI', type: 'text', required: false },
        { id: 'instrucoes', placeholder: 'Instruções', type: 'textarea' },
      ];

    } else if (fluxo === 'Inserir anexo em doc SEI') {
      campos = [
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text', required: false },
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
        { id: 'arquivo', placeholder: 'Selecione o arquivo', type: 'file' },
      ];

    } else if (fluxo === 'Inserir imagem em doc SEI') {
      campos = [
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text', required: false },
        { id: 'numeroDocSei', placeholder: 'Número do DOC_SEI', type: 'text' },
        { id: 'metodoUpload', placeholder: 'Método de Upload', type: 'radio', options: ['Imagens Individuais', 'Arquivo ZIP', 'PDF para JPG'] },
      ];

    } else if (fluxo === 'Assinatura em doc SEI') {
      campos = [
        { id: 'processo_sei', placeholder: 'Número do Processo SEI', type: 'text', required: false },
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
        { id: 'numero', placeholder: 'Número', type: 'text' },
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
    grp.className = 'form-group proc-search-group';

    const lbl = document.createElement('label');
    lbl.textContent = 'Buscar processo (qualquer campo)';
    lbl.htmlFor = 'buscaProcGlobal';

    const row = document.createElement('div');
    row.className = 'proc-search-row';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control';
    inp.id = 'buscaProcGlobal';
    inp.placeholder = 'Digite parte do número, título, atribuição...';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Buscar';

    row.appendChild(inp);
    row.appendChild(btn);
    grp.appendChild(lbl);
    grp.appendChild(row);

    const resWrap = document.createElement('div');
    resWrap.id = 'procResults';
    resWrap.className = 'mt-2';
    grp.appendChild(resWrap);

    // Coloca a busca no topo do form
    fluxoForm.insertBefore(grp, fluxoForm.firstChild);

    // Pequeno espaçador
    const spacer = document.createElement('div');
    spacer.className = 'after-search-spacer';
    fluxoForm.insertBefore(spacer, grp.nextSibling);

    let pagina = 1;
    const limite = 10;

    async function executarBusca(page = 1) {
      const term = inp.value.trim();
      if (term.length < 2) {
        resWrap.innerHTML = '<div class="text-muted p-2">Digite pelo menos 2 caracteres.</div>';
        return;
      }
      resWrap.innerHTML = '<div class="text-muted p-2">Buscando…</div>';
      const { items, page: p, pages, total } = await buscarProcessosGlobais(term, page, limite);
      if (!items.length) {
        resWrap.innerHTML = '<div class="text-muted p-2">Nenhum processo encontrado.</div>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm table-hover table-bordered mb-0';
      table.style.tableLayout = 'fixed';
      table.innerHTML = `
        <thead>
          <tr>
            <th class="th-numero">Número</th>
            <th class="th-title">Título/Especificação</th>
            <th class="th-atrib">Atribuição</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');
items.forEach(proc => {
  const m = mapProcRow(proc);

  // Linha principal do processo
  const tr = document.createElement('tr');
  const titleCell = `
    <td class="col-title" title="${m.titulo}">
      <div class="title-scroll">${m.titulo}</div>
    </td>
  `;
 tr.innerHTML = `
  <td class="col-action" title="Abrir documentos">
    <button class="btn btn-sm btn-link btn-expand-docs" title="Mostrar documentos">+</button>
  </td>
  <td class="col-numero" title="${m.numero}">${m.numero}</td>
  ${titleCell}
  <td class="col-atrib" title="${m.atrib}">${m.atrib}</td>
`;

  // Linha extra para documentos, inicialmente oculta
  const trDocs = document.createElement('tr');
  trDocs.style.display = 'none';
  const tdDocs = document.createElement('td');
  tdDocs.colSpan = 4; // ocupa todas as colunas
  tdDocs.innerHTML = '<div class="docs-container">Carregando documentos...</div>';
  trDocs.appendChild(tdDocs);


  
  // Evento para expandir/contrair documentos
  
// em vez de declarar uma const, anexa o listener direto:
tr.querySelector('.btn-expand-docs').addEventListener('click', async (e) => {
  e.stopPropagation();

  const normalizedNumber = normalizeSeiNumber(m.numero);
  console.log('Número do processo para documentos:', m.numero);
  console.log('Número normalizado:', normalizedNumber);

  if (trDocs.style.display === 'none') {
    trDocs.style.display = '';
    const container = tdDocs.querySelector('.docs-container');
    container.innerHTML = 'Carregando documentos...';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/processes/by-sei/${encodeURIComponent(normalizedNumber)}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const payload = await res.json();
      console.log('Payload de documentos:', payload);

      const docs = Array.isArray(payload) ? payload : (payload.items || payload.data || payload.results || []);

      if (!docs || docs.length === 0) {
        container.innerHTML = '<em>Nenhum documento encontrado.</em>';
      } else {
        const list = document.createElement('ul');
        docs.forEach(doc => {
          const li = document.createElement('li');
          li.textContent = `${doc.title || doc.docTitle || doc.name || 'Documento sem título'}${(doc.docNumber || doc.date) ? ' - ' + (doc.docNumber || doc.date) : ''}`;
          list.appendChild(li);
        });
        container.innerHTML = '';
        container.appendChild(list);
      }
    } catch (err) {
      console.error(err);
      container.innerHTML = `<span class="text-danger">Erro ao carregar documentos: ${err.message}</span>`;
    }
  } else {
    trDocs.style.display = 'none';
  }
});
//

// --- dentro do items.forEach, após criar tr, trDocs e tdDocs ---
// Substitua ambos os listeners por este bloco (dentro do items.forEach, após criar tr, trDocs, tdDocs)
const btn = tr.querySelector('.btn-expand-docs');
if (!btn) {
  console.warn('botão .btn-expand-docs NÃO encontrado para o processo:', m.numero);
} else {
  btn.onclick = async (e) => {
    e.stopPropagation();
    console.log('📄 clique documento para processo', m.numero);

    const normalizedNumber = normalizeSeiNumber(m.numero);
    console.log('Número normalizado:', normalizedNumber);

    const container = tdDocs.querySelector('.docs-container');
    if (!container) {
      console.error('Container de documentos não encontrado para', m.numero);
      return;
    }

    // Toggle: se oculto, abre; se aberto, fecha
    const isClosed = trDocs.style.display === 'none' || !trDocs.style.display;
    if (!isClosed && trDocs.style.display !== 'none') {
      trDocs.style.display = 'none';
      return;
    }
    trDocs.style.display = ''; // mostra
    container.innerHTML = 'Carregando documentos...';

    try {
      const token = localStorage.getItem('token');
      console.log('fetch documentos para', normalizedNumber);
      const res = await fetch(`${apiUrl}/api/processes/by-sei/${encodeURIComponent(normalizedNumber)}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('HTTP status documentos:', res.status, res.statusText);

      let payload;
      try {
        payload = await res.json();
      } catch (jsonErr) {
        const txt = await res.text().catch(() => '(erro lendo texto)');
        console.warn('Resposta não-JSON do servidor:', txt.slice(0,500));
        container.innerText = 'Resposta inesperada do servidor (não JSON). Veja Console.';
        console.log('RAW RESPONSE:', txt);
        return;
      }
      console.log('Payload de documentos:', payload);

      const docs = Array.isArray(payload) ? payload
                 : Array.isArray(payload.items) ? payload.items
                 : Array.isArray(payload.data) ? payload.data
                 : Array.isArray(payload.results) ? payload.results
                 : Array.isArray(payload.docs) ? payload.docs
                 : null;

      if (!docs || docs.length === 0) {
        console.warn('Nenhum documento extraído pelo parser. Mostrando payload cru no container para inspeção.');
        container.innerHTML = `<pre style="white-space:pre-wrap;max-height:300px;overflow:auto;">${escapeHtml(JSON.stringify(payload, null, 2)).slice(0,20000)}</pre>`;
        return;
      }

      // monta tabela: Número | Título
      const table = document.createElement('table');
      table.className = 'table table-sm mb-0';
      table.style.width = '100%';

      const thead = document.createElement('thead');
      thead.innerHTML = `<tr><th style="width:30%;">Número</th><th>Título</th></tr>`;
      table.appendChild(thead);

      const tbodyDocs = document.createElement('tbody');

      docs.forEach(doc => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';

        const numeroExib = doc.seiNumber || doc.docNumber || doc.docNumberText || doc.number || '';
        const tituloExib = stripHtml(doc.docTitle || doc.title || doc.name || doc.description || '');

        const tdNum = document.createElement('td');
        tdNum.className = 'col-numero';
        tdNum.textContent = numeroExib;
        tdNum.title = numeroExib;

        const tdTitle = document.createElement('td');
        tdTitle.className = 'col-title';
        tdTitle.title = tituloExib;
        const divTitle = document.createElement('div');
        divTitle.className = 'title-scroll';
        divTitle.style.whiteSpace = 'normal';
        divTitle.textContent = tituloExib;
        tdTitle.appendChild(divTitle);

        row.appendChild(tdNum);
        row.appendChild(tdTitle);

        // clique na linha do documento: preenche input id="numeroDocSei" (confirme este id no formulário)
        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const inputDoc = document.getElementById('numeroDocSei'); // <-- usar este id (camelCase) se for o que você criou
          const valueToSet = numeroExib || '';
          if (inputDoc) {
            inputDoc.value = valueToSet;
            if (typeof showAlert === 'function') showAlert(`Documento selecionado: ${valueToSet}`, 'success');
            inputDoc.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inputDoc.classList.add('is-valid');
            setTimeout(() => inputDoc.classList.remove('is-valid'), 1500);
          } else {
            console.warn('input id="numeroDocSei" não encontrado. Valor:', valueToSet);
          }
        });

        tbodyDocs.appendChild(row);
      });

      table.appendChild(tbodyDocs);
      container.innerHTML = '';
      container.appendChild(table);

    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
      container.innerHTML = `<span class="text-danger">Erro ao carregar documentos: ${err.message}</span>`;
    }
  };
}

// helper escape HTML (para debug)
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


  
  // Clique na linha principal seleciona o processo (sem expandir docs)
  tr.addEventListener('click', () => {
    if (!m.numero) return;
    campoNumeroProc.value = m.numero;
    showAlert(`Processo selecionado: ${m.numero}`, 'success');
    campoNumeroProc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    campoNumeroProc.classList.add('is-valid');
    setTimeout(() => campoNumeroProc.classList.remove('is-valid'), 1500);
  });

  tbody.appendChild(tr);
  tbody.appendChild(trDocs);
});
    
      // wrapper com rolagem vertical da lista
      const scrollWrap = document.createElement('div');
      scrollWrap.className = 'results-scroll';
      scrollWrap.style.maxHeight = '240px';
      scrollWrap.style.overflow = 'auto';
      scrollWrap.style.webkitOverflowScrolling = 'touch';
      scrollWrap.appendChild(table);

      // paginação
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
      resWrap.style.overflow = 'visible';
      resWrap.appendChild(scrollWrap);

      const pagWrap = document.createElement('div');
      pagWrap.appendChild(prev);
      pagWrap.appendChild(info);
      pagWrap.appendChild(next);
      pager.appendChild(pagWrap);
      resWrap.appendChild(pager);
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

  // ----- Containers extras -----
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

  // ====== BLOCO DE AGENDAMENTO ======
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
  rImediato.checked = true;

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

   console.log('[DEBUG] listando inputs do form antes de enviar:');
e.target.querySelectorAll('input[type="file"]').forEach(inp => {
  console.log(' ->', inp.id, 'name=', inp.name);
});

  const envioSelecionado = (e.target.querySelector('input[name="envio"]:checked') || {}).value || 'imediato';
  if (envioSelecionado === 'agendar') {
    const quandoEl = e.target.querySelector('#quando');
    if (!quandoEl || !quandoEl.value) {
      showAlert('Informe a data e hora do agendamento.', 'warning');
      return;
    }
    const min = quandoEl.min ? new Date(quandoEl.min) : null;
    const escolhido = new Date(quandoEl.value);
    if (min && escolhido < min) {
      showAlert('Escolha um horário de agendamento no futuro (mínimo alguns minutos à frente).', 'warning');
      return;
    }

  }

  showLoadingOverlay();

  const fluxo = document.getElementById('modalTitle').innerText;
 // monta o FormData com segurança
const formData = new FormData();
formData.append('fluxo', fluxo);

const inputs = e.target.querySelectorAll('input, textarea, select');
inputs.forEach((input) => {
  const name = (input.name || '').trim();   // <- garante nome
  if (!name) return;                        // <- pula campos sem name

  if (input.type === 'file' && input.files && input.files.length > 0) {
    for (let i = 0; i < input.files.length; i++) {
      formData.append(name, input.files[i]);
    }
  } else if (input.type === 'radio') {
    if (input.checked) formData.append(name, input.value);
  } else if (input.type !== 'file') {
    formData.append(name, (input.value || '').trim());
  }
});

// debug: veja o que realmente está indo
for (const [k, v] of formData.entries()) {
  console.log('[FD]', k, v instanceof File ? `File:${v.name}` : v);
}


  if (envioSelecionado === 'agendar') {
    const whenEl = e.target.querySelector('#quando');
    if (whenEl && whenEl.value) {
      formData.append('quandoUtc', new Date(whenEl.value).toISOString());
    }
  }

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
  console.error('send-email erro:',
    err?.response?.status,
    err?.response?.data || err?.message
  );
  showAlert('Falha ao processar sua solicitação.', 'danger');
})

  .finally(() => {
    hideLoadingOverlay();
  });
}

// Expor no escopo global
window.abrirFormulario = abrirFormulario;

// ==================== fim script.js ====================
