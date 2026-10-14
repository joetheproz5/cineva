const assert=require("node:assert/strict");
const test=require("node:test");
const recommendations=require("../recommendations");
const now=Date.parse("2026-10-14T12:00:00Z"),today="2026-10-14T08:00:00Z";
const item=(id,genres=[28],values={})=>({id,type:"movie",title:`Movie ${id}`,genre_ids:genres,poster_path:"/poster.png",release_date:"2025-01-01",vote_average:8,vote_count:500,popularity:10,...values});
const history=(id,genres,values={})=>({id,type:"movie",title:`Seen ${id}`,genreIds:genres,currentTime:5400,duration:6000,lastWatchedAt:today,...values});
test("chosen genres and likes outweigh popularity, with a balanced cold-start fallback",()=>{
 const candidates=[item(1,[28]),item(2,[35],{popularity:1000})];
 const model=recommendations.build({now,preferences:{favoriteGenres:[28]}});assert.equal(recommendations.rank(candidates,model)[0].id,1);
 const likes=recommendations.build({now,liked:[{id:90,type:"movie",genreIds:[35],likedAt:today}]});assert.equal(recommendations.rank(candidates,likes)[0].id,2);
 const cold=recommendations.build({now});assert.deepEqual(recommendations.rank(candidates,cold),recommendations.rank(candidates.slice().reverse(),cold));
});
test("brief plays do not teach tastes or become anchors; meaningful and completed plays do",()=>{
 assert.equal(recommendations.engagement(history(1,[28],{currentTime:10})),0);
 const model=recommendations.build({now,history:[history(1,[28],{currentTime:10}),history(2,[35],{currentTime:3000})]});
 assert.deepEqual(recommendations.topGenres(model,"movie"),[35]);assert.equal(model.anchors.length,1);assert.equal(model.anchors[0].id,2);
 assert.equal(recommendations.engagement({watched:true}),1);
});
test("a series counts once rather than overwhelming tastes with dozens of episodes",()=>{
 const episode=history(1,[35],{type:"tv",currentTime:1800,duration:2000});
 const one=recommendations.build({now,history:[episode]});const many=recommendations.build({now,history:Array.from({length:40},(_,i)=>({...episode,season:1,episode:i+1}))});
 assert.deepEqual(many.genres,one.genres);assert.equal(many.anchors.length,1);
});
test("recent meaningful viewing carries more weight than old activity",()=>{
 const model=recommendations.build({now,history:[history(1,[35],{lastWatchedAt:"2023-01-01"}),history(2,[28])]});
 assert.ok(model.genres.movie[28]>model.genres.movie[35]);
});
test("profile isolation, type preferences, hidden titles and family restrictions are preserved",()=>{
 const model=recommendations.build({now,profileId:"a",history:[history(1,[35],{profileId:"b"})],liked:[{type:"movie",id:2,genreIds:[35],profileId:"b"}],hidden:[{type:"movie",id:3,profileId:"a"}],preferences:{contentMix:"movies"}});
 assert.equal(model.signals,0);assert.equal(model.anchors.length,0);
 const ranked=recommendations.rank([item(3),item(4),item(5,[27]),item(6,[35],{type:"tv"})],model,{allowed:title=>!title.genre_ids.includes(27)});
 assert.deepEqual(ranked.map(title=>title.id),[4]);
});
test("movie and TV IDs stay separate, with genre IDs mapped between the two",()=>{
 const model=recommendations.build({now,liked:[{type:"movie",id:1,genreIds:[28],likedAt:today}],hidden:[{type:"tv",id:1}]});
 assert.ok(model.genres.tv[10759]>0);assert.ok(recommendations.rank([item(1),item(1,[10759],{type:"tv"})],model).some(title=>title.type==="movie"));
});
test("completed titles are demoted, hidden titles excluded, and scarce perfect ratings are discounted",()=>{
 const model=recommendations.build({now,history:[history(1,[28])],hidden:[{type:"movie",id:2}]});
 const ranked=recommendations.rank([item(1),item(2),item(3),item(4,[28],{vote_average:10,vote_count:1})],model);
 assert.equal(ranked[0].id,3);assert.ok(!ranked.some(title=>title.id===2));assert.ok(recommendations.score(item(3),model)>recommendations.score(item(4,[28],{vote_average:10,vote_count:1}),model));
});
test("related titles get a bonus without bypassing exclusions or profile rules",()=>{
 const model=recommendations.build({now,hidden:[{type:"movie",id:2}]});recommendations.addRelated(model,{strength:6},[item(1),item(2)]);
 assert.ok(recommendations.score(item(1),model)>recommendations.score(item(3),model));assert.equal(recommendations.rank([item(1),item(2)],model).length,1);
});
test("ranking is stable and filters future releases, missing posters and duplicates",()=>{
 const model=recommendations.build({now});const rows=[item(1),item(1),item(2,[28],{release_date:"2027-01-01"}),item(3,[28],{poster_path:null}),item(4)];
 assert.deepEqual(recommendations.rank(rows,model).map(title=>title.id),[1,4]);assert.deepEqual(rows[0],item(1));
});
test("metadata recovers missing legacy genres and keeps negative feedback modest",()=>{
 const model=recommendations.build({now,liked:[{type:"movie",id:1,genreIds:[],likedAt:today}],hidden:[{type:"movie",id:2}],metadata:[item(1,[35]),item(2,[28])]});
 assert.ok(model.genres.movie[35]>0);assert.ok(model.genres.movie[28]<0);
});
test("small diversity penalty breaks near ties but never replaces strong taste matches",()=>{
 const model=recommendations.build({now});const ranked=recommendations.rank([item(1),item(2),item(3),item(4),item(5,[35])],model);
 assert.ok(ranked.findIndex(title=>title.id===5)<4);
});
