require('dotenv').config();
const pool=require('./src/config/db');
async function count(sql,p=[]){return Number((await pool.query(sql,p)).rows[0]?.total||0)}
(async()=>{let criticos=0,avisos=0;const checks=[];
function add(check,total,nivel='CRITICO'){const n=Number(total||0);const out=n?(nivel==='CRITICO'?'CRITICO':'AVISO'):'OK';checks.push({check,total:n,nivel:out});if(n&&nivel==='CRITICO')criticos++;if(n&&nivel!=='CRITICO')avisos++;}
try{
 console.log('=== Auditoria de prontidão para piloto V2 ===');
 for(const t of ['clientes','barbeiros','servicos','agendamentos','reservas_pagamento','produtos','vendas','fila_espera','avaliacoes'])add(`${t}: registros sem tenant`,await count(`SELECT COUNT(*) total FROM ${t} WHERE barbearia_id IS NULL`));
 add('tenant interno: quantidade diferente de 1',await count(`SELECT CASE WHEN COUNT(*)=1 THEN 0 ELSE 1 END total FROM barbearias WHERE COALESCE(is_system,false)=true`));
 add('usuários com papel incompatível com tipo de tenant',await count(`SELECT COUNT(*) total FROM usuarios u JOIN barbearias b ON b.id=u.barbearia_id WHERE (u.papel='super_admin')<>COALESCE(b.is_system,false)`));
 add('Supermaster: quantidade ativa diferente de 1',await count(`SELECT CASE WHEN COUNT(*)=1 THEN 0 ELSE 1 END total FROM usuarios WHERE papel='super_admin' AND ativo=true`));
 add('Supermaster sem MFA habilitado',await count(`SELECT COUNT(*) total FROM usuarios WHERE papel='super_admin' AND ativo=true AND COALESCE(mfa_enabled,false)=false`));
 const crossQueries={
  'agendamentos → clientes':`SELECT COUNT(*) total FROM agendamentos a LEFT JOIN clientes x ON x.id=a.cliente_id AND x.barbearia_id=a.barbearia_id WHERE x.id IS NULL`,
  'agendamentos → barbeiros':`SELECT COUNT(*) total FROM agendamentos a LEFT JOIN barbeiros x ON x.id=a.barbeiro_id AND x.barbearia_id=a.barbearia_id WHERE x.id IS NULL`,
  'agendamentos → serviços':`SELECT COUNT(*) total FROM agendamentos a LEFT JOIN servicos x ON x.id=a.servico_id AND x.barbearia_id=a.barbearia_id WHERE x.id IS NULL`,
  'reservas → barbeiros':`SELECT COUNT(*) total FROM reservas_pagamento r LEFT JOIN barbeiros x ON x.id=r.barbeiro_id AND x.barbearia_id=r.barbearia_id WHERE x.id IS NULL`,
  'reservas → serviços':`SELECT COUNT(*) total FROM reservas_pagamento r LEFT JOIN servicos x ON x.id=r.servico_id AND x.barbearia_id=r.barbearia_id WHERE x.id IS NULL`,
  'vendas → clientes':`SELECT COUNT(*) total FROM vendas v LEFT JOIN clientes x ON x.id=v.cliente_id AND x.barbearia_id=v.barbearia_id WHERE v.cliente_id IS NOT NULL AND x.id IS NULL`,
  'vendas → barbeiros':`SELECT COUNT(*) total FROM vendas v LEFT JOIN barbeiros x ON x.id=v.barbeiro_id AND x.barbearia_id=v.barbearia_id WHERE v.barbeiro_id IS NOT NULL AND x.id IS NULL`,
  'fila → clientes':`SELECT COUNT(*) total FROM fila_espera f LEFT JOIN clientes x ON x.id=f.cliente_id AND x.barbearia_id=f.barbearia_id WHERE x.id IS NULL`,
  'fila → barbeiros':`SELECT COUNT(*) total FROM fila_espera f LEFT JOIN barbeiros x ON x.id=f.barbeiro_id AND x.barbearia_id=f.barbearia_id WHERE f.barbeiro_id IS NOT NULL AND x.id IS NULL`,
  'fila → serviços':`SELECT COUNT(*) total FROM fila_espera f LEFT JOIN servicos x ON x.id=f.servico_id AND x.barbearia_id=f.barbearia_id WHERE x.id IS NULL`
 };
 for(const [name,q] of Object.entries(crossQueries))add(`referência multi-tenant inválida: ${name}`,await count(q));
 add('constraints de segurança ainda NOT VALID',await count(`SELECT COUNT(*) total FROM pg_constraint WHERE conname LIKE ANY(ARRAY['fk_%_tenant','ck_%']) AND NOT convalidated`));
 add('agendamentos ativos sobrepostos',await count(`SELECT COUNT(*) total FROM agendamentos a JOIN servicos sa ON sa.id=a.servico_id AND sa.barbearia_id=a.barbearia_id JOIN agendamentos b ON b.barbearia_id=a.barbearia_id AND b.barbeiro_id=a.barbeiro_id AND b.data=a.data AND b.id>a.id JOIN servicos sb ON sb.id=b.servico_id AND sb.barbearia_id=b.barbearia_id WHERE a.status IN ('agendado','confirmado','em_atendimento','concluido') AND b.status IN ('agendado','confirmado','em_atendimento','concluido') AND a.horario < b.horario+(sb.duracao*INTERVAL '1 minute') AND a.horario+(sa.duracao*INTERVAL '1 minute') > b.horario`));
 add('holds ativos sobrepostos com agendamentos',await count(`SELECT COUNT(*) total FROM reservas_pagamento r JOIN servicos sr ON sr.id=r.servico_id AND sr.barbearia_id=r.barbearia_id JOIN agendamentos a ON a.barbearia_id=r.barbearia_id AND a.barbeiro_id=r.barbeiro_id AND a.data=r.data JOIN servicos sa ON sa.id=a.servico_id AND sa.barbearia_id=a.barbearia_id WHERE r.status IN ('aguardando_pagamento','pagamento_pendente','aguardando_pix_manual') AND r.expira_em>NOW() AND a.status IN ('agendado','confirmado','em_atendimento','concluido') AND r.horario < a.horario+(sa.duracao*INTERVAL '1 minute') AND r.horario+(sr.duracao*INTERVAL '1 minute') > a.horario`));
 add('pagamentos Mercado Pago duplicados',await count(`SELECT COUNT(*) total FROM (SELECT mp_payment_id FROM reservas_pagamento WHERE mp_payment_id IS NOT NULL GROUP BY mp_payment_id HAVING COUNT(*)>1)x`));
 add('vendas finais duplicadas por atendimento',await count(`SELECT COUNT(*) total FROM (SELECT barbearia_id,agendamento_id FROM vendas WHERE agendamento_id IS NOT NULL AND status='finalizada' GROUP BY 1,2 HAVING COUNT(*)>1)x`));
 add('agendamentos com valores financeiros inválidos',await count(`SELECT COUNT(*) total FROM agendamentos WHERE COALESCE(valor_cobrado,0)<0 OR COALESCE(valor_pago,0)<0 OR COALESCE(valor_final,0)<0 OR (status_pagamento='pago' AND COALESCE(valor_pago,0)+0.01<COALESCE(valor_final,0)) OR (status_pagamento='parcial' AND (COALESCE(valor_pago,0)<=0 OR COALESCE(valor_pago,0)>=COALESCE(valor_final,0)))`));
 add('vendas com recebimento inconsistente',await count(`SELECT COUNT(*) total FROM vendas WHERE total<0 OR desconto<0 OR COALESCE(valor_pre_pago,0)<0 OR COALESCE(valor_recebido,0)<0 OR COALESCE(valor_pre_pago,0)+COALESCE(valor_recebido,0)>total+0.01`));
 add('produtos com valores inválidos',await count(`SELECT COUNT(*) total FROM produtos WHERE preco<0 OR custo<0 OR estoque<0 OR estoque_minimo<0`));
 add('SKUs duplicados no mesmo tenant',await count(`SELECT COUNT(*) total FROM (SELECT barbearia_id,lower(btrim(sku)) sku FROM produtos WHERE NULLIF(btrim(COALESCE(sku,'')),'') IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1)x`));
 add('clientes com telefone duplicado no mesmo tenant',await count(`SELECT COUNT(*) total FROM (SELECT barbearia_id,regexp_replace(COALESCE(telefone,''),'\\D','','g') telefone FROM clientes WHERE length(regexp_replace(COALESCE(telefone,''),'\\D','','g'))>=10 GROUP BY 1,2 HAVING COUNT(*)>1)x`),'AVISO');
 add('registros públicos sem token seguro',await count(`SELECT (SELECT COUNT(*) FROM agendamentos WHERE public_token IS NULL OR length(public_token)<32)+(SELECT COUNT(*) FROM reservas_pagamento WHERE public_token IS NULL OR length(public_token)<32) total`));
 add('reservas vencidas ainda segurando horário',await count(`SELECT COUNT(*) total FROM reservas_pagamento WHERE status IN ('aguardando_pagamento','pagamento_pendente','aguardando_pix_manual') AND expira_em<NOW()`),'AVISO');
 add('webhooks em falha permanente',await count(`SELECT COUNT(*) total FROM webhook_events WHERE status='falha_permanente'`),'AVISO');
 add('webhooks presos em processamento > 15min',await count(`SELECT COUNT(*) total FROM webhook_events WHERE status='processando' AND atualizado_em<NOW()-INTERVAL '15 minutes'`),'AVISO');
 add('lembretes presos em processamento > 30min',await count(`SELECT COUNT(*) total FROM automacoes_envios WHERE status='processando' AND COALESCE(atualizado_em,enviado_em)<NOW()-INTERVAL '30 minutes'`),'AVISO');
 add('trials vencidos ainda marcados como trial',await count(`SELECT COUNT(*) total FROM assinaturas a JOIN barbearias b ON b.id=a.barbearia_id WHERE a.id=(SELECT id FROM assinaturas x WHERE x.barbearia_id=a.barbearia_id ORDER BY id DESC LIMIT 1) AND COALESCE(b.is_system,false)=false AND a.status='trial' AND a.fim_trial<CURRENT_DATE`),'AVISO');
 console.table(checks);
 if(criticos){console.error(`❌ ${criticos} problema(s) crítico(s); ${avisos} aviso(s). Não liberar piloto.`);process.exitCode=1}else console.log(`✅ Nenhuma inconsistência crítica detectada. Avisos: ${avisos}.`);
}catch(e){console.error('❌ Auditoria falhou:',e.message);process.exitCode=1}finally{await pool.end()}})();
