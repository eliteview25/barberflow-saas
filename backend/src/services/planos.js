const pool=require('../config/db');

const MATRIZ={
  starter:new Set(['agenda','clientes','barbeiros','servicos']),
  pro:new Set(['agenda','clientes','barbeiros','servicos','equipe','financeiro_basico','pagina_publica_simples','pagamentos_online']),
  premium:new Set(['agenda','clientes','barbeiros','servicos','equipe','financeiro_basico','pagina_publica_simples','pagamentos_online','automacoes','financeiro_graficos','pagina_publica_completa','personalizacao_publica'])
};
const ORDEM={starter:1,pro:2,premium:3};
function planoValido(p){return MATRIZ[p]?p:'starter'}
function trialAtivo(a){if(!a||a.status!=='trial'||!a.fim_trial)return false;return new Date(String(a.fim_trial).slice(0,10)+'T23:59:59')>=new Date()}
function planoEfetivo(a){if(trialAtivo(a))return 'premium';return planoValido(a?.plano)}
function recursosDoPlano(plano){return [...(MATRIZ[planoValido(plano)]||MATRIZ.starter)]}
function temRecursoAssinatura(a,recurso){return MATRIZ[planoEfetivo(a)]?.has(recurso)||false}
function diasRestantesTrial(a){if(!trialAtivo(a))return 0;const hoje=new Date();hoje.setHours(0,0,0,0);const fim=new Date(String(a.fim_trial).slice(0,10)+'T00:00:00');return Math.max(0,Math.ceil((fim-hoje)/86400000));}
async function obterAssinaturaAtual(barbeariaId){const r=await pool.query(`SELECT * FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[barbeariaId]);return r.rows[0]||null;}
async function contextoPlano(barbeariaId){const a=await obterAssinaturaAtual(barbeariaId);if(!a)return {assinatura:null,plano_efetivo:null,recursos:[],trial_ativo:false,dias_trial:0};const pe=planoEfetivo(a);return {assinatura:a,plano_efetivo:pe,recursos:recursosDoPlano(pe),trial_ativo:trialAtivo(a),dias_trial:diasRestantesTrial(a)};}
function exigirRecurso(recurso){return async(req,res,next)=>{try{const ctx=await contextoPlano(req.usuario.barbearia_id);if(!ctx.assinatura)return res.status(402).json({erro:'Barbearia sem assinatura',codigo:'SEM_ASSINATURA'});const ativa=ctx.assinatura.status==='ativa'||ctx.trial_ativo;if(!ativa)return res.status(402).json({erro:'Assinatura inativa ou período de teste encerrado',codigo:'ASSINATURA_INATIVA'});if(!ctx.recursos.includes(recurso)){const requerido=recurso==='equipe'||recurso==='financeiro_basico'||recurso==='pagina_publica_simples'||recurso==='pagamentos_online'?'pro':'premium';return res.status(403).json({erro:`Este recurso está disponível no plano ${requerido==='pro'?'Pro':'Premium'}.`,codigo:'PLANO_INSUFICIENTE',recurso,plano_atual:ctx.plano_efetivo,plano_necessario:requerido});}req.plano=ctx;next();}catch(e){console.error(e);res.status(500).json({erro:'Erro ao validar o plano'});}}}
module.exports={MATRIZ,ORDEM,planoEfetivo,recursosDoPlano,temRecursoAssinatura,trialAtivo,diasRestantesTrial,obterAssinaturaAtual,contextoPlano,exigirRecurso};
