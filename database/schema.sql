-- O schema oficial é criado/atualizado por: cd backend && npm run migrate
-- Este arquivo documenta as entidades da versão SaaS.
-- barbearias -> tenant isolado
-- usuarios -> login e papéis (dono, gerente, recepcao, barbeiro)
-- usuarios.barbeiro_id -> vínculo opcional e exclusivo para contas do tipo barbeiro
-- assinaturas -> trial/plano/status
-- clientes, barbeiros, servicos, horarios_trabalho, agendamentos -> todos possuem barbearia_id
-- password_resets -> recuperação de senha com token de uso único


-- Pagamentos multiempresa / Mercado Pago OAuth
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS aceitar_mercadopago BOOLEAN DEFAULT false;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mp_aceitar_pix BOOLEAN DEFAULT true;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mp_aceitar_cartao BOOLEAN DEFAULT true;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS aceitar_pix_manual BOOLEAN DEFAULT false;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS pix_chave TEXT;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS pix_nome VARCHAR(160);
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS pix_banco VARCHAR(120);
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS aceitar_dinheiro BOOLEAN DEFAULT true;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(30) DEFAULT 'nao_informado';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status_pagamento VARCHAR(30) DEFAULT 'nao_exigido';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_cobrado NUMERIC(10,2) DEFAULT 0;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) DEFAULT 0;
ALTER TABLE reservas_pagamento ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(30) DEFAULT 'mercado_pago';
CREATE TABLE IF NOT EXISTS integracoes_pagamento(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,provedor VARCHAR(40) NOT NULL,mp_user_id TEXT,access_token_enc TEXT,refresh_token_enc TEXT,public_key TEXT,scope TEXT,expires_at TIMESTAMP,status VARCHAR(30) DEFAULT 'desconectado',conectado_em TIMESTAMP,atualizado_em TIMESTAMP DEFAULT NOW(),UNIQUE(barbearia_id,provedor));
CREATE TABLE IF NOT EXISTS oauth_states(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,state TEXT UNIQUE NOT NULL,code_verifier TEXT NOT NULL,expira_em TIMESTAMP NOT NULL,criado_em TIMESTAMP DEFAULT NOW());


-- Preparação para IA no WhatsApp (motor será integrado na próxima etapa)
CREATE TABLE IF NOT EXISTS ai_config(
  barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  nome_assistente VARCHAR(60) NOT NULL DEFAULT 'Sofia',
  tom VARCHAR(20) NOT NULL DEFAULT 'amigavel' CHECK(tom IN ('profissional','amigavel','descontraido')),
  mensagem_inicial VARCHAR(500), mensagem_fallback VARCHAR(500),
  consultar_horarios BOOLEAN NOT NULL DEFAULT true, criar_agendamento BOOLEAN NOT NULL DEFAULT true,
  reagendar BOOLEAN NOT NULL DEFAULT true, cancelar BOOLEAN NOT NULL DEFAULT true,
  informar_precos BOOLEAN NOT NULL DEFAULT true, enviar_link_pagamento BOOLEAN NOT NULL DEFAULT true,
  transferir_solicitacao BOOLEAN NOT NULL DEFAULT true, transferir_reclamacao BOOLEAN NOT NULL DEFAULT true,
  transferir_pagamento BOOLEAN NOT NULL DEFAULT true, limite_mensal INTEGER NOT NULL DEFAULT 500,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_uso_mensal(
  barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
  mes DATE NOT NULL, atendimentos INTEGER NOT NULL DEFAULT 0,
  tokens_entrada BIGINT NOT NULL DEFAULT 0, tokens_saida BIGINT NOT NULL DEFAULT 0,
  custo_centavos INTEGER NOT NULL DEFAULT 0, atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY(barbearia_id,mes)
);
