(function(root){
  const metadata=new Map(),pendingStatus=new Set(),bulkPending=new Set(),undoByScope=new Map();let generation=0,episodeSync=Promise.resolve(),alertScope="",alertError="";
  const identity=()=>`${accountWatchlistUserId()||""}:${activeProfileId()}`;
  const tracker=()=>root.SEVENSeriesTracker;
  function follows(){
    if(!accountWatchlistUserId())return [];
    const saved=state.watchlistOwnerId===accountWatchlistUserId()&&state.watchlistProfileId===activeProfileId()?state.watchlist:[];
    const titles=new Map();[...saved,...listItems()].filter(item=>contentType(item)==="tv"&&Number(item.id)>0).forEach(item=>titles.set(Number(item.id),{...item,type:"tv"}));
    // Fetch metadata for followed shows even when their classification isn't cached yet.
    return [...titles.values()];
  }
  async function cached(path,force=false){
    const key=`${currentPreferences().language}:${path}`,old=metadata.get(key);
    if(!force&&old&&Date.now()-old.time<15*60000)return old.promise;
    const entry={time:Date.now(),promise:api(path)};metadata.set(key,entry);
    try{return await entry.promise;}catch(error){if(metadata.get(key)===entry)metadata.delete(key);throw error;}
  }
  async function parallel(items,task,limit=4){
    const output=new Array(items.length);let next=0;
    await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;try{output[index]={value:await task(items[index]),ok:true};}catch(error){output[index]={error,ok:false};}}}));return output;
  }
  function signature(){return JSON.stringify([identity(),tracker().todayKey(),follows().map(item=>item.id).sort((a,b)=>a-b),currentPreferences(),restrictedTitles(),hiddenTitles(),progressEntries().filter(item=>item.type==="tv").map(item=>[item.id,item.season,item.episode,item.watched,item.progress,item.currentTime,item.lastWatchedAt])]);}
  async function cloudProgress(){
    const scope=identity(),profile=activeProfileId();
    if(!state.session)return;
    const rows=await localAPI("/api/account/progress",{headers:authorizedHeaders()});
    if(identity()!==scope||!Array.isArray(rows))return;
    for(const row of rows){
      if(row.content_type!=="tv"||!row.content_key?.startsWith(`seven-progress-${profile}-`)||pendingStatus.has(`${scope}:${row.content_key}`))continue;
      const remote=accountProgressRecord(row);let local={};try{local=JSON.parse(localStorage.getItem(row.content_key)||"{}");}catch{}
      if(String(local.lastWatchedAt||"")>String(remote.lastWatchedAt||""))continue;
      localStorage.setItem(row.content_key,JSON.stringify({...local,...remote}));upsertAccountProgress(row);
    }
  }
  async function refresh({force=false}={}){
    if(!accountWatchlistUserId())return null;
    const scope=identity(),key=signature(),previous=state.seriesTracker;
    if(!force&&previous?.scope===scope&&previous.signature===key&&Date.now()-previous.updatedAt<15*60000)return previous.promise||previous;
    const items=follows(),ids=new Set(items.map(item=>Number(item.id))),version=++generation;
    const view=state.seriesTracker={scope,signature:key,loading:true,updatedAt:Date.now(),shows:previous?.scope===scope?previous.shows.filter(item=>ids.has(Number(item.show.id))):[],errors:[]};
    paint();
    view.promise=(async()=>{
      try{await cloudProgress();}catch{view.progressError="Episode progress couldn’t sync. Retry when connected.";}
      if(identity()!==scope||generation!==version)return null;view.signature=signature();
      const results=await parallel(items,async item=>{
        const show=normalize(await cached(`tv/${item.id}`,force),"tv");
        if(identity()!==scope||generation!==version)return null;
        if(!contentAllowed(show))return null;
        return tracker().inspect(show,progressEntries(),number=>cached(`tv/${show.id}/season/${number}`,force));
      });
      if(identity()!==scope||generation!==version)return null;
      view.shows=results.filter(result=>result.ok&&result.value).map(result=>result.value);
      view.errors=results.map((result,index)=>result.ok?null:{id:items[index].id,title:titleOf(items[index]),message:result.error.message}).filter(Boolean);
      view.shows.sort((a,b)=>Number(!!b.next)-Number(!!a.next)||(a.upcoming?.air_date||"9999").localeCompare(b.upcoming?.air_date||"9999")||titleOf(a.show).localeCompare(titleOf(b.show)));
      view.loading=false;delete view.promise;paint();return view;
    })();return view.promise;
  }
  async function newEpisodes(){
    const scope=identity();if(!accountWatchlistUserId()){state.newEpisodes=[];return;}
    const results=await parallel(follows(),item=>cached(`tv/${item.id}`));
    if(identity()!==scope)return;
    const recent=new Date(tracker().todayKey()+"T12:00:00Z");recent.setUTCDate(recent.getUTCDate()-14);const cutoff=recent.toISOString().slice(0,10);
    state.newEpisodes=results.filter(result=>result.ok).map(result=>normalize(result.value,"tv")).filter(contentAllowed).map(show=>({...show,episode:show.last_episode_to_air})).filter(show=>tracker().aired(show.episode)&&show.episode.air_date>=cutoff&&!isWatched({type:"tv",id:show.id,season:show.episode.season_number,episode:show.episode.episode_number}));
    if(state.route==="home"){
      const old=document.querySelector(".new-episode-rail"),library=document.querySelector(".home-library");
      if(old){old.outerHTML=state.newEpisodes.length?newEpisodeRail(state.newEpisodes):"";bindCommon();}
      else if(library&&state.newEpisodes.length&&window.scrollY<120){library.insertAdjacentHTML("afterbegin",newEpisodeRail(state.newEpisodes));bindCommon();}
    }
    if(currentPreferences().episodeAlerts===true)void syncAlerts();
  }
  function episodeLabel(episode){return `S${Number(episode.season_number)} · E${Number(episode.episode_number)}`;}
  function dateLabel(value){return tracker().validDate(value)?new Date(value+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}):"Date not announced";}
  function toolbar(){
    const mode=state.watchlistView||"saved";
    return '<div class="tracker-toolbar"><div class="tracker-tabs" role="group" aria-label="Watchlist views">'+[["saved","Saved"],["shows","Up next"],["calendar","Calendar"]].map(([value,label])=>`<button type="button" data-tracker-view="${value}" aria-pressed="${mode===value}">${label}</button>`).join("")+`</div><div class="tracker-tools"><button type="button" data-progress-import>Import history</button><button type="button" data-progress-undo ${hasUndo()?"":"hidden"}>Undo last change</button></div></div><div id="series-tracker-slot"></div>`;
  }
  function markup(){
    const view=state.seriesTracker,mode=state.watchlistView||"saved";
    if(mode==="saved")return "";
    const items=follows();
    if(!items.length)return '<p class="tracker-empty">Save a series to Watchlist or Favourites to follow it here.</p>';
    const usable=view?.scope===identity(),shows=usable?view.shows.filter(entry=>contentAllowed(entry.show)):[],loading=!usable||view.loading;
    const alerts=`<div class="tracker-heading"><h2>${mode==="calendar"?"Release calendar":"Your series"}</h2><button type="button" data-tracker-alerts>${currentPreferences().episodeAlerts&&alertScope===identity()?"Alerts on · Turn off":"Enable alerts"}</button></div>${alertError?`<p class="tracker-warning" role="status">${escapeHTML(alertError)}</p>`:""}`;
    const errors=(usable&&view.errors.length?`<p class="tracker-warning" role="status">${view.errors.length} series couldn’t load. <button type="button" data-tracker-refresh>Try again</button></p>`:"")+(usable&&view.progressError?`<p class="tracker-warning" role="status">${escapeHTML(view.progressError)} <button type="button" data-tracker-refresh>Try again</button></p>`:"");
    if(loading&&!shows.length)return alerts+'<p class="tracker-loading" role="status">Loading your series…</p>';
    if(mode==="calendar"){
      const offset=Number(state.trackerWeek)||0,dates=tracker().week(offset),entries=tracker().calendarEntries(shows,dates),today=tracker().todayKey();
      return alerts+errors+`<div class="tracker-week"><button type="button" data-tracker-week="-1" aria-label="Previous week" ${offset<=-4?"disabled":""}>‹</button><button type="button" data-tracker-today>${dateLabel(dates[0])} – ${dateLabel(dates[6])}${offset===0?" · This week":""}</button><button type="button" data-tracker-week="1" aria-label="Next week" ${offset>=12?"disabled":""}>›</button></div><div class="tracker-calendar">${dates.map(date=>{
        const scheduled=entries.filter(entry=>entry.episode.air_date===date);
        return `<section class="tracker-day ${date===today?"is-today":""}"><h3>${new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</h3>${scheduled.length?scheduled.map(({show,episode})=>`<button type="button" class="tracker-calendar-item" data-open="tv:${show.id}"><img src="${posterOf(show)}" alt="" loading="lazy"><span><b>${escapeHTML(titleOf(show))}</b><small>${episodeLabel(episode)}${Number(episode.episode_number)===1?" · Season premiere":""}${isWatched({type:"tv",id:show.id,season:episode.season_number,episode:episode.episode_number})?" · Watched":""}</small></span></button>`).join(""):'<span class="tracker-no-release">No listed releases</span>'}</section>`;
      }).join("")}</div><p class="tracker-date-note">TMDB-listed dates. Streaming availability can vary.</p>${loading?'<p class="tracker-loading" role="status">Updating…</p>':""}`;
    }
    return alerts+errors+`<div class="tracker-show-grid">${shows.map(({show,next,upcoming,status,calendarError})=>{
      const description=next?`${next.resume?"Resume":"Up next"}: ${episodeLabel({...next.episode,season_number:next.season})}`:status==="finished"?"Finished":"Caught up";
      return `<article class="tracker-show"><button type="button" class="tracker-poster" data-open="tv:${show.id}" aria-label="Open ${escapeHTML(titleOf(show))}"><img src="${posterOf(show)}" alt="" loading="lazy"></button><div class="tracker-show-copy"><button type="button" class="tracker-title" data-open="tv:${show.id}">${escapeHTML(titleOf(show))}</button><p>${description}</p>${upcoming?`<small>${Number(upcoming.episode_number)===1?`Season ${Number(upcoming.season_number)}`:episodeLabel(upcoming)} · ${dateLabel(upcoming.air_date)}</small>`:!["Ended","Canceled"].includes(show.status)?'<small>Next release not announced</small>':""}${calendarError?'<small class="tracker-warning">Some episode dates unavailable.</small>':""}<div class="tracker-show-actions">${next?`<button type="button" class="tracker-play" data-tracker-play="${show.id}:${next.season}:${next.episode.episode_number}">${next.resume?"Resume":"Watch"}</button>`:""}<button type="button" data-tracker-manage="${show.id}">Episodes</button></div></div></article>`;
    }).join("")}</div>${loading?'<p class="tracker-loading" role="status">Updating…</p>':""}`;
  }
  function paint(){
    if(state.route!=="watchlist"||!accountWatchlistUserId())return;
    const slot=document.querySelector("#series-tracker-slot");if(!slot)return;
    slot.innerHTML=markup();bindCommon();bind(slot);
  }
  function bind(scope=document){
    root.SEVENProgressUI?.bind(scope);
    scope.querySelectorAll("[data-tracker-view]").forEach(button=>button.onclick=()=>{state.watchlistView=button.dataset.trackerView;render();if(state.watchlistView!=="saved")void refresh();});
    scope.querySelectorAll("[data-tracker-week]").forEach(button=>button.onclick=()=>{state.trackerWeek=Math.max(-4,Math.min(12,(Number(state.trackerWeek)||0)+Number(button.dataset.trackerWeek)));paint();});
    scope.querySelector("[data-tracker-today]")?.addEventListener("click",()=>{state.trackerWeek=0;paint();});
    scope.querySelectorAll("[data-tracker-refresh]").forEach(button=>button.onclick=()=>void refresh({force:true}));
    scope.querySelectorAll("[data-tracker-play]").forEach(button=>button.onclick=()=>{const [id,season,episode]=button.dataset.trackerPlay.split(":").map(Number);void play(id,season,episode);});
    scope.querySelectorAll("[data-tracker-manage]").forEach(button=>button.onclick=()=>void manage(Number(button.dataset.trackerManage)));
    scope.querySelector("[data-tracker-alerts]")?.addEventListener("click",async event=>{
      const button=event.currentTarget;button.disabled=true;
      const enabled=!(currentPreferences().episodeAlerts&&alertScope===identity()),before=currentPreferences().episodeAlerts;
      try{if(enabled)await createReleasePushSubscription();updateCurrentPreferences({episodeAlerts:enabled});await syncAlerts({interactive:true});await saveAccount();paint();}
      catch(error){updateCurrentPreferences({episodeAlerts:before});alertError=error.message;paint();}
      finally{if(button.isConnected)button.disabled=false;}
    });
  }
  async function play(id,season,episode){
    const scope=identity();try{
      const [show,data]=await Promise.all([cached(`tv/${id}`),cached(`tv/${id}/season/${season}`)]);
      if(identity()!==scope)return;
      const target=(data.episodes||[]).find(item=>Number(item.episode_number)===episode);
      if(!contentAllowed(normalize(show,"tv"))||!tracker().aired(target))throw Error("This episode does not have a listed release yet.");
      state.series=normalize(show,"tv");state.selectedSeason=season;state.episodes=data;state.episodesSeriesId=id;state.episodesSeason=season;state.seriesNext=null;playEpisode(episode,true);
    }catch(error){showToast(error.message||"Couldn’t open this episode.");}
  }
  function matchesStatus(key,record){try{const current=JSON.parse(localStorage.getItem(key)||"null");return !!current&&Date.parse(current.lastWatchedAt)===Date.parse(record.lastWatchedAt)&&Number(current.currentTime)===Number(record.currentTime)&&Number(current.duration)===Number(record.duration)&&(!!current.watched||Number(current.progress)>=90)===(!!record.watched||Number(record.progress)>=90);}catch{return false;}}
  async function saveStatus(show,season,episode,value,{allowGuest=false}={}){
    const signedIn=!!state.session&&!!accountWatchlistUserId();
    if(!signedIn&&!allowGuest)throw Error("Sign in to save episode progress.");
    if(tracker().validDate(episode.air_date)&&episode.air_date>tracker().todayKey())throw Error("This episode has not reached its listed release date.");
    const scope=identity(),item={type:"tv",id:Number(show.id),season:Number(season),episode:Number(episode.episode_number),title:episode.name||titleOf(show),posterPath:show.poster_path||episode.still_path||null,genreIds:(show.genres||[]).map(genre=>genre.id)},key=watchKey(item),pending=`${scope}:${key}`;
    if(bulkPending.has(scope))throw Error("A history change is saving. Please wait.");
    if(pendingStatus.has(pending))return;pendingStatus.add(pending);
    const before=localStorage.getItem(key);let saved={},hasBefore=false;try{const parsed=before?JSON.parse(before):null;if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)){saved=parsed;hasBefore=true;}}catch{}
    const ticket=root.SEVENUndo?.begin("progress:"+key),profile=activeProfileId(),headers=authorizedHeaders();
    if(state.pendingProgress?.content_key===key){clearTimeout(state.progressTimer);state.pendingProgress=null;}
    const record={...saved,...item,currentTime:value?Math.max(1,Number(saved.currentTime)||0):0,duration:Math.max(1,Number(saved.duration)||0),progress:value?100:0,watched:value,lastWatchedAt:new Date().toISOString()};
    const payload={content_key:key,content_type:"tv",tmdb_id:item.id,season:item.season,episode:item.episode,title:item.title,poster_path:item.posterPath,progress_seconds:record.currentTime,duration_seconds:record.duration,is_watched:value,last_watched_at:record.lastWatchedAt};
    localStorage.setItem(key,JSON.stringify(record));
    try{
      if(signedIn)await localAPI("/api/account/progress",{method:"POST",headers:{"Content-Type":"application/json",...authorizedHeaders()},body:JSON.stringify(payload)});
      if(identity()!==scope)return;
      if(signedIn)upsertAccountProgress(payload);state.seriesNext=null;if(state.seriesTracker)state.seriesTracker.signature="";if(signedIn)void newEpisodes();
      const previous=hasBefore?{...payload,progress_seconds:Math.max(0,Number(saved.currentTime)||0),duration_seconds:Math.max(0,Number(saved.duration)||0),is_watched:!!saved.watched||Number(saved.progress)>=90,last_watched_at:Number.isFinite(Date.parse(saved.lastWatchedAt))?saved.lastWatchedAt:new Date(Date.parse(record.lastWatchedAt)-1).toISOString()}:null;
      root.SEVENUndo?.offer(ticket,value?"Marked watched.":"Marked unwatched.",async()=>{
        pendingStatus.add(pending);
        try {
          if(signedIn){const result=await batchRequest({action:"undo",profile,entries:[{key,expected:record.lastWatchedAt,previous}]},headers),status=result.results?.find(entry=>entry.key===key)?.status;if(status==="changed")return {changed:true};if(status!=="restored")throw Error("Could not restore progress. Try again.");}
          if(identity()!==scope||!ticket.isCurrent()||!matchesStatus(key,record))return {changed:true};
          if(previous){localStorage.setItem(key,before);if(signedIn)upsertAccountProgress(previous);}else{localStorage.removeItem(key);if(signedIn)forgetAccountProgress(key);}
          statusChanged();await root.refreshUndoView?.();return {undone:true};
        } finally {pendingStatus.delete(pending);}
      },()=>identity()===scope&&!pendingStatus.has(pending)&&!bulkPending.has(scope)&&matchesStatus(key,record));
    }catch(error){if(identity()===scope&&matchesStatus(key,record)){if(before)localStorage.setItem(key,before);else localStorage.removeItem(key);}throw error;}
    finally{pendingStatus.delete(pending);}
  }
  const hasUndo=()=>!!undoByScope.get(identity())?.length;
  function batchRequest(body,headers=authorizedHeaders()){return localAPI("/api/account/progress/batch",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});}
  function statusChanged(){state.seriesNext=null;if(state.seriesTracker)state.seriesTracker.signature="";root.SEVENProgressUI?.updateUndo();void newEpisodes();void refresh();}
  async function saveBatch(changes){
    if(!state.session||!accountWatchlistUserId())throw Error("Sign in to save viewing history.");
    const scope=identity(),profile=activeProfileId(),headers=authorizedHeaders();
    if(bulkPending.has(scope)||[...pendingStatus].some(key=>key.startsWith(scope+":")))throw Error("Wait for the current episode change to finish.");
    const unique=new Map();
    for(const change of changes){
      const {show,season,episode}=change,type=contentType(show),item={type,id:Number(show.id),season:type==="tv"?Number(season):null,episode:type==="tv"?Number(episode?.episode_number):null,title:type==="tv"?episode?.name||titleOf(show):titleOf(show),posterPath:show.poster_path||null,genreIds:(show.genres||[]).map(genre=>genre.id)};
      if(!["movie","tv"].includes(type)||!Number.isSafeInteger(item.id)||item.id<1||!contentAllowed(show)||typeof change.value!=="boolean"||
        (type==="tv"&&(!Number.isSafeInteger(item.season)||item.season<0||!Number.isSafeInteger(item.episode)||item.episode<1||!tracker().aired(episode)))||
        (type==="movie"&&(!tracker().validDate(show.release_date)||show.release_date>tracker().todayKey())))throw Error("Only released titles and episodes can be imported or marked in bulk.");
      const key=watchKey(item);unique.set(key,{...change,item,key});
    }
    if(!unique.size)throw Error("There are no changes to save.");if(unique.size>10000)throw Error("Choose a smaller history change.");
    const ticket=root.SEVENUndo?.begin("history-batch");
    for(const key of unique.keys())root.SEVENUndo?.begin("progress:"+key);
    bulkPending.add(scope);for(const key of unique.keys())pendingStatus.add(`${scope}:${key}`);
    try{
      if(state.pendingProgress&&unique.has(state.pendingProgress.content_key)){
        const pending=state.pendingProgress;clearTimeout(state.progressTimer);state.pendingProgress=null;
        await localAPI("/api/account/progress",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(pending)});
      }
      const rows=[],keys=[...unique.keys()];
      for(let offset=0;offset<keys.length;offset+=1000){const page=await batchRequest({action:"read",profile,keys:keys.slice(offset,offset+1000)},headers);if(identity()!==scope)throw Error("Profile changed. Nothing was saved.");if(!Array.isArray(page))throw Error("Couldn’t read the previous progress. Try again.");rows.push(...page);}
      if(identity()!==scope)throw Error("Profile changed. Nothing was saved.");
      if(!Array.isArray(rows))throw Error("Couldn’t read the previous progress. Try again.");
      const remote=new Map(rows.map(row=>[row.content_key,row])),stamp=new Date().toISOString(),journal=[],records=[];
      for(const {item,key,value} of unique.values()){
        const previous=remote.get(key)||null;let local={};try{local=JSON.parse(localStorage.getItem(key)||"{}");}catch{}
        const saved=previous&&Date.parse(previous.last_watched_at)>(Date.parse(local.lastWatchedAt)||0)?accountProgressRecord(previous):local;
        const done=!!saved.watched||Number(saved.progress)>=90;if(done===value&&!(value===false&&Number(saved.currentTime)>0))continue;
        const currentTime=value?Math.max(0,Number(saved.currentTime)||0):0,duration=Math.max(0,Number(saved.duration)||0);
        const record={...saved,...item,currentTime,duration,progress:value?100:0,watched:value,lastWatchedAt:stamp};
        const payload={content_key:key,content_type:item.type,tmdb_id:item.id,season:item.season,episode:item.episode,title:item.title,poster_path:item.posterPath,progress_seconds:currentTime,duration_seconds:duration,is_watched:value,last_watched_at:stamp};
        journal.push({key,expected:stamp,previous,localBefore:previous?{...local,...accountProgressRecord(previous)}:null,record,payload});records.push(payload);
      }
      if(!records.length)return {count:0};
      if(records.length>1000)throw Error("Save up to 1,000 changed episodes at a time. Choose an earlier episode first.");
      const written=await batchRequest({profile,records},headers);
      if(!Array.isArray(written)||written.length!==records.length)throw Error("Couldn’t confirm the save. Refresh before retrying.");
      undoByScope.set(scope,journal);
      if(identity()===scope){for(const item of journal){localStorage.setItem(item.key,JSON.stringify(item.record));upsertAccountProgress(item.payload);}statusChanged();}
      root.SEVENUndo?.offer(ticket,"Viewing history updated.",async()=>{const result=await undoBatch({quick:true});await root.refreshUndoView?.();return result.changed?{changed:true}:{undone:true};},()=>(undoByScope.get(scope)||[]).some(entry=>entry.expected===stamp)&&!bulkPending.has(scope));
      return {count:records.length};
    }finally{bulkPending.delete(scope);for(const key of unique.keys())pendingStatus.delete(`${scope}:${key}`);}
  }
  async function undoBatch({quick=false}={}){
    const scope=identity(),profile=activeProfileId(),journal=undoByScope.get(scope),headers=authorizedHeaders();
    if(!state.session||!accountWatchlistUserId())throw Error("Sign in to undo history changes.");
    if(!journal?.length)return {count:0,changed:0};if(bulkPending.has(scope)||[...pendingStatus].some(key=>key.startsWith(scope+":")))throw Error("Wait for the current episode change to finish.");
    if(!quick)root.SEVENUndo?.begin("history-batch");
    bulkPending.add(scope);for(const item of journal)pendingStatus.add(`${scope}:${item.key}`);
    let count=0,changed=0;
    try{
      for(let index=0;index<journal.length;index+=20){
        if(identity()!==scope)throw Error("Profile changed. Continue undo on the original profile.");
        const chunk=journal.slice(index,index+20).filter(item=>{if(matchesStatus(item.key,item.record))return true;changed++;undoByScope.set(scope,(undoByScope.get(scope)||[]).filter(entry=>entry.key!==item.key));return false;});
        if(!chunk.length)continue;
        const response=await batchRequest({action:"undo",profile,entries:chunk.map(({key,expected,previous})=>({key,expected,previous}))},headers);
        if(!Array.isArray(response.results))throw Error("Couldn’t confirm the undo. Try again.");
        for(const result of response.results){
          const item=chunk.find(item=>item.key===result.key);if(!item||!["restored","changed"].includes(result.status))continue;
          undoByScope.set(scope,(undoByScope.get(scope)||[]).filter(entry=>entry.key!==item.key));
          if(result.status==="changed"){
            changed++;
            if(identity()===scope&&matchesStatus(item.key,item.record)){const latest=await batchRequest({action:"read",profile,keys:[item.key]},headers);if(identity()===scope&&matchesStatus(item.key,item.record)&&Array.isArray(latest)){if(latest[0]){localStorage.setItem(item.key,JSON.stringify({...item.record,...accountProgressRecord(latest[0])}));upsertAccountProgress(latest[0]);}else{localStorage.removeItem(item.key);forgetAccountProgress(item.key);}}}
            continue;
          }count++;
          if(identity()===scope&&matchesStatus(item.key,item.record)){if(item.localBefore){localStorage.setItem(item.key,JSON.stringify(item.localBefore));upsertAccountProgress(item.previous);}else{localStorage.removeItem(item.key);forgetAccountProgress(item.key);}}
        }
        if(response.results.some(result=>result.status==="failed"))throw Error("Some changes couldn’t be undone. Try again to finish.");
      }
      return {count,changed};
    }finally{bulkPending.delete(scope);for(const item of journal)pendingStatus.delete(`${scope}:${item.key}`);if(identity()===scope)statusChanged();}
  }
  async function manage(id){
    const scope=identity();try{
      const show=normalize(await cached(`tv/${id}`),"tv");if(identity()!==scope||!contentAllowed(show))return;
      document.querySelector(".tracker-episode-modal")?.remove();
      app.insertAdjacentHTML("beforeend",`<div class="modal tracker-episode-modal"><section class="tracker-episode-panel" role="dialog" aria-modal="true" aria-label="Episodes for ${escapeHTML(titleOf(show))}"><div class="tracker-modal-heading"><h2>${escapeHTML(titleOf(show))}</h2><button type="button" data-tracker-close aria-label="Close episodes">×</button></div><label>Season <select data-tracker-season>${(show.seasons||[]).map(season=>`<option value="${Number(season.season_number)}">${escapeHTML(season.name||`Season ${season.season_number}`)}</option>`).join("")}</select></label><p class="tracker-modal-error" role="status"></p><div class="tracker-episode-list"></div></section></div>`);
      const modal=document.querySelector(".tracker-episode-modal"),select=modal.querySelector("[data-tracker-season]"),tracked=state.seriesTracker?.shows.find(item=>Number(item.show.id)===id);select.value=String(tracked?.next?.season||(show.seasons||[]).find(season=>season.season_number>0)?.season_number||0);
      modal.dataset.trackerSeries=String(id);
      modal.querySelector("[data-tracker-close]").onclick=()=>modal.remove();modal.addEventListener("click",event=>{if(event.target===modal)modal.remove();});modal.addEventListener("keydown",event=>{if(event.key==="Escape")modal.remove();});
      let request=0;
      const draw=async()=>{
        const number=Number(select.value),current=++request,list=modal.querySelector(".tracker-episode-list");list.innerHTML='<p>Loading episodes…</p>';
        try{const data=await cached(`tv/${id}/season/${number}`);if(current!==request||!modal.isConnected||identity()!==scope)return;
          list.innerHTML=(data.episodes||[]).map(episode=>{const done=isWatched({type:"tv",id,season:number,episode:episode.episode_number}),future=tracker().validDate(episode.air_date)&&!tracker().aired(episode);return `<div class="tracker-episode-row"><span><b>E${episode.episode_number} · ${escapeHTML(episode.name||"Episode")}</b><small>${dateLabel(episode.air_date)}</small></span><button type="button" data-tracker-status="${Number(episode.episode_number)}" aria-pressed="${done}" ${future?"disabled":""}>${done?"Watched":"Mark watched"}</button></div>`;}).join("")||'<p>No episodes listed.</p>';
          list.querySelectorAll("[data-tracker-status]").forEach(button=>button.onclick=async()=>{
            const episode=data.episodes.find(item=>Number(item.episode_number)===Number(button.dataset.trackerStatus));button.disabled=true;modal.querySelector(".tracker-modal-error").textContent="";
            try{await saveStatus(show,number,episode,button.getAttribute("aria-pressed")!=="true");if(identity()!==scope||!modal.isConnected)return;const done=isWatched({type:"tv",id,season:number,episode:episode.episode_number});button.setAttribute("aria-pressed",String(done));button.textContent=done?"Watched":"Mark watched";void refresh();}
            catch(error){if(modal.isConnected)modal.querySelector(".tracker-modal-error").textContent=error.message;}
            finally{if(button.isConnected)button.disabled=false;}
          });
        }catch(error){if(current===request&&modal.isConnected)list.innerHTML=`<p>${escapeHTML(error.message)}</p><button type="button" data-tracker-retry-season>Try again</button>`;list.querySelector("[data-tracker-retry-season]")?.addEventListener("click",draw);}
      };select.onchange=draw;root.SEVENProgressUI?.attachManage(modal,show,select,draw);modal.querySelector("[data-tracker-close]").focus();await draw();
    }catch(error){showToast(error.message||"Episode information unavailable.");}
  }
  function revision(){const key="seven.episode-alerts.revision",value=Math.max(Date.now(),Number(localStorage.getItem(key)||0)+1);localStorage.setItem(key,String(value));return value;}
  function syncAlerts({interactive=false,clear=false}={}){
    const scope=identity(),version=revision(),token=releaseDeviceToken();
    const operation=async()=>{
      if(!token)return;
      if(!clear&&identity()!==scope)return;
      const enabled=!clear&&!!accountWatchlistUserId()&&currentPreferences().episodeAlerts===true;
      let series=[];
      if(enabled){
        if(!("Notification" in root)||Notification.permission!=="granted")throw Error("Enable notifications on this device to receive episode alerts.");
        const followed=follows();if(followed.length>80){await releaseAlertsRequest("/api/episode-follows",{token,method:"POST",body:JSON.stringify({revision:version,scope:"",series:[]})});alertScope="";throw Error("Alerts are paused: this device supports up to 80 followed series.");}
        await createReleasePushSubscription();
        const details=await parallel(followed,item=>cached(`tv/${item.id}`));
        if(identity()!==scope)return;
        if(details.some(result=>!result.ok))throw Error("Couldn’t sync all followed series. Try again.");
        series=details.map(result=>result.value).filter(show=>contentAllowed(normalize(show,"tv"))).map(show=>({id:show.id,title:String(show.name||"Series").slice(0,80),season:Number(show.last_episode_to_air?.season_number)||0,episode:Number(show.last_episode_to_air?.episode_number)||0}));
      }
      const hash=clear?"":[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(scope)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
      await releaseAlertsRequest("/api/episode-follows",{token,method:"POST",body:JSON.stringify({revision:version,scope:hash,series})});
      if(clear||identity()===scope){alertScope=enabled?scope:"";alertError="";paint();}
    };
    const task=episodeSync.catch(()=>{}).then(operation);episodeSync=task;
    if(!interactive)task.catch(error=>{if(identity()===scope){alertError=error.message;paint();}});
    return task;
  }
  function clear(){generation++;state.seriesTracker=null;state.newEpisodes=[];alertScope="";alertError="";document.querySelector(".tracker-episode-modal")?.remove();document.querySelector(".tracker-progress-modal")?.remove();void syncAlerts({clear:true});}
  document.addEventListener("visibilitychange",()=>{if(typeof state!=="undefined"&&document.visibilityState==="visible"&&state.route==="watchlist"&&(state.watchlistView||"saved")!=="saved")void refresh();});
  root.SEVENTrackerUI={follows,refresh,newEpisodes,toolbar,paint,bind,play,manage,saveStatus,saveBatch,undoBatch,hasUndo,cached,identity,syncAlerts,clear};
})(window);
