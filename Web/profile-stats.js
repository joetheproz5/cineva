(function attachProfileStats(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEVENProfileStats = api;
})(typeof window === "undefined" ? globalThis : window, function createProfileStats() {
  const VERSION = 1;

  function contentKey(item) {
    return `${item?.type || item?.content_type}:${Number(item?.id || item?.tmdb_id) || 0}:${Number(item?.season) || 0}:${Number(item?.episode) || 0}`;
  }

  function progressSeconds(entry) {
    const duration = Number(entry?.duration) || 0;
    const current = Number(entry?.currentTime) || 0;
    return Math.max(0, Math.min(current, duration || current));
  }

  function cleanStats(stats) {
    if (!stats || stats.version !== VERSION) return null;
    return {
      version:VERSION,
      totalSeconds:Math.max(0, Number(stats.totalSeconds) || 0),
      byTitle:stats.byTitle && typeof stats.byTitle === "object" ? stats.byTitle : {},
      currentStreak:Math.max(0, Number(stats.currentStreak) || 0),
      longestStreak:Math.max(0, Number(stats.longestStreak) || 0),
      lastWatchedDay:/^\d{4}-\d{2}-\d{2}$/.test(stats.lastWatchedDay || "") ? stats.lastWatchedDay : ""
    };
  }

  function dayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
  }

  function streaks(days) {
    const ordered = [...new Set(days.filter(Boolean))].sort();
    let longest = 0, current = 0, previous = null;
    ordered.forEach(day => {
      const date = new Date(`${day}T00:00:00.000Z`);
      current = previous && date - previous === 86400000 ? current + 1 : 1;
      longest = Math.max(longest, current);
      previous = date;
    });
    const last = ordered.at(-1) || "";
    return { longest, current:last && Date.now() - Date.parse(`${last}T00:00:00.000Z`) <= 86400000 * 2 ? current : 0, last };
  }

  function legacyStats(entries = []) {
    const byTitle = {};
    let totalSeconds = 0;
    const days = [];
    entries.forEach(entry => {
      if (!entry?.type || !Number(entry.id)) return;
      const key = `${entry.type}:${Number(entry.id)}`, seconds = progressSeconds(entry);
      const previous = byTitle[key];
      byTitle[key] = {
        type:entry.type,
        id:Number(entry.id),
        title:String(entry.title || "Untitled"),
        posterPath:entry.posterPath || null,
        genreIds:Array.isArray(entry.genreIds) ? entry.genreIds : [],
        seconds:(previous?.seconds || 0) + seconds,
        lastWatchedAt:entry.lastWatchedAt || null
      };
      totalSeconds += seconds;
      const day = dayKey(entry.lastWatchedAt);
      if (day) days.push(day);
    });
    const run = streaks(days);
    return { version:VERSION, totalSeconds, byTitle, currentStreak:run.current, longestStreak:run.longest, lastWatchedDay:run.last };
  }

  function ensureWatchStats(profile, entries = []) {
    if (!profile) return legacyStats(entries);
    const saved = cleanStats(profile.watchStats);
    if (saved) {
      profile.watchStats = saved;
      return saved;
    }
    profile.watchStats = legacyStats(entries);
    return profile.watchStats;
  }

  function mergeWatchStats(remote, local) {
    const cloud = cleanStats(remote), device = cleanStats(local);
    if (!cloud) return device;
    if (!device) return cloud;
    const byTitle = { ...cloud.byTitle };
    Object.entries(device.byTitle).forEach(([key, item]) => {
      const saved = byTitle[key];
      if (!saved || Number(item.seconds) > Number(saved.seconds)) byTitle[key] = item;
      else if (!saved.posterPath || !saved.genreIds?.length) byTitle[key] = { ...saved, posterPath:saved.posterPath || item.posterPath || null, genreIds:saved.genreIds?.length ? saved.genreIds : item.genreIds || [] };
    });
    const cloudIsNewer = device.lastWatchedDay > cloud.lastWatchedDay;
    const totalSeconds = Object.values(byTitle).reduce((total, item) => total + Math.max(0, Number(item.seconds) || 0), 0);
    return {
      version:VERSION,
      totalSeconds:Math.max(totalSeconds, cloud.totalSeconds, device.totalSeconds),
      byTitle,
      currentStreak:cloudIsNewer ? device.currentStreak : cloud.currentStreak,
      longestStreak:Math.max(cloud.longestStreak, device.longestStreak),
      lastWatchedDay:cloudIsNewer ? device.lastWatchedDay : cloud.lastWatchedDay
    };
  }

  function addWatchTime(profile, item, elapsedSeconds, now = new Date()) {
    const seconds = Number(elapsedSeconds);
    if (!profile || !item?.type || !Number(item.id) || !Number.isFinite(seconds) || seconds <= 0) return null;
    const stats = ensureWatchStats(profile), key = `${item.type}:${Number(item.id)}`, existing = stats.byTitle[key] || {
      type:item.type,
      id:Number(item.id),
      title:String(item.title || item.name || "Untitled"),
      posterPath:item.posterPath || null,
      genreIds:Array.isArray(item.genreIds) ? item.genreIds : [],
      seconds:0,
      lastWatchedAt:null
    };
    existing.seconds = Math.round(((Number(existing.seconds) || 0) + seconds) * 10) / 10;
    existing.title = String(item.title || existing.title || "Untitled");
    existing.posterPath = item.posterPath || existing.posterPath || null;
    existing.genreIds = Array.isArray(item.genreIds) && item.genreIds.length ? item.genreIds : existing.genreIds || [];
    existing.lastWatchedAt = now.toISOString();
    stats.byTitle[key] = existing;
    stats.totalSeconds = Math.round((stats.totalSeconds + seconds) * 10) / 10;

    const day = dayKey(now);
    if (day && day !== stats.lastWatchedDay) {
      const yesterday = new Date(`${day}T00:00:00.000Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      stats.currentStreak = stats.lastWatchedDay === yesterday.toISOString().slice(0, 10) ? stats.currentStreak + 1 : 1;
      stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
      stats.lastWatchedDay = day;
    }
    return stats;
  }

  function summarize(entries = [], profile = null) {
    const validEntries = entries.filter(entry => entry?.type && Number(entry.id) && entry.title);
    const watchStats = ensureWatchStats(profile, validEntries);
    const titles = new Map();
    Object.values(watchStats.byTitle).forEach(item => titles.set(`${item.type}:${Number(item.id)}`, { ...item, seconds:Math.max(0, Number(item.seconds) || 0) }));
    validEntries.forEach(entry => {
      const key = `${entry.type}:${Number(entry.id)}`;
      if (!titles.has(key)) titles.set(key, { ...entry, seconds:0 });
    });

    const completedMovies = new Set(), completedEpisodes = new Set();
    validEntries.forEach(entry => {
      if (!entry.watched && Number(entry.progress) < 90) return;
      const key = contentKey(entry);
      if (entry.type === "movie") completedMovies.add(key);
      if (entry.type === "tv") completedEpisodes.add(key);
    });

    const genreTitles = new Map();
    titles.forEach(item => {
      (item.genreIds || []).forEach(id => {
        const key = `${item.type}:${item.id}:${id}`;
        genreTitles.set(key, { title:`${item.type}:${item.id}`, genre:id });
      });
    });
    const genreCounts = {};
    genreTitles.forEach(({ title, genre }) => {
      genreCounts[genre] ||= new Set();
      genreCounts[genre].add(title);
    });

    return {
      entries:validEntries,
      titles:[...titles.values()].sort((a, b) => b.seconds - a.seconds),
      seconds:Math.max(0, Number(watchStats.totalSeconds) || 0),
      moviesFinished:completedMovies.size,
      episodesWatched:completedEpisodes.size,
      titlesStarted:titles.size,
      streak:Math.max(0, Number(watchStats.longestStreak) || 0),
      genres:Object.entries(genreCounts).sort((a, b) => b[1].size - a[1].size).map(([id]) => Number(id))
    };
  }

  function clearWatchStats(profile) {
    if (!profile) return;
    profile.watchStats = { version:VERSION, totalSeconds:0, byTitle:{}, currentStreak:0, longestStreak:0, lastWatchedDay:"" };
  }

  return { VERSION, contentKey, progressSeconds, ensureWatchStats, mergeWatchStats, addWatchTime, summarize, clearWatchStats };
});
