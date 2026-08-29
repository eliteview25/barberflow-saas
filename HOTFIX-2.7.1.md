# BarberFlow 2.7.1 — Hotfix de inicialização

- Corrige import ausente de `exigirStepUp` em `backend/src/routes/operacao.js`.
- Corrige import ausente de `exigirStepUp` em `backend/src/routes/ai.js`.
- Adiciona teste de runtime que carrega o `src/app.js` e todas as rotas para detectar `ReferenceError` durante o boot.
- Nenhuma alteração de banco ou funcionalidade de negócio.
