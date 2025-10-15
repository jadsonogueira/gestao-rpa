// processoSearch.js — usa sua rota EXISTENTE: /api/processos?search=
(() => {
  const API = '/api/processos';   // ← sua rota já existente
  const DEBOUNCE_MS = 300;

  const debounce = (fn, ms) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function attachSearchDropdown(input, onPick) {
    const dd = document.createElement('div');
    dd.className = 'proc-dd shadow rounded border bg-white';
    dd.style.position = 'absolute'; dd.style.zIndex = '9999';
    dd.style.minWidth = (input.offsetWidth || 320) + 'px'; dd.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input); wrap.appendChild(dd);

    function render(items) {
      dd.innerHTML = '';
      if (!items?.length) { dd.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">Nenhum resultado</div>'; return; }
      items.forEach(it => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100';
        row.innerHTML = `
          <div class="font-medium">${escapeHtml(it.numero || '-')}</div>
          <div class="text-xs text-gray-600">${escapeHtml(it.titulo || '-')}</div>
          <div class="text-[11px] text-gray-500">Atrib.: ${escapeHtml(it.atribuicao || '-')}</div>`;
        row.addEventListener('click', () => { dd.style.display = 'none'; onPick(it); });
        dd.appendChild(row);
      });
    }

    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) dd.style.display = 'none'; });

    const doSearch = debounce(async () => {
      const q = input.value.trim();
      if (!q) { dd.style.display = 'none'; return; }
      try {
        // usa seu contrato atual: /api/processos?search=<termo>
        const url = `${API}?search=${encodeURIComponent(q)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        // aceite {items:[...]} OU array direto:
        const items = Array.isArray(data) ? data : (data.items || data);
        render(items);
        dd.style.minWidth = input.offsetWidth + 'px';
        dd.style.display = 'block';
      } catch (e) { console.error('Erro buscando processos:', e); }
    }, DEBOUNCE_MS);

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', () => { if (input.value.trim()) doSearch(); });
  }

  function initProcSearch() {
    document.querySelectorAll('input[data-proc-search]:not([data-proc-disabled])')
      .forEach((input) => {
        const targetSel = input.getAttribute('data-proc-target');
        const targetEl = targetSel && document.querySelector(targetSel);
        if (!targetEl) return;
        attachSearchDropdown(input, (proc) => {
          targetEl.value = proc.numero || '';
          input.dispatchEvent(new Event('blur'));
          targetEl.dispatchEvent(new Event('change'));
        });
      });
  }

  window.__procSearch = { init: initProcSearch };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProcSearch);
  } else { initProcSearch(); }
})();
