const crypto = require('crypto');
const {recordSystemEvent}=require('../services/launchReadiness');
const {notifyOps}=require('../services/opsAlerts');

function requestContext(req,res,next){
  const incoming=String(req.headers['x-request-id']||'');
  const requestId = /^[A-Za-z0-9._:-]{1,64}$/.test(incoming)?incoming:crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id',requestId);
  const inicio = process.hrtime.bigint();
  res.on('finish',()=>{
    const ms = Number(process.hrtime.bigint()-inicio)/1e6;
    const payload = {
      nivel: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      request_id: requestId,
      metodo: req.method,
      rota: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duracao_ms: Number(ms.toFixed(1)),
      ip: req.ip,
      usuario_id: req.usuario?.id || null,
      barbearia_id: req.usuario?.barbearia_id || null
    };
    console.log(JSON.stringify(payload));
    if(res.statusCode>=500){recordSystemEvent({nivel:'error',evento:'http_5xx',requestId:requestId,barbeariaId:req.usuario?.barbearia_id,usuarioId:req.usuario?.id,mensagem:`${req.method} ${req.originalUrl.split('?')[0]} -> ${res.statusCode}`,detalhes:{status:res.statusCode,duracao_ms:Number(ms.toFixed(1))}});notifyOps({nivel:'error',evento:'http_5xx',request_id:requestId,rota:req.originalUrl.split('?')[0],status:res.statusCode});}
  });
  next();
}

module.exports={requestContext};
