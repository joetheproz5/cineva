/* Episode ordering and calendar dates shared by series pages and Watchlist. */
(function(root,factory){const tracker=factory();if(typeof module==="object"&&module.exports)module.exports=tracker;root.SEVENSeriesTracker=tracker;})(typeof window==="undefined"?globalThis:window,function(){
  const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00Z"))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
  function todayKey(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");}
  const episodeKey=(season,episode)=>`${Number(season)}:${Number(episode)}`;
  const watched=record=>!!record?.watched||Number(record?.progress)>=90;
  const aired=(episode,today=todayKey())=>validDate(episode?.air_date)&&episode.air_date<=today;
  function recordsFor(show,entries){
    const records=new Map();
    entries.filter(item=>item.type==="tv"&&Number(item.id)===Number(show.id)&&Number(item.season)>0&&Number(item.episode)>0).forEach(item=>{
      const key=episodeKey(item.season,item.episode),old=records.get(key);
      if(!old||String(item.lastWatchedAt||"")>String(old.lastWatchedAt||""))records.set(key,item);
    });return records;
  }
  async function inspect(show,entries,fetchSeason,today=todayKey()){
    const records=recordsFor(show,entries),seasons=(show.seasons||[]).filter(season=>Number(season.season_number)>0).sort((a,b)=>a.season_number-b.season_number),loaded=new Map();
    const get=number=>{number=Number(number);if(!loaded.has(number))loaded.set(number,Promise.resolve(fetchSeason(number)).then(data=>(data.episodes||[]).map(item=>({...item,season_number:number})).sort((a,b)=>a.episode_number-b.episode_number)));return loaded.get(number);};
    const latest=show.last_episode_to_air,nextRelease=show.next_episode_to_air;
    const calendarSeasons=new Set([latest?.season_number,nextRelease?.season_number].filter(number=>Number(number)>0));
    // Include the next season premiere when TMDB only lists its season date.
    const futureSeason=seasons.find(season=>validDate(season.air_date)&&season.air_date>=today);
    if(futureSeason)calendarSeasons.add(futureSeason.season_number);
    const calendar=[];let calendarError="";
    for(const number of calendarSeasons){try{calendar.push(...await get(number));}catch(error){calendarError=error.message||"Episode dates unavailable.";}}
    if(futureSeason&&!calendar.some(item=>Number(item.season_number)===Number(futureSeason.season_number)&&Number(item.episode_number)===1&&validDate(item.air_date)))calendar.push({season_number:Number(futureSeason.season_number),episode_number:1,air_date:futureSeason.air_date,name:"Season premiere",seasonDate:true});
    let next=null;
    const resumes=[...records.values()].filter(record=>!watched(record)&&Number(record.currentTime)>=5&&Number(record.duration)>0).sort((a,b)=>String(b.lastWatchedAt||"").localeCompare(String(a.lastWatchedAt||"")));
    for(const record of resumes){const episode=(await get(record.season)).find(item=>Number(item.episode_number)===Number(record.episode));if(aired(episode,today)){next={season:Number(record.season),episode,resume:true};break;}}
    if(!next)for(const season of seasons){
      if(validDate(season.air_date)&&season.air_date>today)continue;
      const count=Number(season.episode_count)||0;
      if(count>0&&Array.from({length:count},(_,i)=>watched(records.get(episodeKey(season.season_number,i+1)))).every(Boolean))continue;
      const episodes=await get(season.season_number),episode=episodes.find(item=>aired(item,today)&&!watched(records.get(episodeKey(season.season_number,item.episode_number))));
      if(episode){next={season:Number(season.season_number),episode,resume:false};break;}
    }
    if(nextRelease&&validDate(nextRelease.air_date)&&!calendar.some(episode=>episodeKey(episode.season_number,episode.episode_number)===episodeKey(nextRelease.season_number,nextRelease.episode_number)))calendar.push(nextRelease);
    const upcoming=calendar.filter(item=>validDate(item.air_date)&&item.air_date>today).sort((a,b)=>a.air_date.localeCompare(b.air_date)||a.season_number-b.season_number||a.episode_number-b.episode_number)[0]||null;
    return {show,next,upcoming,calendar:calendar.filter(item=>validDate(item.air_date)),calendarError,status:next?"watch":upcoming?"upcoming":["Ended","Canceled"].includes(show.status)?"finished":"caught-up"};
  }
  function week(offset=0,today=todayKey()){
    const date=new Date(today+"T12:00:00Z"),day=date.getUTCDay();date.setUTCDate(date.getUTCDate()-((day+6)%7)+Number(offset)*7);
    return Array.from({length:7},(_,index)=>{const value=new Date(date);value.setUTCDate(date.getUTCDate()+index);return value.toISOString().slice(0,10);});
  }
  function calendarEntries(shows,dates){
    const days=new Set(dates),seen=new Set(),entries=[];
    for(const tracked of shows)for(const episode of tracked.calendar||[]){const key=`${tracked.show.id}:${episodeKey(episode.season_number,episode.episode_number)}`;if(!days.has(episode.air_date)||seen.has(key))continue;seen.add(key);entries.push({show:tracked.show,episode});}
    return entries.sort((a,b)=>a.episode.air_date.localeCompare(b.episode.air_date)||String(a.show.name).localeCompare(String(b.show.name))||a.episode.episode_number-b.episode.episode_number);
  }
  return {validDate,todayKey,episodeKey,watched,aired,recordsFor,inspect,week,calendarEntries};
});
