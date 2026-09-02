const pool=require('../config/db');
const MODOS_ATENDIMENTO=['fluxo','ia','ambos'];
const DEFAULTS={
  ativo:false,modo_atendimento:'fluxo',nome_assistente:'Sofia',tom:'amigavel',mensagem_inicial:'Olá! Sou a assistente virtual da barbearia. Como posso ajudar?',mensagem_fallback:'Vou chamar alguém da equipe para continuar seu atendimento.',
  consultar_horarios:true,criar_agendamento:true,reagendar:true,cancelar:true,informar_precos:true,enviar_link_pagamento:true,
  transferir_solicitacao:true,transferir_reclamacao:true,transferir_pagamento:true,limite_mensal:500
};
let schemaPromise=null;
async function ensureAiSchema(db=pool){
  const run=async()=>{
  await db.query(`CREATE TABLE IF NOT EXISTS ai_config(
    barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT false,
    modo_atendimento VARCHAR(12) NOT NULL DEFAULT 'fluxo' CHECK(modo_atendimento IN ('fluxo','ia','ambos')),
    nome_assistente VARCHAR(60) NOT NULL DEFAULT 'Sofia',
    tom VARCHAR(20) NOT NULL DEFAULT 'amigavel' CHECK(tom IN ('profissional','amigavel','descontraido')),
    mensagem_inicial VARCHAR(500),mensagem_fallback VARCHAR(500),
    consultar_horarios BOOLEAN NOT NULL DEFAULT true,criar_agendamento BOOLEAN NOT NULL DEFAULT true,reagendar BOOLEAN NOT NULL DEFAULT true,cancelar BOOLEAN NOT NULL DEFAULT true,
    informar_precos BOOLEAN NOT NULL DEFAULT true,enviar_link_pagamento BOOLEAN NOT NULL DEFAULT true,
    transferir_solicitacao BOOLEAN NOT NULL DEFAULT true,transferir_reclamacao BOOLEAN NOT NULL DEFAULT true,transferir_pagamento BOOLEAN NOT NULL DEFAULT true,
    limite_mensal INTEGER NOT NULL DEFAULT 500 CHECK(limite_mensal BETWEEN 0 AND 100000),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS modo_atendimento VARCHAR(12)`);
  await db.query(`UPDATE ai_config SET modo_atendimento=CASE WHEN ativo THEN 'ambos' ELSE 'fluxo' END WHERE modo_atendimento IS NULL`);
  await db.query(`UPDATE ai_config SET modo_atendimento='fluxo',ativo=false WHERE modo_atendimento NOT IN ('fluxo','ia','ambos')`);
  await db.query(`ALTER TABLE ai_config ALTER COLUMN modo_atendimento SET DEFAULT 'fluxo'`);
  await db.query(`ALTER TABLE ai_config ALTER COLUMN modo_atendimento SET NOT NULL`);
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_ai_config_modo_atendimento' AND conrelid='ai_config'::regclass) THEN
      ALTER TABLE ai_config ADD CONSTRAINT ck_ai_config_modo_atendimento CHECK(modo_atendimento IN ('fluxo','ia','ambos')) NOT VALID;
    END IF;
  END $$`);
  await db.query(`ALTER TABLE ai_config VALIDATE CONSTRAINT ck_ai_config_modo_atendimento`);
  await db.query(`CREATE TABLE IF NOT EXISTS ai_uso_mensal(
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    mes DATE NOT NULL,atendimentos INTEGER NOT NULL DEFAULT 0 CHECK(atendimentos>=0),
    tokens_entrada BIGINT NOT NULL DEFAULT 0 CHECK(tokens_entrada>=0),tokens_saida BIGINT NOT NULL DEFAULT 0 CHECK(tokens_saida>=0),
    custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_centavos>=0),atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(barbearia_id,mes)
  )`);
  };
  if(db!==pool)return run();
  if(!schemaPromise)schemaPromise=run().catch(error=>{schemaPromise=null;throw error});
  return schemaPromise;
}
function normalizeMode(value,legacyActive=false){return MODOS_ATENDIMENTO.includes(value)?value:(legacyActive?'ambos':'fluxo')}
function modeUsesFlow(value){return ['fluxo','ambos'].includes(normalizeMode(value))}
function modeUsesAi(value){return ['ia','ambos'].includes(normalizeMode(value))}
async function getAiConfig(barbeariaId,db=pool){await ensureAiSchema(db);await db.query(`INSERT INTO ai_config(barbearia_id) VALUES($1) ON CONFLICT(barbearia_id) DO NOTHING`,[barbeariaId]);const r=await db.query(`SELECT * FROM ai_config WHERE barbearia_id=$1`,[barbeariaId]);const config=r.rows[0]||{barbearia_id:barbeariaId,...DEFAULTS};config.modo_atendimento=normalizeMode(config.modo_atendimento,config.ativo===true);config.ativo=modeUsesAi(config.modo_atendimento);return config;}
function cleanText(v,max){const x=String(v??'').trim();return x?x.slice(0,max):null}
async function updateAiConfig(barbeariaId,body={},db=pool){await ensureAiSchema(db);const tom=['profissional','amigavel','descontraido'].includes(body.tom)?body.tom:'amigavel';const nome=cleanText(body.nome_assistente,60)||'Sofia';const inicio=cleanText(body.mensagem_inicial,500)||DEFAULTS.mensagem_inicial;const fallback=cleanText(body.mensagem_fallback,500)||DEFAULTS.mensagem_fallback;const bool=k=>body[k]!==false,modo=normalizeMode(body.modo_atendimento,body.ativo===true),ativo=modeUsesAi(modo),rawLimit=Number(body.limite_mensal??DEFAULTS.limite_mensal);const limite=Math.max(0,Math.min(100000,Number.isFinite(rawLimit)?rawLimit:DEFAULTS.limite_mensal));const r=await db.query(`INSERT INTO ai_config(barbearia_id,ativo,modo_atendimento,nome_assistente,tom,mensagem_inicial,mensagem_fallback,consultar_horarios,criar_agendamento,reagendar,cancelar,informar_precos,enviar_link_pagamento,transferir_solicitacao,transferir_reclamacao,transferir_pagamento,limite_mensal,atualizado_em)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
ON CONFLICT(barbearia_id) DO UPDATE SET ativo=EXCLUDED.ativo,modo_atendimento=EXCLUDED.modo_atendimento,nome_assistente=EXCLUDED.nome_assistente,tom=EXCLUDED.tom,mensagem_inicial=EXCLUDED.mensagem_inicial,mensagem_fallback=EXCLUDED.mensagem_fallback,consultar_horarios=EXCLUDED.consultar_horarios,criar_agendamento=EXCLUDED.criar_agendamento,reagendar=EXCLUDED.reagendar,cancelar=EXCLUDED.cancelar,informar_precos=EXCLUDED.informar_precos,enviar_link_pagamento=EXCLUDED.enviar_link_pagamento,transferir_solicitacao=EXCLUDED.transferir_solicitacao,transferir_reclamacao=EXCLUDED.transferir_reclamacao,transferir_pagamento=EXCLUDED.transferir_pagamento,limite_mensal=EXCLUDED.limite_mensal,atualizado_em=NOW() RETURNING *`,[barbeariaId,ativo,modo,nome,tom,inicio,fallback,bool('consultar_horarios'),bool('criar_agendamento'),bool('reagendar'),bool('cancelar'),bool('informar_precos'),bool('enviar_link_pagamento'),bool('transferir_solicitacao'),bool('transferir_reclamacao'),bool('transferir_pagamento'),limite]);return r.rows[0];}
async function getAiUsage(barbeariaId,db=pool){await ensureAiSchema(db);const r=await db.query(`SELECT atendimentos,tokens_entrada,tokens_saida,custo_centavos FROM ai_uso_mensal WHERE barbearia_id=$1 AND mes=date_trunc('month',CURRENT_DATE)::date`,[barbeariaId]);return r.rows[0]||{atendimentos:0,tokens_entrada:0,tokens_saida:0,custo_centavos:0};}
module.exports={DEFAULTS,MODOS_ATENDIMENTO,normalizeMode,modeUsesFlow,modeUsesAi,ensureAiSchema,getAiConfig,updateAiConfig,getAiUsage};
