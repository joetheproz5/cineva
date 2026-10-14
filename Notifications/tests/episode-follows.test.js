import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {createECDH,randomBytes} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";
import {validateFollows,releaseDecision} from "../src/episodes.js";
const origin="https://seven-9fm.pages.dev",token="d".repeat(43);
function setup(){
 const db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON");
 for(const file of ["0001_release_reminders.sql","0002_episode_follows.sql"])db.exec(fs.readFileSync(new URL("../migrations/"+file,import.meta.url),"utf8"));
 const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}};},async first(column){const row=db.prepare(sql).get(...values);return column?row?.[column]:row;},async all(){return {results:db.prepare(sql).all(...values)};}};},async batch(statements){db.exec("BEGIN");try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec("COMMIT");return results;}catch(error){db.exec("ROLLBACK");throw error;}}};
 const key=createECDH("prime256v1");key.generateKeys();const subscriber=createECDH("prime256v1");subscriber.generateKeys();
 const env={DB,TMDB_PROXY_BASE:origin+"/api/tmdb/",APP_BASE_URL:origin,VAPID_SUBJECT:origin,VAPID_PUBLIC_KEY:key.getPublicKey().toString("base64url"),VAPID_PRIVATE_KEY:key.getPrivateKey().toString("base64url")};
 const request=(path,body,auth=token)=>worker.fetch(new Request("https://alerts.example"+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+auth}:{})},body:JSON.stringify(body)}),env);
 const subscribe=()=>request("/api/subscriptions",{subscription:{endpoint:"https://fcm.googleapis.com/fcm/send/fixture",keys:{p256dh:subscriber.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}}});
 return {db,env,request,subscribe};
}
const follow=(id=25)=>({id,title:"Show",season:1,episode:1});
test("follow sets are device-scoped, preserve delivery baselines, and ignore stale profile requests",async()=>{
 const {db,request,subscribe}=setup();assert.equal((await subscribe()).status,200);
 assert.equal((await request("/api/episode-follows",{revision:1,scope:"profile-a",series:[follow()]})).status,200);
 await request("/api/episode-follows",{revision:2,scope:"profile-a",series:[{...follow(),episode:3}]});
 assert.equal(db.prepare("SELECT last_episode FROM episode_follows").get().last_episode,1);
 await request("/api/episode-follows",{revision:1,scope:"",series:[]});assert.equal(db.prepare("SELECT COUNT(*) AS n FROM episode_follows").get().n,1);
 await request("/api/episode-follows",{revision:3,scope:"profile-b",series:[{...follow(),season:2,episode:1}]});assert.equal(db.prepare("SELECT last_season FROM episode_follows").get().last_season,2);
 await request("/api/episode-follows",{revision:4,scope:"",series:[]});await request("/api/episode-follows",{revision:3,scope:"profile-a",series:[follow()]});assert.equal(db.prepare("SELECT COUNT(*) AS n FROM episode_follows").get().n,0);
});
test("unauthenticated devices, duplicates, excessive follows and invalid episode IDs are rejected",async()=>{
 const {request,subscribe}=setup();await subscribe();
 assert.equal((await request("/api/episode-follows",{revision:1,scope:"a",series:[follow()]},null)).status,401);
 assert.equal((await request("/api/episode-follows",{revision:1,scope:"a",series:[follow(),follow()]})).status,400);
 assert.throws(()=>validateFollows({revision:1,scope:"a",series:Array.from({length:81},(_,i)=>follow(i+1))}),/Invalid/);
 assert.throws(()=>validateFollows({revision:1,scope:"a",series:[{...follow(),id:-1}]}),/Invalid/);
});
test("release decisions never announce future/invalid dates or historical episodes",()=>{
 const row={last_season:1,last_episode:2};
 assert.equal(releaseDecision(row,{last_episode_to_air:{season_number:1,episode_number:3,air_date:"2026-10-15"}},"2026-10-14").notify,false);
 assert.equal(releaseDecision(row,{last_episode_to_air:{season_number:1,episode_number:2,air_date:"2026-10-14"}},"2026-10-14").notify,false);
 assert.equal(releaseDecision(row,{last_episode_to_air:{season_number:2,episode_number:1,air_date:"2026-10-14"}},"2026-10-14").newSeason,true);
 assert.equal(releaseDecision(row,{last_episode_to_air:{season_number:2,episode_number:1,air_date:"2026-02-30"}},"2026-10-14").notify,false);
});
test("the scheduled worker sends a real encrypted Web Push once and advances its baseline",async()=>{
 const {db,env,request,subscribe}=setup();await subscribe();await request("/api/episode-follows",{revision:1,scope:"a",series:[follow()]});
 const original=global.fetch;let pushes=0;const today=new Date().toISOString().slice(0,10);
 global.fetch=async url=>{if(String(url).includes("/api/tmdb/"))return Response.json({name:"Show",last_episode_to_air:{season_number:1,episode_number:2,air_date:today},next_episode_to_air:null});pushes++;return new Response(null,{status:201});};
 try{await worker.scheduled({},env);await worker.scheduled({},env);assert.equal(pushes,1);assert.equal(db.prepare("SELECT last_episode FROM episode_follows").get().last_episode,2);}finally{global.fetch=original;}
});
test("failed push deliveries keep their baseline for retry, expired subscriptions are removed",async()=>{
 const {db,env,request,subscribe}=setup();await subscribe();await request("/api/episode-follows",{revision:1,scope:"a",series:[follow()]});
 const original=global.fetch;let status=503;const today=new Date().toISOString().slice(0,10);
 global.fetch=async url=>String(url).includes("/api/tmdb/")?Response.json({name:"Show",last_episode_to_air:{season_number:1,episode_number:2,air_date:today}}):new Response(null,{status});
 try{await worker.scheduled({},env);assert.equal(db.prepare("SELECT last_episode FROM episode_follows").get().last_episode,1);db.exec("UPDATE episode_follows SET checked_at=datetime('now','-46 minutes')");status=410;await worker.scheduled({},env);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get().n,0);}finally{global.fetch=original;}
});
test("delivering a legacy movie reminder does not remove an active episode subscription",async()=>{
 const {db,env,request,subscribe}=setup();await subscribe();await request("/api/episode-follows",{revision:1,scope:"a",series:[follow()]});
 const device=db.prepare("SELECT id FROM devices").get().id,today=new Date().toISOString().slice(0,10);db.prepare("INSERT INTO release_reminders(device_id,media_type,tmdb_id,title,release_date) VALUES(?,'movie',10,'Movie',?)").run(device,today);
 const original=global.fetch;global.fetch=async url=>String(url).includes("/api/tmdb/movie")?Response.json({title:"Movie",release_date:today}):String(url).includes("/api/tmdb/tv")?Response.json({name:"Show",last_episode_to_air:{season_number:1,episode_number:1,air_date:today}}):new Response(null,{status:201});
 try{await worker.scheduled({},env);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM release_reminders").get().n,0);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get().n,1);}finally{global.fetch=original;}
});
