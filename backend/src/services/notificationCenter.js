const pool=require('../config/db');

const ROLES=new Set(['dono','gerente','recepcao','barbeiro']);
const LEVELS=new Set(['info','success','warning','error']);

async function ensureNotificationSchema(db=pool){
  await db.query(`CREATE TABLE IF NOT EXISTS notificacoes(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER REFERENCES barbearias(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    audiencia VARCHAR(20) NOT NULL DEFAULT 'tenant',
    papeis TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tipo VARCHAR(50) NOT NULL DEFAULT 'sistema',
    nivel VARCHAR(20) NOT NULL DEFAULT 'info',
    titulo VARCHAR(160) NOT NULL,
    mensagem VARCHAR(700) NOT NULL,
    link VARCHAR(500),
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    chave_unica VARCHAR(200),
    expira_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK(audiencia IN ('tenant','super_admin')),
    CHECK(nivel IN ('info','success','warning','error')),
    CHECK((audiencia='tenant' AND barbearia_id IS NOT NULL) OR audiencia='super_admin')
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS notificacoes_leituras(
    notificacao_id BIGINT NOT NULL REFERENCES notificacoes(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    lida_em TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(notificacao_id,usuario_id)
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_notificacoes_chave_unica ON notificacoes(chave_unica) WHERE chave_unica IS NOT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_notificacoes_tenant_data ON notificacoes(barbearia_id,criado_em DESC) WHERE audiencia='tenant'`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_notificacoes_master_data ON notificacoes(criado_em DESC) WHERE audiencia='super_admin'`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_notificacoes_leituras_usuario ON notificacoes_leituras(usuario_id,lida_em DESC)`);
}

