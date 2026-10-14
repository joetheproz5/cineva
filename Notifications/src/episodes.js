export const MAX_FOLLOWS=80;
export function validEpisodeDate(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=Date.parse(value+"T12:00:00Z");return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function validateFollows(body){
  if(!Number.isSafeInteger(body?.revision)||body.revision<0||typeof body.scope!=="string"||body.scope.length>180||!Array.isArray(body.series)||body.series.length>MAX_FOLLOWS)throw new TypeError("Invalid followed series.");
  const seen=new Set();
  const series=body.series.map(item=>{
    if(!Number.isSafeInteger(item.id)||item.id<1||typeof item.title!=="string"||!item.title.trim()||item.title.length>80||!Number.isInteger(item.season)||item.season<0||item.season>999||!Number.isInteger(item.episode)||item.episode<0||item.episode>10000||seen.has(item.id))throw new TypeError("Invalid followed series.");
    seen.add(item.id);return {...item,title:item.title.trim()};
  });
  if(series.length&&!body.scope)throw new TypeError("A profile scope is required.");
  return {revision:body.revision,scope:body.scope,series};
}
export function releaseDecision(follow,show,today=new Date().toISOString().slice(0,10)){
  const latest=show.last_episode_to_air,season=Number(latest?.season_number)||0,episode=Number(latest?.episode_number)||0;
  const newer=season>Number(follow.last_season)||season===Number(follow.last_season)&&episode>Number(follow.last_episode);
  const notify=season>0&&episode>0&&validEpisodeDate(latest.air_date)&&latest.air_date<=today&&newer;
  const upcoming=show.next_episode_to_air;
  const nextDate=validEpisodeDate(upcoming?.air_date)&&upcoming.air_date>today?upcoming.air_date:null;
  return {notify,season,episode,nextDate,newSeason:notify&&episode===1&&season>Number(follow.last_season)};
}
