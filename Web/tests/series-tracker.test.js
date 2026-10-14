const assert=require("node:assert/strict");
const test=require("node:test");
const tracker=require("../series-tracker");
const today="2026-10-14",show={id:1,name:"Show",status:"Returning Series",seasons:[{season_number:0,episode_count:1},{season_number:1,episode_count:3,air_date:"2026-01-01"},{season_number:2,episode_count:2,air_date:"2026-10-20"}],last_episode_to_air:{season_number:1,episode_number:2,air_date:"2026-10-12"},next_episode_to_air:{season_number:1,episode_number:3,air_date:"2026-10-15"}};
const episode=(number,date,season=1)=>({episode_number:number,season_number:season,name:`Episode ${number}`,air_date:date});
const fetchSeason=async season=>({episodes:season===1?[episode(1,"2026-10-05"),episode(2,"2026-10-12"),episode(3,"2026-10-15")]:[episode(1,"2026-10-20",2),episode(2,"2026-10-27",2)]});
const record=(episode,values={})=>({type:"tv",id:1,season:1,episode,progress:100,watched:true,lastWatchedAt:"2026-10-14",...values});
test("first unwatched released episode is next; specials and future episodes never become next",async()=>{
 const data=await tracker.inspect(show,[],fetchSeason,today);assert.equal(data.next.season,1);assert.equal(data.next.episode.episode_number,1);assert.equal(data.upcoming.episode_number,3);assert.equal(data.status,"watch");
 const caught=await tracker.inspect(show,[record(1),record(2)],fetchSeason,today);assert.equal(caught.next,null);assert.equal(caught.status,"upcoming");
});
test("partial resume is preferred and 90-percent complete records do not resume",async()=>{
 const data=await tracker.inspect(show,[record(1),record(2,{watched:false,progress:45,currentTime:900,duration:2000})],fetchSeason,today);assert.equal(data.next.resume,true);assert.equal(data.next.episode.episode_number,2);
 const complete=await tracker.inspect(show,[record(1),record(2,{watched:false,progress:90,currentTime:1800,duration:2000})],fetchSeason,today);assert.equal(complete.next,null);
});
test("calendar preserves season premieres and deduplicates next-episode metadata",async()=>{
 const data=await tracker.inspect(show,[],fetchSeason,today);assert.equal(data.calendar.filter(item=>item.season_number===1&&item.episode_number===3).length,1);
 const week=tracker.week(1,today);assert.equal(week[0],"2026-10-19");assert.equal(week[6],"2026-10-25");
 const entries=tracker.calendarEntries([data,data],week);assert.equal(entries.length,1);assert.equal(entries[0].episode.season_number,2);assert.equal(entries[0].episode.episode_number,1);
});
test("resume and completion respect title identity and the newest manual status",async()=>{
 const data=await tracker.inspect(show,[record(1),record(1,{watched:false,progress:0,lastWatchedAt:"2026-10-15"}),record(2,{id:2})],fetchSeason,today);assert.equal(data.next.episode.episode_number,1);
});
test("fully watched seasons are skipped, but unwatched gaps are not lost",async()=>{
 const completed={...show,seasons:[{season_number:1,episode_count:2,air_date:"2026-01-01"},{season_number:2,episode_count:2,air_date:"2026-10-01"}],last_episode_to_air:{season_number:2,episode_number:2,air_date:"2026-10-12"},next_episode_to_air:null};
 const fetch=async season=>({episodes:[episode(1,"2026-10-01",season),episode(2,"2026-10-12",season)]});
 const next=await tracker.inspect(completed,[record(1),record(2)],fetch,today);assert.equal(next.next.season,2);
 const gap=await tracker.inspect(completed,[record(2),record(2,{season:2})],fetch,today);assert.equal(gap.next.season,1);assert.equal(gap.next.episode.episode_number,1);
});
test("ended shows finish; unannounced dates remain unknown rather than playable",async()=>{
 const ended=await tracker.inspect({...show,status:"Ended",seasons:[show.seasons[1]],next_episode_to_air:null},[record(1),record(2),record(3)],async()=>({episodes:[episode(1,"2026-10-01"),episode(2,"2026-10-05"),episode(3,"2026-10-12")]}),today);assert.equal(ended.status,"finished");
 const unknown=await tracker.inspect({id:3,seasons:[{season_number:1,episode_count:1}],status:"In Production"},[],async()=>({episodes:[episode(1,null)]}),today);assert.equal(unknown.next,null);assert.equal(unknown.upcoming,null);
 assert.equal(tracker.validDate("2026-02-30"),false);assert.equal(tracker.aired(episode(1,null),today),false);
});
test("metadata errors are surfaced instead of claiming the show is caught up",async()=>{
 await assert.rejects(tracker.inspect(show,[],async()=>{throw Error("Offline");},today),/Offline/);
});
test("an announced new season date remains visible before episode metadata is published",async()=>{
 const data=await tracker.inspect({id:4,status:"Returning Series",seasons:[{season_number:3,air_date:"2026-10-20",episode_count:0}]},[],async()=>({episodes:[]}),today);
 assert.equal(data.upcoming.season_number,3);assert.equal(data.upcoming.air_date,"2026-10-20");assert.equal(data.upcoming.seasonDate,true);
});
