(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SEVENProgressTools=api;})(typeof window==='undefined'?globalThis:window,function(){
  const MAX_ROWS=500;
  const positive=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
  const folded=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function csv(text){
    const rows=[];let row=[],value='',quoted=false;
    text=String(text).replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(quoted)quoted=false;else if(!value)quoted=true;else throw Error('Invalid CSV quoting.');}
      else if(c===','&&!quoted){row.push(value.trim());value='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';if(rows.length>MAX_ROWS+1)throw Error('Import up to 500 rows at a time.');}
      else value+=c;
    }
    if(quoted)throw Error('An opening quote is missing its closing quote.');row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  function parse(text){
    if(String(text).length>2000000)throw Error('Choose a file smaller than 2 MB.');
    let entries;
    if(String(text).trim().startsWith('[')){entries=JSON.parse(text);if(!Array.isArray(entries))throw Error('Use a JSON array.');}
    else {const rows=csv(text),headers=(rows.shift()||[]).map(h=>h.toLowerCase().replace(/[ -]+/g,'_'));if(!headers.includes('title')&&!headers.includes('tmdb_id')&&!headers.includes('id'))throw Error('Use a Title/Date CSV or a CSV with tmdb_id, type, season and episode.');entries=rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]||''])));}
    if(!entries.length)throw Error('The file has no viewing history.');if(entries.length>MAX_ROWS)throw Error('Import up to 500 rows at a time.');
    return entries.map((entry,index)=>{
      if(!entry||typeof entry!=='object')throw Error(`Invalid row ${index+1}.`);
      const title=String(entry.title||entry.Title||'').slice(0,500),parts=title.split(/:\s*/),id=Number(entry.tmdb_id||entry.id)||null;
      const season=entry.season!==undefined&&entry.season!==''?Number(entry.season):null,episode=entry.episode!==undefined&&entry.episode!==''?Number(entry.episode):null;
      const match=title.match(/(?:season\s*(\d+)\s*:\s*(?:episode\s*)?(\d+)|\bS(\d+)\s*E(\d+)\b)/i);
      const looksSeries=parts.length>2||season!==null||!!match;
      return {index,title,query:looksSeries?parts[0]||title:title,type:entry.type==='movie'||entry.content_type==='movie'?'movie':entry.type==='tv'||entry.content_type==='tv'||looksSeries?'tv':null,id,
        season:season??(match?Number(match[1]||match[3]):Number(title.match(/\bseason\s*(\d+)/i)?.[1])||null),episode:episode??(match?Number(match[2]||match[4]):null),episodeTitle:parts.length>2?parts.at(-1):null};
    });
  }
  function episodesThrough(seasons,targetSeason,targetEpisode,today){
    if(!positive(targetSeason)||!positive(targetEpisode))throw Error('Choose a season and episode.');
    const target=(seasons.find(s=>Number(s.season_number)===Number(targetSeason))?.episodes||[]).find(e=>Number(e.episode_number)===Number(targetEpisode));
    const aired=e=>/^\d{4}-\d{2}-\d{2}$/.test(e?.air_date||'')&&Number.isFinite(Date.parse(e.air_date))&&e.air_date<=today;
    if(!aired(target))throw Error('Choose an episode with a listed release on or before today.');
    return seasons.filter(s=>Number(s.season_number)>0&&Number(s.season_number)<=Number(targetSeason)).flatMap(s=>(s.episodes||[]).filter(e=>positive(e.episode_number)&&aired(e)&&(Number(s.season_number)<Number(targetSeason)||Number(e.episode_number)<=Number(targetEpisode))).map(episode=>({season:Number(s.season_number),episode})));
  }
  return {parse,csv,folded,episodesThrough,MAX_ROWS};
});
