const crypto = require('crypto');

function requestContext(req,res,next){
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0,128);
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
  });
  next();
}

module.exports={requestContext};
