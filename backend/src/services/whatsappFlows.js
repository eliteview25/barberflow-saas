const pool=require('../config/db');

const MESSAGE_KEYS=[
  'boas_vindas','servico','servico_invalido','barbeiro','barbeiro_invalido','data','data_invalida','sem_horarios',
  'horario','horario_invalido','nome','nome_invalido','pagamento','pagamento_invalido','confirmacao','confirmacao_dinheiro',
  'reserva_pix','reserva_mercado_pago','erro_finalizacao','recomecar'
];
const ALLOWED_VARS=new Set(['barbearia','servico','preco','barbeiro','data','hora','cliente','codigo','link','valor','pix_chave','pix_nome','pix_banco','opcoes']);
const REQUIRED_VARS={servico:['opcoes'],barbeiro:['opcoes'],horario:['opcoes'],pagamento:['opcoes'],reserva_pix:['valor','pix_chave'],reserva_mercado_pago:['link']};
const DEFAULT_TRIGGERS=['oi','olá','ola','menu','início','inicio','agendar','agendamento','marcar horário','marcar horario'];
const DEFAULT_MESSAGES={
  boas_vindas:'Olá! 👋 Bem-vindo à *{barbearia}*. Vou cuidar do seu agendamento por aqui.',
  servico:'✂️ *Escolha o serviço*\n\n{opcoes}\n\nResponda com o *número* da opção desejada.',
  servico_invalido:'Não encontrei essa opção. 🙂 Responda com o número de um dos serviços da lista.',
  barbeiro:'💈 *Profissional*\n\nVocê escolheu *{servico}*. Agora selecione quem vai atender você:\n\n{opcoes}\n\nResponda com o número do profissional.',
  barbeiro_invalido:'Escolha um profissional usando o número mostrado na lista.',
  data:'📅 *Escolha a data*\n\nQual dia você prefere para *{servico}* com *{barbeiro}*?\nEnvie *DD/MM*, *hoje* ou *amanhã*.',
  data_invalida:'Não consegui entender a data. Envie no formato *DD/MM* ou escreva *hoje* / *amanhã*.',
  sem_horarios:'Essa data ficou sem horários livres. 😕 Envie outra data para eu consultar novamente.',
  horario:'🕐 *Horários disponíveis em {data}*\n\n{opcoes}\n\nResponda com o número do horário.',
  horario_invalido:'Escolha um dos horários usando o número correspondente.',
  nome:'Quase pronto! ✨\nQual é o seu *nome* para eu identificar o agendamento?',
  nome_invalido:'Digite seu nome para continuar o agendamento.',
  pagamento:'💳 *Forma de pagamento*\n\n{opcoes}\n\nResponda com o número da forma de pagamento.',
  pagamento_invalido:'Escolha a forma de pagamento usando o número mostrado na lista.',
  confirmacao:'✅ *Agendamento confirmado!*\n\n✂️ {servico}\n💈 {barbeiro}\n📅 {data} às {hora}\n👤 {cliente}\n\nCódigo: *{codigo}*\n{link}\n\nQuando quiser consultar, envie *ACOMPANHAR*.',
  confirmacao_dinheiro:'✅ *Agendamento confirmado!*\n\nPagamento: dinheiro no atendimento\n✂️ {servico}\n💈 {barbeiro}\n📅 {data} às {hora}\n\nCódigo: *{codigo}*\n{link}\n\nEnvie *ACOMPANHAR* para consultar depois.',
  reserva_pix:'⏳ *Horário reservado*\n\nFaça o Pix de *R$ {valor}* para confirmar.\n\nChave: {pix_chave}\nRecebedor: {pix_nome}\n{pix_banco}\n\nA barbearia confirmará após verificar o pagamento.',
  reserva_mercado_pago:'⏳ *Horário reservado*\n\nFinalize o pagamento no link abaixo para confirmar:\n{link}\n\nA reserva expira em alguns minutos.',
  erro_finalizacao:'Não consegui finalizar o agendamento agora. 😕 Digite *oi* para tentar novamente ou fale com a barbearia.',
  recomecar:'Vamos recomeçar. Digite *oi* para ver os serviços disponíveis.'
};

