const pool=require('../config/db');
const {criarNotificacao}=require('./notificationCenter');

const LEGAL_VERSION='2026-08-27';

async function ensureLaunchSchema(){
  await pool.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mostrar_whatsapp_publico BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS mostrar_mapa_publico BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS onboarding_link_compartilhado BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS onboarding_concluido_em TIMESTAMP`);
  await pool.query(`CREATE TABLE IF NOT EXISTS legal_acceptances(
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    documento VARCHAR(40) NOT NULL,
    versao VARCHAR(30) NOT NULL,
    ip INET,
    user_agent TEXT,
    aceito_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id,documento,versao)
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_legal_acceptances_tenant ON legal_acceptances(barbearia_id,aceito_em DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS support_tickets(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    categoria VARCHAR(40) NOT NULL,
    assunto VARCHAR(160) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'aberto',
    prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
    resposta TEXT,
    respondido_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK(status IN ('aberto','em_atendimento','resolvido','fechado')),
    CHECK(prioridade IN ('baixa','normal','alta'))
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_support_tickets_tenant ON support_tickets(barbearia_id,status,criado_em DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON support_tickets(status,criado_em DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS system_events(
    id BIGSERIAL PRIMARY KEY,
    nivel VARCHAR(20) NOT NULL,
    evento VARCHAR(80) NOT NULL,
    request_id VARCHAR(128),
    barbearia_id INTEGER REFERENCES barbearias(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    mensagem TEXT,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK(nivel IN ('info','warn','error'))
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_system_events_level_data ON system_events(nivel,criado_em DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_runs(
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(30) NOT NULL,
    destino VARCHAR(40) NOT NULL,
    tamanho_bytes BIGINT,
    arquivo VARCHAR(240),
    erro TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK(status IN ('sucesso','local_only','falhou'))
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_backup_runs_data ON backup_runs(criado_em DESC)`);
}

async function onboardingStatus(barbeariaId){
  const r=await pool.query(`SELECT b.id,b.nome,b.slug,b.telefone,b.cidade,b.estado,COALESCE(b.onboarding_link_compartilhado,false) link_compartilhado,b.onboarding_concluido_em,
    (SELECT COUNT(*)::int FROM barbeiros x WHERE x.barbearia_id=b.id AND x.ativo=true) barbeiros,
    (SELECT COUNT(*)::int FROM servicos x WHERE x.barbearia_id=b.id AND x.ativo=true) servicos,
    (SELECT COUNT(*)::int FROM horarios_trabalho x WHERE x.barbearia_id=b.id) horarios
    FROM barbearias b WHERE b.id=$1`,[barbeariaId]);
  if(!r.rowCount)return null;
  const b=r.rows[0];
  const steps=[
    {id:'dados',titulo:'Complete os dados da barbearia',descricao:'Telefone, cidade e estado ajudam clientes e pagamentos.',concluido:!!(b.telefone&&b.cidade&&b.estado),href:'/pages/configuracoes.html'},
    {id:'barbeiros',titulo:'Cadastre seus barbeiros',descricao:'Adicione pelo menos um profissional ativo.',concluido:Number(b.barbeiros)>0,href:'/pages/barbeiros.html'},
    {id:'servicos',titulo:'Cadastre seus serviços',descricao:'Informe duração e preço dos serviços oferecidos.',concluido:Number(b.servicos)>0,href:'/pages/servicos.html'},
    {id:'horarios',titulo:'Configure os horários de trabalho',descricao:'Defina quando seus profissionais podem receber agendamentos.',concluido:Number(b.horarios)>0,href:'/pages/barbeiros.html'},
    {id:'publicar',titulo:'Compartilhe sua página de agendamento',descricao:'Abra o link público, teste no celular e envie para um cliente.',concluido:!!b.link_compartilhado,href:`/agendar/${encodeURIComponent(b.slug)}`}
  ];
  const concluidas=steps.filter(x=>x.concluido).length;
  const completo=concluidas===steps.length;
  if(completo&&!b.onboarding_concluido_em)await pool.query(`UPDATE barbearias SET onboarding_concluido_em=NOW() WHERE id=$1 AND onboarding_concluido_em IS NULL`,[barbeariaId]);
  return {completo,concluidas,total:steps.length,progresso:Math.round(concluidas/steps.length*100),steps,public_url:`/agendar/${encodeURIComponent(b.slug)}`};
}

async function recordSystemEvent({nivel='error',evento,mensagem,requestId=null,barbeariaId=null,usuarioId=null,detalhes={}}){
  try{
    const text=String(mensagem||'').slice(0,4000);
    await pool.query(`INSERT INTO system_events(nivel,evento,request_id,barbearia_id,usuario_id,mensagem,detalhes) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[nivel,evento,requestId,barbeariaId,usuarioId,text,JSON.stringify(detalhes||{})]);
    if(['warn','error'].includes(nivel))await criarNotificacao({audiencia:'super_admin',tipo:'sistema',nivel:nivel==='warn'?'warning':'error',titulo:nivel==='warn'?'Atenção na operação':'Falha detectada no sistema',mensagem:text||String(evento||'Evento operacional'),link:'/master.html',chaveUnica:`system:${String(evento||'unknown')}:${String(requestId||Date.now())}`});
  }catch(e){console.error('system_event_write_failed',e.message)}
}

module.exports={LEGAL_VERSION,ensureLaunchSchema,onboardingStatus,recordSystemEvent};
