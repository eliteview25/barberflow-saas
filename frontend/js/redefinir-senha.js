const token = new URLSearchParams(location.search).get('token') || '';
const btn = document.getElementById('btn');
const senha = document.getElementById('senha');
const msg = document.getElementById('msg');
senha.maxLength = 72;

function aviso(texto, tipo = 'error') {
  msg.className = 'notice ' + tipo;
  msg.textContent = texto;
}

async function validarLink() {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    aviso('Link inválido ou expirado. Solicite uma nova recuperação.');
    btn.disabled = true;
    return false;
  }

  try {
    const r = await fetch('/api/auth/validar-reset', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token})
    });

    if (!r.ok) {
      aviso('Link inválido ou expirado. Solicite uma nova recuperação.');
      btn.disabled = true;
      return false;
    }

    return true;
  } catch {
    aviso('Não foi possível validar o link agora. Tente novamente.');
    btn.disabled = true;
    return false;
  }
}

btn.addEventListener('click', async () => {
  btn.disabled = true;

  try {
    const r = await fetch('/api/auth/redefinir-senha', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        token,
        senha: senha.value
      })
    });

    const d = await r.json().catch(() => ({}));

    aviso(
      d.mensagem || d.erro || 'Não foi possível atualizar a senha.',
      r.ok ? 'success' : 'error'
    );

    if (r.ok) {
      setTimeout(() => location.replace('/login.html'), 1200);
    }
  } finally {
    if (!msg.classList.contains('success')) {
      btn.disabled = false;
    }
  }
});

validarLink();
