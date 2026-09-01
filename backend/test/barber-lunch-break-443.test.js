const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('4.4.3 prepara intervalo de almoço no schema com restrição segura',()=>{
  const schedule=read('backend/src/services/barberSchedule.js');
  const server=read('backend/server.js');
  assert.match(schedule,/ALTER TABLE horarios_trabalho ADD COLUMN IF NOT EXISTS intervalo_inicio TIME/);
  assert.match(schedule,/ALTER TABLE horarios_trabalho ADD COLUMN IF NOT EXISTS intervalo_fim TIME/);
  assert.match(schedule,/ck_horarios_intervalo_valido/);
  assert.match(schedule,/hora_inicio < intervalo_inicio/);
  assert.match(schedule,/intervalo_fim < hora_fim/);
  assert.match(server,/ensureBarberScheduleSchema/);
});

test('cadastro de expediente salva almoço por dia e valida que fica dentro do expediente',()=>{
  const route=read('backend/src/routes/barbeiros.js');
  const front=read('frontend/js/barbeiros.js');
  assert.match(route,/intervalo_inicio,intervalo_fim/);
  assert.match(route,/O intervalo de almoço deve ficar dentro do expediente/);
  assert.match(route,/Expediente e intervalo atualizados/);
  assert.match(front,/data-break=/);
  assert.match(front,/data-break-in=/);
  assert.match(front,/data-break-out=/);
  assert.match(front,/intervalo_inicio:temIntervalo/);
});

test('disponibilidade pública, interna e WhatsApp bloqueia slots que atravessam almoço',()=>{
  for(const file of ['backend/src/routes/publico.js','backend/src/routes/agendamentos.js','backend/src/services/whatsapp.js']){
    const src=read(file);
    assert.match(src,/intervalo_inicio,intervalo_fim/);
    assert.match(src,/m<intFim&&m\+dur>intInicio/);
    assert.match(src,/!ocupado&&!intervalo|!conflito&&!intervalo/);
  }
});

test('regra central impede criação ou reagendamento direto durante almoço',()=>{
  const booking=read('backend/src/services/booking.js');
  assert.match(booking,/code:'INTERVALO'/);
  assert.match(booking,/Horário coincide com o intervalo de almoço do barbeiro/);
  assert.match(booking,/\$1::time < \$2::time/);
  assert.match(booking,/\$1::time\+\(\$3\*INTERVAL '1 minute'\) > \$4::time/);
});

test('dashboard desconta intervalo dos minutos disponíveis e editor é responsivo',()=>{
  const tenant=read('backend/src/routes/tenant.js');
  const css=read('frontend/style.css');
  assert.match(tenant,/COALESCE\(ht\.intervalo_fim-ht\.intervalo_inicio,INTERVAL '0 minutes'\)/);
  assert.match(css,/schedule-break-times/);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*schedule-break-times/);
});
