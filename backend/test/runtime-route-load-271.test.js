const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

test('aplicação carrega todas as rotas sem ReferenceError em runtime',()=>{
  const backend=path.resolve(__dirname,'..');
  const expressPath=path.join(backend,'node_modules','express');
  if(!fs.existsSync(expressPath)){
    const routesDir=path.join(backend,'src','routes');
    for(const file of fs.readdirSync(routesDir).filter(x=>x.endsWith('.js'))){
      const src=fs.readFileSync(path.join(routesDir,file),'utf8');
      if(src.includes('exigirStepUp')) assert.match(src,/require\('\.\.\/middlewares\/auth'\)/,`${file}: exigirStepUp deve vir do middleware auth`);
      if(/[,\s]exigirStepUp[,\s)]/.test(src)){
        const imports=(src.match(/const\s*\{([^}]+)\}\s*=\s*require\('\.\.\/middlewares\/auth'\)/)||[])[1]||'';
        assert.ok(imports.split(',').map(x=>x.trim()).includes('exigirStepUp'),`${file}: exigirStepUp usado sem importação`);
      }
    }
    return;
  }
  const out=execFileSync(process.execPath,['-e',"require('./src/app'); process.stdout.write('APP_LOAD_OK'); process.exit(0)"],{cwd:backend,env:{...process.env,NODE_ENV:'test'},encoding:'utf8',timeout:10000});
  assert.equal(out,'APP_LOAD_OK');
});
