require('dotenv').config();
if(!process.env.JWT_SECRET){console.error('JWT_SECRET não configurado');process.exit(1);}
const app=require('./src/app');
const pool=require('./src/config/db');
const PORT=Number(process.env.PORT||3001);
let server;
let encerrando=false;

async function iniciar(){
  try{
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL conectado!');
    server=app.listen(PORT,()=>{
      console.log(`BarberFlow SaaS: http://localhost:${PORT}`);
      console.log(`Agendamento público: http://localhost:${PORT}/agendar/SEU-SLUG`);
    });
  }catch(e){
    console.error('Falha ao iniciar: PostgreSQL indisponível:',e.message);
    process.exit(1);
  }
}

async function encerrar(sinal){
  if(encerrando)return;
  encerrando=true;
  console.log(`Recebido ${sinal}. Encerrando BarberFlow...`);
  const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
  try{
    if(server) await new Promise(resolve=>server.close(resolve));
    await pool.end();
    clearTimeout(timer);
    process.exit(0);
  }catch(e){console.error('Erro no shutdown:',e.message);process.exit(1);}
}

process.on('SIGTERM',()=>encerrar('SIGTERM'));
process.on('SIGINT',()=>encerrar('SIGINT'));
process.on('unhandledRejection',(e)=>console.error('Unhandled rejection:',e));
process.on('uncaughtException',(e)=>{console.error('Uncaught exception:',e);encerrar('uncaughtException')});
iniciar();
