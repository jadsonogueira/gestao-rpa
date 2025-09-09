// script2.js — Carregador de formulários para o dashboard2 (sem alterar seu script atual)
(function () {
  const BASE_FORMS = "/forms"; // ajuste se seus formulários estiverem em outra pasta

  // Nome do card -> arquivo HTML do formulário
  const FORM_MAP = {
    "Consultar empenho": "consultar-empenho.html",
    "Liberar assinatura externa": "liberar-assinatura-externa.html",
    "Liberar acesso externo": "liberar-acesso-externo.html",
    "Alterar ordem de documentos": "alterar-ordem-documentos.html",
    "Inserir anexo em doc SEI": "inserir-anexo-doc-sei.html",
    "Inserir imagem em doc SEI": "inserir-imagem-doc-sei.html",
    "Assinatura em doc SEI": "assinatura-doc-sei.html",
    "Criar Doc SEI Externo": "criar-doc-sei-externo.html",
    "Criar Doc SEI Editável": "criar-doc-sei-editavel.html",
    "Analise de processo": "analise-de-processo.html",
    "Unir PDFs": "pdf-merge.html",
    "Dividir PDF": "pdf-split.html",
    "PDF pesquisável (OCR)": "pdf-ocr.html",
    "PDF para JPG": "pdf-to-jpg.html"
  };

  function slugify(nome) {
    return nome.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function carregarFormularioHTML(nome) {
    const arquivo = FORM_MAP[nome] || `${slugify(nome)}.html`;
    const url = `${BASE_FORMS}/${arquivo}`;
    const bodyEl = document.querySelector("#fluxoModal .modal-body");
    if (!bodyEl) return;

    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      bodyEl.innerHTML = html;
      // Inicializa tooltips que eventualmente existam no HTML carregado
      if (window.$) $('[data-toggle="tooltip"]', bodyEl).tooltip();
    } catch (err) {
      bodyEl.innerHTML = `
        <div class="alert alert-warning" role="alert">
          Não foi possível carregar <b>${nome}</b> em <code>${url}</code>.<br>
          <small>Detalhes: ${err.message}</small>
        </div>`;
    }
  }

  // Mantém a função original e apenas “envolve” para injetar o HTML do formulário
  const originalAbrir = window.abrirFormulario;
  window.abrirFormulario = function (nome) {
    // chama a função já definida no dashboard2.html (abre o modal e mostra o loader)
    if (typeof originalAbrir === "function") {
      originalAbrir(nome);
    }
    // depois carrega o conteúdo real do formulário
    carregarFormularioHTML(nome);
  };

  console.log("[script2.js] ativo — formulários serão carregados de /forms/*.html");
})();
