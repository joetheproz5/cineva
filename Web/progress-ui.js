(function(root){
  const tools=()=>root.SEVENProgressTools,ui=()=>root.SEVENTrackerUI,tracker=()=>root.SEVENSeriesTracker;
  function updateUndo(){document.querySelectorAll('[data-progress-undo]').forEach(button=>button.hidden=!ui().hasUndo());}
  function bind(scope=document){
    scope.querySelectorAll('[data-progress-import]').forEach(button=>button.onclick=()=>void importHistory());
    scope.querySelectorAll('[data-progress-undo]').forEach(button=>button.onclick=()=>void undo());
  }
  async function undo(){
    const modal=dialog('Undo last history change');modal.body.innerHTML='<p>Restore the progress from before your last catch-up, season change or import. Newer playback stays untouched.</p><div class="progress-footer"><button type="button" data-confirm>Undo change</button></div>';
    modal.body.querySelector('[data-confirm]').onclick=()=>run(modal,async()=>{
      const result=await ui().undoBatch();if(!modal.alive())return;modal.busy=false;modal.close();showToast(result.changed?`Undone. ${result.changed} newer change${result.changed===1?' was':'s were'} kept.`:`${result.count} change${result.count===1?'':'s'} undone.`);
    });
  }
  function dialog(title){
    document.querySelector('.tracker-progress-modal')?.remove();const focus=document.activeElement,scope=ui().identity(),parent=document.querySelector('.tracker-episode-modal');
    if(parent){parent.hidden=true;parent.setAttribute('aria-hidden','true');}
    app.insertAdjacentHTML('beforeend',`<div class="modal tracker-progress-modal"><section class="tracker-episode-panel" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="tracker-modal-heading"><h2>${escapeHTML(title)}</h2><button type="button" data-close aria-label="Close">×</button></div><div class="progress-body"></div><p class="tracker-modal-error" role="status"></p></section></div>`);
    const element=document.querySelector('.tracker-progress-modal'),body=element.querySelector('.progress-body'),error=element.querySelector('.tracker-modal-error');
    const modal={element,body,error,scope,busy:false,alive:()=>element.isConnected&&ui().identity()===scope,close:()=>{if(modal.busy)return;element.remove();if(parent?.isConnected){parent.hidden=false;parent.removeAttribute('aria-hidden');}if(focus?.isConnected)focus.focus();}};
    element.querySelector('[data-close]').onclick=modal.close;element.onclick=event=>{if(event.target===element)modal.close();};
    element.onkeydown=event=>{
      if(event.key==='Escape')modal.close();
      if(event.key==='Tab'){const controls=[...element.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);if(!controls.length)return;if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}
    };element.querySelector('[data-close]').focus();return modal;
  }
  async function run(modal,task){
    if(!modal.alive()||modal.busy)return;modal.busy=true;modal.error.textContent='';modal.element.setAttribute('aria-busy','true');
    const controls=[...modal.element.querySelectorAll('button,input,select')],disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
    try{await task();}catch(error){if(modal.alive())modal.error.textContent=error.message||'Couldn’t save. Try again.';}
    finally{modal.busy=false;modal.element.removeAttribute('aria-busy');controls.forEach((c,i)=>{if(c.isConnected)c.disabled=disabled[i];});}
  }
  async function preview(show,changes,label,after){
    const modal=dialog(label);modal.body.innerHTML=`<p>${changes.length} released episode${changes.length===1?'':'s'} · ${escapeHTML(titleOf(show))}</p><p class="progress-note">Only this profile. Watch hours aren’t added.</p><div class="progress-preview">${changes.map(({season,episode,value})=>`<div><span>S${season} · E${episode.episode_number} · ${escapeHTML(episode.name||'Episode')}</span><small>${value?'Watched':'Unwatched'}</small></div>`).join('')}</div><div class="progress-footer"><button type="button" data-confirm ${changes.length?'':'disabled'}>Save changes</button></div>`;
    modal.body.querySelector('[data-confirm]').onclick=()=>run(modal,async()=>{const result=await ui().saveBatch(changes);modal.busy=false;modal.close();if(ui().identity()===modal.scope){showToast(result.count?`${result.count} episode${result.count===1?'':'s'} updated.`:'Already up to date.');if(after)await after();}});
  }
  function attachManage(modal,show,select,draw){
    modal.querySelector('.tracker-episode-list').insertAdjacentHTML('beforebegin','<div class="progress-season-tools"><button type="button" data-catchup>Catch up to an episode</button><button type="button" data-season-watched>Season watched</button><button type="button" data-season-unwatched>Season unwatched</button><button type="button" data-progress-undo hidden>Undo last change</button></div>');bind(modal);updateUndo();
    const scope=ui().identity(),error=modal.querySelector('.tracker-modal-error');let busy=false;
    async function prepare(action){
      if(busy)return;busy=true;error.textContent='';const buttons=[...modal.querySelectorAll('.progress-season-tools button')];buttons.forEach(b=>b.disabled=true);
      try{
        const number=Number(select.value),data=await ui().cached(`tv/${show.id}/season/${number}`);
        if(!modal.isConnected||ui().identity()!==scope)return;
        const episodes=(data.episodes||[]).filter(e=>tracker().aired(e));
        if(!episodes.length&&action!=='catchup')throw Error('This season has no released episodes with listed dates.');
        if(action!=='catchup')return await preview(show,episodes.map(episode=>({show,season:number,episode,value:action==='watched'})),`Mark season ${number} ${action}`,draw);
        const picker=dialog('Where did you leave off?');
        const seasons=(show.seasons||[]).filter(s=>s.season_number>0&&(!tracker().validDate(s.air_date)||s.air_date<=tracker().todayKey()));
        picker.body.innerHTML=`<p>${escapeHTML(titleOf(show))}</p><div class="progress-cursor"><label>Season<select data-through-season>${seasons.map(s=>`<option value="${s.season_number}">${escapeHTML(s.name||`Season ${s.season_number}`)}</option>`).join('')}</select></label><label>Last episode watched<select data-through-episode></select></label></div><p class="progress-note">Earlier released episodes will be marked watched. Specials aren’t included.</p><div class="progress-footer"><button type="button" data-review>Review changes</button></div>`;
        const seasonInput=picker.body.querySelector('[data-through-season]'),episodeInput=picker.body.querySelector('[data-through-episode]'),review=picker.body.querySelector('[data-review]');seasonInput.value=String(number>0?number:seasons[0]?.season_number);let version=0;
        const load=async()=>{const request=++version;episodeInput.disabled=true;review.disabled=true;picker.error.textContent='';try{const season=await ui().cached(`tv/${show.id}/season/${Number(seasonInput.value)}`);if(!picker.alive()||request!==version)return;episodeInput.innerHTML=(season.episodes||[]).filter(e=>tracker().aired(e)).map(e=>`<option value="${e.episode_number}">E${e.episode_number} · ${escapeHTML(e.name||'Episode')}</option>`).join('');review.disabled=!episodeInput.options.length;episodeInput.disabled=false;}catch(error){if(picker.alive()&&request===version)picker.error.textContent=error.message;}};
        seasonInput.onchange=load;await load();review.onclick=()=>run(picker,async()=>{
          const targetSeason=Number(seasonInput.value),targetEpisode=Number(episodeInput.value),loaded=[];
          for(const season of seasons.filter(s=>s.season_number<=targetSeason)){const data=await ui().cached(`tv/${show.id}/season/${season.season_number}`);loaded.push({...data,season_number:season.season_number});if(!picker.alive())return;}
          const changes=tools().episodesThrough(loaded,targetSeason,targetEpisode,tracker().todayKey()).map(({season,episode})=>({show,season,episode,value:true}));
          picker.busy=false;picker.close();await preview(show,changes,`Watched through S${targetSeason} · E${targetEpisode}`,draw);
        });
      }catch(e){if(modal.isConnected&&ui().identity()===scope)error.textContent=e.message;}
      finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});}
    }
    modal.querySelector('[data-catchup]').onclick=()=>void prepare('catchup');modal.querySelector('[data-season-watched]').onclick=()=>void prepare('watched');modal.querySelector('[data-season-unwatched]').onclick=()=>void prepare('unwatched');
  }
  async function importHistory(){
    if(!accountWatchlistUserId())return;const modal=dialog('Import viewing history');
    modal.body.innerHTML='<p class="progress-note">Choose a Netflix Title/Date CSV, or a CSV/JSON with tmdb_id, type, season and episode. You’ll review the matches before saving.</p><label class="progress-file">Choose file<input type="file" accept=".csv,.json,text/csv,application/json" data-file></label><button type="button" class="progress-template" data-template>Download CSV example</button><p class="progress-note">Up to 500 rows · 2 MB. The file stays on this device; only title searches and confirmed progress are sent. Imported series aren’t automatically added to Watchlist.</p><div class="progress-import-list"></div><div class="progress-footer" hidden><span data-summary></span><button type="button" data-import-save disabled>Import selected</button></div>';
    modal.body.querySelector('[data-template]').onclick=()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['tmdb_id,type,season,episode,title\n1396,tv,1,1,Breaking Bad\n'],{type:'text/csv'}));link.download='seven-history-example.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
    let rows=[],version=0,resolving=false;const searches=new Map(),list=modal.body.querySelector('.progress-import-list'),footer=modal.body.querySelector('.progress-footer'),save=modal.body.querySelector('[data-import-save]');
    const summary=()=>{const count=rows.filter(row=>row.selected&&row.change).length;modal.body.querySelector('[data-summary]').textContent=resolving?`Finding matches · ${count} ready`:`${count} of ${rows.length} selected`;save.disabled=!count||resolving;};
    async function choose(row,result){
      row.selected=false;row.change=null;const request=++row.request;
      if(!result){row.message='Choose a match or leave this row out.';return;}
      try{
        const show=normalize(await ui().cached(`${result.type}/${result.id}`),result.type);if(!modal.alive()||!rows.includes(row)||request!==row.request)return;
        if(!contentAllowed(show))throw Error('Unavailable for this profile.');row.show=show;row.candidates=row.candidates.filter(c=>`${c.type}:${c.id}`!==`${result.type}:${result.id}`);row.candidates.unshift({...result,title:titleOf(show)});row.chosen=`${result.type}:${result.id}`;
        if(result.type==='movie'){
          if(!tracker().validDate(show.release_date)||show.release_date>tracker().todayKey())throw Error('Not released yet.');row.change={show,value:true};
        }else{
          const seasonNumber=Number(row.season),episodeNumber=Number(row.episode);
          if(row.season===null||row.season===''||!Number.isInteger(seasonNumber)||seasonNumber<0||!episodeNumber){
            // Named Netflix episodes are matched only when unique, never by row order.
            if(row.episodeTitle){const seasons=(show.seasons||[]).filter(s=>s.season_number>0&&(!seasonNumber||s.season_number===seasonNumber));const matches=[];
              for(const s of seasons){const data=await ui().cached(`tv/${show.id}/season/${s.season_number}`);if(!modal.alive()||request!==row.request)return;for(const e of data.episodes||[])if(tools().folded(e.name)===tools().folded(row.episodeTitle))matches.push({season:s.season_number,episode:e.episode_number});}
              if(matches.length===1){row.season=matches[0].season;row.episode=matches[0].episode;}
            }
          }
          if(row.season===null||row.season===''||!Number.isSafeInteger(Number(row.season))||Number(row.season)<0||!Number.isSafeInteger(Number(row.episode))||Number(row.episode)<1)throw Error('Enter the season and episode to include this row.');
          const data=await ui().cached(`tv/${show.id}/season/${Number(row.season)}`);if(!modal.alive()||request!==row.request)return;
          const episode=(data.episodes||[]).find(e=>Number(e.episode_number)===Number(row.episode));if(!tracker().aired(episode))throw Error('Episode not found or not released.');row.change={show,season:Number(row.season),episode,value:true};
        }
        row.message='Ready to import';row.selected=true;
      }catch(error){if(request===row.request&&rows.includes(row))row.message=error.message;}
    }
    function drawRow(row){
      if(!rows.includes(row))return;
      const el=list.querySelector(`[data-import-row="${row.index}"]`);if(!el)return;
el.innerHTML=`<label class="progress-row-check"><input type="checkbox" data-include ${row.selected?'checked':''} ${row.change?'':'disabled'}><span>${escapeHTML(row.title||`TMDB ${row.id}`)}</span></label><select data-match aria-label="Match for row ${row.index+1}"><option value="">Choose title</option>${row.candidates.map(c=>`<option value="${c.type}:${c.id}" ${row.chosen===`${c.type}:${c.id}`?'selected':''}>${escapeHTML(c.title)} · ${c.type==='tv'?'Series':'Movie'}${c.year?` · ${c.year}`:''}</option>`).join('')}</select>${row.show?.type==='tv'||row.type==='tv'?`<div class="progress-row-episode"><label>Season<input type="number" min="0" max="999" step="1" value="${row.season!==null&&row.season!==''?Number(row.season):''}" data-season></label><label>Episode<input type="number" min="1" max="10000" step="1" value="${Number(row.episode)||''}" data-episode></label></div>`:''}<small role="status">${escapeHTML(row.message||'Finding matches…')}</small>`;
      el.querySelector('[data-include]').onchange=e=>{row.selected=e.target.checked;summary();};
      const resolve=async()=>{row.season=el.querySelector('[data-season]')?.value||row.season;row.episode=el.querySelector('[data-episode]')?.value||row.episode;const selected=el.querySelector('[data-match]').value;row.chosen=selected;el.setAttribute('aria-busy','true');const task=choose(row,row.candidates.find(c=>`${c.type}:${c.id}`===selected));summary();await task;if(modal.alive()){drawRow(row);summary();}};
      el.querySelector('[data-match]').onchange=resolve;el.querySelector('[data-season]')?.addEventListener('change',resolve);el.querySelector('[data-episode]')?.addEventListener('change',resolve);
    }
    modal.body.querySelector('[data-file]').onchange=async event=>{
      const file=event.target.files?.[0],current=++version;if(!file)return;resolving=true;modal.error.textContent='';footer.hidden=true;save.disabled=true;
      try{
        if(file.size>2000000)throw Error('Choose a file smaller than 2 MB.');const parsed=tools().parse(await file.text());if(!modal.alive()||current!==version)return;
        rows=parsed.map(row=>({...row,candidates:[],request:0,selected:false,change:null}));list.innerHTML=rows.map(row=>`<article class="progress-import-row" data-import-row="${row.index}"></article>`).join('');rows.forEach(drawRow);footer.hidden=false;summary();let next=0;
        await Promise.all(Array.from({length:Math.min(3,rows.length)},async()=>{while(next<rows.length){const row=rows[next++];try{
          if(!modal.alive()||current!==version)return;
          if(row.id){if(!['tv','movie'].includes(row.type))throw Error('An ID needs a type: tv or movie.');row.candidates=[{id:row.id,type:row.type,title:row.title||`TMDB ${row.id}`}];await choose(row,row.candidates[0]);}
          else {if(!searches.has(row.query))searches.set(row.query,api('search/multi',{query:row.query,include_adult:'false'}).catch(error=>{searches.delete(row.query);throw error;}));const data=await searches.get(row.query);if(!modal.alive()||current!==version)return;row.candidates=(data.results||[]).filter(c=>['movie','tv'].includes(c.media_type)&&(!row.type||row.type===c.media_type)).slice(0,8).map(c=>({id:c.id,type:c.media_type,title:c.title||c.name,year:(c.release_date||c.first_air_date||'').slice(0,4)}));const exact=row.candidates.filter(c=>tools().folded(c.title)===tools().folded(row.query));if(exact.length===1)await choose(row,exact[0]);else row.message='Review the title match.';}
        }catch(error){row.message=error.message;}if(modal.alive()&&current===version){drawRow(row);summary();}}}));if(modal.alive()&&current===version){resolving=false;summary();}
      }catch(error){if(modal.alive()&&current===version){resolving=false;rows=[];list.innerHTML='';modal.error.textContent=error.message;}}
    };
    save.onclick=()=>run(modal,async()=>{const result=await ui().saveBatch(rows.filter(row=>row.selected&&row.change).map(row=>row.change));if(!modal.alive())return;modal.busy=false;modal.close();showToast(result.count?`${result.count} title${result.count===1?'':'s'} imported.`:'Already up to date.');});
  }
  root.SEVENProgressUI={bind,updateUndo,attachManage,importHistory,undo};
})(window);
