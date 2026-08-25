const path=require('path');
const express=require('express');
const cors=require('cors');
const helmet=require('helmet');
const {rateLimit}=require('express-rate-limit');
const {requestContext}=require('./middlewares/observability');
const operacao=require('./routes/operacao'); const master=require('./routes/master'); const whatsapp=require('./routes/whatsapp'); const uploads=require('./routes/uploads'); const automacoes=require('./routes/automacoes'); const mercadoPagoConnect=require('./routes/mercadoPagoConnect'); const auth=require('./routes/auth'); const clientes=require('./routes/clientes'); const barbeiros=require('./routes/barbeiros'); const servicos=require('./routes/servicos'); const agendamentos=require('./routes/agendamentos'); const tenant=require('./routes/tenant'); const publico=require('./routes/publico'); const integracoes=require('./routes/integracoes');

const app=express();
app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,referrerPolicy:{policy:'strict-origin-when-cross-origin'}}));

const allowedOrigins=new Set();
if(process.env.APP_URL){try{allowedOrigins.add(new URL(process.env.APP_URL).origin)}catch{}}
if(process.env.NODE_ENV!=='production'){
  ['http://localhost:3001','http://127.0.0.1:3001','http://localhost:5500','http://127.0.0.1:5500'].forEach(x=>allowedOrigins.add(x));
}
app.use(cors({
  origin(origin,cb){
    if(!origin || allowedOrigins.has(origin)) return cb(null,true);
    return cb(new Error('Origem não permitida pelo CORS'));
  },
  credentials:false,
  methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders:['Content-Type','Authorization','X-Request-Id','X-Cron-Secret','X-Signature','X-Request-Id']
}));
app.use(express.json({limit:'200kb'}));
app.use(requestContext);
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

const globalApiLimiter=rateLimit({windowMs:60*1000,limit:Number(process.env.API_RATE_LIMIT_PER_MINUTE||300),standardHeaders:'draft-8',legacyHeaders:false});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:Number(process.env.AUTH_RATE_LIMIT_PER_15_MIN||30),standardHeaders:'draft-8',legacyHeaders:false,message:{erro:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'}});
const publicLimiter=rateLimit({windowMs:60*1000,limit:Number(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE||120),standardHeaders:'draft-8',legacyHeaders:false});
app.use('/api',globalApiLimiter);
app.use('/api/auth/login',authLimiter);
app.use('/api/auth/registrar',authLimiter);
app.use('/api/auth/solicitar-reset',authLimiter);
app.use('/api/publico',publicLimiter);

app.get('/api/health/live',(req,res)=>res.json({ok:true,servico:'BarberFlow API'}));
app.get('/api/health/ready',async(req,res)=>{try{const pool=require('./config/db');await pool.query('SELECT 1');res.json({ok:true,banco:'ok'})}catch(e){res.status(503).json({ok:false,banco:'erro',request_id:req.requestId})}});
app.get('/api/health',(req,res)=>res.json({ok:true,servico:'BarberFlow API'}));

app.use('/api/operacao',operacao); app.use('/api/whatsapp',whatsapp); app.use('/api/cron/automacoes',automacoes); app.use('/api/master',master); app.use('/api/uploads',uploads); app.use('/api/mercadopago',mercadoPagoConnect); app.use('/api/auth',auth); app.use('/api/publico',publico); app.use('/api/webhooks',integracoes); app.use('/api/clientes',clientes); app.use('/api/barbeiros',barbeiros); app.use('/api/servicos',servicos); app.use('/api/agendamentos',agendamentos); app.use('/api',tenant);

const frontend=path.resolve(__dirname,'../../frontend');
app.use(express.static(frontend,{maxAge:process.env.NODE_ENV==='production'?'1h':0,etag:true}));
app.get('/agendar/:slug',(req,res)=>res.sendFile(path.join(frontend,'publico.html')));
app.use((req,res,next)=>{if(req.path.startsWith('/api/'))return next();if(req.method==='GET')return res.sendFile(path.join(frontend,'index.html'));next();});
app.use((req,res)=>res.status(404).json({erro:'Rota não encontrada',request_id:req.requestId}));
app.use((err,req,res,next)=>{
  console.error(JSON.stringify({nivel:'error',evento:'request_error',request_id:req.requestId,mensagem:err.message,stack:process.env.NODE_ENV==='production'?undefined:err.stack}));
  if(err.message==='Origem não permitida pelo CORS') return res.status(403).json({erro:'Origem não permitida',request_id:req.requestId});
  res.status(500).json({erro:'Erro interno do servidor',request_id:req.requestId});
});
module.exports=app;
