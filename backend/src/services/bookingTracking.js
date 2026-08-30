const crypto=require('crypto');
const pool=require('../config/db');
const wp=require('./whatsappProviders');
const {normalizePhone}=require('../utils/security');

function normalizeTrackingCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16)}
function formatTrackingCode(v){const c=normalizeTrackingCode(v);return c?c.match(/.{1,4}/g).join('-'):''}
function newTrackingCode(){return crypto.randomBytes(6).toString('hex').toUpperCase()}
function statusLabel(v){return ({agendado:'Agendado',confirmado:'Confirmado',em_atendimento:'Em atendimento',concluido:'Concluído',cancelado:'Cancelado',nao_compareceu:'Não compareceu'})[String(v)]||String(v||'')}
function trackingUrl(slug,code){const base=String(process.env.APP_URL||'').replace(/\/$/,'');if(!base||!slug||!code)return null;return `${base}/agendar/${encodeURIComponent(slug)}?acompanhar=${encodeURIComponent(formatTrackingCode(code))}`}

async function ensureBookingTrackingSchema(){
  await pool.query(`ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(16)`);
  await pool.query(`UPDATE agendamentos SET tracking_code=UPPER(encode(gen_random_bytes(6),'hex')) WHERE tracking_code IS NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_agendamentos_tracking_code ON agendamentos(barbearia_id,tracking_code) WHERE tracking_code IS NOT NULL`);
  await pool.query(`CREATE OR REPLACE FUNCTION bf_fill_tracking_code() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tracking_code IS NULL OR btrim(NEW.tracking_code)='' THEN NEW.tracking_code=UPPER(encode(gen_random_bytes(6),'hex')); END IF; RETURN NEW; END $$`);
  await pool.query(`DROP TRIGGER IF EXISTS trg_bf_ag_tracking_code ON agendamentos`);
  await pool.query(`CREATE TRIGGER trg_bf_ag_tracking_code BEFORE INSERT ON agendamentos FOR EACH ROW EXECUTE FUNCTION bf_fill_tracking_code()`);
}

async function ensureTrackingCode(db,barbeariaId,appointmentId){
  const cx=db||pool;let r=await cx.query(`SELECT tracking_code FROM agendamentos WHERE id=$1 AND barbearia_id=$2`,[appointmentId,barbeariaId]);
  if(!r.rowCount)return null;if(r.rows[0].tracking_code)return r.rows[0].tracking_code;
  for(let i=0;i<4;i++){
    const code=newTrackingCode();
    try{r=await cx.query(`UPDATE agendamentos SET tracking_code=$1 WHERE id=$2 AND barbearia_id=$3 AND tracking_code IS NULL RETURNING tracking_code`,[code,appointmentId,barbeariaId]);if(r.rowCount)return r.rows[0].tracking_code;}catch(e){if(e.code!=='23505')throw e;}
  }
  return null;
}

async function appointmentDetails(barbeariaId,appointmentId,db=pool){
  const r=await db.query(`SELECT a.id,a.data,a.horario,a.status,a.status_pagamento,a.tracking_code,a.public_token,c.nome cliente,c.telefone,b.nome barbeiro,s.nome servico,br.slug,br.nome barbearia FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id AND c.barbearia_id=a.barbearia_id JOIN barbeiros b ON b.id=a.barbeiro_id AND b.barbearia_id=a.barbearia_id JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id JOIN barbearias br ON br.id=a.barbearia_id WHERE a.id=$1 AND a.barbearia_id=$2`,[appointmentId,barbeariaId]);
  return r.rows[0]||null;
}

function trackingMessage(a,{confirmed=false}={}){
  const title=confirmed||a.status==='confirmado'?'Agendamento confirmado ✅':'Agendamento recebido ✅';
  const url=trackingUrl(a.slug,a.tracking_code);const code=formatTrackingCode(a.tracking_code);
  return `${title}\n${a.servico} com ${a.barbeiro}\n${String(a.data).slice(0,10).split('-').reverse().join('/')} às ${String(a.horario).slice(0,5)}\n\nCódigo de acompanhamento: *${code}*${url?`\nAcompanhe ou gerencie: ${url}`:''}\n\nNo WhatsApp, envie *ACOMPANHAR* para consultar seus próximos horários.`;
}

async function sendAppointmentTracking({barbeariaId,appointmentId,confirmed=false}){
  try{
    const a=await appointmentDetails(barbeariaId,appointmentId);if(!a)return {ok:false,reason:'not_found'};
    if(!a.tracking_code){a.tracking_code=await ensureTrackingCode(pool,barbeariaId,appointmentId);}
    const integ=await wp.activeConnection(barbeariaId);if(!integ)return {ok:false,reason:'whatsapp_not_connected',code:a.tracking_code};
    const phone=normalizePhone(a.telefone);if(phone.length<10)return {ok:false,reason:'invalid_phone',code:a.tracking_code};
    await wp.sendText(integ,phone,trackingMessage(a,{confirmed}));return {ok:true,code:a.tracking_code};
  }catch(e){console.error('booking_tracking_whatsapp',e.message);return {ok:false,reason:e.message};}
}

async function findByTrackingCode({barbeariaId,code,phone,db=pool}){
  const c=normalizeTrackingCode(code),p=normalizePhone(phone);if(c.length<8||p.length<10)return null;
  const r=await db.query(`SELECT a.id,a.data,a.horario,a.status,a.status_pagamento,a.tracking_code,a.public_token,a.valor_final,c.nome cliente,c.telefone,b.nome barbeiro,s.nome servico,s.duracao FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id AND c.barbearia_id=a.barbearia_id JOIN barbeiros b ON b.id=a.barbeiro_id AND b.barbearia_id=a.barbearia_id JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id WHERE a.barbearia_id=$1 AND a.tracking_code=$2 AND regexp_replace(c.telefone,'\\D','','g')=$3 LIMIT 1`,[barbeariaId,c,p]);return r.rows[0]||null;
}

module.exports={ensureBookingTrackingSchema,normalizeTrackingCode,formatTrackingCode,newTrackingCode,ensureTrackingCode,appointmentDetails,trackingMessage,trackingUrl,sendAppointmentTracking,findByTrackingCode,statusLabel};
