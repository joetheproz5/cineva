/* Scores are calculated locally; no account identifiers are sent to TMDB. */
(function (root, factory) {
  const ranking = factory();
  if (typeof module === "object" && module.exports) module.exports = ranking;
  root.SEVENRecommendations = ranking;
})(typeof window === "undefined" ? globalThis : window, function () {
  const DAY = 86400000;
  const typeOf = item => item.type || item.content_type || item.media_type || (item.title ? "movie" : "tv");
  const keyOf = item => `${typeOf(item)}:${Number(item.id ?? item.tmdb_id)}`;
  const genresOf = item => [...new Set((item.genreIds || item.genre_ids || (item.genres || []).map(genre => genre.id)).map(Number).filter(Number.isFinite))];
  const bridges = { 28:[10759], 12:[10759], 878:[10765], 14:[10765], 10759:[28,12], 10765:[878,14] };
  const movieGenres = new Set([28,12,16,35,80,99,18,10751,27,9648,10749,53,878,14,36,10402,10752,37]);
  const tvGenres = new Set([10759,16,35,80,99,18,10751,9648,10765,10762,10763,10764,10766,10767,10768,37]);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function engagement(entry) {
    const duration = Math.max(0, finite(entry.duration)), seconds = Math.max(0, finite(entry.currentTime ?? entry.progress_seconds));
    const percent = Math.max(0, Math.min(100, duration ? seconds / duration * 100 : finite(entry.progress)));
    if (entry.watched || entry.is_watched || percent >= 90) return 1;
    if (seconds < 120 || duration && percent < 5) return 0;
    return Math.min(.85, duration ? percent / 100 : seconds / 3600);
  }
  function build({ profileId="", preferences={}, history=[], liked=[], hidden=[], metadata=[], now=Date.now() } = {}) {
    const model = { profileId, preferences, now, genres:{ movie:{}, tv:{} }, seen:new Map(), liked:new Set(), hidden:new Set(), anchors:[], related:new Map(), signals:0 };
    const lookup = new Map(metadata.map(item => [keyOf(item),item]));
    const scoped = entries => entries.filter(entry => !entry.profileId || entry.profileId === profileId);
    const enriched = entry => { const full={ ...lookup.get(keyOf(entry)), ...entry };if(!genresOf(full).length)full.genreIds=genresOf(lookup.get(keyOf(entry)) || {});return full; };
    const recency = value => { const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? .25 + .75 * Math.exp(-Math.max(0,now-timestamp)/(90*DAY)) : .6; };
    const add = (type, ids, amount, cross = true) => {
      const own = type === "tv" ? tvGenres : movieGenres, other = type === "tv" ? "movie" : "tv", otherGenres = other === "tv" ? tvGenres : movieGenres;
      for (const id of ids) {
        if (own.has(id)) model.genres[type][id] = (model.genres[type][id] || 0) + amount / Math.sqrt(Math.max(1,ids.length));
        if (cross) for (const mapped of bridges[id] || (otherGenres.has(id) ? [id] : [])) model.genres[other][mapped] = (model.genres[other][mapped] || 0) + amount * .3 / Math.sqrt(Math.max(1,ids.length));
      }
    };
    for (const entry of scoped(hidden)) model.hidden.add(keyOf(entry));
    for (const id of new Set((preferences.favoriteGenres || []).map(Number))) {
      add("movie",[id],3,false);
      for (const tvId of bridges[id] || (tvGenres.has(id) ? [id] : [])) add("tv",[tvId],3,false);
      model.signals++;
    }
    const grouped = new Map();
    for (const raw of scoped(history)) {
      const entry = enriched(raw), key = keyOf(entry), weight = engagement(entry);
      if (!weight || model.hidden.has(key)) continue;
      const previous = grouped.get(key), recent = recency(entry.lastWatchedAt), strength = weight * recent;
      if (!previous || strength > previous.strength) grouped.set(key,{ entry, strength, completed:weight===1 || previous?.completed });
      else if (weight===1) previous.completed = true;
    }
    for (const [key,{entry,strength,completed}] of grouped) {
      const type = typeOf(entry); if (!["movie","tv"].includes(type)) continue;
      model.seen.set(key,{completed}); add(type,genresOf(entry),2.5*strength);
      model.anchors.push({ ...entry, type, strength:2.5*strength }); model.signals++;
    }
    for (const raw of scoped(liked)) {
      const entry=enriched(raw),key=keyOf(entry),type=typeOf(entry);
      if (model.hidden.has(key) || !["movie","tv"].includes(type) || model.liked.has(key)) continue;
      model.liked.add(key); const strength=6*recency(entry.likedAt);add(type,genresOf(entry),strength);
      model.anchors=model.anchors.filter(anchor=>keyOf(anchor)!==key);model.anchors.push({...entry,type,strength:strength+3});model.signals++;
    }
    for (const raw of scoped(hidden)) { const entry=enriched(raw),type=typeOf(entry);if (["movie","tv"].includes(type)) add(type,genresOf(entry),-.8,false); }
    model.anchors.sort((a,b)=>b.strength-a.strength || finite(b.id)-finite(a.id));
    return model;
  }
  function topGenres(model,type) {
    return Object.entries(model.genres[type]).filter(([,weight])=>weight>0).sort((a,b)=>b[1]-a[1] || Number(a[0])-Number(b[0])).slice(0,3).map(([id])=>Number(id));
  }
  function addRelated(model,anchor,items) {
    const strength=Math.min(1,anchor.strength/6);
    items.forEach((item,index)=>{const key=keyOf(item),value=strength*(1-index/Math.max(1,items.length)*.5);model.related.set(key,Math.max(model.related.get(key)||0,value));});
  }
  function score(item,model) {
    const type=typeOf(item),key=keyOf(item),weights=model.genres[type] || {},ids=genresOf(item),normalizer=Math.max(3,...Object.values(weights).filter(weight=>weight>0));
    const affinity=ids.length ? ids.reduce((sum,id)=>sum+(weights[id]||0),0)/Math.sqrt(ids.length)/normalizer : 0;
    const votes=Math.max(0,finite(item.vote_count)),average=Math.max(0,Math.min(10,finite(item.vote_average))),quality=(votes*average+80*6.5)/(votes+80)/10;
    const popularity=Math.min(1,Math.log1p(Math.max(0,finite(item.popularity)))/Math.log(201));
    const date=Date.parse(item.release_date || item.first_air_date),age=Number.isFinite(date)?Math.max(0,(model.now-date)/DAY):Infinity;
    const seen=model.seen.get(key),seenPenalty=seen ? type==="movie" && seen.completed ? 4 : 2 : 0;
    return affinity*6 + (model.related.get(key)||0)*3 + quality*2 + popularity*.8 + (age<=365?.25:0) - seenPenalty - (model.liked.has(key)?2:0);
  }
  function rank(items,model,{allowed=()=>true,exclude=new Set()}={}) {
    const today=new Date(model.now).toISOString().slice(0,10),unique=new Map();
    for(const item of items) {
      const type=typeOf(item),key=keyOf(item),date=String(item.release_date || item.first_air_date || "");
      if(!["movie","tv"].includes(type) || !Number(item.id) || !item.poster_path || model.hidden.has(key) || exclude.has(key) || date>today || !allowed(item))continue;
      if(model.preferences.contentMix==="movies"&&type==="tv" || model.preferences.contentMix==="series"&&type==="movie" || model.preferences.moviesEnabled===false&&type==="movie" || model.preferences.seriesEnabled===false&&type==="tv")continue;
      if(!unique.has(key))unique.set(key,{...item,type});
    }
    const remaining=[...unique.values()].map(item=>({item,score:score(item,model)})).sort((a,b)=>b.score-a.score || keyOf(a.item).localeCompare(keyOf(b.item))),ranked=[],recent=[];
    // A small diversity penalty breaks long runs of the same genre without overriding taste.
    while(remaining.length) {
      let best=0,bestScore=-Infinity;
      for(let i=0;i<remaining.length;i++) {
        const ids=genresOf(remaining[i].item),overlap=recent.reduce((sum,genres)=>sum+(ids.some(id=>genres.includes(id))?1:0),0);
        const adjusted=remaining[i].score-overlap*.25;
        if(adjusted>bestScore){bestScore=adjusted;best=i;}
      }
      const [entry]=remaining.splice(best,1);ranked.push(entry.item);recent.push(genresOf(entry.item));if(recent.length>4)recent.shift();
    }
    return ranked;
  }
  return {build,rank,score,topGenres,engagement,addRelated,keyOf};
});
