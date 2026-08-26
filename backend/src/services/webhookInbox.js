const pool=require('../config/db');

function maxAttempts(){return Math.max(1,Math.min(50,Number(process.env.WEBHOOK_MAX_ATTEMPTS||12)||12))}
function staleSeconds(){return Math.max(60,Math.min(3600,Number(process.env.WEBHOOK_PROCESSING_STALE_SECONDS||300)||300))}
function backoffMinutes(attempt){return Math.min(60,Math.max(1,2**Math.min(5,Math.max(0,attempt-1))))}

async function enqueue(provider,eventId,payload){
  const id=String(eventId||'').slice(0,500);if(!provider||!id)throw new Error('Evento de webhook inválido');
  const r=await pool.query(`
    INSERT INTO webhook_events(provider,event_id,status,payload,tentativas,recebido_em,atualizado_em)
    VALUES($1,$2,'pendente',$3,0,NOW(),NOW())
    ON CONFLICT(provider,event_id) DO UPDATE SET
      payload=CASE
        WHEN webhook_events.status IN ('processado','processando','falha_permanente') THEN webhook_events.payload
        ELSE EXCLUDED.payload
      END,
      atualizado_em=CASE
        WHEN webhook_events.status IN ('processado','processando','falha_permanente') THEN webhook_events.atualizado_em
        ELSE NOW()
      END,
      status=CASE
        WHEN webhook_events.status IN ('processado','processando','falha_permanente') THEN webhook_events.status
        ELSE 'pendente'
      END,
      proxima_tentativa=CASE
        WHEN webhook_events.status IN ('processado','processando','falha_permanente') THEN webhook_events.proxima_tentativa
        ELSE NULL
      END
    RETURNING id,status,tentativas`,[provider,id,JSON.stringify(payload||{})]);
  return r.rows[0];
}

async function claim(provider,eventId){
  const r=await pool.query(`
    UPDATE webhook_events SET
      status='processando',
      tentativas=COALESCE(tentativas,0)+1,
      proxima_tentativa=NULL,
      atualizado_em=NOW()
    WHERE provider=$1 AND event_id=$2
      AND COALESCE(tentativas,0)<$3
      AND (
        (status IN ('pendente','recebido','erro') AND (proxima_tentativa IS NULL OR proxima_tentativa<=NOW()))
        OR (status='processando' AND atualizado_em < NOW()-($4*INTERVAL '1 second'))
      )
    RETURNING id,payload,tentativas`,[provider,String(eventId),maxAttempts(),staleSeconds()]);
  return r.rows[0]||null;
}

async function done(provider,eventId){
  await pool.query(`UPDATE webhook_events SET status='processado',erro=NULL,processado_em=NOW(),proxima_tentativa=NULL,atualizado_em=NOW() WHERE provider=$1 AND event_id=$2`,[provider,String(eventId)]);
}

async function fail(provider,eventId,error,attempt=1){
  const permanent=Number(attempt)>=maxAttempts();const mins=backoffMinutes(attempt);
  await pool.query(`UPDATE webhook_events SET status=$3,erro=$4,proxima_tentativa=CASE WHEN $3='falha_permanente' THEN NULL ELSE NOW()+($5*INTERVAL '1 minute') END,atualizado_em=NOW() WHERE provider=$1 AND event_id=$2`,[provider,String(eventId),permanent?'falha_permanente':'erro',String(error?.message||error||'erro').slice(0,2000),mins]);
}

async function processEvent(provider,eventId,processor){
  const row=await claim(provider,eventId);if(!row)return {skipped:true};
  try{await processor(typeof row.payload==='string'?JSON.parse(row.payload):row.payload||{});await done(provider,eventId);return {ok:true};}
  catch(e){await fail(provider,eventId,e,row.tentativas);throw e;}
}

async function pending(limit=50){
  const r=await pool.query(`
    SELECT provider,event_id FROM webhook_events
    WHERE COALESCE(tentativas,0)<$2 AND (
      (status IN ('pendente','recebido','erro') AND (proxima_tentativa IS NULL OR proxima_tentativa<=NOW()))
      OR (status='processando' AND atualizado_em < NOW()-($3*INTERVAL '1 second'))
    )
    ORDER BY recebido_em LIMIT $1`,[Math.max(1,Math.min(200,Number(limit)||50)),maxAttempts(),staleSeconds()]);
  return r.rows;
}

async function stats(){
  const r=await pool.query(`SELECT status,COUNT(*)::int quantidade FROM webhook_events GROUP BY status ORDER BY status`);return r.rows;
}

module.exports={enqueue,claim,done,fail,processEvent,pending,stats,maxAttempts,staleSeconds};