function texto(value,max){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function safeLink(value){const v=String(value||'').trim();return /^\/(?!\/)[A-Za-z0-9_~!$&'()*+,;=:@%/?.#-]{0,499}$/.test(v)?v:null}
function dateLabel(value){const s=String(value||'').slice(0,10).split('-');return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:'data informada'}
function timeLabel(value){return String(value||'').slice(0,5)||'horário informado'}

async function criarNotificacao({barbeariaId=null,usuarioId=null,audiencia='tenant',papeis=[],tipo='sistema',nivel='info',titulo,mensagem,link=null,dados={},chaveUnica=null,expiraEm=null},{db=pool}={}){
  const audience=audiencia==='super_admin'?'super_admin':'tenant';
  const tenant=audience==='tenant'?Number(barbeariaId):null;
  if(audience==='tenant'&&(!Number.isSafeInteger(tenant)||tenant<1))return null;
  const user=Number(usuarioId);const targetUser=Number.isSafeInteger(user)&&user>0?user:null;
  const roles=[...new Set((Array.isArray(papeis)?papeis:[]).map(String).filter(x=>ROLES.has(x)))];
  const title=texto(titulo,160),message=texto(mensagem,700);if(!title||!message)return null;
  const level=LEVELS.has(nivel)?nivel:'info';
  const r=await db.query(`INSERT INTO notificacoes(barbearia_id,usuario_id,audiencia,papeis,tipo,nivel,titulo,mensagem,link,dados,chave_unica,expira_em)
    VALUES($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
    ON CONFLICT DO NOTHING RETURNING id`,[
      tenant,targetUser,audience,roles,texto(tipo,50)||'sistema',level,title,message,safeLink(link),JSON.stringify(dados||{}),texto(chaveUnica,200)||null,expiraEm||null
    ]);
  return r.rows[0]||null;
}

async function appointmentContext(barbeariaId,agendamentoId){
  const r=await pool.query(`SELECT a.id,a.data,a.horario,a.status,a.status_pagamento,a.barbeiro_id,
    c.nome cliente,b.nome barbeiro,s.nome servico
    FROM agendamentos a
    JOIN clientes c ON c.id=a.cliente_id AND c.barbearia_id=a.barbearia_id
    JOIN barbeiros b ON b.id=a.barbeiro_id AND b.barbearia_id=a.barbearia_id
    JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id
    WHERE a.id=$1 AND a.barbearia_id=$2`,[agendamentoId,barbeariaId]);
  return r.rows[0]||null;
}

async function notifyAssignedBarber(ctx,{titulo,mensagem,nivel,tipo,chave,link}){
  const users=(await pool.query(`SELECT id FROM usuarios WHERE barbearia_id=$1 AND barbeiro_id=$2 AND papel='barbeiro' AND ativo=true`,[ctx.barbearia_id||ctx.barbeariaId,ctx.barbeiro_id])).rows;
  for(const user of users)await criarNotificacao({barbeariaId:ctx.barbearia_id||ctx.barbeariaId,usuarioId:user.id,papeis:['barbeiro'],titulo,mensagem,nivel,tipo,link,chaveUnica:`${chave}:user:${user.id}`});
}

async function publicarEventoNotificacao(evento,dados={}){
  const event=String(evento||'');
  const tenant=Number(dados.barbearia_id),appointmentId=Number(dados.agendamento_id);
  if(['nova_barbearia','support_ticket_created'].includes(event)){
    const isSignup=event==='nova_barbearia';
    return criarNotificacao({
      audiencia:'super_admin',tipo:isSignup?'barbearia':'suporte',nivel:isSignup?'success':'warning',
      titulo:isSignup?'Nova barbearia cadastrada':'Novo chamado de suporte',
      mensagem:isSignup?`${texto(dados.barbearia,120)||'Uma nova barbearia'} iniciou o trial Premium.`:`${texto(dados.barbearia,120)||'Uma barbearia'} abriu o chamado “${texto(dados.assunto,160)||'Sem assunto'}”.`,
      link:isSignup?'/master.html?secao=barbearias-sec':'/master.html?secao=suporte-sec',
      chaveUnica:`${event}:${Number(dados.barbearia_id)||0}:${Number(dados.ticket_id)||0}`
    });
  }
  if(event==='support_ticket_updated'){
    return criarNotificacao({barbeariaId:tenant,usuarioId:Number(dados.usuario_id)||null,papeis:Number(dados.usuario_id)?[]:['dono','gerente'],tipo:'suporte',nivel:'info',titulo:'Chamado de suporte atualizado',mensagem:`O chamado “${texto(dados.assunto,160)||'enviado ao suporte'}” foi atualizado para ${texto(dados.status,30)||'um novo status'}.`,link:'/pages/suporte.html',chaveUnica:`${event}:${Number(dados.ticket_id)||0}:${texto(dados.status,30)}`});
  }
  if(['pix_manual_pendente','pagamento_aprovado_sem_vaga'].includes(event)){
    const reservationId=Number(dados.reserva_id);if(!Number.isSafeInteger(tenant)||tenant<1||!Number.isSafeInteger(reservationId)||reservationId<1)return null;
    const reservation=(await pool.query(`SELECT r.id,r.nome,r.data,r.horario,r.valor_cobrado,b.nome barbeiro,s.nome servico FROM reservas_pagamento r JOIN barbeiros b ON b.id=r.barbeiro_id AND b.barbearia_id=r.barbearia_id JOIN servicos s ON s.id=r.servico_id AND s.barbearia_id=r.barbearia_id WHERE r.id=$1 AND r.barbearia_id=$2`,[reservationId,tenant])).rows[0];if(!reservation)return null;
    const review=event==='pagamento_aprovado_sem_vaga';
    return criarNotificacao({barbeariaId:tenant,papeis:['dono','gerente','recepcao'],tipo:'pagamento',nivel:review?'error':'warning',titulo:review?'Pagamento exige revisão':'Pix aguardando confirmação',mensagem:review?`O pagamento de ${reservation.nome} foi aprovado, mas o horário de ${dateLabel(reservation.data)} às ${timeLabel(reservation.horario)} não está mais disponível.`:`${reservation.nome} reservou ${reservation.servico} para ${dateLabel(reservation.data)} às ${timeLabel(reservation.horario)} e informou pagamento via Pix manual.`,link:'/pages/agendamentos.html',chaveUnica:`${event}:${tenant}:${reservationId}`});
  }
  if(!Number.isSafeInteger(tenant)||tenant<1||!Number.isSafeInteger(appointmentId)||appointmentId<1)return null;
  const ctx=await appointmentContext(tenant,appointmentId);if(!ctx)return null;ctx.barbearia_id=tenant;
  const when=`${dateLabel(ctx.data)} às ${timeLabel(ctx.horario)}`;
  const link=`/pages/agendamentos.html?data=${String(ctx.data).slice(0,10)}`;
  let titulo='Atualização no agendamento',mensagem=`${ctx.cliente}: ${ctx.servico}, ${when}.`,nivel='info',tipo='agenda',suffix=event;
  if(['agendamento_publico_criado','agendamento_publico_dinheiro','agendamento_criado'].includes(event)){titulo='Novo agendamento';mensagem=`${ctx.cliente} marcou ${ctx.servico} para ${when} com ${ctx.barbeiro}.`;nivel='success';}
  else if(['agendamento_publico_pago','agendamento_pix_confirmado'].includes(event)){titulo='Pagamento e agendamento confirmados';mensagem=`${ctx.cliente} confirmou ${ctx.servico} para ${when}. Pagamento identificado.`;nivel='success';tipo='pagamento';}
  else if(['agendamento_cancelado_publico','agendamento_cancelado_acompanhamento'].includes(event)){titulo='Agendamento cancelado';mensagem=`${ctx.cliente} cancelou ${ctx.servico} de ${when}${dados.reembolso_pendente?' e há reembolso pendente.':'.'}`;nivel='warning';suffix=`${event}:${dados.reembolso_pendente?'refund':'normal'}`;}
  else if(['agendamento_reagendado_publico','agendamento_reagendado_acompanhamento'].includes(event)){titulo='Agendamento reagendado';mensagem=`${ctx.cliente} reagendou ${ctx.servico} para ${when} com ${ctx.barbeiro}.`;nivel='info';}
  else if(event==='agendamento_status'){
    if(!['cancelado','nao_compareceu'].includes(String(dados.status)))return null;
    titulo=dados.status==='cancelado'?'Agendamento cancelado':'Cliente não compareceu';mensagem=`${ctx.cliente} — ${ctx.servico}, ${when}.`;nivel='warning';suffix=`${event}:${dados.status}`;
  }else return null;
  const chave=`${suffix}:${tenant}:${appointmentId}`;
  await criarNotificacao({barbeariaId:tenant,papeis:['dono','gerente','recepcao'],tipo,nivel,titulo,mensagem,link,chaveUnica:`${chave}:operacao`});
  await notifyAssignedBarber(ctx,{titulo,mensagem,nivel,tipo,chave,link});
  return true;
}

function visibilitySql(user,start=1){
  if(user.papel==='super_admin')return {sql:`n.audiencia='super_admin' AND (n.usuario_id IS NULL OR n.usuario_id=$${start})`,params:[user.id]};
  return {sql:`n.audiencia='tenant' AND n.barbearia_id=$${start+1} AND (n.usuario_id IS NULL OR n.usuario_id=$${start}) AND (cardinality(n.papeis)=0 OR $${start+2}=ANY(n.papeis))`,params:[user.id,user.barbearia_id,user.papel]};
}

async function listarNotificacoes(user,limit=30){
  const lim=Math.min(Math.max(Number(limit)||30,1),50),v=visibilitySql(user,1),limitPos=v.params.length+1;
  const [items,count]=await Promise.all([
    pool.query(`SELECT n.id,n.tipo,n.nivel,n.titulo,n.mensagem,n.link,n.dados,n.criado_em,(l.usuario_id IS NOT NULL) lida
      FROM notificacoes n LEFT JOIN notificacoes_leituras l ON l.notificacao_id=n.id AND l.usuario_id=$1
      WHERE ${v.sql} AND (n.expira_em IS NULL OR n.expira_em>NOW())
      ORDER BY n.criado_em DESC,n.id DESC LIMIT $${limitPos}`,v.params.concat(lim)),
    pool.query(`SELECT COUNT(*)::int nao_lidas FROM notificacoes n
      WHERE ${v.sql} AND (n.expira_em IS NULL OR n.expira_em>NOW())
      AND NOT EXISTS(SELECT 1 FROM notificacoes_leituras l WHERE l.notificacao_id=n.id AND l.usuario_id=$1)`,v.params)
  ]);
  return {items:items.rows,nao_lidas:Number(count.rows[0]?.nao_lidas||0)};
}

async function marcarLida(user,id){
  const notificationId=Number(id);if(!Number.isSafeInteger(notificationId)||notificationId<1)return false;
  const v=visibilitySql(user,2);
  const r=await pool.query(`INSERT INTO notificacoes_leituras(notificacao_id,usuario_id)
    SELECT n.id,$1 FROM notificacoes n WHERE n.id=$${v.params.length+2} AND ${v.sql}
    ON CONFLICT(notificacao_id,usuario_id) DO UPDATE SET lida_em=NOW() RETURNING notificacao_id`,[user.id,...v.params,notificationId]);
  return !!r.rowCount;
}

async function marcarTodasLidas(user){
  const v=visibilitySql(user,2);
  const r=await pool.query(`INSERT INTO notificacoes_leituras(notificacao_id,usuario_id)
    SELECT n.id,$1 FROM notificacoes n WHERE ${v.sql} AND (n.expira_em IS NULL OR n.expira_em>NOW())
    ON CONFLICT(notificacao_id,usuario_id) DO NOTHING`,[user.id,...v.params]);
  return r.rowCount;
}

module.exports={ensureNotificationSchema,criarNotificacao,publicarEventoNotificacao,listarNotificacoes,marcarLida,marcarTodasLidas};
