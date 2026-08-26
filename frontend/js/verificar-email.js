(() => {
    const token = new URLSearchParams(location.search).get('token');
    const msg = document.getElementById('msg');
    const btn = document.getElementById('confirmarEmail');

    if (
        !token ||
        token.length < 32 ||
        token.length > 200 ||
        !/^[A-Za-z0-9_-]+$/.test(token)
    ) {
        msg.textContent = 'Link inválido ou expirado';
        msg.className = 'notice error';
        btn.hidden = true;
        return;
    }

    msg.textContent = 'Clique no botão abaixo para confirmar seu e-mail.';
    btn.hidden = false;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        msg.textContent = 'Confirmando e-mail...';

        try {
            const r = await fetch('/api/auth/verificar-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            const d = await r.json();

            msg.textContent =
                d.mensagem ||
                d.erro ||
                'Não foi possível confirmar o e-mail';

            msg.className = 'notice ' + (r.ok ? 'success' : 'error');

            if (r.ok) {
                btn.hidden = true;
            } else {
                btn.disabled = false;
            }

        } catch {
            msg.textContent = 'Não foi possível confirmar o e-mail';
            msg.className = 'notice error';
            btn.disabled = false;
        }
    });
})();