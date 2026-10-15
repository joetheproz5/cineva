const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
test('progress helpers load in order and are included in the offline shell',()=>{
 const root=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 const scripts=['series-tracker.js?v=1','progress-tools.js?v=1','series-tracker-ui.js?v=2','progress-ui.js?v=1','app.js?v=368'];for(let i=0;i<scripts.length;i++){assert.ok(index.includes(scripts[i]));assert.ok(worker.includes(scripts[i]));if(i)assert.ok(index.indexOf(scripts[i-1])<index.indexOf(scripts[i]));}
});
test('both production and local proxies mount the same batch handler; local server remains valid JS',()=>{
 const repo=path.resolve(__dirname,'../..'),production=fs.readFileSync(path.join(repo,'functions/api/[[path]].js'),'utf8'),local=fs.readFileSync(path.join(repo,'Web/server.js'),'utf8');assert.match(production,/account\/progress\/batch.*handleProgressBatch/);assert.match(local,/account\/progress\/batch/);assert.match(local,/module\.handleProgressBatch/);assert.doesNotThrow(()=>require('node:vm').createScript(local));
});
test('TMDB TV taxonomy types such as Scripted normalize to tv, not a third content type',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),normalize=require('node:vm').runInNewContext(`(${source.match(/function normalize\(item, fallbackType\) \{[^\n]+/)[0]})`);
 assert.equal(normalize({id:1396,name:'Breaking Bad',type:'Scripted'},'tv').type,'tv');assert.equal(normalize({id:1,name:'Talk show',type:'Talk Show'},'tv').type,'tv');assert.equal(normalize({id:1,title:'A movie'},'movie').type,'movie');assert.equal(normalize({id:1,name:'Series',type:'tv'},'movie').type,'tv');
});
