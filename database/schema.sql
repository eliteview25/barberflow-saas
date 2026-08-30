-- O schema oficial é criado/atualizado por: cd backend && npm run migrate
-- Este arquivo documenta as entidades da versão SaaS.
-- barbearias -> tenant isolado
-- usuarios -> login e papéis (dono, gerente, recepcao, barbeiro)
-- usuarios.barbeiro_id -> vínculo opcional e exclusivo para contas do tipo barbeiro
-- assinaturas -> trial/plano/status
-- clientes, barbeiros, servicos, horarios_trabalho, agendamentos -> todos possuem barbearia_id
-- password_resets -> recuperação de senha com token de uso único


-- Segurança 2FA do Supermaster: chave de troca pendente sem invalidar o autenticador atual
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT;

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
CREATE TABLE IF NOT EXISTS integracoes_pagamento(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,provedor VARCHAR(40) NOT NULL,mp_user_id TEXT,provider_account_id TEXT,access_token_enc TEXT,refresh_token_enc TEXT,secret_enc TEXT,public_key TEXT,scope TEXT,expires_at TIMESTAMP,environment VARCHAR(20) DEFAULT 'production',metadata JSONB NOT NULL DEFAULT '{}'::jsonb,capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,status VARCHAR(30) DEFAULT 'desconectado',last_verified_at TIMESTAMP,last_error TEXT,conectado_em TIMESTAMP,atualizado_em TIMESTAMP DEFAULT NOW(),UNIQUE(barbearia_id,provedor));
CREATE TABLE IF NOT EXISTS oauth_states(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,state TEXT UNIQUE NOT NULL,code_verifier TEXT NOT NULL,provedor VARCHAR(40) NOT NULL DEFAULT 'mercadopago',expira_em TIMESTAMP NOT NULL,criado_em TIMESTAMP DEFAULT NOW());


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


