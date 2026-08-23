require('dotenv').config();
if(!process.env.JWT_SECRET){console.error('JWT_SECRET não configurado no .env');process.exit(1);} const app=require('./src/app'); const pool=require('./src/config/db'); const PORT=Number(process.env.PORT||3001);
pool.query('SELECT NOW()').then(()=>console.log('PostgreSQL conectado!')).catch(e=>console.error('Erro ao conectar ao PostgreSQL:',e.message));
app.listen(PORT,()=>{console.log(`BarberFlow SaaS: http://localhost:${PORT}`);console.log(`Agendamento público: http://localhost:${PORT}/agendar/SEU-SLUG`);});
