// ... (resto do código permanece igual até a função enviarFormulario)

async function enviarFormulario(e) {
  e.preventDefault();
  const fluxo = document.getElementById('modalTitle').innerText;
  
  // Cria um objeto para armazenar os dados do formulário
  const dados = {};
  const form = e.target;
  
  // Pega todos os campos do formulário, exceto o arquivo
  for (let element of form.elements) {
    if (element.name && element.name !== 'anexo' && element.type !== 'submit') {
      dados[element.name] = element.value;
    }
  }

  // Cria o FormData
  const formData = new FormData();
  formData.append('fluxo', fluxo);
  formData.append('dados', JSON.stringify(dados)); // Converte o objeto dados para JSON string

  // Adiciona o arquivo se existir
  const anexoInput = form.querySelector('input[type="file"]');
  if (anexoInput && anexoInput.files[0]) {
    formData.append('anexo', anexoInput.files[0]);
  }

  try {
    const res = await fetch(`${apiUrl}/send-email`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    const data = await res.text();
    showAlert('Solicitação enviada com sucesso.', 'success');
    $('#fluxoModal').modal('hide');
  } catch (error) {
    console.error('Erro ao enviar formulário:', error);
    showAlert(`Erro ao enviar a solicitação: ${error.message}`, 'danger');
  }
}