(function(root){
  const metadata=new Map(),pendingStatus=new Set();let generation=0,episodeSync=Promise.resolve(),alertScope="",alertError="";
  const identity=()=>`${accountWatchlistUserId()||""}:${activeProfileId()}`;
  const tracker=()=>root.SEVENSeriesTracker;
  function follows(){
    if(!accountWatchlistUserId())return [];
    const saved=state.watchlistOwnerId===accountWatchlistUserId()&&state.watchlistProfileId===activeProfileId()?state.watchlist:[];
    const titles=new Map();[...saved,...listItems()].filter(item=>contentType(item)==="tv"&&Number(item.id)>0).forEach(item=>titles.set(Number(item.id),{...item,type:"tv"}));
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
    return '<div class="tracker-tabs" role="group" aria-label="Watchlist views">'+[["saved","Saved"],["shows","Up next"],["calendar","Calendar"]].map(([value,label])=>`<button type="button" data-tracker-view="${value}" aria-pressed="${mode===value}">${label}</button>`).join("")+'</div><div id="series-tracker-slot"></div>';
  }
  function markup(){
    const view=state.seriesTracker,mode=state.watchlistView||"saved";
    if(mode==="saved")return "";
    const items=follows();
    if(!items.length)return '<p class="tracker-empty">Save a series to Watchlist or Favourites to follow it here.</p>';
    const usable=view?.scope===identity(),shows=usable?view.shows:[],loading=!usable||view.loading;
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
  async function saveStatus(show,season,episode,value,{allowGuest=false}={}){
    const signedIn=!!state.session&&!!accountWatchlistUserId();
    if(!signedIn&&!allowGuest)throw Error("Sign in to save episode progress.");
    if(tracker().validDate(episode.air_date)&&episode.air_date>tracker().todayKey())throw Error("This episode has not reached its listed release date.");
    const scope=identity(),item={type:"tv",id:Number(show.id),season:Number(season),episode:Number(episode.episode_number),title:episode.name||titleOf(show),posterPath:show.poster_path||episode.still_path||null,genreIds:(show.genres||[]).map(genre=>genre.id)},key=watchKey(item),pending=`${scope}:${key}`;
    if(pendingStatus.has(pending))return;pendingStatus.add(pending);
    const before=localStorage.getItem(key);let saved={};try{saved=before?JSON.parse(before):{};}catch{}
    if(state.pendingProgress?.content_key===key){clearTimeout(state.progressTimer);state.pendingProgress=null;}
    const record={...saved,...item,currentTime:value?Math.max(1,Number(saved.currentTime)||0):0,duration:Math.max(1,Number(saved.duration)||0),progress:value?100:0,watched:value,lastWatchedAt:new Date().toISOString()};
    const payload={content_key:key,content_type:"tv",tmdb_id:item.id,season:item.season,episode:item.episode,title:item.title,poster_path:item.posterPath,progress_seconds:record.currentTime,duration_seconds:record.duration,is_watched:value,last_watched_at:record.lastWatchedAt};
    localStorage.setItem(key,JSON.stringify(record));
    try{
      if(signedIn)await localAPI("/api/account/progress",{method:"POST",headers:{"Content-Type":"application/json",...authorizedHeaders()},body:JSON.stringify(payload)});
      if(identity()!==scope)return;
      if(signedIn)upsertAccountProgress(payload);state.seriesNext=null;if(state.seriesTracker)state.seriesTracker.signature="";if(signedIn)void newEpisodes();
    }catch(error){if(identity()===scope){if(before)localStorage.setItem(key,before);else localStorage.removeItem(key);}throw error;}
    finally{pendingStatus.delete(pending);}
  }
  async function manage(id){
    const scope=identity();try{
      const show=normalize(await cached(`tv/${id}`),"tv");if(identity()!==scope||!contentAllowed(show))return;
      document.querySelector(".tracker-episode-modal")?.remove();
      app.insertAdjacentHTML("beforeend",`<div class="modal tracker-episode-modal"><section class="tracker-episode-panel" role="dialog" aria-modal="true" aria-label="Episodes for ${escapeHTML(titleOf(show))}"><div class="tracker-modal-heading"><h2>${escapeHTML(titleOf(show))}</h2><button type="button" data-tracker-close aria-label="Close episodes">×</button></div><label>Season <select data-tracker-season>${(show.seasons||[]).map(season=>`<option value="${Number(season.season_number)}">${escapeHTML(season.name||`Season ${season.season_number}`)}</option>`).join("")}</select></label><p class="tracker-modal-error" role="status"></p><div class="tracker-episode-list"></div></section></div>`);
      const modal=document.querySelector(".tracker-episode-modal"),select=modal.querySelector("[data-tracker-season]"),tracked=state.seriesTracker?.shows.find(item=>Number(item.show.id)===id);select.value=String(tracked?.next?.season||(show.seasons||[]).find(season=>season.season_number>0)?.season_number||0);
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
      };select.onchange=draw;modal.querySelector("[data-tracker-close]").focus();await draw();
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
  function clear(){generation++;state.seriesTracker=null;state.newEpisodes=[];alertScope="";alertError="";document.querySelector(".tracker-episode-modal")?.remove();void syncAlerts({clear:true});}
  document.addEventListener("visibilitychange",()=>{if(typeof state!=="undefined"&&document.visibilityState==="visible"&&state.route==="watchlist"&&(state.watchlistView||"saved")!=="saved")void refresh();});
  root.SEVENTrackerUI={follows,refresh,newEpisodes,toolbar,paint,bind,play,manage,saveStatus,syncAlerts,clear};
})(window);
