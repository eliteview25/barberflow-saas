require('dotenv').config();
const pool=require('./src/config/db');
async function count(sql,params=[]){return Number((await pool.query(sql,params)).rows[0].total||0)}
(async()=>{let criticos=0;try{
  console.log('=== Auditoria de prontidão para piloto ===');
  const checks=[];
  const semTenant={
    clientes:await count(`SELECT COUNT(*) total FROM clientes WHERE barbearia_id IS NULL`),
    barbeiros:await count(`SELECT COUNT(*) total FROM barbeiros WHERE barbearia_id IS NULL`),
    servicos:await count(`SELECT COUNT(*) total FROM servicos WHERE barbearia_id IS NULL`),
    agendamentos:await count(`SELECT COUNT(*) total FROM agendamentos WHERE barbearia_id IS NULL`)
  };
  for(const [nome,total] of Object.entries(semTenant)){checks.push({check:`${nome} sem tenant`,total,nivel:total?'CRITICO':'OK'});if(total)criticos++;}
  const duplicados=await count(`SELECT COUNT(*) total FROM (SELECT barbearia_id,barbeiro_id,data,horario,COUNT(*) FROM agendamentos WHERE status NOT IN ('cancelado','nao_compareceu') GROUP BY 1,2,3,4 HAVING COUNT(*)>1) x`);
  checks.push({check:'slots exatos duplicados ativos',total:duplicados,nivel:duplicados?'CRITICO':'OK'});if(duplicados)criticos++;
  const vencidas=await count(`SELECT COUNT(*) total FROM reservas_pagamento WHERE status='aguardando_pagamento' AND expira_em<NOW()`);
  checks.push({check:'reservas vencidas aguardando',total:vencidas,nivel:vencidas?'AVISO':'OK'});
  const semAssinatura=await count(`SELECT COUNT(*) total FROM barbearias b WHERE ativo=true AND NOT EXISTS(SELECT 1 FROM assinaturas a WHERE a.barbearia_id=b.id)`);
  checks.push({check:'barbearias ativas sem assinatura',total:semAssinatura,nivel:semAssinatura?'CRITICO':'OK'});if(semAssinatura)criticos++;
  const estoqueBaixo=await count(`SELECT COUNT(*) total FROM produtos WHERE ativo=true AND estoque<=estoque_minimo`);
  checks.push({check:'produtos em estoque baixo',total:estoqueBaixo,nivel:estoqueBaixo?'INFO':'OK'});
  console.table(checks);
  if(criticos){console.error(`❌ ${criticos} problema(s) crítico(s) encontrado(s).`);process.exitCode=1}else console.log('✅ Nenhuma inconsistência crítica detectada para piloto.');
}catch(e){console.error('❌ Auditoria falhou:',e.message);process.exitCode=1}finally{await pool.end()}})();
