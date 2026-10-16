const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
test('development server serves hardened pages, delegates APIs and does not expose local credential files',async()=>{
 const port=21000+Math.floor(Math.random()*20000),child=spawn(process.execPath,['Web/server.js'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server did not start.')),10000);child.stdout.on('data',chunk=>{if(String(chunk).includes('SEVEN is available')){clearTimeout(timer);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Local server exited '+code));});});
  const origin='http://127.0.0.1:'+port,main=await fetch(origin);assert.equal(main.status,200);assert.match(main.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(main.headers.get('x-content-type-options'),'nosniff');assert.ok((await main.text()).includes('auth-security.js?v=1'));
  for(const file of ['supabase.local.json','supabase.LOCAL.json','tmdb.local.json','.env','server.js','SERVER.js','tests/auth-security.test.js','qa/auth-security.cjs'])assert.equal((await fetch(origin+'/'+file)).status,404,file);
  assert.equal((await fetch(origin+'/dashboard')).status,200);assert.equal((await fetch(origin+'/api/not-a-real-endpoint')).status,404);
 }finally{child.kill();}
});
