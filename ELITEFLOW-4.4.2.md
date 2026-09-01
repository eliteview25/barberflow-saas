# EliteFlow 4.4.2 — Foto do barbeiro no próprio acesso

- O login do usuário com papel `barbeiro` usa a foto do cadastro profissional vinculado por `barbeiro_id` quando a conta não tiver uma foto própria.
- `/api/auth/me` aplica o mesmo fallback para manter a imagem atualizada em sessões existentes.
- Cabeçalho, sidebar e cartão de perfil mobile são atualizados após a sincronização da sessão.
- O vínculo exige o mesmo `barbearia_id`, preservando o isolamento entre tenants.
