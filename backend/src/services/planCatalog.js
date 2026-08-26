const MATRIZ={
  starter:new Set(['agenda','clientes','barbeiros','servicos']),
  pro:new Set(['agenda','clientes','barbeiros','servicos','equipe','financeiro_basico','pagina_publica_simples','pagamentos_online']),
  premium:new Set(['agenda','clientes','barbeiros','servicos','equipe','financeiro_basico','pagina_publica_simples','pagamentos_online','automacoes','financeiro_graficos','pagina_publica_completa','personalizacao_publica','pdv_estoque','comissoes','fila_espera','crm_avancado','avaliacoes','fidelidade','relatorios_avancados','exportacao_dados'])
};
const ORDEM={starter:1,pro:2,premium:3};
function planoValido(p){return MATRIZ[p]?p:'starter'}
function trialAtivo(a){if(!a||a.status!=='trial'||!a.fim_trial)return false;return new Date(String(a.fim_trial).slice(0,10)+'T23:59:59')>=new Date()}
function planoEfetivo(a){if(trialAtivo(a))return 'premium';return planoValido(a?.plano)}
function recursosDoPlano(plano){return [...(MATRIZ[planoValido(plano)]||MATRIZ.starter)]}
function temRecursoAssinatura(a,recurso){return MATRIZ[planoEfetivo(a)]?.has(recurso)||false}
function diasRestantesTrial(a){if(!trialAtivo(a))return 0;const hoje=new Date();hoje.setHours(0,0,0,0);const fim=new Date(String(a.fim_trial).slice(0,10)+'T00:00:00');return Math.max(0,Math.ceil((fim-hoje)/86400000));}
module.exports={MATRIZ,ORDEM,planoValido,trialAtivo,planoEfetivo,recursosDoPlano,temRecursoAssinatura,diasRestantesTrial};
