// script2.js – versão de teste para dashboard2
console.log("[script2.js] carregado");

const FORM_MAP2 = {
  "Consultar empenho": "consultar-empenho.html",
  "Liberar assinatura externa": "liberar-assinatura-externa.html",
  "Unir PDFs": "pdf-merge.html"
};
const BASE_FORMS = "/forms"; // ajuste a pasta conforme sua estrutura

function slugify2(nome) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


async function carregarFormulario2(nome, destinoEl) {
  const arquivo = FORM_MAP2[nome] || `${slugify2(nome)}.html`;
  const url = `${BASE_FORMS}/${arquivo}`;

  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`);
    const html = await resp.text();
    destinoEl.innerHTML = html;
  } catch (err) {
    destinoEl.innerHTML = `<div class="alert alert-warning">Falha ao carregar formulário <b>${nome}</b>: ${err.message}</div>`;
  }
}

window.abrirFormulario2 = function(nome) {
  const title = document.getElementById("modalTitle2");
  const body  = document.querySelector("#fluxoModal2 .modal-body");
  if (title) title.textContent = nome;
  if (body) body.innerHTML = `<p class="text-muted">Carregando formulário <b>${nome}</b>...</p>`;
  $('#fluxoModal2').modal('show');
  carregarFormulario2(nome, body);
};
