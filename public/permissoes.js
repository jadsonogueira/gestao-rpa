document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${window.location.origin}/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await res.json();
    if (!data.valid) {
      localStorage.removeItem('token');
      return window.location.href = 'login.html';
    }

    const userRole = data.userRole || data.role;

    const restricoes = {
      'classe_a': ['Assinatura em doc SEI', 'Criar Doc SEI Editável', 'Criar Doc SEI Externo'],
      'classe_b': ['Criar Doc SEI Editável', 'Criar Doc SEI Externo'],
      'classe_c': ['Criar Doc SEI Externo'],
      'classe_d': [],
      'classe_e': [],
      'admin': [] // sem restrição
    };

    const fluxosRestritos = restricoes[userRole] || [];

    document.querySelectorAll('.card.service-card').forEach(card => {
      const titulo = card.querySelector('.card-title')?.textContent.trim();
      if (fluxosRestritos.includes(titulo)) {
        card.classList.add('restrito');
        card.removeAttribute('onclick');
        card.setAttribute('data-toggle', 'tooltip');
        card.setAttribute('title', 'Acesso restrito: serviço disponível apenas para níveis superiores');
      }
    });

    // Inicializar tooltips (requer jQuery e Bootstrap)
    if (window.jQuery) {
      $('[data-toggle="tooltip"]').tooltip();
    }
  } catch (err) {
    console.error('Erro ao aplicar permissões:', err);
  }
});