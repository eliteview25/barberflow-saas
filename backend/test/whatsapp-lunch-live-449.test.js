const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('WhatsApp revalida o horário escolhido contra a agenda real antes de avançar',()=>{
  const src=read('backend/src/services/whatsapp.js');
  assert.match(src,/if\(s\.etapa==='horario'\)[\s\S]*slotContext\(pool,\{barbeariaId:integ\.barbearia_id/);
  assert.match(src,/A disponibilidade mudou e aquele horário não está mais livre/);
  assert.match(src,/const atuais=await slots\(integ\.barbearia_id,d\.barbeiro\.id,d\.servico\.id,d\.data\)/);
});

test('consulta de disponibilidade pela IA não pode afirmar horário sem validar agenda e almoço',()=>{
  const src=read('backend/src/services/whatsapp.js');
  assert.match(src,/const perguntaDisponibilidade=/);
  assert.match(src,/if\(perguntaDisponibilidade&&sv&&br&&ai\.data\)/);
  assert.match(src,/slotContext\(pool,\{barbeariaId:integ\.barbearia_id,barbeiroId:br\.id,servicoId:sv\.id,data:ai\.data,horario:ai\.horario\}\)/);
  assert.match(src,/if\(perguntaDisponibilidade\)\{await sendText\(integ,from,'Para confirmar disponibilidade eu preciso consultar a agenda real/);
});

test('slots do WhatsApp continuam removendo qualquer serviço que atravesse o almoço',()=>{
  const src=read('backend/src/services/whatsapp.js');
  assert.match(src,/SELECT hora_inicio,hora_fim,intervalo_inicio,intervalo_fim FROM horarios_trabalho/);
  assert.match(src,/m<intFim&&m\+dur>intInicio/);
  assert.match(src,/if\(!ocupado&&!intervalo\)out\.push/);
});
