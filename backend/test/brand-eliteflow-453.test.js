const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const target=path.join(dir,entry.name);
  return entry.isDirectory()?walk(target):[target];
});

test('identidade visível usa EliteFlow e o nome completo',()=>{
  const frontend=walk(path.join(root,'frontend')).filter(file=>/\.(?:html|js|svg)$/.test(file));
  const visible=frontend.map(file=>fs.readFileSync(file,'utf8')).join('\n');
  assert.doesNotMatch(visible,/BarberFlow|Barber<span>Flow|barberflow/i);
  assert.match(visible,/Elite<span>Flow<\/span>/);
  assert.match(visible,/EliteFlow: Gestão de Barbearia/);
  assert.match(read('frontend/favicon.svg'),/aria-label="EliteFlow"/);
});

test('pacote e artefatos novos usam EliteFlow 4.5.4',()=>{
  const pkg=JSON.parse(read('backend/package.json'));
  assert.equal(pkg.name,'eliteflow-saas');
  assert.equal(pkg.version,'4.5.4');
  assert.match(pkg.description,/EliteFlow: Gestão de Barbearia/);
  assert.match(read('backend/src/config/db.js'),/application_name: 'eliteflow-saas'/);
  assert.match(read('backend/backup.js'),/filename=`eliteflow-/);
  assert.match(read('backend/src/routes/operacao.js'),/filename="eliteflow-\$\{tipo\}\.csv"/);
});

test('identificadores legados críticos continuam compatíveis',()=>{
  assert.match(read('backend/src/utils/security.js'),/JWT_ISSUER='barberflow'/);
  assert.match(read('backend/src/utils/security.js'),/JWT_AUDIENCE='barberflow-web'/);
  assert.match(read('backend/src/services/mercadoPago.js'),/external_reference: `barberflow:/);
  assert.match(read('backend/src/services/subscriptionPayments.js'),/barberflow-subscription-pix/);
  assert.match(read('backend/src/services/whatsappQr.js'),/`barberflow\$\{Number\(barbeariaId\)\}`/);
  assert.match(read('backend/src/routes/automacoes.js'),/x-barberflow-cron/);
  assert.match(read('backend/migrar-banco.js'),/barberflow-system/);
});