-- Pré-lançamento V1

ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS onboarding_link_compartilhado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS onboarding_concluido_em TIMESTAMP;
CREATE TABLE IF NOT EXISTS legal_acceptances(id BIGSERIAL PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,documento VARCHAR(40) NOT NULL,versao VARCHAR(30) NOT NULL,ip INET,user_agent TEXT,aceito_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(usuario_id,documento,versao));
CREATE TABLE IF NOT EXISTS support_tickets(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,categoria VARCHAR(40) NOT NULL,assunto VARCHAR(160) NOT NULL,mensagem TEXT NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'aberto',prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',resposta TEXT,respondido_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),CHECK(status IN ('aberto','em_atendimento','resolvido','fechado')),CHECK(prioridade IN ('baixa','normal','alta')));
CREATE TABLE IF NOT EXISTS system_events(id BIGSERIAL PRIMARY KEY,nivel VARCHAR(20) NOT NULL,evento VARCHAR(80) NOT NULL,request_id VARCHAR(128),barbearia_id INTEGER REFERENCES barbearias(id) ON DELETE SET NULL,usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,mensagem TEXT,detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),CHECK(nivel IN ('info','warn','error')));
CREATE TABLE IF NOT EXISTS backup_runs(id BIGSERIAL PRIMARY KEY,status VARCHAR(30) NOT NULL,destino VARCHAR(40) NOT NULL,tamanho_bytes BIGINT,arquivo VARCHAR(240),erro TEXT,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),CHECK(status IN ('sucesso','local_only','falhou')));
CREATE INDEX IF NOT EXISTS ix_legal_acceptances_tenant ON legal_acceptances(barbearia_id,aceito_em DESC);
CREATE INDEX IF NOT EXISTS ix_support_tickets_tenant ON support_tickets(barbearia_id,status,criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON support_tickets(status,criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_system_events_level_data ON system_events(nivel,criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_backup_runs_data ON backup_runs(criado_em DESC);


-- Metas financeiras por mês (barbearia e barbeiros)
CREATE TABLE IF NOT EXISTS metas_financeiras(
  id BIGSERIAL PRIMARY KEY,
  barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
  barbeiro_id INTEGER REFERENCES barbeiros(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK(valor>=0),
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_meta_financeira_geral_mes ON metas_financeiras(barbearia_id,mes) WHERE barbeiro_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_meta_financeira_barbeiro_mes ON metas_financeiras(barbearia_id,barbeiro_id,mes) WHERE barbeiro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_metas_financeiras_tenant_mes ON metas_financeiras(barbearia_id,mes DESC);


-- BarberFlow 2.5 — catálogo de produtos e gateways da plataforma
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
CREATE TABLE IF NOT EXISTS platform_payment_gateways(
  provedor VARCHAR(40) PRIMARY KEY,
  secret_enc TEXT,
  public_key TEXT,
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  status VARCHAR(30) NOT NULL DEFAULT 'sem_credenciais',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Experiência pública e configurações da plataforma (2.5.3)
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mostrar_whatsapp_publico BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mostrar_mapa_publico BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS platform_settings(
  chave VARCHAR(80) PRIMARY KEY,
  valor TEXT,
  atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);


-- BarberFlow 2.6: loja pública, retenção de exclusões e ciclo anual
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_ativa BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_titulo VARCHAR(160);
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_descricao TEXT;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_logo_url TEXT;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_banner_url TEXT;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS exclusao_programada_em TIMESTAMP;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS excluida_por INTEGER;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS mostrar_na_loja BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS destaque_pagina_publica BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS descricao_publica TEXT;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS ciclo_cobranca VARCHAR(20) NOT NULL DEFAULT 'mensal';
ALTER TABLE assinaturas_pagamentos ADD COLUMN IF NOT EXISTS ciclo_cobranca VARCHAR(20) NOT NULL DEFAULT 'mensal';
CREATE INDEX IF NOT EXISTS ix_produtos_loja ON produtos(barbearia_id,mostrar_na_loja,ativo);
CREATE INDEX IF NOT EXISTS ix_barbearias_exclusao_programada ON barbearias(exclusao_programada_em) WHERE exclusao_programada_em IS NOT NULL;


-- BarberFlow 2.7: e-commerce, checkout automático e entrega por distância
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_aceitar_retirada BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_aceitar_entrega BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_retirada_instrucao TEXT;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_taxa_base NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_por_km NUMERIC(10,2) NOT NULL DEFAULT 2;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_minimo NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_gratis_ate_km NUMERIC(10,2);
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_gratis_acima NUMERIC(10,2);
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_frete_distancia_max_km NUMERIC(10,2) NOT NULL DEFAULT 20;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_aceitar_pix BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS loja_aceitar_cartao BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS loja_pedidos(
  id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,public_token TEXT NOT NULL UNIQUE,idempotency_key TEXT,
  cliente_nome VARCHAR(160) NOT NULL,cliente_email VARCHAR(160) NOT NULL,cliente_telefone VARCHAR(30) NOT NULL,tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'retirada',
  cep VARCHAR(12),endereco TEXT,numero VARCHAR(40),complemento VARCHAR(160),bairro VARCHAR(120),cidade VARCHAR(120),estado VARCHAR(40),distancia_km NUMERIC(10,2),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,frete NUMERIC(10,2) NOT NULL DEFAULT 0,total NUMERIC(10,2) NOT NULL DEFAULT 0,forma_pagamento VARCHAR(20),
  status_pagamento VARCHAR(30) NOT NULL DEFAULT 'pendente',status_pedido VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',mp_payment_id TEXT,mp_status VARCHAR(40),
  qr_code TEXT,qr_code_base64 TEXT,ticket_url TEXT,estoque_reservado BOOLEAN NOT NULL DEFAULT true,venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
  expira_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),pago_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS loja_pedido_itens(
  id BIGSERIAL PRIMARY KEY,pedido_id BIGINT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  nome VARCHAR(200) NOT NULL,imagem_url TEXT,quantidade INTEGER NOT NULL,valor_unitario NUMERIC(10,2) NOT NULL,subtotal NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_loja_pedidos_tenant_status ON loja_pedidos(barbearia_id,status_pedido,criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_loja_pedidos_expira ON loja_pedidos(status_pagamento,expira_em) WHERE status_pagamento='pendente';


-- BarberFlow 2.8: Marketing, campanhas, cupons, indicação e atribuição
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_out_em TIMESTAMP;
CREATE TABLE IF NOT EXISTS marketing_modelos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,nome VARCHAR(120) NOT NULL,template_nome_meta VARCHAR(512),idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',mensagem_preview TEXT,parametros JSONB NOT NULL DEFAULT '[]'::jsonb,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS marketing_cupons(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,codigo VARCHAR(40) NOT NULL,descricao VARCHAR(200),tipo VARCHAR(20) NOT NULL,valor NUMERIC(10,2) NOT NULL,pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,desconto_maximo NUMERIC(10,2),inicio TIMESTAMP,fim TIMESTAMP,limite_total INTEGER,limite_por_cliente INTEGER NOT NULL DEFAULT 1,usos INTEGER NOT NULL DEFAULT 0,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,codigo));
CREATE TABLE IF NOT EXISTS marketing_campanhas(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,nome VARCHAR(160) NOT NULL,objetivo VARCHAR(80),segmento VARCHAR(40) NOT NULL DEFAULT 'todos',segmento_config JSONB NOT NULL DEFAULT '{}'::jsonb,modelo_id BIGINT REFERENCES marketing_modelos(id) ON DELETE SET NULL,template_nome VARCHAR(512),template_idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',template_parametros JSONB NOT NULL DEFAULT '[]'::jsonb,mensagem_preview TEXT,cupom_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,investimento NUMERIC(10,2) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'rascunho',agendada_para TIMESTAMP,total_alvo INTEGER NOT NULL DEFAULT 0,enviados INTEGER NOT NULL DEFAULT 0,erros INTEGER NOT NULL DEFAULT 0,cliques INTEGER NOT NULL DEFAULT 0,conversoes INTEGER NOT NULL DEFAULT 0,receita NUMERIC(12,2) NOT NULL DEFAULT 0,criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,enviado_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS marketing_envios(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,campanha_id BIGINT NOT NULL REFERENCES marketing_campanhas(id) ON DELETE CASCADE,cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,telefone VARCHAR(40) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'pendente',erro TEXT,enviado_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(campanha_id,cliente_id));
CREATE TABLE IF NOT EXISTS marketing_links(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,campanha_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL,nome VARCHAR(140) NOT NULL,token VARCHAR(80) NOT NULL UNIQUE,destino VARCHAR(30) NOT NULL,cliques INTEGER NOT NULL DEFAULT 0,conversoes INTEGER NOT NULL DEFAULT 0,receita NUMERIC(12,2) NOT NULL DEFAULT 0,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS marketing_cupom_usos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cupom_id BIGINT NOT NULL REFERENCES marketing_cupons(id) ON DELETE CASCADE,loja_pedido_id BIGINT REFERENCES loja_pedidos(id) ON DELETE SET NULL,cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,telefone VARCHAR(40),valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(loja_pedido_id));
CREATE TABLE IF NOT EXISTS marketing_indicacoes_config(barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,ativo BOOLEAN NOT NULL DEFAULT false,tipo_recompensa VARCHAR(20) NOT NULL DEFAULT 'fixo',valor_indicador NUMERIC(10,2) NOT NULL DEFAULT 10,valor_indicado NUMERIC(10,2) NOT NULL DEFAULT 10,pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS marketing_indicacao_codigos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,codigo VARCHAR(40) NOT NULL UNIQUE,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,cliente_id));
CREATE TABLE IF NOT EXISTS marketing_indicacao_conversoes(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,codigo_id BIGINT NOT NULL REFERENCES marketing_indicacao_codigos(id) ON DELETE CASCADE,indicado_cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,loja_pedido_id BIGINT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,cupom_indicador_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,cupom_indicado_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,indicado_cliente_id),UNIQUE(loja_pedido_id));
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS cupom_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL;
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS cupom_codigo VARCHAR(40);
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS marketing_link_id BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL;
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS marketing_campanha_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL;
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS indicacao_codigo VARCHAR(40);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS marketing_link_id BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS marketing_campanha_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL;
ALTER TABLE reservas_pagamento ADD COLUMN IF NOT EXISTS marketing_link_id BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL;
ALTER TABLE reservas_pagamento ADD COLUMN IF NOT EXISTS marketing_campanha_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL;

-- BarberFlow 2.8.0 — complementos de consentimento, entrega/leitura e atribuição
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in_em TIMESTAMP;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in_origem VARCHAR(40);
ALTER TABLE marketing_campanhas ADD COLUMN IF NOT EXISTS link_destino VARCHAR(30);
ALTER TABLE marketing_campanhas ADD COLUMN IF NOT EXISTS marketing_link_id BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL;
ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMP;
ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS lido_em TIMESTAMP;
ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reservas_pagamento ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS ix_marketing_campanhas_tenant ON marketing_campanhas(barbearia_id,status,criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_marketing_envios_status ON marketing_envios(campanha_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_envio_provider_message ON marketing_envios(provider_message_id) WHERE provider_message_id IS NOT NULL;


-- WhatsApp multi-provider (2.9)
CREATE TABLE IF NOT EXISTS whatsapp_conexoes(
  id BIGSERIAL PRIMARY KEY,
  barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
  provedor VARCHAR(30) NOT NULL,
  numero VARCHAR(40),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_enc TEXT,
  webhook_token_hash VARCHAR(64),
  webhook_token_enc TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'desconectado',
  conectado_em TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(barbearia_id,provedor)
);
ALTER TABLE automacoes_config ADD COLUMN IF NOT EXISTS whatsapp_provedor VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_conexao_webhook_token ON whatsapp_conexoes(webhook_token_hash) WHERE webhook_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_whatsapp_conexoes_tenant_status ON whatsapp_conexoes(barbearia_id,status,provedor);

-- BarberFlow 3.0 — operação avançada
CREATE TABLE IF NOT EXISTS comandas(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,barbeiro_id INTEGER REFERENCES barbeiros(id) ON DELETE SET NULL,agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,status VARCHAR(20) NOT NULL DEFAULT 'aberta',subtotal_servicos NUMERIC(12,2) NOT NULL DEFAULT 0,subtotal_produtos NUMERIC(12,2) NOT NULL DEFAULT 0,desconto NUMERIC(12,2) NOT NULL DEFAULT 0,total NUMERIC(12,2) NOT NULL DEFAULT 0,forma_pagamento VARCHAR(30),venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,observacoes TEXT,aberta_em TIMESTAMP NOT NULL DEFAULT NOW(),fechada_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,agendamento_id));
CREATE TABLE IF NOT EXISTS comanda_itens(id BIGSERIAL PRIMARY KEY,comanda_id BIGINT NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,tipo VARCHAR(20) NOT NULL,referencia_id INTEGER,descricao VARCHAR(200) NOT NULL,quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS clube_planos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,nome VARCHAR(160) NOT NULL,descricao TEXT,preco_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,dia_cobranca INTEGER,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS clube_plano_servicos(plano_id BIGINT NOT NULL REFERENCES clube_planos(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,quantidade_mensal INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(plano_id,servico_id));
CREATE TABLE IF NOT EXISTS clube_assinaturas(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,plano_id BIGINT NOT NULL REFERENCES clube_planos(id) ON DELETE RESTRICT,status VARCHAR(20) NOT NULL DEFAULT 'ativa',inicio DATE NOT NULL DEFAULT CURRENT_DATE,proxima_cobranca DATE,forma_pagamento VARCHAR(30),observacoes TEXT,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS clube_consumos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,assinatura_id BIGINT NOT NULL REFERENCES clube_assinaturas(id) ON DELETE CASCADE,servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,competencia DATE NOT NULL DEFAULT date_trunc('month',CURRENT_DATE)::date,quantidade INTEGER NOT NULL DEFAULT 1,criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS clube_cobrancas(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,assinatura_id BIGINT NOT NULL REFERENCES clube_assinaturas(id) ON DELETE CASCADE,competencia DATE NOT NULL,vencimento DATE NOT NULL,valor NUMERIC(12,2) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pendente',forma_pagamento VARCHAR(30),referencia_externa TEXT,pago_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(assinatura_id,competencia));
ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS validade_dias INTEGER NOT NULL DEFAULT 90;
ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS pacote_servicos(pacote_id INTEGER NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,quantidade INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(pacote_id,servico_id));
CREATE TABLE IF NOT EXISTS cliente_pacotes(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,pacote_id INTEGER NOT NULL REFERENCES pacotes(id) ON DELETE RESTRICT,valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,status VARCHAR(20) NOT NULL DEFAULT 'ativo',comprado_em TIMESTAMP NOT NULL DEFAULT NOW(),expira_em DATE,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS cliente_pacote_saldos(cliente_pacote_id BIGINT NOT NULL REFERENCES cliente_pacotes(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,quantidade_total INTEGER NOT NULL,quantidade_usada INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(cliente_pacote_id,servico_id));
CREATE TABLE IF NOT EXISTS fidelidade_movimentos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,pontos INTEGER NOT NULL,tipo VARCHAR(30) NOT NULL,referencia_tipo VARCHAR(30),referencia_id BIGINT,descricao VARCHAR(220),criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS crm_tags(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,nome VARCHAR(60) NOT NULL,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,nome));
CREATE TABLE IF NOT EXISTS crm_cliente_tags(barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,tag_id BIGINT NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),PRIMARY KEY(cliente_id,tag_id));
ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS data_preferida DATE; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS hora_inicio TIME; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS hora_fim TIME; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS prioridade INTEGER NOT NULL DEFAULT 0; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMP; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS expira_em TIMESTAMP; ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS origem VARCHAR(30) NOT NULL DEFAULT 'painel';
CREATE TABLE IF NOT EXISTS fornecedores(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,nome VARCHAR(160) NOT NULL,documento VARCHAR(40),telefone VARCHAR(40),email VARCHAR(160),contato VARCHAR(120),observacoes TEXT,ativo BOOLEAN NOT NULL DEFAULT true,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL; ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) NOT NULL DEFAULT 'un'; ALTER TABLE produtos ADD COLUMN IF NOT EXISTS validade DATE;
CREATE TABLE IF NOT EXISTS estoque_movimentos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,tipo VARCHAR(30) NOT NULL,quantidade NUMERIC(12,3) NOT NULL,estoque_anterior NUMERIC(12,3) NOT NULL,estoque_posterior NUMERIC(12,3) NOT NULL,custo_unitario NUMERIC(12,4),referencia_tipo VARCHAR(30),referencia_id BIGINT,observacoes VARCHAR(500),criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS compras_pedidos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,status VARCHAR(20) NOT NULL DEFAULT 'rascunho',numero_documento VARCHAR(80),total NUMERIC(12,2) NOT NULL DEFAULT 0,observacoes TEXT,criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),recebido_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS compra_itens(id BIGSERIAL PRIMARY KEY,pedido_id BIGINT NOT NULL REFERENCES compras_pedidos(id) ON DELETE CASCADE,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,quantidade NUMERIC(12,3) NOT NULL,custo_unitario NUMERIC(12,4) NOT NULL DEFAULT 0,subtotal NUMERIC(12,2) NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS servico_insumos(barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,quantidade NUMERIC(12,3) NOT NULL,PRIMARY KEY(barbearia_id,servico_id,produto_id));
CREATE TABLE IF NOT EXISTS fiscal_config(barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,ativo BOOLEAN NOT NULL DEFAULT false,provedor VARCHAR(30) NOT NULL DEFAULT 'manual',regime VARCHAR(40),codigo_servico VARCHAR(40),item_lista_servico VARCHAR(40),aliquota_iss NUMERIC(7,4),municipio_codigo VARCHAR(20),inscricao_municipal VARCHAR(60),observacoes TEXT,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fiscal_documentos(id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,status VARCHAR(30) NOT NULL DEFAULT 'rascunho',valor NUMERIC(12,2) NOT NULL DEFAULT 0,descricao TEXT,numero VARCHAR(80),codigo_verificacao VARCHAR(120),url TEXT,provider_id TEXT,erro TEXT,payload JSONB NOT NULL DEFAULT '{}'::jsonb,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),emitido_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW());