async function ensureWhatsAppFlowSchema(db=pool){
  await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_fluxos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(240),
    ativo BOOLEAN NOT NULL DEFAULT false,
    gatilhos JSONB NOT NULL DEFAULT '[]'::jsonb,
    mensagens JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_whatsapp_fluxos_tenant ON whatsapp_fluxos(barbearia_id,atualizado_em DESC)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_fluxos_ativo_tenant ON whatsapp_fluxos(barbearia_id) WHERE ativo=true`);
}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,100)}
function cleanDescription(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,240)}
function cleanTriggers(value){
  const input=Array.isArray(value)?value:String(value||'').split(/[\n,]/);
  const out=[];for(const item of input){const x=String(item||'').trim().toLowerCase().replace(/\s+/g,' ').slice(0,60);if(x&&!out.includes(x))out.push(x);if(out.length>=20)break}return out.length?out:[...DEFAULT_TRIGGERS]
}
function validateTemplate(key,value){
  const txt=String(value??'').trim().slice(0,1600);if(!txt)return DEFAULT_MESSAGES[key]||'';
  for(const m of txt.matchAll(/\{([a-z_]+)\}/gi))if(!ALLOWED_VARS.has(String(m[1]).toLowerCase()))throw Object.assign(new Error(`Variável não permitida em ${key}: {${m[1]}}`),{status:400});
  for(const required of REQUIRED_VARS[key]||[])if(!new RegExp(`\\{${required}\\}`,'i').test(txt))throw Object.assign(new Error(`A mensagem ${key} precisa manter {${required}}`),{status:400});
  return txt;
}
function cleanMessages(value={}){const out={};for(const key of MESSAGE_KEYS)out[key]=validateTemplate(key,value?.[key]);return out}
function publicFlow(row){return {...row,gatilhos:Array.isArray(row.gatilhos)?row.gatilhos:[],mensagens:{...DEFAULT_MESSAGES,...(row.mensagens||{})}}}
async function ensureDefaultFlow(barbeariaId,db=pool){
  await ensureWhatsAppFlowSchema(db);const existing=await db.query(`SELECT * FROM whatsapp_fluxos WHERE barbearia_id=$1 ORDER BY ativo DESC,id LIMIT 1`,[barbeariaId]);if(existing.rowCount)return publicFlow(existing.rows[0]);
  try{const r=await db.query(`INSERT INTO whatsapp_fluxos(barbearia_id,nome,descricao,ativo,gatilhos,mensagens) VALUES($1,$2,$3,true,$4,$5) RETURNING *`,[barbeariaId,'Fluxo padrão BarberFlow','Fluxo completo de agendamento com serviço, profissional, data, horário, pagamento e confirmação.',JSON.stringify(DEFAULT_TRIGGERS),JSON.stringify(DEFAULT_MESSAGES)]);return publicFlow(r.rows[0])}catch(e){if(e.code!=='23505')throw e;const after=await db.query(`SELECT * FROM whatsapp_fluxos WHERE barbearia_id=$1 ORDER BY ativo DESC,id LIMIT 1`,[barbeariaId]);if(after.rowCount)return publicFlow(after.rows[0]);throw e}
}
async function listFlows(barbeariaId){await ensureDefaultFlow(barbeariaId);const r=await pool.query(`SELECT * FROM whatsapp_fluxos WHERE barbearia_id=$1 ORDER BY ativo DESC,atualizado_em DESC,id DESC`,[barbeariaId]);return r.rows.map(publicFlow)}
async function getFlow(barbeariaId,id){const r=await pool.query(`SELECT * FROM whatsapp_fluxos WHERE id=$1 AND barbearia_id=$2`,[id,barbeariaId]);return r.rowCount?publicFlow(r.rows[0]):null}
async function getActiveFlow(barbeariaId){await ensureDefaultFlow(barbeariaId);let r=await pool.query(`SELECT * FROM whatsapp_fluxos WHERE barbearia_id=$1 AND ativo=true LIMIT 1`,[barbeariaId]);if(!r.rowCount){const first=(await pool.query(`SELECT id FROM whatsapp_fluxos WHERE barbearia_id=$1 ORDER BY id LIMIT 1`,[barbeariaId])).rows[0];if(first){await activateFlow(barbeariaId,first.id);r=await pool.query(`SELECT * FROM whatsapp_fluxos WHERE id=$1 AND barbearia_id=$2`,[first.id,barbeariaId]);}}return r.rowCount?publicFlow(r.rows[0]):{id:null,nome:'Fluxo padrão BarberFlow',ativo:true,gatilhos:[...DEFAULT_TRIGGERS],mensagens:{...DEFAULT_MESSAGES}}}
async function createFlow(barbeariaId,body={}){await ensureWhatsAppFlowSchema();const nome=cleanName(body.nome);if(nome.length<2)throw Object.assign(new Error('Informe um nome para o fluxo'),{status:400});const r=await pool.query(`INSERT INTO whatsapp_fluxos(barbearia_id,nome,descricao,ativo,gatilhos,mensagens) VALUES($1,$2,$3,false,$4,$5) RETURNING *`,[barbeariaId,nome,cleanDescription(body.descricao)||null,JSON.stringify(cleanTriggers(body.gatilhos)),JSON.stringify(cleanMessages(body.mensagens||DEFAULT_MESSAGES))]);return publicFlow(r.rows[0])}
async function updateFlow(barbeariaId,id,body={}){const current=await getFlow(barbeariaId,id);if(!current)throw Object.assign(new Error('Fluxo não encontrado'),{status:404});const nome=body.nome===undefined?current.nome:cleanName(body.nome);if(nome.length<2)throw Object.assign(new Error('Informe um nome para o fluxo'),{status:400});const desc=body.descricao===undefined?current.descricao:cleanDescription(body.descricao)||null;const gatilhos=body.gatilhos===undefined?current.gatilhos:cleanTriggers(body.gatilhos);const mensagens=body.mensagens===undefined?current.mensagens:cleanMessages({...current.mensagens,...body.mensagens});const r=await pool.query(`UPDATE whatsapp_fluxos SET nome=$1,descricao=$2,gatilhos=$3,mensagens=$4,atualizado_em=NOW() WHERE id=$5 AND barbearia_id=$6 RETURNING *`,[nome,desc,JSON.stringify(gatilhos),JSON.stringify(mensagens),id,barbeariaId]);return publicFlow(r.rows[0])}
async function activateFlow(barbeariaId,id){const c=await pool.connect();try{await c.query('BEGIN');const own=await c.query(`SELECT id FROM whatsapp_fluxos WHERE id=$1 AND barbearia_id=$2 FOR UPDATE`,[id,barbeariaId]);if(!own.rowCount)throw Object.assign(new Error('Fluxo não encontrado'),{status:404});await c.query(`UPDATE whatsapp_fluxos SET ativo=false,atualizado_em=NOW() WHERE barbearia_id=$1 AND ativo=true`,[barbeariaId]);const r=await c.query(`UPDATE whatsapp_fluxos SET ativo=true,atualizado_em=NOW() WHERE id=$1 AND barbearia_id=$2 RETURNING *`,[id,barbeariaId]);await c.query('COMMIT');return publicFlow(r.rows[0])}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}}
async function duplicateFlow(barbeariaId,id){const src=await getFlow(barbeariaId,id);if(!src)throw Object.assign(new Error('Fluxo não encontrado'),{status:404});return createFlow(barbeariaId,{nome:`${src.nome} - cópia`.slice(0,100),descricao:src.descricao,gatilhos:src.gatilhos,mensagens:src.mensagens})}
async function deleteFlow(barbeariaId,id){const current=await getFlow(barbeariaId,id);if(!current)throw Object.assign(new Error('Fluxo não encontrado'),{status:404});if(current.ativo)throw Object.assign(new Error('Defina outro fluxo como ativo antes de excluir este'),{status:409});const count=Number((await pool.query(`SELECT COUNT(*)::int n FROM whatsapp_fluxos WHERE barbearia_id=$1`,[barbeariaId])).rows[0].n);if(count<=1)throw Object.assign(new Error('A barbearia precisa manter pelo menos um fluxo'),{status:409});await pool.query(`DELETE FROM whatsapp_fluxos WHERE id=$1 AND barbearia_id=$2`,[id,barbeariaId]);return true}
function renderMessage(flow,key,vars={},fallback=''){
  const template=String(flow?.mensagens?.[key]||fallback||DEFAULT_MESSAGES[key]||'');return template.replace(/\{([a-z_]+)\}/gi,(all,name)=>Object.prototype.hasOwnProperty.call(vars,String(name).toLowerCase())?String(vars[String(name).toLowerCase()]??''):all).trim();
}
function matchesTrigger(flow,message){const q=String(message||'').trim().toLowerCase().replace(/\s+/g,' ');return (flow?.gatilhos||DEFAULT_TRIGGERS).some(x=>q===String(x).toLowerCase())}
module.exports={MESSAGE_KEYS,DEFAULT_MESSAGES,DEFAULT_TRIGGERS,ensureWhatsAppFlowSchema,ensureDefaultFlow,listFlows,getFlow,getActiveFlow,createFlow,updateFlow,activateFlow,duplicateFlow,deleteFlow,renderMessage,matchesTrigger};
