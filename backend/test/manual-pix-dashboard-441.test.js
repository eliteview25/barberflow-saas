const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const reservations=read('backend/src/services/reservations.js');
const tracking=read('backend/src/services/bookingTracking.js');
const tenant=read('backend/src/routes/tenant.js');
const html=read('frontend/index.html');
const js=read('frontend/script.js');
const css=read('frontend/style.css');

test('4.4.1 aprovação de Pix cria agendamento e aguarda resultado do envio WhatsApp',()=>{
  assert.match(reservations,/const whatsapp=await sendAppointmentTracking\(\{barbeariaId:r\.barbearia_id,appointmentId:ag\.rows\[0\]\.id,confirmed:true,paymentConfirmed:true\}\)/);
  assert.match(reservations,/appointment_id:ag\.rows\[0\]\.id/);
  assert.match(reservations,/whatsapp\}/);
  assert.match(tenant,/whatsapp_enviado:out\.already_confirmed\?null:out\.whatsapp\?\.ok===true/);
  assert.match(tenant,/exigirStepUp/);
});

test('mensagem após Pix confirmado contém dados completos do agendamento',()=>{
  assert.match(tracking,/Pagamento confirmado ✅/);
  assert.match(tracking,/✂️ Serviço:/);
  assert.match(tracking,/👤 Profissional:/);
  assert.match(tracking,/📅 Data:/);
  assert.match(tracking,/🕒 Horário:/);
  assert.match(tracking,/Código de acompanhamento/);
  assert.match(tracking,/Até breve na/);
});

test('dashboard inicial possui área de aprovação rápida e modal próprio',()=>{
  for(const id of ['dashboardPixApprovals','dashboardPixCount','dashboardPixList','dashboardPixModal','dashboardPixModalDetails','dashboardPixModalConfirm'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/loadPendingPixDashboard/);
  assert.match(js,/data-dashboard-pix/);
  assert.match(js,/confirmSelectedPix/);
  assert.match(js,/\['dono','gerente','recepcao'\]\.includes\(role\)/);
  assert.doesNotMatch(js,/confirm\('Você conferiu o recebimento deste Pix\?'\)/);
});

test('aprovação rápida é responsiva e mostra falha de WhatsApp sem reverter agendamento',()=>{
  assert.match(js,/whatsapp_enviado===true/);
  assert.match(js,/whatsapp_enviado===false/);
  assert.match(js,/WhatsApp não conectado/);
  assert.match(css,/\.dashboard-pix-approvals/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.dashboard-pix-row/);
  assert.match(css,/@media\(max-width:390px\)[\s\S]*\.dashboard-pix-confirm-btn/);
});
