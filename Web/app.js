const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/original";
const TMDB_STILL = "https://image.tmdb.org/t/p/w780";
const FEATURED_ID = 71712;
const isInstalledPWA = window.matchMedia?.("(display-mode: standalone)").matches
  || window.matchMedia?.("(display-mode: fullscreen)").matches
  || navigator.standalone === true;
if (isInstalledPWA) document.documentElement.classList.add("seven-installed-pwa");
const app = document.querySelector("#app");
let searchRequest = 0;
let coverflowResizeTimer;
let coverflowViewportWidth = window.innerWidth;
let sessionRefreshTimer;
let sessionRefreshPromise;
let deferredInstallPrompt;
const continuePosterRepairs = new Set();
const state = { featured: null, featuredPool: [], featuredIndex: 0, heroTimer: null, catalog: {}, newEpisodes: [], route: "home", search: "", user: null, session: null, account: null, accountProgress: [], myList: [], watchlist: [], watchlistOwnerId: null, watchlistProfileId: null, watchlistLoaded: false, watchlistLoading: false, watchlistLoadSequence:0, watchlistMutationVersion:0, watchlistError: null, watchlistFilter: "all", watchlistSort: "recent", watchlistPending: new Set(), watchlistTargets:new Map(), movie: null, person: null, personBackRoute: "home", trailer: null, progressTimer: null, pendingProgress: null, playerContextKey: null, pendingEpisodeCompletion: null, startupReady: false, introAnimationComplete: false, introExitStarted: false, introTimer: null, introSafetyTimer: null, footerScrollFrame: 0, watchStatsSyncTimer: null, watchStatsSyncPromise: null, watchStatsSyncPending: false };
const playbackWatch = { sample:null, buffered:0, bufferType:null, accessToken:null, batch:null, sending:false, timer:null };
const SESSION_KEY = "cineva.supabase.session";
const SESSION_REFRESH_LOCK = "seven-auth-session-refresh";
const PENDING_EMAIL_VERIFICATION_KEY = "seven.auth.pending-email-verification";
const VERIFIED_EMAIL_KEY = "seven.auth.email-verified";
const ACCOUNT_KEY = "seven.account.settings";
const ACCOUNT_OWNER_KEY = "seven.account.owner";
const MY_LIST_KEY = "seven.my-list";
const WATCHLIST_STORAGE_PREFIX = "seven.account.watchlist.";
const PROFILE_WATCHLIST_STORAGE_PREFIX = "seven.profile.watchlist.";
const DISPLAY_LANGUAGES = { English:"en-US", Arabic:"ar-SA", French:"fr-FR" };
const UI_STRINGS = {
  Arabic: {
    "Home":"الرئيسية", "For You":"مخصص لك", "Movies":"أفلام", "Series":"مسلسلات", "Favourites":"المفضلة", "Favs":"المفضلة",
    "Titles, movies, series":"عناوين، أفلام، مسلسلات", "Account":"الحساب", "Search":"بحث",
    "Play something":"شغّل شيئاً", "We’ll pick a trailer for you":"سنختار لك إعلاناً تشويقياً",
    "Not sure what to watch?":"لا تعرف ماذا تشاهد؟", "Swipe through trailers and find something new.":"تصفح الإعلانات التشويقية واكتشف شيئاً جديداً.",
    "WHO’S WATCHING?":"من يشاهد؟", "Choose a profile":"اختر ملفاً شخصياً", "Manage profiles":"إدارة الملفات",
    "You're offline":"أنت غير متصل", "NO CONNECTION":"لا يوجد اتصال", "Try again":"حاول مجدداً",
    "SEVEN needs an internet connection to load titles and your profiles. Check your network and try again.":"يحتاج SEVEN إلى اتصال بالإنترنت لتحميل العناوين وملفاتك الشخصية. تحقق من اتصالك وحاول مجدداً.",
    "Profiles":"الملفات الشخصية", "Your SEVEN":"SEVEN الخاص بك", "Playback":"التشغيل", "Security":"الأمان", "Categories":"الفئات",
    "Browse":"تصفح", "Watching now":"يشاهد الآن", "Settings":"الإعدادات", "Switch profile":"تبديل الملف الشخصي", "All settings":"كل الإعدادات",
    "Profile & parental controls":"الملف الشخصي والرقابة الأبوية", "Viewing experience":"تجربة المشاهدة", "Activity & privacy":"النشاط والخصوصية", "Settings saved.":"تم حفظ الإعدادات.", "Allow browser notifications to enable episode alerts.":"اسمح بإشعارات المتصفح لتفعيل تنبيهات الحلقات.", "Your profile":"ملفك الشخصي", "Create a profile":"إنشاء ملف شخصي", "CURRENT PROFILE":"الملف الحالي", "PROFILE SETTINGS":"إعدادات الملف الشخصي", "Choose a profile name and avatar.":"اختر اسم الملف والصورة الرمزية.", "Choose what this profile can discover and watch.":"اختر ما يمكن لهذا الملف اكتشافه ومشاهدته.", "Make playback fit your preferences.":"خصص التشغيل حسب تفضيلاتك.", "Choose the language and content you want to see.":"اختر اللغة والمحتوى الذي تريد مشاهدته.", "Review saved titles, ratings, and watch history.":"راجع العناوين المحفوظة والتقييمات وسجل المشاهدة.", "Protect the profile and manage account access.":"احمِ الملف وأدر الوصول إلى الحساب.", "Manage each profile's details and viewing limits.":"أدر تفاصيل كل ملف وحدود المشاهدة.", "Manage people, playback, and privacy for this profile.":"أدر الأشخاص والتشغيل والخصوصية لهذا الملف.",
    "Activity":"النشاط", "Viewing preferences":"تفضيلات المشاهدة", "Security and privacy":"الأمان والخصوصية",
    "Who’s watching?":"من يشاهد؟",
    "Profile stats":"إحصائيات الملف", "Favourites":"المفضلة", "Viewing activity":"نشاط المشاهدة", "Your ratings":"تقييماتك", "Not for me":"ليس عني",
    "Change password":"تغيير كلمة المرور", "Install SEVEN":"تثبيت SEVEN", "Clear viewing history":"مسح سجل المشاهدة", "Sign out":"تسجيل الخروج",
    "Change":"تغيير", "Install":"تثبيت", "Clear":"مسح", "Sign out ":"", "Open":"فتح", "View":"عرض", "Delete":"حذف", "Save changes":"حفظ التغييرات", "Create profile":"إنشاء ملف",
    "Edit this profile":"تعديل هذا الملف", "Family controls":"تحكم الأسرة", "Language & display":"اللغة والعرض", "Your SEVEN activity":"نشاطك في SEVEN", "Privacy & security":"الخصوصية والأمان",
    "Autoplay next episode":"تشغيل الحلقة التالية تلقائياً", "Cinematic intro":"المقدمة السينمائية", "Autoplay spotlight":"تشغيل الدور تلقائياً", "New episode alerts":"تنبيهات الحلقات الجديدة",
    "Maturity setting":"تصنيف العم", "Display language":"لغة العرض",
    "Kids profile":"ملف أطفال", "Screen time limit":"حد وقت الشاشة", "Daily limit":"الحد اليومي", "Show movies":"عرض الأفلام", "Show series":"عرض المسلسلات", "Preferred player":"مشغل الفيديو المفضل",
    "Profile PIN":"رمز الملف الشخصي", "Parent access code":"رمز الوصول الأبوي",
    "Set a profile PIN":"تعيين رمز الملف", "Change profile PIN":"تغيير رمز الملف",
    "SCREEN TIME":"وقت الشاشة", "Time's up for today":"انتهى الوقت لهذا اليوم", "Parent access code ":"رمز الوصول الأبوي",
    "Unlock options":"فتح الخيارات", "+30 min":"+30 دقيقة", "+1 hour":"+1 ساعة", "Off for today":"إيقاف لهذا اليوم",
    "Watch now":"شاهد الآن", "Next trailer":"الإعلان التالي", "Next episode":"الحلقة التالية", "Back":"رجوع",
    "Continue watching":"متابعة المشاهدة", "New episodes":"حلقات جديدة", "Trending now":"الأكثر رواجاً الآن", "New movies":"أفلام جديدة", "New series":"مسلسلات جديدة", "Popular movies":"أفلام شائعة", "Popular series":"مسلسلات شائعة", "Coming soon":"قريباً", "All-time greats":"الأعظم على الإطلاق", "Action & adventure":"أكشن ومغامرة",
    "RECENT SEARCHES":"عمليات البحث الأخيرة", "Top searches":"الأكثر بحثاً", "Clear":"مسح",
    "Password updated.":"تم تحديث كلمة المرور.", "Done":"تم"
  },
  French: {
    "Home":"Accueil", "For You":"Pour vous", "Movies":"Films", "Series":"Séries", "Favourites":"Favoris", "Favs":"Favoris",
    "Titles, movies, series":"Titres, films, séries", "Account":"Compte", "Search":"Rechercher",
    "Play something":"Lancer quelque chose", "We’ll pick a trailer for you":"On choisit une bande-annonce pour vous",
    "Not sure what to watch?":"Vous ne savez pas quoi regarder ?", "Swipe through trailers and find something new.":"Parcourez les bandes-annonces et découvrez.",
    "WHO’S WATCHING?":"QUI REGARDE ?", "Choose a profile":"Choisir un profil", "Manage profiles":"Gérer les profils",
    "You're offline":"Vous êtes hors ligne", "NO CONNECTION":"AUCUNE CONNEXION", "Try again":"Réessayer",
    "SEVEN needs an internet connection to load titles and your profiles. Check your network and try again.":"SEVEN nécessite une connexion Internet pour charger les titres et vos profils. Vérifiez votre réseau et réessayez.",
    "Profiles":"Profils", "Your SEVEN":"Votre SEVEN", "Playback":"Lecture", "Security":"Sécurité", "Categories":"Catégories",
    "Browse":"Parcourir", "Watching now":"En cours", "Settings":"Paramètres", "Switch profile":"Changer de profil", "All settings":"Tous les paramètres",
    "Profile & parental controls":"Profil et contrôle parental", "Viewing experience":"Expérience de visionnage", "Activity & privacy":"Activité et confidentialité", "Settings saved.":"Paramètres enregistrés.", "Allow browser notifications to enable episode alerts.":"Autorisez les notifications du navigateur pour activer les alertes.", "Your profile":"Votre profil", "Create a profile":"Créer un profil", "CURRENT PROFILE":"PROFIL ACTUEL", "PROFILE SETTINGS":"PARAMÈTRES DU PROFIL", "Choose a profile name and avatar.":"Choisissez un nom et un avatar.", "Choose what this profile can discover and watch.":"Choisissez le contenu que ce profil peut découvrir et regarder.", "Make playback fit your preferences.":"Personnalisez la lecture selon vos préférences.", "Choose the language and content you want to see.":"Choisissez la langue et les contenus à afficher.", "Review saved titles, ratings, and watch history.":"Consultez les titres enregistrés, les notes et l'historique.", "Protect the profile and manage account access.":"Protégez le profil et gérez l'accès au compte.", "Manage each profile's details and viewing limits.":"Gérez les détails et les limites de chaque profil.", "Manage people, playback, and privacy for this profile.":"Gérez les profils, la lecture et la confidentialité.",
    "Activity":"Activité", "Viewing preferences":"Préférences de lecture", "Security and privacy":"Sécurité et confidentialité",
    "Who’s watching?":"Qui regarde ?",
    "Profile stats":"Statistiques du profil", "Favourites":"Favoris", "Viewing activity":"Activité de visionnage", "Your ratings":"Vos notes", "Not for me":"Pas pour moi",
    "Change password":"Changer le mot de passe", "Install SEVEN":"Installer SEVEN", "Clear viewing history":"Effacer l'historique", "Sign out":"Se déconnecter",
    "Change":"Changer", "Install":"Installer", "Clear":"Effacer", "Open":"Ouvrir", "View":"Voir", "Delete":"Supprimer", "Save changes":"Enregistrer", "Create profile":"Créer le profil",
    "Edit this profile":"Modifier ce profil", "Family controls":"Contrôles familiaux", "Language & display":"Langue et affichage", "Your SEVEN activity":"Votre activité SEVEN", "Privacy & security":"Confidentialité et sécurité",
    "Autoplay next episode":"Lecture auto. épisode suivant", "Cinematic intro":"Intro cinématique", "Autoplay spotlight":"Rotation de la une", "New episode alerts":"Alertes nouveaux épisodes",
    "Maturity setting":"Classification", "Display language":"Langue d'affichage",
    "Kids profile":"Profil enfant", "Screen time limit":"Limite de temps d'écran", "Daily limit":"Limite quotidienne", "Show movies":"Afficher les films", "Show series":"Afficher les séries", "Preferred player":"Lecteur préféré",
    "Profile PIN":"Code du profil", "Parent access code":"Code d'accès parental",
    "Set a profile PIN":"Définir un code", "Change profile PIN":"Changer le code",
    "SCREEN TIME":"TEMPS D'ÉCRAN", "Time's up for today":"Le temps est écoulé pour aujourd'hui",
    "Unlock options":"Débloquer les options", "+30 min":"+30 min", "+1 hour":"+1 heure", "Off for today":"Désactivé aujourd'hui",
    "Watch now":"Regarder", "Next trailer":"BA suivante", "Next episode":"Épisode suivant", "Back":"Retour",
    "Continue watching":"Reprendre", "New episodes":"Nouveaux épisodes", "Trending now":"Tendances", "New movies":"Nouveaux films", "New series":"Nouvelles séries", "Popular movies":"Films populaires", "Popular series":"Séries populaires", "Coming soon":"Prochainement", "All-time greats":"Les grands classiques", "Action & adventure":"Action et aventure",
    "RECENT SEARCHES":"RECHERCHES RÉCENTES", "Top searches":"Recherches populaires", "Clear":"Effacer",
    "Password updated.":"Mot de passe mis à jour.", "Done":"Terminé"
  }
};
function t(text) { return UI_STRINGS[currentPreferences().language]?.[text] ?? text; }
function applyLocale() {
  const language = currentPreferences().language || "English";
  document.documentElement.lang = { English:"en", Arabic:"ar", French:"fr" }[language] || "en";
  document.documentElement.dir = language === "Arabic" ? "rtl" : "ltr";
}
const DEFAULT_PREFERENCES = { autoplayNext:true, autoplayPreviews:true, episodeAlerts:false, maturity:"18+", language:"English", familySafe:false, favoriteGenres:[], contentMix:"both", blockScary:false, searchEnabled:true, moviesEnabled:true, seriesEnabled:true, introEnabled:true, playerProvider:"cinesrc" };
const PLAYER_PROVIDERS = Object.freeze(["cinesrc", "vidfast", "multiembed", "vidsrc", "2embed"]);
const PREVIOUS_EPISODE_WATCHED_PERCENT = 50;
const NEXT_EPISODE_CONFIRMATION_PERCENT = 25;
function selectedPlayerProvider() { const provider = currentPreferences().playerProvider; return PLAYER_PROVIDERS.includes(provider) ? provider : "cinesrc"; }
function playbackProgressPercent(record = {}) { const duration = Number(record.duration), currentTime = Number(record.currentTime), savedProgress = Number(record.progress); if (Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) && currentTime >= 0) return Math.min(100, currentTime / duration * 100); return Number.isFinite(savedProgress) ? Math.min(100, Math.max(0, savedProgress)) : 0; }
function isDirectNextEpisode(previous, current) { return previous?.type === "tv" && current?.type === "tv" && Number(previous.id) === Number(current.id) && Number(previous.season) === Number(current.season) && Number(current.episode) === Number(previous.episode) + 1; }
function shouldConfirmPreviousEpisode(previous, current, previousRecord, currentProgress) { return isDirectNextEpisode(previous, current) && playbackProgressPercent(previousRecord) >= PREVIOUS_EPISODE_WATCHED_PERCENT && Number(currentProgress) >= NEXT_EPISODE_CONFIRMATION_PERCENT; }
const activeProfileId = () => state.account?.activeProfileId || "main";
const watchKey = item => `seven-progress-${activeProfileId()}-${item.type}-${item.id}-${item.season || 0}-${item.episode || 0}`;
const titleOf = item => item.title || item.name || item.original_title || item.original_name || "Untitled";
const yearOf = item => (item.release_date || item.first_air_date || "").slice(0, 4);
const posterOf = item => item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : "icon.svg";
const stillOf = item => item.backdrop_path ? `${TMDB_STILL}${item.backdrop_path}` : posterOf(item);
const escapeHTML = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
function scrollToTop() { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
function animateScrollToTop() {
  const root = document.scrollingElement || document.documentElement;
  const startY = Math.max(Number(window.scrollY) || 0, Number(root.scrollTop) || 0, Number(document.body.scrollTop) || 0);
  if (startY <= 0) return;
  cancelAnimationFrame(state.footerScrollFrame);
  const duration = Math.min(1100, Math.max(420, startY * .42));
  let startedAt = null;
  const step = timestamp => {
    if (startedAt === null) startedAt = timestamp;
    const progress = Math.min((timestamp - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const top = Math.round(startY * (1 - eased));
    root.scrollTop = top;
    if (document.body !== root) document.body.scrollTop = top;
    if (Math.abs((Number(root.scrollTop) || 0) - top) > 1) window.scrollTo(0, top);
    if (progress < 1) state.footerScrollFrame = requestAnimationFrame(step);
    else {
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      state.footerScrollFrame = 0;
    }
  };
  state.footerScrollFrame = requestAnimationFrame(step);
}

async function localAPI(path, options = {}) { const response = await fetch(path, options); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || data.msg || "Request failed."); error.status = response.status; throw error; } return data; }
function authorizedHeaders() { return state.session?.access_token ? { Authorization:`Bearer ${state.session.access_token}` } : {}; }
function analyticsAllowed() { return navigator.doNotTrack !== "1" && window.doNotTrack !== "1" && navigator.globalPrivacyControl !== true; }
function reportAccountVisit() { if (state.session?.access_token) window.SevenMetrics?.trackAccountVisit(state.session.access_token); }
function resetPlaybackWatchTracking() { clearTimeout(playbackWatch.timer); playbackWatch.sample = null; playbackWatch.buffered = 0; playbackWatch.bufferType = null; playbackWatch.accessToken = null; playbackWatch.batch = null; playbackWatch.sending = false; playbackWatch.timer = null; }
function recordProfileWatchTime(item, seconds) {
  const profile = currentProfile(), stats = window.SEVENProfileStats;
  if (!state.session || !profile || !stats) return;
  stats.ensureWatchStats(profile, progressEntries());
  stats.addWatchTime(profile, item, seconds);
  persistLocalAccount();
  state.watchStatsSyncPending = true;
  scheduleProfileWatchStatsSync();
}
function persistLocalAccount() {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account));
  const owner = state.user?.id || state.session?.user?.id;
  if (owner) localStorage.setItem(ACCOUNT_OWNER_KEY, owner);
}
async function clearProfilePlaybackStats(profileId = activeProfileId()) {
  if (state.watchStatsSyncPromise) await state.watchStatsSyncPromise;
  const profile = state.account?.profiles?.find(item => item.id === profileId);
  if (profile && window.SEVENProfileStats) window.SEVENProfileStats.clearWatchStats(profile);
  clearTimeout(state.watchStatsSyncTimer); state.watchStatsSyncTimer = null; state.watchStatsSyncPending = false;
  await saveAccount();
}
function scheduleProfileWatchStatsSync() {
  if (!state.session || !state.account || !state.watchStatsSyncPending || state.watchStatsSyncTimer) return;
  state.watchStatsSyncTimer = setTimeout(() => { state.watchStatsSyncTimer = null; void flushProfileWatchStats(); }, 120000);
}
async function flushProfileWatchStats(keepalive = false) {
  clearTimeout(state.watchStatsSyncTimer); state.watchStatsSyncTimer = null;
  if (!state.session || !state.account || !state.watchStatsSyncPending) return;
  if (state.watchStatsSyncPromise) {
    await state.watchStatsSyncPromise;
    if (keepalive && state.watchStatsSyncPending) return flushProfileWatchStats(true);
    return;
  }
  const snapshot = JSON.stringify({ account:state.account });
  state.watchStatsSyncPending = false;
  state.watchStatsSyncPromise = (async () => {
    try {
      await localAPI("/api/account/settings", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:snapshot, keepalive });
    } catch { state.watchStatsSyncPending = true; }
    finally { state.watchStatsSyncPromise = null; if (state.watchStatsSyncPending) scheduleProfileWatchStatsSync(); }
  })();
  await state.watchStatsSyncPromise;
}
function watchTimeEventId() { if (crypto.randomUUID) return crypto.randomUUID(); const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128; const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
function scheduleWatchTimeFlush(delay = 12000) { if (!playbackWatch.timer) playbackWatch.timer = setTimeout(() => { playbackWatch.timer = null; void flushWatchTime(); }, delay); }
async function flushWatchTime() {
  if (!analyticsAllowed()) { resetPlaybackWatchTracking(); return; }
  if (!playbackWatch.batch && playbackWatch.buffered >= 0.5) {
    const seconds = Math.round(playbackWatch.buffered * 10) / 10;
    playbackWatch.batch = { eventId:watchTimeEventId(), seconds, userType:playbackWatch.bufferType || (state.session ? "account" : "guest"), accessToken:playbackWatch.accessToken || state.session?.access_token || null };
    playbackWatch.buffered = 0;
    playbackWatch.bufferType = null;
    playbackWatch.accessToken = null;
  }
  if (!playbackWatch.batch || playbackWatch.sending) return;
  playbackWatch.sending = true;
  try {
    const batch = playbackWatch.batch, isAccount = batch.userType === "account", path = isAccount ? "/api/account/watch-time" : "/api/metrics/event";
    const body = isAccount ? { eventId:batch.eventId, seconds:batch.seconds } : { event:"watch-time", eventId:batch.eventId, seconds:batch.seconds };
    const headers = { "Content-Type":"application/json" };
    if (isAccount && (batch.accessToken || state.session?.access_token)) headers.Authorization = `Bearer ${batch.accessToken || state.session.access_token}`;
    await localAPI(path, { method:"POST", headers, body:JSON.stringify(body), keepalive:true });
    playbackWatch.batch = null;
  } catch { /* Retry the same idempotent event when another sample arrives. */ }
  finally {
    playbackWatch.sending = false;
    if (playbackWatch.batch || playbackWatch.buffered >= 0.5) scheduleWatchTimeFlush(10000);
  }
}
function samplePlaybackWatchTime(currentTime) {
  const now = Date.now(), key = state.player ? watchKey(state.player) : "", userType = state.session ? "account" : "guest", previous = playbackWatch.sample;
  if (previous && previous.userType !== userType) {
    if (analyticsAllowed() && playbackWatch.buffered >= 0.5) void flushWatchTime();
    else { clearTimeout(playbackWatch.timer); playbackWatch.buffered = 0; playbackWatch.bufferType = null; playbackWatch.accessToken = null; playbackWatch.timer = null; }
    playbackWatch.sample = null;
  }
  const priorSample = playbackWatch.sample;
  playbackWatch.sample = { key, currentTime, at:now, userType };
  if (!priorSample || priorSample.userType !== userType) return;
  if (priorSample.key !== key) return;
  const elapsed = (now - priorSample.at) / 1000, advanced = currentTime - priorSample.currentTime;
  // Count forward-playing media time; discard seeks, rewinds and long gaps.
  if (elapsed > 0 && elapsed <= 30 && advanced > 0.15 && advanced <= elapsed * 2.25 + 1) {
    recordProfileWatchTime(state.player, advanced);
    if (!analyticsAllowed()) { clearTimeout(playbackWatch.timer); playbackWatch.buffered = 0; playbackWatch.bufferType = null; playbackWatch.accessToken = null; playbackWatch.timer = null; return; }
    playbackWatch.bufferType = userType;
    playbackWatch.accessToken = userType === "account" ? state.session?.access_token || playbackWatch.accessToken : null;
    playbackWatch.buffered += advanced;
    if (playbackWatch.buffered >= 15) void flushWatchTime();
    else scheduleWatchTimeFlush();
  }
}
window.addEventListener("pagehide", () => { void flushWatchTime(); void flushProfileWatchStats(true); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushWatchTime(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushProfileWatchStats(true); });
function defaultAccount() { const name = state.user?.user_metadata?.display_name || state.user?.email?.split("@")[0] || "Main profile"; return { activeProfileId:"main", onboardingComplete:true, onboardingStep:1, profiles:[{ id:"main", name, color:"#d3131c", kids:false }], preferences:{ ...DEFAULT_PREFERENCES } }; }
const EMPTY_SECRET_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function hydrateAccount() {
  let local = null;
  try {
    const candidate = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"), owner = localStorage.getItem(ACCOUNT_OWNER_KEY);
    if ((!state.user?.id && !owner) || (state.user?.id && owner === state.user.id)) local = candidate;
  } catch {}
  const remote = state.user?.user_metadata?.seven_account, saved = remote || local || {}, fallback = defaultAccount();
  state.account = { ...fallback, ...saved, parentAccessEnabled:saved.parentAccessEnabled === true, profiles:Array.isArray(saved.profiles) && saved.profiles.length ? saved.profiles : fallback.profiles, preferences:{ ...fallback.preferences, ...(saved.preferences || {}) } };
  let migratedKidsPin = false, cleanedEmptyPin = false, mergedLocalStats = false;
  state.account.profiles.forEach(profile => {
    const deviceProfile = local?.profiles?.find(item => item.id === profile.id);
    if (remote && deviceProfile?.watchStats && window.SEVENProfileStats) {
      const merged = window.SEVENProfileStats.mergeWatchStats(profile.watchStats, deviceProfile.watchStats);
      if (merged && JSON.stringify(merged) !== JSON.stringify(profile.watchStats || null)) mergedLocalStats = true;
      if (merged) profile.watchStats = merged;
    }
    if (profile.pinHash === EMPTY_SECRET_HASH) { delete profile.pinHash; cleanedEmptyPin = true; }
    if (!profile.kids || !profile.pinHash) return;
    if (!state.account.parentPinHash) state.account.parentPinHash = profile.pinHash;
    delete profile.pinHash;
    migratedKidsPin = true;
  });
  if (!state.account.profiles.some(profile => profile.id === state.account.activeProfileId)) state.account.activeProfileId = state.account.profiles[0].id;
  if (["cinepro", "vidlink", "vidking"].includes(state.account.preferences.playerProvider)) state.account.preferences.playerProvider = "cinesrc";
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account));
  if (state.user?.id) localStorage.setItem(ACCOUNT_OWNER_KEY, state.user.id);
  if (mergedLocalStats && state.session) { state.watchStatsSyncPending = true; scheduleProfileWatchStatsSync(); }
  if ((migratedKidsPin || cleanedEmptyPin) && state.session) void saveAccount();
}
function migrateLegacyProgress() { const prefix = `seven-progress-${activeProfileId()}-`; Object.keys(localStorage).filter(key => key.startsWith("cineva-progress-")).forEach(key => { const next = key.replace("cineva-progress-", prefix); if (!localStorage.getItem(next)) localStorage.setItem(next, localStorage.getItem(key)); }); }
function parentAccessConfigured() { return Boolean(state.account?.parentAccessEnabled || state.account?.parentPinHash); }
async function refreshParentAccessStatus() { if (!state.session || !state.account) return; try { const data = await localAPI("/api/account/parent-access", { headers:authorizedHeaders() }); if (data.enabled) { const hadLegacyHash = Boolean(state.account.parentPinHash); state.account.parentAccessEnabled = true; delete state.account.parentPinHash; if (hadLegacyHash) await saveAccount(); } else if (!state.account.parentPinHash) state.account.parentAccessEnabled = false; localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account)); } catch { /* Keep a legacy local verifier available until the user migrates it. */ } }
async function saveAccount(remote = true) { persistLocalAccount(); if (!remote || !state.session) return; const account = JSON.parse(JSON.stringify(state.account)); if (account.parentAccessEnabled) delete account.parentPinHash; try { const user = await localAPI("/api/account/settings", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ account }) }); state.user = user; } catch { /* Local account preferences remain available if sync is offline. */ } }
function readStoredSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function sessionStartedAt(session) { const saved = Number(session?.seven_started_at); if (saved) return saved; const expiresAt = Number(session?.expires_at), expiresIn = Number(session?.expires_in); return expiresAt && expiresIn ? expiresAt * 1000 - expiresIn * 1000 : Date.now(); }
function flushWatchTypeChange() { void flushWatchTime(); playbackWatch.sample = null; if (playbackWatch.buffered < 0.5) { clearTimeout(playbackWatch.timer); playbackWatch.buffered = 0; playbackWatch.bufferType = null; playbackWatch.accessToken = null; playbackWatch.timer = null; } }
function persistSession(session, startedAt = sessionStartedAt(session)) {
  const stored = readStoredSession(), sameUser = !stored?.user?.id || !session?.user?.id || stored.user.id === session.user.id;
  const owner = localStorage.getItem(ACCOUNT_OWNER_KEY), incomingUser = session?.user?.id;
  if (owner && incomingUser && owner !== incomingUser) {
    void flushProfileWatchStats();
    clearTimeout(state.watchStatsSyncTimer); state.watchStatsSyncTimer = null; state.watchStatsSyncPending = false;
    Object.keys(localStorage).filter(key => key.startsWith("seven-progress-") || key.startsWith("cineva-progress-")).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(MY_LIST_KEY);
    clearWatchlistCache(owner);
    state.accountProgress = [];
    state.myList = [];
    state.watchlist = [];
    state.watchlistOwnerId = null;
    state.watchlistProfileId = null;
    state.watchlistLoaded = false;
    state.watchlistLoadSequence++;
    state.watchlistLoading = false;
    state.watchlistPending.clear();
  }
  if (sameUser && stored?.refresh_token && Number(stored.expires_at || 0) > Number(session?.expires_at || 0)) { session = stored; startedAt = sessionStartedAt(stored); }
  if (!state.session && session?.access_token) flushWatchTypeChange();
  state.session = { ...session, seven_started_at:startedAt };
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  reportAccountVisit();
}
function clearSession() {
  void flushProfileWatchStats();
  flushWatchTypeChange();
  clearTimeout(sessionRefreshTimer);
  clearTimeout(state.progressTimer);
  state.pendingProgress = null;
  state.accountProgress = [];
  state.myList = [];
  if (state.watchlistOwnerId) clearWatchlistCache(state.watchlistOwnerId);
  state.watchlist = [];
  state.watchlistOwnerId = null;
  state.watchlistProfileId = null;
  state.watchlistLoaded = false;
  state.watchlistLoading = false;
  state.watchlistLoadSequence++;
  state.watchlistError = null;
  state.watchlistPending.clear();
  Object.keys(localStorage).filter(key => key.startsWith("seven-progress-") || key.startsWith("cineva-progress-")).forEach(key => localStorage.removeItem(key));
  localStorage.removeItem(MY_LIST_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("seven.parent-access");
  state.session = null;
  state.user = null;
  state.account = defaultAccount();
}
function signOut() { clearSession(); state.profileDraft = null; state.profileEditorIsNew = null; state.profileSettingsCategory = null; state.profileSettingsReturn = null; state.accountReturn = null; state.route = "home"; render(); }
function accessTokenExpiresSoon(session = state.session) { return !session?.access_token || !session.expires_at || Number(session.expires_at) * 1000 - Date.now() < 90 * 1000; }
function scheduleSessionRefresh() { clearTimeout(sessionRefreshTimer); if (!state.session?.refresh_token) return; const delay = Math.max(30_000, Math.min(45 * 60 * 1000, Number(state.session.expires_at || 0) * 1000 - Date.now() - 90_000)); sessionRefreshTimer = setTimeout(async () => { try { await refreshSession(); } catch (error) { if ([400, 401, 403].includes(error.status)) clearSession(); } scheduleSessionRefresh(); }, delay); }
async function withSessionRefreshLock(callback) {
  if (navigator.locks?.request) return navigator.locks.request(SESSION_REFRESH_LOCK, { mode:"exclusive" }, callback);
  return callback();
}
async function refreshSession() {
  if (sessionRefreshPromise) return sessionRefreshPromise;
  const observedRefreshToken = state.session?.refresh_token;
  sessionRefreshPromise = withSessionRefreshLock(async () => {
    const stored = readStoredSession(), storedIsNewer = stored?.refresh_token && Number(stored.expires_at || 0) > Number(state.session?.expires_at || 0);
    if (storedIsNewer) { state.session = stored; state.user = stored.user || state.user; }
    if (!state.session?.refresh_token) throw new Error("Your session has expired.");
    // Another tab may have rotated the one-use refresh token while this tab waited for the lock.
    if (observedRefreshToken && state.session.refresh_token !== observedRefreshToken && !accessTokenExpiresSoon()) return state.session;
    const startedAt = sessionStartedAt(state.session), data = await localAPI("/api/auth/refresh", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ refresh_token:state.session.refresh_token }) });
    if (!data.session?.access_token) throw new Error("Could not refresh your session.");
    persistSession(data.session, startedAt);
    state.user = data.user || data.session.user || state.user;
    return state.session;
  }).finally(() => { sessionRefreshPromise = null; });
  return sessionRefreshPromise;
}
function refreshSessionIfNeeded() {
  if (!state.session?.refresh_token || !accessTokenExpiresSoon()) return;
  void refreshSession().then(scheduleSessionRefresh).catch(error => { if ([400, 401, 403].includes(error.status)) clearSession(); else scheduleSessionRefresh(); });
}
window.addEventListener("storage", event => {
  if (event.key !== SESSION_KEY || !event.newValue) return;
  let incoming; try { incoming = JSON.parse(event.newValue); } catch { return; }
  const sameUser = !state.session?.user?.id || !incoming?.user?.id || state.session.user.id === incoming.user.id;
  if (incoming?.access_token && sameUser && Number(incoming.expires_at || 0) > Number(state.session?.expires_at || 0)) {
    state.session = incoming;
    state.user = incoming.user || state.user;
    scheduleSessionRefresh();
  }
});
async function restoreSession() { let stored; try { stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch {} if (!stored?.access_token) { hydrateAccount(); hydrateMyList(); hydrateWatchlist(); return; } persistSession(stored, sessionStartedAt(stored)); try { if (accessTokenExpiresSoon()) await refreshSession(); state.user = await localAPI("/api/auth/user", { headers:authorizedHeaders() }); } catch (error) { try { await refreshSession(); state.user = await localAPI("/api/auth/user", { headers:authorizedHeaders() }); } catch (refreshError) { if ([400, 401, 403].includes(refreshError.status) || [401, 403].includes(error.status)) clearSession(); else state.user = state.session?.user || null; } } hydrateAccount(); await refreshParentAccessStatus(); hydrateMyList(); hydrateWatchlist(); if (state.session) { await Promise.allSettled([loadCloudProgress(), loadMyList(), loadAccountWatchlist()]); migrateLegacyProgress(); scheduleSessionRefresh(); } }
function accountProgressRecord(row) { const duration = Number(row.duration_seconds) || 0, currentTime = Number(row.progress_seconds) || 0; return { key:row.content_key, currentTime, duration, progress:duration > 0 ? Math.min(100, currentTime / duration * 100) : 0, watched:Boolean(row.is_watched), type:row.content_type, id:Number(row.tmdb_id), season:Number(row.season) || null, episode:Number(row.episode) || null, title:row.title || "Untitled", posterPath:row.poster_path || null, lastWatchedAt:row.last_watched_at || new Date().toISOString() }; }
function upsertAccountProgress(row) { if (!state.session || !row.content_key) return; const record = accountProgressRecord(row); state.accountProgress = [record, ...state.accountProgress.filter(item => item.key !== record.key)].sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0)); }
async function loadCloudProgress() { const rows = await localAPI("/api/account/progress", { headers:authorizedHeaders() }); state.accountProgress = (Array.isArray(rows) ? rows : []).map(accountProgressRecord).filter(row => row.key && row.type && row.id); state.accountProgress.forEach(row => localStorage.setItem(row.key, JSON.stringify(row))); }
function listKey(item) { return `${item.profileId}:${item.type}:${item.id}`; }
function listRecord(row) { return { profileId:row.profileId || row.profile_id || "main", type:row.type || row.content_type, id:Number(row.id || row.tmdb_id), title:row.title || "Untitled", poster_path:row.poster_path || row.posterPath || null, backdrop_path:row.backdrop_path || row.backdropPath || null, release_date:row.release_date || row.releaseDate || null, vote_average:Number(row.vote_average || row.voteAverage) || 0, addedAt:row.addedAt || row.added_at || new Date().toISOString() }; }
function hydrateMyList() { const owner = localStorage.getItem(ACCOUNT_OWNER_KEY); if (owner && (!state.user?.id || owner !== state.user.id)) { state.myList = []; return; } try { state.myList = JSON.parse(localStorage.getItem(MY_LIST_KEY) || "[]").map(listRecord).filter(item => item.type && item.id); } catch { state.myList = []; } }
function persistMyList() { localStorage.setItem(MY_LIST_KEY, JSON.stringify(state.myList)); const owner = state.user?.id || state.session?.user?.id; if (owner) localStorage.setItem(ACCOUNT_OWNER_KEY, owner); }
function listItems() { return state.myList.filter(item => item.profileId === activeProfileId()).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)); }
function isInMyList(item) { return state.myList.some(entry => entry.profileId === activeProfileId() && entry.type === item.type && Number(entry.id) === Number(item.id)); }
async function loadMyList() { if (!state.session) return; const rows = await localAPI("/api/account/list", { headers:authorizedHeaders() }); const merged = new Map(state.myList.map(item => [listKey(item), item])); rows.map(listRecord).forEach(item => merged.set(listKey(item), item)); state.myList = [...merged.values()]; persistMyList(); }
function accountWatchlistUserId() { if (!state.session?.access_token || state.user?.is_anonymous || state.session?.user?.is_anonymous) return null; return state.session?.user?.id || state.user?.id || null; }
function watchlistStorageKey(userId = accountWatchlistUserId(), profileId = activeProfileId()) { return userId ? `${PROFILE_WATCHLIST_STORAGE_PREFIX}${userId}.${profileId}` : null; }
function clearWatchlistCache(userId, profileId = null) { if (!userId) return; const profilePrefix = `${PROFILE_WATCHLIST_STORAGE_PREFIX}${userId}.`; Object.keys(localStorage).filter(key => key === `${WATCHLIST_STORAGE_PREFIX}${userId}` || key.startsWith(profilePrefix) && (!profileId || key === watchlistStorageKey(userId, profileId))).forEach(key => localStorage.removeItem(key)); }
function watchlistKey(item) { return `${item.type}:${Number(item.id)}`; }
function watchlistRecord(row) { return { type:row.type || row.content_type, id:Number(row.id ?? row.tmdb_id), title:String(row.title || "Untitled"), poster_path:row.poster_path || row.posterPath || null, backdrop_path:row.backdrop_path || row.backdropPath || null, release_date:row.release_date || row.releaseDate || null, vote_average:Number(row.vote_average ?? row.voteAverage) || 0, addedAt:row.addedAt || row.added_at || new Date().toISOString() }; }
function hydrateWatchlist() { const ownerId = accountWatchlistUserId(), profileId = activeProfileId(); state.watchlistOwnerId = ownerId; state.watchlistProfileId = ownerId ? profileId : null; state.watchlistLoaded = false; state.watchlistError = null; state.watchlistLoadSequence++; if (!ownerId) { state.watchlist = []; return; } try { const cached = JSON.parse(localStorage.getItem(watchlistStorageKey(ownerId, profileId)) || "[]"); state.watchlist = Array.isArray(cached) ? cached.map(watchlistRecord).filter(item => ["movie", "tv"].includes(item.type) && Number.isSafeInteger(item.id) && item.id > 0) : []; } catch { state.watchlist = []; } }
function persistWatchlist() { const ownerId = accountWatchlistUserId(), profileId = activeProfileId(); if (!ownerId || state.watchlistOwnerId !== ownerId || state.watchlistProfileId !== profileId) return; localStorage.setItem(watchlistStorageKey(ownerId, profileId), JSON.stringify(state.watchlist)); }
function isInWatchlist(item) { return state.watchlistOwnerId === accountWatchlistUserId() && state.watchlistProfileId === activeProfileId() && state.watchlist.some(entry => entry.type === item.type && Number(entry.id) === Number(item.id)); }
function watchlistAction(item, variant = "detail") { const type = item.type || contentType(item), id = Number(item.id), key = watchlistKey({ type, id }), saved = isInWatchlist({ type, id }), pending = state.watchlistPending.has(`${accountWatchlistUserId()}:${activeProfileId()}:${key}`); state.watchlistTargets.set(key, item); return variant === "card" ? `<button type="button" class="card-watchlist ${saved ? "saved" : ""}" data-toggle-watchlist="${escapeHTML(key)}" aria-label="${saved ? "Remove" : "Add"} ${escapeHTML(titleOf(item))} ${saved ? "from" : "to"} Watchlist" aria-pressed="${saved}" title="${saved ? "Remove from" : "Add to"} Watchlist" ${pending ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12v17l-6-3.8-6 3.8z"/></svg></button>` : `<button type="button" class="secondary watchlist-action ${saved ? "saved" : ""}" data-toggle-watchlist="${escapeHTML(key)}" aria-label="${saved ? "Remove from" : "Add to"} Watchlist" title="${saved ? "Remove from" : "Add to"} Watchlist" aria-pressed="${saved}" ${pending ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12v17l-6-3.8-6 3.8z"/></svg><span>${pending ? "Saving" : saved ? "Saved" : "Watchlist"}</span></button>`; }
async function loadAccountWatchlist(refreshView = false) {
  const ownerId = accountWatchlistUserId(), profileId = activeProfileId(); if (!ownerId) { state.watchlist = []; state.watchlistOwnerId = null; state.watchlistProfileId = null; state.watchlistLoaded = true; return; }
  if (state.watchlistOwnerId !== ownerId || state.watchlistProfileId !== profileId) hydrateWatchlist();
  const sequence = ++state.watchlistLoadSequence, mutationVersion = state.watchlistMutationVersion;
  state.watchlistLoading = true; state.watchlistError = null;
  if (refreshView && state.route === "watchlist") render();
  try {
    const rows = await localAPI(`/api/account/watchlist?profile=${encodeURIComponent(profileId)}`, { headers:authorizedHeaders() });
    if (accountWatchlistUserId() !== ownerId || activeProfileId() !== profileId || sequence !== state.watchlistLoadSequence) return;
    if (!Array.isArray(rows)) throw new Error("The Watchlist response was invalid.");
    if (mutationVersion !== state.watchlistMutationVersion) { state.watchlistLoaded = true; return; }
    state.watchlist = rows.map(watchlistRecord).filter(item => ["movie", "tv"].includes(item.type) && Number.isSafeInteger(item.id) && item.id > 0);
    state.watchlistLoaded = true; persistWatchlist(); localStorage.removeItem(`${WATCHLIST_STORAGE_PREFIX}${ownerId}`);
  } catch (error) {
    if (accountWatchlistUserId() !== ownerId || activeProfileId() !== profileId || sequence !== state.watchlistLoadSequence) return;
    state.watchlistLoaded = true; state.watchlistError = error.message || "Watchlist could not be synced.";
  } finally {
    if (accountWatchlistUserId() === ownerId && activeProfileId() === profileId && sequence === state.watchlistLoadSequence) { state.watchlistLoading = false; if (refreshView && state.route === "watchlist") render(); }
  }
}
function watchlistToast(message) { document.querySelector(".watchlist-toast")?.remove(); app.insertAdjacentHTML("beforeend", `<div class="watchlist-toast" role="status" aria-live="polite">${escapeHTML(message)}</div>`); setTimeout(() => document.querySelector(".watchlist-toast")?.remove(), 3600); }
async function toggleWatchlist(item) {
  const ownerId = accountWatchlistUserId();
  if (!ownerId) { showAuth("login", "Sign in to save titles to your profile’s Watchlist."); return; }
  const profileId = activeProfileId();
  if (state.watchlistOwnerId !== ownerId || state.watchlistProfileId !== profileId) hydrateWatchlist();
  const type = item.type || contentType(item), id = Number(item.id), key = watchlistKey({ type, id });
  const pendingKey = `${ownerId}:${profileId}:${key}`;
  if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id < 1 || state.watchlistPending.has(pendingKey)) return;
  const before = state.watchlist.map(watchlistRecord), existing = state.watchlist.some(entry => watchlistKey(entry) === key), reconcileAfter = state.watchlistLoading;
  let failureMessage = "";
  state.watchlistPending.add(pendingKey);
  state.watchlistLoaded = true; state.watchlistMutationVersion++;
  if (existing) state.watchlist = state.watchlist.filter(entry => watchlistKey(entry) !== key);
  else state.watchlist = [watchlistRecord({ type, id, title:titleOf(item), poster_path:item.poster_path || item.posterPath, backdrop_path:item.backdrop_path || item.backdropPath, release_date:item.release_date || item.first_air_date || item.releaseDate, vote_average:item.vote_average, addedAt:new Date().toISOString() }), ...state.watchlist];
  persistWatchlist(); render();
  try {
    const request = existing
      ? localAPI(`/api/account/watchlist?profile=${encodeURIComponent(profileId)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, { method:"DELETE", headers:authorizedHeaders() })
      : localAPI("/api/account/watchlist", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ profile_id:profileId, content_type:type, tmdb_id:id, title:titleOf(item), poster_path:item.poster_path || item.posterPath || null, backdrop_path:item.backdrop_path || item.backdropPath || null, release_date:item.release_date || item.first_air_date || item.releaseDate || null, vote_average:item.vote_average ?? null }) });
    await request;
    if (accountWatchlistUserId() === ownerId && activeProfileId() === profileId) state.watchlistError = null;
  } catch (error) {
    if (accountWatchlistUserId() === ownerId && activeProfileId() === profileId) { state.watchlist = before; persistWatchlist(); failureMessage = error.message || "Could not update your Watchlist. Try again."; }
  } finally {
    state.watchlistPending.delete(pendingKey);
    if (state.route === "watchlist") state.watchlistLoaded = true;
    render();
    if (failureMessage) watchlistToast(failureMessage);
    if (reconcileAfter && accountWatchlistUserId() === ownerId && activeProfileId() === profileId) void loadAccountWatchlist(true);
  }
}
function episodeAlertKey(item) { return `${item.id}:${item.episode?.season_number || 0}:${item.episode?.episode_number || 0}`; }
function alertStorageKey() { return `seven.new-episode-alerts.${activeProfileId()}`; }
async function requestEpisodeAlerts() { if (!("Notification" in window)) return false; return Notification.permission === "granted" || (Notification.permission === "default" && await Notification.requestPermission() === "granted"); }
function notifyNewEpisodes() { if (currentPreferences().episodeAlerts !== true || !("Notification" in window) || Notification.permission !== "granted") return; const seen = new Set(JSON.parse(localStorage.getItem(alertStorageKey()) || "[]")), fresh = state.newEpisodes.filter(item => !seen.has(episodeAlertKey(item))); if (!fresh.length) return; fresh.slice(0, 3).forEach(item => new Notification("New episode on SEVEN", { body:`${titleOf(item)} · S${item.episode.season_number} E${item.episode.episode_number}`, icon:posterOf(item) })); fresh.forEach(item => seen.add(episodeAlertKey(item))); localStorage.setItem(alertStorageKey(), JSON.stringify([...seen].slice(-100))); }
async function loadNewEpisodes(airing = state.catalog["New series"] || []) { const savedIds = new Set(listItems().filter(item => item.type === "tv").map(item => Number(item.id))), candidates = airing.filter(item => savedIds.has(Number(item.id))).slice(0, 8); if (!candidates.length) { state.newEpisodes = []; return; } try { const shows = await Promise.all(candidates.map(item => api(`tv/${item.id}`))), today = new Date(); state.newEpisodes = shows.map(show => normalize(show, "tv")).map(show => ({ ...show, episode:show.last_episode_to_air })).filter(show => show.episode?.air_date && new Date(show.episode.air_date) <= today && !isWatched({ type:"tv", id:show.id, season:show.episode.season_number, episode:show.episode.episode_number })); notifyNewEpisodes(); } catch { state.newEpisodes = []; } }
async function toggleMyList(item) { const inList = isInMyList(item), key = listKey({ profileId:activeProfileId(), type:item.type, id:item.id }); if (inList) { state.myList = state.myList.filter(entry => listKey(entry) !== key); persistMyList(); if (state.session) try { await localAPI(`/api/account/list?profile=${encodeURIComponent(activeProfileId())}&type=${encodeURIComponent(item.type)}&id=${encodeURIComponent(item.id)}`, { method:"DELETE", headers:authorizedHeaders() }); } catch {} } else { const entry = listRecord({ profileId:activeProfileId(), type:item.type, id:item.id, title:titleOf(item), poster_path:item.poster_path, backdrop_path:item.backdrop_path, release_date:item.release_date || item.first_air_date, vote_average:item.vote_average, addedAt:new Date().toISOString() }); state.myList = [entry, ...state.myList]; persistMyList(); if (state.session) try { await localAPI("/api/account/list", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ profile_id:entry.profileId, content_type:entry.type, tmdb_id:entry.id, title:entry.title, poster_path:entry.poster_path, backdrop_path:entry.backdrop_path, release_date:entry.release_date, vote_average:entry.vote_average }) }); } catch {} } if (item.type === "tv") void loadNewEpisodes(); render(); }

async function api(path, params = {}) {
  const query = new URLSearchParams(params); if (!query.has("language")) query.set("language", DISPLAY_LANGUAGES[currentPreferences().language] || DISPLAY_LANGUAGES.English); const response = await fetch(`/api/tmdb/${path}?${query}`);
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "TMDB is not configured");
  return response.json();
}
function useFamilyCatalog() { return currentProfile()?.kids || currentPreferences().familySafe === true; }
async function refreshCatalogForLanguage() {
  state.catalogRequest ||= (profile => refreshCatalogNow().then(() => { state.catalogKey = profile; }))(activeProfileId());
  try { await state.catalogRequest; } finally { state.catalogRequest = null; }
}
async function refreshCatalogNow() {
  if (useFamilyCatalog()) {
    const year = new Date().getFullYear(), certification = currentProfile()?.kids ? "PG" : "PG-13", movieParams = { certification_country:"US", "certification.lte":certification, with_genres:"16|10751", sort_by:"popularity.desc" }, showParams = { with_genres:"16|10751", sort_by:"popularity.desc" };
    const [movies, shows, recent, airing, upcoming, greatMovies, greatShows, adventureMovies, actionShows, trendingData] = await Promise.all([
      api("discover/movie", movieParams), api("discover/tv", showParams),
      api("discover/movie", { ...movieParams, "primary_release_date.gte":`${year - 1}-01-01`, sort_by:"primary_release_date.desc" }),
      api("discover/tv", { ...showParams, "first_air_date.gte":`${year - 1}-01-01`, sort_by:"first_air_date.desc" }),
      api("discover/movie", { ...movieParams, "primary_release_date.gte":new Date().toISOString().slice(0, 10), sort_by:"primary_release_date.asc" }),
      api("discover/movie", { ...movieParams, sort_by:"vote_average.desc", "vote_count.gte":80 }),
      api("discover/tv", { ...showParams, sort_by:"vote_average.desc", "vote_count.gte":80 }),
      api("discover/movie", { certification_country:"US", "certification.lte":certification, with_genres:"12", sort_by:"popularity.desc" }),
      api("discover/tv", { with_genres:"10759", sort_by:"popularity.desc" }),
      api("trending/all/week")
    ]);
    const movieList = results(movies), showList = results(shows), recentList = results(recent), airingList = results(airing), trending = results(trendingData);
    state.featuredPool = shuffle([...recentList, ...airingList, ...movieList]).filter(item => item.backdrop_path).slice(0, 12);
    state.featured = state.featuredPool[0] || trending[0] || { id:FEATURED_ID, type:"tv", name:"SEVEN Kids", overview:"Family-friendly movies and series selected for this profile.", backdrop_path:null };
    state.featuredIndex = 0;
    state.catalog = { "Trending now":trending, "New movies":recentList, "New series":airingList, "Popular movies":movieList, "Popular series":showList, "Coming soon":results(upcoming), "All-time greats":shuffle([...results(greatMovies), ...results(greatShows)]), "Action & adventure":shuffle([...results(adventureMovies), ...results(actionShows)]) };
    await loadNewEpisodes(state.catalog["New series"]);
    return;
  }
  const [featured, trending, movies, shows, recent, airing, upcoming, topMovies, topShows, actionMovies, actionShows] = await Promise.all([
    api(`tv/${FEATURED_ID}`), api("trending/all/week"), api("movie/popular"), api("tv/popular"), api("movie/now_playing"), api("tv/on_the_air"),
    api("movie/upcoming"), api("movie/top_rated"), api("tv/top_rated"),
    api("discover/movie", { with_genres:"28", sort_by:"popularity.desc" }), api("discover/tv", { with_genres:"10759", sort_by:"popularity.desc" })
  ]);
  const month = new Date().getMonth(), year = new Date().getFullYear();
  let seasonalName = "", seasonalParams = null;
  if (month === 8 || month === 9) { seasonalName = "Spooky picks"; seasonalParams = { with_genres:"27", sort_by:"popularity.desc" }; }
  else if (month === 11) { seasonalName = "Holiday favorites"; seasonalParams = { with_keywords:"1563", sort_by:"popularity.desc" }; }
  else if (month === 1) { seasonalName = "Date night picks"; seasonalParams = { with_genres:"10749", sort_by:"popularity.desc" }; }
  else if (month >= 5 && month <= 7) { seasonalName = "Summer blockbusters"; seasonalParams = { with_genres:"28", "primary_release_date.gte":`${year}-06-01`, "primary_release_date.lte":`${year}-08-31`, sort_by:"popularity.desc" }; }
  const seasonalData = seasonalParams ? await api("discover/movie", seasonalParams).catch(() => null) : null;
  state.featuredPool = shuffle([...results(recent), ...results(airing), ...results(trending)]).filter(item => item.backdrop_path).slice(0, 12);
  state.featured = state.featuredPool[0] || normalize(featured, "tv");
  state.featuredIndex = 0;
  state.catalog = { "Trending now": results(trending), "New movies": results(recent), "New series": results(airing), "Popular movies": results(movies), "Popular series": results(shows), "Coming soon": results(upcoming), "All-time greats": shuffle([...results(topMovies), ...results(topShows)]), "Action & adventure": shuffle([...results(actionMovies), ...results(actionShows)]), ...(seasonalName && seasonalData ? { [seasonalName]: results(seasonalData) } : {}) };
  await loadNewEpisodes(state.catalog["New series"]);
}
function playMovieNow(movie, resume = false) { const key = { type:"movie", id:movie.id }; state.player = { ...key, title:titleOf(movie), overview:movie.overview, posterPath:movie.poster_path, genreIds:(movie.genres || []).map(genre => genre.id), startAt:resume ? savedStart(key) : 0 }; state.route = "player"; render(); scrollToTop(); }
async function boot() {
  renderLoading();
  const verifiedEmail = await consumeEmailVerificationRedirect();
  await restoreSession();
  applyLocale();
  const params = new URLSearchParams(location.search);
  state.pendingWatch = params.get("watch") || null;
  const deep = (params.get("title") || "").match(/^(movie|tv):(\d+)(?::(\d+):(\d+))?$/);
  if (state.pendingWatch && deep) {
    if (deep[1] === "movie") { await openItem("movie", Number(deep[2])); if (state.movie) playMovieNow(state.movie); return; }
    await openItem("tv", Number(deep[2]));
    if (state.series) { state.selectedSeason = Number(deep[3]) || 1; playEpisode(Number(deep[4]) || 1, false); }
    return;
  }
  if (deep) { await openItem(deep[1], Number(deep[2])); return; }
  if (!navigator.onLine) return renderOfflineScreen();
  if (state.user) { state.route = needsFirstRunOnboarding() ? "onboarding" : "profiles"; if (state.route === "onboarding") beginOnboarding(); render(); } else renderLoading();
  await loadStartupData();
  if (verifiedEmail) await finishEmailVerification(verifiedEmail);
  else {
    const pendingVerification = readPendingEmailVerification();
    if (pendingVerification) showAuthPending(pendingVerification.email);
  }
}
async function loadStartupData() {
  if (!navigator.onLine) return renderOfflineScreen();
  try {
    await refreshCatalogForLanguage();
    state.error = null;
  } catch (error) {
    const status = error.status || 0, message = String(error.message || "");
    if (!navigator.onLine || [502, 503, 504].includes(status) || /failed to fetch|network/i.test(message)) return renderOfflineScreen();
    state.featured = { id: FEATURED_ID, type: "tv", name: "The Good Doctor", overview: "Add a TMDB Read Access Token to enable posters, descriptions, categories, and search.", backdrop_path: null };
    state.catalog = {};
    state.error = error.message;
  }
  if (!state.user || state.route !== "profiles") render();
}
function renderOfflineScreen() {
  app.innerHTML = `<main class="offline-screen"><img class="offline-logo" src="assets/seven-wordmark-v2.png" alt="SEVEN"><span class="brand">${t("NO CONNECTION")}</span><h1>${t("You're offline")}</h1><p>${t("SEVEN needs an internet connection to load titles and your profiles. Check your network and try again.")}</p><button class="offline-retry" data-retry-connection>${t("Try again")}</button></main>`;
  document.querySelector("[data-retry-connection]").onclick = retryConnection;
}
async function retryConnection() {
  renderLoading();
  if (state.user) { state.route = "profiles"; render(); }
  await loadStartupData();
}
function shuffle(items) { const copy = [...items]; for (let index = copy.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [copy[index], copy[target]] = [copy[target], copy[index]]; } return copy; }
function sharedTitleTarget() { const value = new URLSearchParams(window.location.search).get("title") || "", match = value.match(/^(movie|tv):(\d+)$/); return match ? { type:match[1], id:Number(match[2]) } : null; }
function profileMaturity() { return currentProfile()?.kids ? "Kids" : currentPreferences().maturity; }
function contentType(item) { return item.type || (item.media_type === "tv" || item.name || item.original_name ? "tv" : "movie"); }
function restrictedTitles(profile = currentProfile()) { return Array.isArray(profile?.restrictedTitles) ? profile.restrictedTitles.filter(item => item?.id && item?.type) : []; }
function contentGenreIds(item) { return item.genre_ids || (item.genres || []).map(genre => genre.id); }
function contentAllowed(item, { directSearch = false } = {}) { const profile = currentProfile(), preferences = currentPreferences(), maturity = profileMaturity(), type = contentType(item), genres = contentGenreIds(item), has = id => genres.includes(id), restricted = restrictedTitles(profile).some(entry => entry.type === type && Number(entry.id) === Number(item.id)), familySafe = profile?.kids || preferences.familySafe; if (restricted || (!directSearch && isHiddenTitle(item))) return false; if (preferences.moviesEnabled === false && type === "movie") return false; if (preferences.seriesEnabled === false && type === "tv") return false; if (item.adult && maturity !== "18+") return false; if (!directSearch && familySafe && [27, 53, 80, 9648, 10752].some(has)) return false; if (!directSearch && preferences.blockScary && [27, 53, 9648].some(has)) return false; if (maturity === "Kids") return ![27, 53, 80, 9648, 10752].some(has); if (maturity === "13+") return ![27, 53].some(has); return true; }
function results(payload, options) { return (payload.results || []).filter(item => item.media_type !== "person" && contentAllowed(item, options)).map(item => normalize(item)); }
function normalize(item, fallbackType) { return { ...item, type: item.type || (item.media_type === "movie" || item.title ? "movie" : fallbackType || "tv") }; }
function header() {
  const profile = currentProfile() || defaultAccount().profiles[0];
  const activeNav = state.route === "home" ? "home" : state.route === "for-you" ? "for-you" : state.route === "catalog" ? (state.browse?.type === "tv" ? "shows" : "movies") : state.route === "series" ? "shows" : state.route === "movie" ? "movies" : "";
  const account = state.user ? `<button class="account signed-in" data-account title="Account">${profileAvatar(profile)}<i class="account-caret" aria-hidden="true">▾</i></button>` : `<button class="account account-guest" data-auth aria-label="Guest profile. Sign in or create an account" title="Guest profile"><svg class="account-guest-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 20c.65-3.55 2.82-5.4 6.5-5.4s5.85 1.85 6.5 5.4"/></svg></button>`;
  const search = currentPreferences().searchEnabled !== false ? `<div class="search" role="search"><span>⌕</span><input id="search" value="${escapeHTML(state.search)}" placeholder="${t("Titles, movies, series")}" autocomplete="off" enterkeyhint="search" aria-label="Search titles"><div class="search-suggestions" hidden></div></div><button class="msearch-open" data-msearch aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>` : "";
  const homeLink = `<button class="nav-link ${activeNav === "home" ? "active" : ""}" data-home><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/></svg><span>${t("Home")}</span></button>`;
  const forYouLink = `<button class="nav-link ${activeNav === "for-you" ? "active" : ""}" data-for-you><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></svg><span>${t("For You")}</span></button>`;
  const moviesLink = `<button class="nav-link ${activeNav === "movies" ? "active" : ""}" data-movies><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v15H4Z M4 9h16 M8 5l3 4m2-4 3 4M8 20l3-4m2 4 3-4"/></svg><span>${t("Movies")}</span></button>`;
  const seriesLink = `<button class="nav-link ${activeNav === "shows" ? "active" : ""}" data-shows><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 2 5m11-3 3 3m-7 4 4 3-4 3Z"/></svg><span>${t("Series")}</span></button>`;
  const navigation = `<nav aria-label="Main navigation">${homeLink}${forYouLink}${moviesLink}${seriesLink}</nav>`;
  const browseActive = ["catalog", "all-catalog", "movie", "series"].includes(state.route);
  const mobileNavigation = `<nav class="app-mobile-nav" aria-label="Mobile main navigation">${homeLink}${forYouLink}<button class="nav-link ${browseActive ? "active" : ""}" data-mobile-browse><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v15H4Z M4 9h16 M8 5l3 4m2-4 3 4"/></svg><span>${t("Browse")}</span></button></nav>`;
  return `<header class="main-header app-header"><button class="wordmark logo-only" data-home aria-label="SEVEN home"><img src="assets/seven-wordmark-v2.png" alt="SEVEN"></button>${navigation}${search}${account}</header>${mobileNavigation}`;
}
function footer() { return `<footer class="site-footer"><div class="footer-shell"><div class="footer-main"><div class="footer-brand"><button class="footer-wordmark" data-home aria-label="SEVEN home">SEVEN</button><span>${t("Stories worth finding.")}</span></div><nav class="footer-links" aria-label="Footer navigation"><button data-home>${t("Home")}</button><button data-for-you>${t("For You")}</button><button data-movies>${t("Movies")}</button><button data-shows>${t("Series")}</button><button data-favourites>${t("Favourites")}</button><button data-watchlist>${t("Watchlist")}</button></nav><a class="footer-top" href="#app" aria-label="${t("Back to top")}"><span aria-hidden="true">↑</span></a></div><div class="footer-bottom"><small class="footer-disclaimer">Title details, artwork, and trailers are powered by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>. SEVEN uses the TMDB API but is not endorsed or certified by TMDB. TMDB provides metadata only, not playback rights.</small><span class="footer-copyright">© 2026 SEVEN. All rights reserved.</span></div></div></footer>`; }
function render() { state.watchlistTargets = new Map(); if (state.route !== "player") stopPlayerProgressPolling(); if (state.route !== "player" && party.code && !party.following && !state.pendingWatch) partyLeave(); if (state.route !== "msearch" && !document.querySelector(".seven-intro") && document.documentElement.style.overflow === "hidden") document.documentElement.style.overflow = ""; if (state.route === "onboarding" && state.user) return renderOnboarding(); if (state.route === "profiles" && state.user) return renderProfileGate(); if (state.route === "account" && state.user && currentProfile()) { state.profileDraft = { ...currentProfile() }; state.profileEditorIsNew = false; state.profileSettingsCategory = null; state.profileSettingsReturn = state.accountReturn || "home"; state.route = "profile-settings"; return renderProfileSettings(); } if (state.route === "account" && state.user) return renderAccount(); if (state.route === "profile-settings" && state.user) return renderProfileSettings(); if (state.route === "my-list") return renderMyList(); if (state.route === "watchlist") return renderWatchlist(); if (state.route === "hidden" && state.user) return renderHiddenTitles(); if (state.route === "liked" && state.user) return renderLikedTitles(); if (state.route === "stats" && state.user) return renderProfileStats(); if (state.route === "player") return renderPlayer(); if (state.route === "movie") return renderMovie(); if (state.route === "series") return renderSeries(); if (state.route === "person") return renderPerson(); if (state.route === "search") return renderSearch(); if (state.route === "for-you") return renderForYou(); if (state.route === "catalog") return renderCatalog(); if (state.route === "all-catalog") return renderAllCatalog(); if (state.route === "explore") return renderExplore(); if (state.route === "history") return renderHistory(); if (state.route === "trailers") return renderTrailers(); if (state.route === "msearch") return renderMSearch(); renderHome(); }
async function profileSecret(value) { if (!globalThis.crypto?.subtle) throw new Error("Profile locks need a modern browser."); const bytes = new TextEncoder().encode(value), hash = await globalThis.crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join(""); }
const PARENT_ACCESS_KEY = "seven.parent-access";
function hasParentAccess() { return !parentAccessConfigured(); }
function grantParentAccess() { sessionStorage.removeItem(PARENT_ACCESS_KEY); }
function showParentCodeSetup() {
  if (document.querySelector(".parent-setup")) return;
  app.insertAdjacentHTML("beforeend", `<div class="modal parent-setup"><form class="auth-card" id="parent-setup-form"><button class="modal-close" type="button" data-close>×</button><span class="brand">PARENT ACCESS</span><h2>Protect kids settings</h2><p>Set a parent access code. It unlocks account and profile settings only—it does not lock the profile picker.</p><label>Parent access code<input name="pin" required inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="4–8 digits"></label><label>Confirm code<input name="confirmPin" required inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="Repeat code"></label><p class="form-error" id="parent-setup-error"></p><button class="primary auth-submit" type="submit">Save parent code</button></form></div>`);
  document.querySelector(".parent-setup [data-close]").onclick = () => document.querySelector(".parent-setup")?.remove();
  document.querySelector("#parent-setup-form").onsubmit = async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget), pin = String(values.get("pin") || ""), confirmPin = String(values.get("confirmPin") || ""), error = document.querySelector("#parent-setup-error"), submit = event.currentTarget.querySelector("[type=submit]");
    try {
      if (pin !== confirmPin) throw new Error("Those codes do not match.");
      submit.disabled = true;
      await localAPI("/api/account/parent-access", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ newCode:pin }) });
      state.account.parentAccessEnabled = true;
      delete state.account.parentPinHash;
      grantParentAccess();
      await saveAccount();
      document.querySelector(".parent-setup")?.remove();
      const rows = document.querySelector(".screen-time-rows"), kidsEnabled = document.querySelector('[name="kids"]')?.checked === true;
      if (rows && kidsEnabled) { rows.classList.remove("row-disabled"); rows.querySelectorAll("input, select").forEach(field => { field.disabled = false; }); }
    } catch (failure) { error.textContent = failure.message; }
    finally { submit.disabled = false; }
  };
}
function showParentCodeChange() {
  if (!parentAccessConfigured()) return showParentCodeSetup();
  document.querySelector(".modal")?.remove();
  app.insertAdjacentHTML("beforeend", `<div class="modal parent-code-change"><form class="auth-card" id="parent-code-change-form"><button class="modal-close" type="button" data-close>×</button><span class="brand">PARENT ACCESS</span><h2>Change parent code</h2><p>Enter your current parent access code before choosing a new one.</p><label>Current code<input name="currentPin" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="4–8 digits"></label><label>New code<input name="pin" required inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="4–8 digits"></label><label>Confirm new code<input name="confirmPin" required inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="Repeat new code"></label><p class="form-error" id="parent-code-change-error"></p><button class="primary auth-submit" type="submit">Update parent code</button><button class="auth-switch danger-action" type="button" data-disable-parent-code>Turn off parent access code</button></form></div>`);
  const close = () => document.querySelector(".parent-code-change")?.remove();
  document.querySelector(".parent-code-change [data-close]").onclick = close;
  document.querySelector("#parent-code-change-form").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form), currentPin = String(values.get("currentPin") || ""), pin = String(values.get("pin") || ""), confirmPin = String(values.get("confirmPin") || ""), error = form.querySelector("#parent-code-change-error"), submit = form.querySelector("[type=submit]");
    error.textContent = "";
    try {
      if (state.account.parentPinHash ? await profileSecret(currentPin) !== state.account.parentPinHash : !(await localAPI("/api/account/parent-access", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ code:currentPin }) })).verified) throw new Error("That parent access code is not correct.");
      if (pin !== confirmPin) throw new Error("Those codes do not match.");
      if (pin === currentPin) throw new Error("Choose a code different from your current one.");
      submit.disabled = true;
      await localAPI("/api/account/parent-access", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ currentCode:state.account.parentPinHash ? null : currentPin, newCode:pin }) });
      state.account.parentAccessEnabled = true;
      delete state.account.parentPinHash;
      grantParentAccess();
      await saveAccount();
      close();
      renderProfileSettings();
    } catch (failure) { error.textContent = failure.message; } finally { submit.disabled = false; }
  };
  document.querySelector("[data-disable-parent-code]").onclick = async () => {
    const form = document.querySelector("#parent-code-change-form"), currentPin = String(new FormData(form).get("currentPin") || ""), error = form.querySelector("#parent-code-change-error");
    error.textContent = "";
    try {
      if (state.account.parentPinHash ? await profileSecret(currentPin) !== state.account.parentPinHash : !(await localAPI("/api/account/parent-access", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ code:currentPin }) })).verified) throw new Error("Enter your current parent access code to turn it off.");
      if (!confirm("Turn off the parent access code?")) return;
      if (!state.account.parentPinHash) await localAPI("/api/account/parent-access", { method:"DELETE", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ currentCode:currentPin }) });
      delete state.account.parentPinHash;
      state.account.parentAccessEnabled = false;
      sessionStorage.removeItem(PARENT_ACCESS_KEY);
      await saveAccount();
      close();
      renderProfileSettings();
    } catch (failure) { error.textContent = failure.message; }
  };
}
function showParentUnlock() {
  app.insertAdjacentHTML("beforeend", `<div class="modal profile-unlock parent-unlock"><form class="auth-card" id="parent-unlock-form"><button class="modal-close" type="button" data-close>×</button><span class="brand">PARENT ACCESS</span><h2>Enter parent code</h2><p>Account and profile settings are protected on this shared device.</p><label>Parent access code<input name="pin" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="4–8 digits"></label><p class="form-error" id="parent-pin-error"></p><button class="primary auth-submit" type="submit">Continue</button></form></div>`);
  document.querySelector(".parent-unlock [data-close]").onclick = () => document.querySelector(".parent-unlock")?.remove();
  document.querySelector("#parent-unlock-form").onsubmit = async event => {
    event.preventDefault();
    const pin = String(new FormData(event.currentTarget).get("pin") || ""), error = document.querySelector("#parent-pin-error"), submit = event.currentTarget.querySelector("[type=submit]");
    try {
      submit.disabled = true;
      if (state.account.parentPinHash) {
        if (await profileSecret(pin) !== state.account.parentPinHash) { error.textContent = "That parent code is not correct."; return; }
        await localAPI("/api/account/parent-access", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ newCode:pin }) });
        state.account.parentAccessEnabled = true;
        delete state.account.parentPinHash;
        await saveAccount();
      } else if (!(await localAPI("/api/account/parent-access", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ code:pin }) })).verified) { error.textContent = "That parent code is not correct."; return; }
      document.querySelector(".parent-unlock")?.remove();
      openAccount();
    } catch (failure) { error.textContent = failure.message; } finally { submit.disabled = false; }
  };
}
function exitProfileGate(then) {
  const gate = document.querySelector(".profile-gate");
  if (!gate || gate.classList.contains("profile-gate-exit")) { then(); return; }
  gate.classList.add("profile-gate-exit");
  setTimeout(then, 430);
}
async function activateProfile(id) {
  const catalogStale = state.catalogKey !== id;
  state.account.activeProfileId = id;
  hydrateWatchlist();
  void loadAccountWatchlist();
  void saveAccount();
  exitProfileGate(() => { state.route = "home"; scrollToTop(); render(); tickScreenTime(); });
  if (catalogStale) state.catalogRequest = null;
  try { await loadMyList(); await refreshCatalogForLanguage(); } catch {}
  if (state.route === "home") render();
}
function showProfileUnlock(profile) { app.insertAdjacentHTML("beforeend", `<div class="modal profile-unlock"><form class="auth-card" id="profile-unlock-form"><button class="modal-close" type="button" data-close>×</button><span class="brand">PROFILE LOCKED</span>${profileAvatar(profile)}<h2>${escapeHTML(profile.name)}</h2><p>Enter this profile’s PIN to keep watching.</p><label>Profile PIN<input name="pin" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="4–8 digits"></label><p class="form-error" id="profile-pin-error"></p><button class="primary auth-submit" type="submit">Continue</button></form></div>`); document.querySelector(".profile-unlock [data-close]").onclick = () => document.querySelector(".profile-unlock")?.remove(); document.querySelector("#profile-unlock-form").onsubmit = async event => { event.preventDefault(); const pin = new FormData(event.currentTarget).get("pin"), error = document.querySelector("#profile-pin-error"); try { if (await profileSecret(pin) !== profile.pinHash) { error.textContent = "That PIN is not correct."; return; } document.querySelector(".profile-unlock")?.remove(); activateProfile(profile.id); } catch (failure) { error.textContent = failure.message; } }; }
function renderProfileGate() { const account = state.account || defaultAccount(); app.innerHTML = `<main class="profile-gate"><button class="profile-gate-logo" data-home aria-label="SEVEN"><img src="assets/seven-wordmark-v2.png" alt="SEVEN"></button><section><span class="brand">${t("WHO’S WATCHING?")}</span><h1>${t("Choose a profile")}</h1><p>Your progress, Continue Watching row, and playback settings stay with this profile.</p><div class="profile-chooser">${account.profiles.map(profile => `<button class="profile-choice" data-watch-profile="${profile.id}">${profileAvatar(profile)}<b>${escapeHTML(profile.name)}</b><small>${t(profile.kids ? "Kids profile" : profile.pinHash ? "Locked" : "Standard profile")}</small></button>`).join("")}</div><button class="manage-profiles" data-manage-profiles>${t("Manage profiles")}</button></section></main>`; document.querySelectorAll("[data-watch-profile]").forEach(button => button.onclick = () => { const profile = account.profiles.find(item => item.id === button.dataset.watchProfile); if (profile?.pinHash && !profile.kids) showProfileUnlock(profile); else activateProfile(profile.id); }); document.querySelector("[data-manage-profiles]").onclick = showAccount; }
function renderLoading() { app.innerHTML = `<header><span class="wordmark logo-only"><img src="assets/seven-wordmark-v2.png" alt="SEVEN"></span></header><section class="hero skeleton"></section><section class="rail"><div class="skeleton-line wide"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section><section class="rail"><div class="skeleton-line"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section>`; }
function homeSkeleton() { return `<section class="rail"><div class="skeleton-line wide"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section><section class="rail"><div class="skeleton-line"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section>`; }
function renderHome() {
  clearInterval(state.heroTimer);
  const f = state.featured, loadingCatalog = Boolean(state.catalogRequest) && !Object.keys(state.catalog || {}).length;
  const continuing = continueWatching();
  const newEpisodes = state.newEpisodes || [];
  app.innerHTML = `${header()}<main class="home-page"><section class="hero" id="featured">${loadingCatalog ? `<div class="hero-skeleton skeleton"></div>` : featuredMarkup(f)}</section>${state.error ? `<p class="setup">TMDB setup needed: ${escapeHTML(state.error)}. See README.</p>` : ""}<section class="home-library">${continuing.length ? continueRail(continuing) : ""}${newEpisodes.length ? newEpisodeRail(newEpisodes) : ""}<div id="rails">${Object.entries(state.catalog).map(([name, items]) => rail(name, items)).join("") || (loadingCatalog ? homeSkeleton() : "")}</div><button class="play-something-banner" data-trailers><span class="play-something-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="play-something-copy"><small>${t("Not sure what to watch?").toUpperCase()}</small><b>${t("Play something")}</b><span>${t("We’ll pick a trailer for you")}</span></span><em>Start shuffling <b>›</b></em></button></section></main>${footer()}`;
  bindCommon(); bindHeroControls(); scheduleHero(); syncHeaderScroll();
  document.querySelectorAll("[data-trailers]").forEach(button => button.onclick = openTrailers);
  if (continuing.length) void repairContinuePosters(continuing);
  document.querySelectorAll("[data-remove-continue]").forEach(button => button.onclick = async () => {
    const [type, id, season, episode] = button.dataset.removeContinue.split(":"), item = { type, id:Number(id), season:Number(season), episode:Number(episode) };
    const key = watchKey(item);
    localStorage.removeItem(key);
    forgetAccountProgress(key);
    if (state.session) void localAPI(`/api/account/progress?key=${encodeURIComponent(key)}`, { method:"DELETE", headers:authorizedHeaders() }).catch(() => {});
    render();
  });
}
function heroNavigation() {
  const count = state.featuredPool.length;
  if (count < 2) return "";
  const position = String(state.featuredIndex + 1).padStart(2, "0"), total = String(count).padStart(2, "0");
  return `<div class="hero-nav" aria-label="Featured titles"><button class="hero-arrow hero-arrow-prev" data-hero-direction="-1" aria-label="Previous featured title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg></button><span class="hero-counter" aria-live="polite"><b>${position}</b><i>/</i>${total}</span><button class="hero-arrow hero-arrow-next" data-hero-direction="1" aria-label="Next featured title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/></svg></button></div>`;
}
function featuredMarkup(f = state.featured) {
  if (!f) return `<div class="hero-skeleton skeleton"></div>`;
  const backdrop = f.backdrop_path ? `${TMDB_BACKDROP}${f.backdrop_path}` : posterOf(f), score = Number(f.vote_average) || 0, type = contentType(f), description = f.overview || "Discover a new story selected for you on SEVEN.";
  const words = escapeHTML(titleOf(f)).split(/\s+/).map((word, index) => `<span class="hero-word" style="animation-delay:${.42 + index * .09}s">${word}</span>`).join("");
  return `<div class="home-hero-backdrop" style="background-image:url('${escapeHTML(backdrop)}')"></div><div class="home-hero-grade" aria-hidden="true"></div><div class="home-hero-shade"></div><div class="home-hero-layout"><div class="home-hero-content"><p class="hero-eyebrow">TONIGHT ON SEVEN</p><h1>${words}</h1><div class="hero-meta"><strong>${score ? `${Math.round(score * 10)}% match` : "Featured"}</strong><span>${yearOf(f) || "New"}</span><span>${type === "tv" ? "Series" : "Movie"}</span><span class="hero-rating">${type === "tv" ? "TV SERIES" : "FEATURED FILM"}</span></div><p class="hero-synopsis">${escapeHTML(description)}</p><div class="hero-actions"><button class="hero-play" data-open="${type}:${f.id}"><span class="hero-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span>${t("Watch now")}</span></button><button type="button" class="hero-info-link" data-open="${type}:${f.id}"><span>More info</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div></div>${heroNavigation()}`;
}
function bindHeroControls() {
  const featured = document.querySelector("#featured");
  if (!featured) return;
  const selectAndFocus = direction => {
    setFeaturedIndex(state.featuredIndex + direction);
    featured.querySelector(`[data-hero-direction="${direction}"]`)?.focus({ preventScroll:true });
  };
  featured.querySelectorAll("[data-hero-direction]").forEach(button => button.onclick = () => selectAndFocus(Number(button.dataset.heroDirection)));
  featured.querySelectorAll(".home-hero-content [data-open]").forEach(button => {
    const open = () => { const [type, id] = button.dataset.open.split(":"); openItem(type, Number(id)); };
    button.onclick = open;
    if (button.role === "button") button.onkeydown = event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } };
  });
}
function setFeaturedIndex(index) { const count = state.featuredPool.length; if (!count) return; state.featuredIndex = (index + count) % count; state.featured = state.featuredPool[state.featuredIndex]; const featured = document.querySelector("#featured"); if (featured && state.route === "home") { featured.classList.remove("hero-refresh"); void featured.offsetWidth; featured.innerHTML = featuredMarkup(state.featured); featured.classList.add("hero-refresh"); bindHeroControls(); } }
function rotateHero(direction = 1) { if (state.featuredPool.length < 2) return; setFeaturedIndex(state.featuredIndex + direction); }
function scheduleHero() { if (state.featuredPool.length > 1 && currentPreferences().autoplayPreviews !== false) state.heroTimer = setInterval(() => { if (state.route === "home") rotateHero(); }, 8500); }
function railTitle(name) { return `<h2 class="rail-heading">${escapeHTML(t(name === "My List" ? "Favourites" : name))}</h2>`; }
function rail(name, items) { const visible = name === "My List" ? items : items.filter(contentAllowed); if (!visible.length) return ""; const key = `${state.route}:${name}`, displayName = name === "My List" ? "Favourites" : name, ranked = name === "Trending now", railItems = ranked ? visible.slice(0, 4) : visible; state.explorable ||= {}; state.explorable[key] = { name:displayName, items:visible, fromRoute:state.route }; return `<section class="rail ${ranked ? "ranked-rail" : ""}"><div class="rail-title"><div>${railTitle(displayName)}<small>${ranked ? "This week on TMDB" : "Curated for your screen"}</small></div><button class="explore-all" data-explore="${escapeHTML(key)}">View all <b>›</b></button></div><div class="cards">${railItems.map((item, index) => card(item, ranked ? index + 1 : 0)).join("")}</div></section>`; }
function newEpisodeRail(items) { return `<section class="rail new-episode-rail"><div class="rail-title">${railTitle("New episodes")}<span>From My List</span></div><div class="cards">${items.map(item => `<button class="card" data-open="tv:${item.id}"><span class="poster-wrap"><img src="${posterOf(item)}" alt="" loading="lazy"><i>NEW EPISODE</i><strong class="card-play" aria-hidden="true">▶</strong></span><b>${escapeHTML(titleOf(item))}</b><small>S${item.episode.season_number} · E${item.episode.episode_number} · ${escapeHTML(item.episode.name || "New episode")}</small></button>`).join("")}</div></section>`; }
function card(item, rank = 0) { return `<article class="card ${rank ? "ranked-card" : ""}"><button class="card-open" data-open="${item.type}:${item.id}" aria-label="More about ${escapeHTML(titleOf(item))}"><span class="poster-wrap"><img src="${posterOf(item)}" alt="" loading="lazy"><span class="card-shade"></span><i>${item.type === "tv" ? "SERIES" : "MOVIE"}</i>${item.vote_average ? `<em class="card-score">★ ${item.vote_average.toFixed(1)}</em>` : ""}<strong class="card-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></strong></span><span class="card-copy ${rank ? "ranked-copy" : ""}">${rank ? `<em class="card-rank" aria-label="Rank ${rank}">${String(rank).padStart(2, "0")}</em>` : ""}<b>${escapeHTML(titleOf(item))}</b><small>${yearOf(item) || "New"} · ${item.type === "tv" ? "Series" : "Movie"}</small></span></button>${watchlistAction(item, "card")}</article>`; }
function mobileSearchCard(item) { return `<button class="msearch-card" data-open="${item.type}:${item.id}"><span class="msearch-poster"><img src="${posterOf(item)}" alt="" loading="lazy"><i>${item.type === "tv" ? "SERIES" : "MOVIE"}</i>${item.vote_average ? `<em>★ ${item.vote_average.toFixed(1)}</em>` : ""}</span><span class="msearch-copy"><b>${escapeHTML(titleOf(item))}</b><small>${yearOf(item) || "New"} · ${item.type === "tv" ? "Series" : "Movie"}</small></span></button>`; }
function progressEntries() { return Object.keys(localStorage).filter(key => key.startsWith(`seven-progress-${activeProfileId()}-`)).map(key => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return null; } }).filter(Boolean); }
function historyEntries() { return Object.keys(localStorage).filter(key => key.startsWith(`seven-progress-${activeProfileId()}-`)).map(key => { try { return { ...JSON.parse(localStorage.getItem(key) || "{}"), key }; } catch { return null; } }).filter(item => item?.title).sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0)); }
function forgetAccountProgress(key) { state.accountProgress = state.accountProgress.filter(item => item.key !== key); }
function forgetProfileProgress(profileId = activeProfileId()) { const prefix = `seven-progress-${profileId}-`; state.accountProgress = state.accountProgress.filter(item => !item.key?.startsWith(prefix)); }
function historyDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Watched recently" : `Watched ${date.toLocaleDateString(undefined, { month:"short", day:"numeric" })}`; }
function watchDuration(entry) { const duration = Number(entry.duration) || 0, current = Number(entry.currentTime) || 0; return Math.max(0, Math.min(current, duration || current)); }
function watchTimeLabel(seconds) { const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m`; }
function dateToken(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function longestWatchStreak(entries) { const dates = [...new Set(entries.map(entry => dateToken(entry.lastWatchedAt)).filter(Boolean))].sort(); let longest = 0, run = 0, previous = null; dates.forEach(token => { const day = new Date(`${token}T00:00:00`); run = previous && (day - previous) / 86400000 === 1 ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }); return longest; }
function profileStats() {
  const entries = progressEntries().filter(entry => entry?.type && entry.id && entry.title), profile = currentProfile(), previousVersion = profile?.watchStats?.version;
  const summary = window.SEVENProfileStats.summarize(entries, profile);
  if (profile && previousVersion !== window.SEVENProfileStats.VERSION) {
    persistLocalAccount();
    state.watchStatsSyncPending = true;
    scheduleProfileWatchStatsSync();
  }
  return { ...summary, genres:summary.genres.map(id => GENRES[Number(id)]).filter(Boolean).slice(0, 4) };
}
function savedProgress(item) { try { return JSON.parse(localStorage.getItem(watchKey(item)) || "{}"); } catch { return {}; } }
function isWatched(item) { const saved = savedProgress(item); return Boolean(saved.watched) || Number(saved.progress) >= 90; }
function seriesTracking(series) { const entries = progressEntries().filter(item => item.type === "tv" && Number(item.id) === Number(series.id)), watched = entries.filter(item => item.watched || Number(item.progress) >= 90), latest = [...entries].sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0))[0], resume = latest && !latest.watched && Number(latest.duration) > 0 && Number(latest.currentTime) > 0 ? latest : null; return { watched:watched.length, total:Number(series.number_of_episodes) || 0, latest, resume }; }
function nextEpisodeInSeason(series) { const tracking = seriesTracking(series), episodes = state.episodes?.episodes || []; if (tracking.resume && Number(tracking.resume.season) === Number(state.selectedSeason)) { const index = episodes.findIndex(episode => Number(episode.episode_number) === Number(tracking.resume.episode)); return episodes.slice(index + 1).find(episode => !isWatched({ type:"tv", id:series.id, season:state.selectedSeason, episode:episode.episode_number })) || null; } return episodes.find(episode => !isWatched({ type:"tv", id:series.id, season:state.selectedSeason, episode:episode.episode_number })) || null; }
async function loadSeriesNext() { const series = state.series; if (!series) return null; try { const tracking = seriesTracking(series), seasons = (series.seasons || []).filter(season => season.season_number > 0).sort((a, b) => a.season_number - b.season_number), startSeason = Number(tracking.resume?.season || tracking.latest?.season || state.selectedSeason || seasons[0]?.season_number || 1), queue = seasons.filter(season => season.season_number >= startSeason); for (const season of queue) { const data = Number(season.season_number) === Number(state.selectedSeason) ? state.episodes : await api(`tv/${series.id}/season/${season.season_number}`), episodes = data?.episodes || [], resumeIndex = tracking.resume && Number(tracking.resume.season) === Number(season.season_number) ? episodes.findIndex(item => Number(item.episode_number) === Number(tracking.resume.episode)) : -1, pool = resumeIndex >= 0 ? episodes.slice(resumeIndex + 1) : episodes, episode = pool.find(item => !isWatched({ type:"tv", id:series.id, season:season.season_number, episode:item.episode_number })); if (episode) { const resumeAt = savedStart({ type:"tv", id:series.id, season:season.season_number, episode:episode.episode_number }); return state.seriesNext = { season:Number(season.season_number), episode, resume:resumeAt > 0 }; } } } catch { /* Fall back to the current season when episode metadata is unavailable. */ } return state.seriesNext = null; }
async function setEpisodeStatus(episode, watched) { const item = { type:"tv", id:state.series.id, season:state.selectedSeason, episode:episode.episode_number, title:episode.name || titleOf(state.series), posterPath:state.series.poster_path || episode.still_path, genreIds:(state.series.genres || []).map(genre => genre.id) }, record = { currentTime:watched ? 1 : 0, duration:watched ? 1 : 0, progress:watched ? 100 : 0, watched, type:item.type, id:item.id, season:item.season, episode:item.episode, title:item.title, posterPath:item.posterPath, genreIds:item.genreIds, lastWatchedAt:new Date().toISOString() }; localStorage.setItem(watchKey(item), JSON.stringify(record)); state.seriesNext = null; queueProgressSync(item, record.currentTime, record.duration, record.progress); await loadSeriesNext(); renderSeries(); }
async function resumeSeries(record) { state.selectedSeason = Number(record.season) || 1; await loadEpisodes(); playEpisode(Number(record.episode), true); }
function continueWatching() {
  if (!state.session) return [];
  const prefix = `seven-progress-${activeProfileId()}-`, latest = new Map();
  state.accountProgress.filter(item => item.key?.startsWith(prefix) && item.type && item.id && item.title).sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0)).forEach(item => { const key = `${item.type}:${item.id}`; if (!latest.has(key)) latest.set(key, item); });
  return [...latest.values()].filter(item => Number(item.duration) > 0 && Number(item.duration) - Number(item.currentTime) >= 600 && !item.watched).slice(0, 16);
}
function catalogPoster(type, id) { for (const items of Object.values(state.catalog || {})) { const match = items.find(item => contentType(item) === type && Number(item.id) === Number(id) && item.poster_path); if (match) return match.poster_path; } return null; }
async function repairContinuePosters(items) {
  const titles = [...new Map(items.map(item => [`${item.type}:${item.id}`, { type:item.type, id:Number(item.id) }])).values()].filter(item => item.id && !continuePosterRepairs.has(`${item.type}:${item.id}`));
  await Promise.all(titles.map(async ({ type, id }) => {
    const repairKey = `${type}:${id}`;
    continuePosterRepairs.add(repairKey);
    let posterPath = catalogPoster(type, id);
    if (!posterPath) { try { posterPath = (await api(`${type}/${id}`)).poster_path; } catch { continuePosterRepairs.delete(repairKey); return; } }
    if (!posterPath) { continuePosterRepairs.delete(repairKey); return; }
    const changed = [];
    state.accountProgress.filter(record => record.key?.startsWith(`seven-progress-${activeProfileId()}-`) && record.type === type && Number(record.id) === id && record.posterPath !== posterPath).forEach(record => { record.posterPath = posterPath; localStorage.setItem(record.key, JSON.stringify(record)); changed.push({ storageKey:record.key, record }); });
    document.querySelectorAll(`[data-continue^="${type}:${id}:"] img`).forEach(image => { image.src = `${TMDB_IMAGE}${posterPath}`; });
    if (state.session && changed.length) await Promise.allSettled(changed.map(({ storageKey, record }) => localAPI("/api/account/progress", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ content_key:storageKey, content_type:type, tmdb_id:id, season:record.season || null, episode:record.episode || null, title:record.title || "Untitled", poster_path:posterPath, progress_seconds:Number(record.currentTime) || 0, duration_seconds:Number(record.duration) || 0, is_watched:Boolean(record.watched || Number(record.progress) >= 90), last_watched_at:record.lastWatchedAt || new Date().toISOString() }) })));
  }));
}
function continueRail(items) { return `<section class="rail continue-rail"><div class="rail-title">${railTitle("Continue watching")}<span>Pick up where you left off</span></div><div class="cards">${items.map(item => `<div class="continue-item"><button class="card continue-card" data-continue="${escapeHTML(`${item.type}:${item.id}:${item.season || 0}:${item.episode || 0}`)}"><span class="poster-wrap"><img src="${item.posterPath ? TMDB_IMAGE + item.posterPath : "icon.svg"}" alt="" loading="lazy"><i>${item.type === "tv" ? `S${item.season} · E${item.episode}` : "MOVIE"}</i><strong class="card-play" aria-hidden="true">▶</strong></span><b>${escapeHTML(item.title)}</b><small>Resume from ${timeLabel(Math.floor(item.currentTime || 0))}</small><em class="continue-progress"><i style="width:${Math.min(100, Number(item.progress) || 0)}%"></i></em></button><button class="continue-remove" data-remove-continue="${escapeHTML(`${item.type}:${item.id}:${item.season || 0}:${item.episode || 0}`)}" aria-label="Remove ${escapeHTML(item.title)} from Continue watching"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>`).join("")}</div></section>`; }
async function openItem(type, id) {
  try {
    const item = normalize(await api(`${type}/${id}`, { append_to_response:"credits,keywords,videos" }), type);
    state.trailer = trailerFrom(item.videos) || await loadTrailer(type, item.id);
    if (type === "movie") { state.movie = item; state.route = "movie"; }
    else { state.series = item; const tracking = seriesTracking(item); state.selectedSeason = Number(tracking.resume?.season || tracking.latest?.season) || 1; state.route = "series"; await loadEpisodes(); await loadSeriesNext(); }
  } catch (error) { state.error = error.message; state.route = "home"; }
  render(); scrollToTop();
}
async function loadEpisodes() { const seriesId = Number(state.series.id), season = Number(state.selectedSeason); state.episodes = await api(`tv/${seriesId}/season/${season}`); state.episodesSeriesId = seriesId; state.episodesSeason = season; }
function trailerFrom(videos) { return (videos?.results || []).find(video => video.site === "YouTube" && video.type === "Trailer") || (videos?.results || []).find(video => video.site === "YouTube") || null; }
async function loadTrailer(type, id) { try { return trailerFrom(await api(`${type}/${id}/videos`)); } catch { return null; } }
function trailerAction() { return state.trailer ? `<button class="secondary" data-trailer><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span>Trailer</span></button>` : ""; }
function shareAction() { return `<button type="button" class="secondary share-action" data-share-title><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"/></svg><span>Share</span></button>`; }
function titleMoreAction(item, extraActions = "") { return `<div class="title-more"><button type="button" class="secondary title-more-trigger" data-title-more aria-haspopup="true" aria-expanded="false" aria-label="More title actions" title="More"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button><div class="title-more-menu" hidden><div class="title-more-menu-actions">${extraActions}<button type="button" class="secondary list-action ${isInMyList(item) ? "saved" : ""}" data-toggle-my-list><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.9c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.8 2.1Z"/></svg><span>${isInMyList(item) ? "In Favourites" : "Add to Favourites"}</span></button>${trailerAction()}${shareAction()}</div>${ratingAction(item)}</div></div>`; }
function sharedTitleURL(item) { const url = new URL("./", window.location.href); url.searchParams.set("title", `${item.type}:${item.id}`); return url.href; }
function showToast(message) { document.querySelector(".seven-toast")?.remove(); app.insertAdjacentHTML("beforeend", `<div class="seven-toast" role="status">${escapeHTML(message)}</div>`); setTimeout(() => document.querySelector(".seven-toast")?.remove(), 2600); }
async function shareTitle(item) { const url = sharedTitleURL(item), payload = { title:`${titleOf(item)} · SEVEN`, text:`Check out ${titleOf(item)} on SEVEN.`, url }; try { if (navigator.share) { await navigator.share(payload); return; } } catch (error) { if (error?.name === "AbortError") return; } try { await navigator.clipboard.writeText(url); showToast("Link copied — send it to someone."); } catch { window.prompt("Copy this SEVEN link", url); } }
function mediaInfo(item, type) { const credits = item.credits || {}, cast = (credits.cast || []).slice(0, 18), keywords = (item.keywords?.keywords || item.keywords?.results || []).slice(0, 18), people = type === "movie" ? (credits.crew || []).filter(person => ["Director","Writer","Screenplay"].includes(person.job)).slice(0, 4) : (item.created_by || []).slice(0, 4); const facts = type === "movie" ? [["Type","Movie"],["Released",item.release_date || "—"],["Runtime",item.runtime ? `${item.runtime} min` : "—"],["Status",item.status || "—"],["Language",(item.original_language || "—").toUpperCase()],["Countries",(item.production_countries || []).map(country => country.iso_3166_1).join(", ") || "—"]] : [["Type","Series"],["First aired",item.first_air_date || "—"],["Last aired",item.last_air_date || "Ongoing"],["Seasons",item.number_of_seasons || "—"],["Episodes",item.number_of_episodes || "—"],["Status",item.status || "—"],["Language",(item.original_language || "—").toUpperCase()],["Networks",(item.networks || []).map(network => network.name).join(", ") || "—"]]; return `<section class="media-info"><div class="info-block"><span class="brand">ABOUT</span><div class="fact-grid">${facts.map(([label, value]) => `<div><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join("")}</div></div><div class="info-block"><span class="brand">GENRES</span><div class="tag-row">${(item.genres || []).map(genre => `<span>${escapeHTML(genre.name)}</span>`).join("") || "<span>Not listed</span>"}</div></div>${people.length ? `<div class="info-block"><span class="brand">${type === "movie" ? "CREW" : "CREATED BY"}</span><p class="creator-list">${people.map(person => `${escapeHTML(person.name)}${person.job ? ` · ${escapeHTML(person.job)}` : ""}`).join("<br>")}</p></div>` : ""}${keywords.length ? `<div class="info-block"><span class="brand">KEYWORDS</span><div class="tag-row">${keywords.map(keyword => `<span>${escapeHTML(keyword.name)}</span>`).join("")}</div></div>` : ""}${cast.length ? `<div class="info-block cast-block"><span class="brand">CAST</span><div class="cast-row">${cast.map(person => `<button class="cast-card" data-person="${person.id}" aria-label="Open ${escapeHTML(person.name)}"><img src="${person.profile_path ? TMDB_IMAGE + person.profile_path : "icon.svg"}" alt="${escapeHTML(person.name)}" loading="lazy"><b>${escapeHTML(person.name)}</b><small>${escapeHTML(person.character || "Cast")}</small></button>`).join("")}</div></div>` : ""}</section>`; }
function creditType(credit) { return credit.media_type === "movie" || credit.title ? "movie" : "tv"; }
function creditYear(credit) { return (credit.release_date || credit.first_air_date || "").slice(0, 4); }
function personCreditCard(credit) { const type = creditType(credit), role = credit.character || credit.job || credit.department || ""; return `<button class="card person-credit" data-open="${type}:${credit.id}"><span class="poster-wrap"><img src="${posterOf(credit)}" alt="" loading="lazy"><i>${type === "movie" ? "MOVIE" : "SERIES"}</i><strong class="card-play" aria-hidden="true">▶</strong></span><b>${escapeHTML(titleOf(credit))}</b><small>${creditYear(credit) || "TBA"}${role ? ` · ${escapeHTML(role)}` : ""}</small></button>`; }
function personRail(title, credits) { return credits.length ? `<section class="rail person-rail"><div class="rail-title">${railTitle(title)}<span>${credits.length} titles</span></div><div class="cards">${credits.map(personCreditCard).join("")}</div></section>` : ""; }
function safeExternalURL(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
function personFacts(person) { const gender = ({ 1:"Female", 2:"Male", 3:"Non-binary" })[person.gender] || "Not listed"; return [["Known for", person.known_for_department || "—"], ["Born", person.birthday || "—"], ["Place of birth", person.place_of_birth || "—"], ["Gender", gender], ["Died", person.deathday || "—"], ["Also known as", (person.also_known_as || []).slice(0, 3).join(", ") || "—"]]; }
async function openPerson(id) {
  state.personBackRoute = state.route;
  state.person = null;
  state.personError = "";
  state.route = "person";
  scrollToTop();
  render();
  try { state.person = await api(`person/${id}`, { append_to_response:"combined_credits,external_ids,images" }); }
  catch (error) { state.personError = error.message; }
  render();
}
function renderPerson() {
  const person = state.person;
  if (!person) {
    app.innerHTML = `${header()}<button class="back" data-person-back>‹ Back</button><section class="person-hero person-loading"><div class="person-photo skeleton"></div><div><span class="brand">CAST & CREW</span><div class="skeleton-line wide"></div><p>${escapeHTML(state.personError || "Loading person details from TMDB…")}</p></div></section>${footer()}`;
    bindCommon();
    document.querySelector("[data-person-back]").onclick = () => { state.route = state.personBackRoute || "home"; render(); };
    return;
  }

  const credits = person.combined_credits || {};
  const dedupe = list => [...new Map(list.filter(credit => credit?.id && (credit.title || credit.name)).map(credit => [`${creditType(credit)}:${credit.id}`, credit])).values()].sort((a, b) => String(b.release_date || b.first_air_date || "").localeCompare(String(a.release_date || a.first_air_date || "")));
  const acting = dedupe(credits.cast || []);
  const crew = dedupe(credits.crew || []);
  const movieCredits = acting.filter(credit => creditType(credit) === "movie");
  const seriesCredits = acting.filter(credit => creditType(credit) === "tv");
  const homepage = safeExternalURL(person.homepage);
  const external = person.external_ids || {};
  const links = [homepage ? `<a href="${escapeHTML(homepage)}" target="_blank" rel="noreferrer">Official site ↗</a>` : "", external.imdb_id ? `<a href="https://www.imdb.com/name/${encodeURIComponent(external.imdb_id)}/" target="_blank" rel="noreferrer">IMDb ↗</a>` : "", external.instagram_id ? `<a href="https://www.instagram.com/${encodeURIComponent(external.instagram_id)}/" target="_blank" rel="noreferrer">Instagram ↗</a>` : "", external.facebook_id ? `<a href="https://www.facebook.com/${encodeURIComponent(external.facebook_id)}" target="_blank" rel="noreferrer">Facebook ↗</a>` : ""].filter(Boolean).join("");
  const biography = person.biography ? escapeHTML(person.biography).replace(/\n/g, "<br>") : "TMDB does not have a biography for this person yet.";
  app.innerHTML = `${header()}<button class="back" data-person-back>‹ Back</button><section class="person-hero"><img class="person-photo" src="${person.profile_path ? TMDB_IMAGE + person.profile_path : "icon.svg"}" alt="${escapeHTML(person.name)}"><div class="person-main"><span class="brand">CAST & CREW</span><h1>${escapeHTML(person.name)}</h1><div class="person-links">${links}</div><p class="person-biography">${biography}</p><div class="person-facts">${personFacts(person).map(([label, value]) => `<div><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join("")}</div></div></section><section class="person-filmography"><div class="rail-title"><div><span class="brand">FILMOGRAPHY</span><h2>On SEVEN</h2></div><span>${acting.length + crew.length} TMDB credits</span></div>${personRail("Movies", movieCredits)}${personRail("Series", seriesCredits)}${personRail("Behind the scenes", crew)}</section>${footer()}`;
  bindCommon();
  document.querySelector("[data-person-back]").onclick = () => { state.route = state.personBackRoute || "home"; render(); };
}
function renderMovie() {
  const movie = state.movie, resumeAt = savedStart({ type:"movie", id:movie.id }), playbackAction = resumeAt ? `<button class="primary" data-resume-movie><b>▶</b> Resume from ${timeLabel(resumeAt)}</button>` : `<button class="primary" data-play-movie><b>▶</b> Play movie</button>`, extraActions = `${resumeAt ? `<button type="button" class="secondary" data-play-movie><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5M5.2 12a7 7 0 1 0 2-4.95L4 12"/></svg><span>Start over</span></button>` : ""}`;
  app.innerHTML = `${header()}<button class="back" data-home>‹ Browse</button><section class="detail"><img src="${posterOf(movie)}" alt="${escapeHTML(titleOf(movie))}"><div class="movie-detail-copy"><span class="brand">MOVIE</span><h1>${escapeHTML(titleOf(movie))}</h1><div class="meta"><span>${yearOf(movie)}</span><i></i><span>${movie.runtime ? `${movie.runtime} min` : "Movie"}</span><i></i><span>${movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : "TV-14"}</span></div><p>${escapeHTML(movie.overview || "")}</p></div><div class="actions movie-actions title-actions">${playbackAction}${watchlistAction(movie)}${titleMoreAction(movie, extraActions)}</div></section>${mediaInfo(movie, "movie")}${footer()}`;
  bindCommon(); document.querySelector("[data-play-movie]")?.addEventListener("click", () => playMovieNow(movie)); document.querySelector("[data-resume-movie]")?.addEventListener("click", () => playMovieNow(movie, true)); document.querySelector("[data-toggle-my-list]")?.addEventListener("click", () => toggleMyList(movie)); document.querySelector("[data-trailer]")?.addEventListener("click", showTrailer); document.querySelector("[data-hide-title]")?.addEventListener("click", () => hideTitle(movie)); document.querySelector("[data-like-title]")?.addEventListener("click", () => likeTitle(movie)); document.querySelector("[data-share-title]")?.addEventListener("click", () => shareTitle(movie));
}
function renderSeries() {
  const s = state.series, seasons = (s.seasons || []).filter(x => x.season_number > 0), tracking = seriesTracking(s), upNext = state.seriesNext, next = upNext?.episode || nextEpisodeInSeason(s), nextSeason = upNext?.season || state.selectedSeason, episodeTotal = tracking.total || "—", progress = tracking.total ? Math.min(100, Math.round(tracking.watched / tracking.total * 100)) : 0;
  const episodeRows = (state.episodes?.episodes || []).map(episode => {
    const item = { type:"tv", id:s.id, season:state.selectedSeason, episode:episode.episode_number }, watched = isWatched(item), resume = savedStart(item), runtime = episode.runtime ? `${episode.runtime} min` : "Episode";
    const status = watched ? "Watched" : resume ? `Resume from ${timeLabel(resume)}` : runtime;
    return `<article class="episode series-episode ${watched ? "is-watched" : ""}"><button class="episode-main" data-play-episode="${episode.episode_number}"><span class="episode-art"><img src="${episode.still_path ? TMDB_IMAGE + episode.still_path : "icon.svg"}" alt="" loading="lazy"><i aria-hidden="true">▶</i></span><span class="episode-copy"><small class="episode-kicker">S${state.selectedSeason} · E${episode.episode_number} <em>${escapeHTML(status)}</em></small><b>${escapeHTML(episode.name || `Episode ${episode.episode_number}`)}</b><span>${escapeHTML(episode.overview || "No description is available for this episode yet.")}</span></span></button><button class="episode-toggle ${watched ? "done" : ""}" data-toggle-episode="${episode.episode_number}" aria-label="${watched ? "Mark unwatched" : "Mark watched"}">${watched ? "✓" : "+"}</button></article>`;
  }).join("");
  const action = tracking.resume ? `<button class="primary" data-resume-series><b>▶</b> Continue S${tracking.resume.season} · E${tracking.resume.episode}</button>` : `<button class="primary" data-play-series><b>▶</b> ${next ? `Play episode ${next.episode_number}` : "Play episode 1"}</button>`, extraActions = `${tracking.resume ? `<button type="button" class="secondary" data-play-series><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5M5.2 12a7 7 0 1 0 2-4.95L4 12"/></svg><span>Start season</span></button>` : ""}`;
  const upNextCard = next ? `<button class="series-next" data-play-up-next><span class="series-next-art"><img src="${next.still_path ? TMDB_IMAGE + next.still_path : posterOf(s)}" alt=""><i aria-hidden="true">▶</i></span><span class="series-next-copy"><small>UP NEXT · S${nextSeason} E${next.episode_number}</small><strong>${escapeHTML(next.name || `Episode ${next.episode_number}`)}</strong><em>${upNext?.resume ? `Resume from ${timeLabel(savedStart({ type:"tv", id:s.id, season:nextSeason, episode:next.episode_number }))}` : "Ready when you are"}</em></span><span class="series-next-arrow" aria-hidden="true">→</span></button>` : "";
  const backdrop = s.backdrop_path ? `${TMDB_BACKDROP}${s.backdrop_path}` : posterOf(s);
  const seasonRail = `<nav class="series-season-rail" aria-label="Choose season">${seasons.map(x => `<button type="button" data-series-season="${x.season_number}" aria-current="${x.season_number === state.selectedSeason ? "true" : "false"}"><span>Season</span><b>${x.season_number}</b></button>`).join("")}</nav>`;
  app.innerHTML = `${header()}<main class="series-page"><section class="series-hero"><div class="series-hero-backdrop" style="background-image:url('${backdrop}')"></div><div class="series-hero-fade" style="background-image:url('${backdrop}')"></div><div class="series-hero-shade"></div><button class="series-back" data-home>‹ <span>Back to browse</span></button><div class="series-hero-content"><img class="series-poster" src="${posterOf(s)}" alt="${escapeHTML(titleOf(s))}"><div class="series-hero-copy"><span class="series-eyebrow">SEVEN ORIGINAL SERIES</span><h1>${escapeHTML(titleOf(s))}</h1><div class="series-meta"><span>${yearOf(s)}</span><span>${s.number_of_seasons || seasons.length} seasons</span><span class="series-score">★ ${s.vote_average ? s.vote_average.toFixed(1) : "New"}</span></div><p>${escapeHTML(s.overview || "Discover the story, meet the characters, and start watching on SEVEN.")}</p><div class="actions title-actions">${action}${watchlistAction(s)}${titleMoreAction(s, extraActions)}</div></div></div></section><div class="series-shell"><section class="series-dashboard"><div class="series-progress-card"><div><span class="series-section-label">YOUR PROGRESS</span><strong>${tracking.watched} <small>of ${episodeTotal} episodes</small></strong><p>${progress ? "Keep going — your next episode is ready." : "Start the series and your progress will appear here."}</p></div><span class="series-progress-percent">${progress}%</span><i><em style="width:${progress}%"></em></i></div>${upNextCard}</section><section class="episode-section series-episodes"><div class="series-section-head"><div><span class="series-section-label">EPISODE GUIDE</span><h2>Season ${state.selectedSeason}</h2></div></div>${seasonRail}<div id="episodes-list" class="series-episode-grid">${episodeRows || '<p class="episode-empty">No episodes are available for this season.</p>'}</div></section><section class="series-more"><div class="series-section-head"><div><span class="series-section-label">BEHIND THE STORY</span><h2>More about ${escapeHTML(titleOf(s))}</h2></div></div>${mediaInfo(s, "tv")}</section></div></main>${footer()}`;
  bindCommon(); document.querySelectorAll("[data-series-season]").forEach(button => button.onclick = async () => { state.selectedSeason = Number(button.dataset.seriesSeason); await loadEpisodes(); render(); });
  document.querySelector("[data-play-series]")?.addEventListener("click", () => playSeriesEpisode(nextSeason, next?.episode_number || 1, false)); document.querySelector("[data-play-up-next]")?.addEventListener("click", () => playSeriesEpisode(nextSeason, next?.episode_number || 1, Boolean(upNext?.resume))); document.querySelector("[data-resume-series]")?.addEventListener("click", () => resumeSeries(tracking.resume)); document.querySelector("[data-toggle-my-list]")?.addEventListener("click", () => toggleMyList(s)); document.querySelector("[data-trailer]")?.addEventListener("click", showTrailer); document.querySelector("[data-hide-title]")?.addEventListener("click", () => hideTitle(s)); document.querySelector("[data-like-title]")?.addEventListener("click", () => likeTitle(s)); document.querySelector("[data-share-title]")?.addEventListener("click", () => shareTitle(s));
  document.querySelectorAll("[data-play-episode]").forEach(button => button.onclick = () => playEpisode(Number(button.dataset.playEpisode), false)); document.querySelectorAll("[data-toggle-episode]").forEach(button => button.onclick = () => { const episode = (state.episodes?.episodes || []).find(item => Number(item.episode_number) === Number(button.dataset.toggleEpisode)); if (episode) setEpisodeStatus(episode, !isWatched({ type:"tv", id:s.id, season:state.selectedSeason, episode:episode.episode_number })); });
}
function showTrailer() { if (!state.trailer?.key) return; app.insertAdjacentHTML("beforeend", `<div class="modal trailer-modal"><section class="trailer-card"><button class="modal-close" data-close>×</button><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(state.trailer.key)}?autoplay=1&rel=0" title="${escapeHTML(state.trailer.name || "Trailer")}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></section></div>`); document.querySelector(".trailer-modal [data-close]").onclick = () => document.querySelector(".trailer-modal")?.remove(); }
function savedStart(item) { try { const saved = JSON.parse(localStorage.getItem(watchKey(item)) || "{}"), time = Math.floor(Number(saved.currentTime) || 0), duration = Number(saved.duration) || 0; return time >= 5 && (!duration || time < duration - 5) ? time : 0; } catch { return 0; } }
function timeLabel(seconds) { const minutes = Math.floor(seconds / 60), remainder = String(seconds % 60).padStart(2, "0"); return `${minutes}:${remainder}`; }
function resumeAction(item, attribute) { const seconds = savedStart(item); return seconds ? `<button class="secondary resume-action" ${attribute}><b>↻</b> Resume from ${timeLabel(seconds)}</button>` : ""; }
async function playSeriesEpisode(season, episode, resume = false) { if (Number(state.selectedSeason) !== Number(season)) { state.selectedSeason = Number(season); await loadEpisodes(); } playEpisode(Number(episode), resume); }
function playEpisode(number, resume = false) { const episode = (state.episodes.episodes || []).find(x => x.episode_number === number) || {}, key = { type:"tv", id:state.series.id, season:state.selectedSeason, episode:number }, previous = state.player; state.pendingEpisodeCompletion = isDirectNextEpisode(previous, key) && playbackProgressPercent(savedProgress(previous)) >= PREVIOUS_EPISODE_WATCHED_PERCENT ? { ...previous } : null; state.player = { ...key, title:episode.name || titleOf(state.series), overview:episode.overview || state.series.overview, posterPath:state.series.poster_path || episode.still_path, genreIds:(state.series.genres || []).map(genre => genre.id), startAt:resume ? savedStart(key) : 0 }; state.route = "player"; render(); scrollToTop(); }
function playerURL(item, progress = 0) {
  const provider = selectedPlayerProvider();
  const season = item.season || 1, episode = item.episode || 1, start = Math.max(0, Math.floor(progress) || 0);
  if (provider === "vidfast") {
    const base = item.type === "movie" ? `movie/${item.id}` : `tv/${item.id}/${season}/${episode}`;
    return `https://vidfast.vc/${base}?autoPlay=true&autoNext=true&nextButton=true&theme=b20710&hideServerControls=false${start ? `&startAt=${start}` : ""}`;
  }
  if (provider === "cinesrc") {
    const params = new URLSearchParams({ autoplay:"true", autonext:"true", autoskip:"true", color:"#b20710" });
    if (item.type === "tv") { params.set("s", String(season)); params.set("e", String(episode)); }
    if (start) { params.set("t", String(start)); params.set("continueprompt", "false"); }
    return `https://cinesrc.st/embed/${item.type === "movie" ? `movie/${item.id}` : `tv/${item.id}`}?${params}`;
  }
  if (provider === "multiembed") return `https://multiembed.mov/?video_id=${item.id}${item.type === "tv" ? `&s=${season}&e=${episode}` : ""}${start ? `&t=${start}` : ""}`;
  if (provider === "2embed") return item.type === "movie" ? `https://www.2embed.online/embed/movie/${item.id}` : `https://www.2embed.online/embed/tv/${item.id}/${season}/${episode}`;
  const base = item.type === "movie" ? `movie/${item.id}` : `tv/${item.id}/${season}/${episode}`;
  return `https://vidsrc.sbs/embed/${base}?autoplay=1&color=b20710${start ? `&t=${start}` : ""}`;
}
function nextPlayerEpisode(item) { if (item.type !== "tv" || Number(state.series?.id) !== Number(item.id) || Number(state.selectedSeason) !== Number(item.season)) return null; return (state.episodes?.episodes || []).filter(episode => Number(episode.episode_number) > Number(item.episode)).sort((a, b) => Number(a.episode_number) - Number(b.episode_number))[0] || null; }
const cineSrcPoll = { timer:null, currentTime:null, duration:null };
let playerEpisodeContextRequest = 0;
function stopPlayerProgressPolling() { clearInterval(cineSrcPoll.timer); cineSrcPoll.timer = null; cineSrcPoll.currentTime = null; cineSrcPoll.duration = null; }
function sendPlayerCommand(provider, command) {
  const frame = document.querySelector("iframe.player"), target = window.SEVENPlayerSecurity?.playerCommandFrame(provider);
  if (!frame?.contentWindow || !target) return;
  frame.contentWindow.postMessage({ type:"cinesrc:command", command, args:[] }, target);
}
function startPlayerProgressPolling() {
  stopPlayerProgressPolling();
  if (selectedPlayerProvider() !== "cinesrc") return;
  // CineSrc's embed ships without the documented timeupdate postMessage events,
  // but it answers getCurrentTime/getDuration commands, so poll for real times.
  cineSrcPoll.timer = setInterval(() => { if (state.route === "player") pollCineSrcProgress(); else stopPlayerProgressPolling(); }, 3000);
  pollCineSrcProgress();
}
function pollCineSrcProgress() {
  const provider = selectedPlayerProvider();
  if (provider !== "cinesrc" || state.route !== "player" || !document.querySelector("iframe.player")) return;
  sendPlayerCommand(provider, "getCurrentTime");
  sendPlayerCommand(provider, "getDuration");
}
function handlePlayerResponse(data) {
  if (data.command === "getCurrentTime") cineSrcPoll.currentTime = data.result;
  else if (data.command === "getDuration") cineSrcPoll.duration = data.result;
  else return;
  if (cineSrcPoll.currentTime != null && Number(cineSrcPoll.duration) > 0) {
    recordPlaybackEvent({ event:"timeupdate", currentTime:cineSrcPoll.currentTime, duration:cineSrcPoll.duration });
    cineSrcPoll.currentTime = null;
    cineSrcPoll.duration = null;
  }
}
function playerEpisodePanel(player) {
  if (player.type !== "tv") return "";
  if (Number(state.series?.id) !== Number(player.id) || Number(state.episodesSeriesId) !== Number(player.id) || Number(state.episodesSeason) !== Number(state.selectedSeason)) return `<section class="episode-section player-episodes player-episodes-loading" data-player-episode-panel><span class="brand">EPISODES</span><p>Loading Season ${state.selectedSeason}…</p></section>`;

  const seasons = (state.series.seasons || []).filter(season => season.season_number > 0);
  const rows = (state.episodes?.episodes || []).map(episode => {
    const item = { type:"tv", id:player.id, season:state.selectedSeason, episode:episode.episode_number };
    const watched = isWatched(item);
    const current = Number(state.selectedSeason) === Number(player.season) && Number(episode.episode_number) === Number(player.episode);
    const resume = savedStart(item), status = current ? "" : watched ? `<em class="episode-state is-watched">✓ Watched</em>` : resume ? `<em class="episode-state is-resume">Resume from ${timeLabel(resume)}</em>` : "";
    return `<article class="episode ${watched ? "is-watched" : ""} ${current ? "is-current" : ""}"><button class="episode-main" data-player-episode="${episode.episode_number}"><span class="player-episode-art"><img src="${episode.still_path ? TMDB_IMAGE + episode.still_path : "icon.svg"}" alt=""><i aria-hidden="true">▶</i></span><span><b><em>${String(episode.episode_number).padStart(2, "0")}</em>${escapeHTML(episode.name)}${episode.vote_average ? `<i class="episode-score">★ ${Number(episode.vote_average).toFixed(1)}</i>` : ""}</b><small class="episode-description">${escapeHTML(episode.overview || "No description available.")}</small>${status}</span><strong class="episode-open" aria-hidden="true">▶</strong></button>${current ? '<span class="episode-current">Now playing</span>' : ""}</article>`;
  }).join("");

  const seasonPicker = `<nav class="season-rail" aria-label="Choose season">${seasons.map(season => `<button type="button" data-player-season="${season.season_number}" aria-current="${Number(season.season_number) === Number(state.selectedSeason) ? "true" : "false"}"><span>Season</span><b>${season.season_number}</b></button>`).join("")}</nav>`;
  return `<section class="episode-section player-episodes" data-player-episode-panel><div class="rail-title"><h2>Episodes</h2><span>${Number(state.selectedSeason) === Number(player.season) ? `Watching Season ${player.season}` : `Season ${state.selectedSeason}`}</span></div>${seasonPicker}<div class="player-episodes-list">${rows || '<p class="episode-empty">No episodes are available for this season.</p>'}</div></section>`;
}
function bindPlayerEpisodes(player) {
  document.querySelectorAll("[data-player-season]").forEach(button => button.addEventListener("click", async () => {
    state.selectedSeason = Number(button.dataset.playerSeason);
    await loadEpisodes();
    document.querySelector("[data-player-episode-panel]")?.replaceWith(document.createRange().createContextualFragment(playerEpisodePanel(player)));
    bindPlayerEpisodes(player);
  }));
  document.querySelectorAll("[data-player-episode]").forEach(button => button.onclick = () => playEpisode(Number(button.dataset.playerEpisode), false));
}
function openMobileSearch() {
  if (state.route !== "msearch") state.mSearchReturn = state.route;
  state.route = "msearch";
  state.mSearch ||= { query: state.search || "", results: state.searchResults || [], trending: state.catalog["Trending now"]?.slice(0, 12) || null };
  if (!state.mSearch.trending) api("trending/all/week").then(payload => { state.mSearch.trending = results(payload).slice(0, 12); if (state.route === "msearch" && (state.mSearch.query || "").trim().length < 2) renderMSearch(); }).catch(() => { state.mSearch.trending = []; });
  render();
  setTimeout(() => document.querySelector("#msearch-input")?.focus(), 80);
}
function renderMSearch() {
  const view = state.mSearch || { query:"", results:[], trending:null };
  app.innerHTML = `${header()}<div class="msearch-page"><div class="msearch-bar"><button class="msearch-back" data-msearch-back aria-label="${t("Back")}">‹</button><div class="msearch-input-wrap"><span class="msearch-magnifier" aria-hidden="true">⌕</span><input id="msearch-input" type="search" placeholder="${t("Titles, movies, series")}" value="${escapeHTML(view.query || "")}" autocomplete="off" enterkeyhint="search"><button class="msearch-clear" data-msearch-clear ${view.query ? "" : "hidden"} aria-label="Clear">×</button></div></div><div id="msearch-body"></div></div>`;
  bindCommon();
  const body = document.querySelector("#msearch-body"), input = document.querySelector("#msearch-input"), clearButton = document.querySelector("[data-msearch-clear]");
  const viewport = window.visualViewport;
  const alignViewport = () => {
    const page = document.querySelector(".msearch-page");
    if (!page) { viewport?.removeEventListener("resize", alignViewport); viewport?.removeEventListener("scroll", alignViewport); return; }
    const top = `${viewport?.offsetTop || 0}px`, height = `${viewport?.height || window.innerHeight}px`;
    if (page.style.top !== top || page.style.height !== height) { page.style.top = top; page.style.height = height; }
  };
  viewport?.addEventListener("resize", alignViewport);
  viewport?.addEventListener("scroll", alignViewport);
  alignViewport();
  document.documentElement.style.overflow = "hidden";
  const renderIdle = () => {
    const trending = view.trending;
    body.innerHTML = `<h2 class="msearch-title">${t("Top searches")}</h2><div class="msearch-top">${!trending ? Array.from({ length: 8 }, () => `<div class="msearch-top-item"><div class="skeleton" style="aspect-ratio:16/9"></div></div>`).join("") : trending.length ? trending.map((item, index) => `<button class="msearch-top-item" data-open="${item.type}:${item.id}"><img src="${item.backdrop_path ? TMDB_IMAGE + item.backdrop_path : posterOf(item)}" alt="" loading="lazy"><b>${index + 1}</b><span>${escapeHTML(titleOf(item))}</span></button>`).join("") : `<p class="msearch-empty">Nothing to show yet.</p>`}</div>`;
    bindCommon();
  };
  const renderResults = (items, loading, query) => {
    body.innerHTML = loading ? `<div class="msearch-grid">${Array.from({ length: 6 }, () => `<div class="msearch-skeleton skeleton"></div>`).join("")}</div>` : items.length ? `<div class="msearch-grid">${items.map(mobileSearchCard).join("")}</div>` : `<p class="msearch-empty">No matches for “${escapeHTML(query)}”.</p>`;
    bindCommon();
  };
  if ((view.query || "").trim().length >= 2) renderResults(view.results, false, view.query); else renderIdle();
  clearButton.onclick = () => { input.value = ""; view.query = ""; view.results = []; clearButton.hidden = true; renderIdle(); input.focus(); };
  document.querySelector("[data-msearch-back]").onclick = () => { state.route = state.mSearchReturn || "home"; state.mSearchReturn = null; render(); };
  let timer;
  input.oninput = () => {
    view.query = input.value;
    clearButton.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length < 2) { view.results = []; renderIdle(); return; }
      renderResults([], true, query);
      try { view.results = results(await api("search/multi", { query })); } catch { view.results = []; }
      if (input.value.trim() === query && state.route === "msearch") renderResults(view.results, false, query);
    }, 300);
  };
}
async function openTrailers() {
  state.route = "trailers";
  state.trailerFeed = { loading: true };
  render();
  try {
    const trending = results(await api("trending/all/week")).filter(item => item.overview).slice(0, 12);
    const withVideos = await Promise.all(trending.map(async item => {
      try {
        const data = await api(`${item.type}/${item.id}/videos`);
        const videos = (data.results || []).filter(video => video.site === "YouTube");
        const video = videos.find(video => video.type === "Trailer") || videos.find(video => video.type === "Teaser") || videos[0];
        return video ? { ...item, key: video.key } : null;
      } catch { return null; }
    }));
    state.trailerFeed = { items: withVideos.filter(Boolean).slice(0, 8) };
  } catch (error) { state.trailerFeed = { items: [], error: error.message }; }
  if (state.route === "trailers") render();
}
function renderTrailers() {
  const feed = state.trailerFeed || { loading: true };
  const slides = feed.loading ? Array.from({ length: 4 }, () => `<div class="trailer-slide"><div class="trailer-skeleton skeleton"></div></div>`).join("") : feed.error && !feed.items.length ? `<div class="trailer-slide"><p class="trailer-error">${escapeHTML(feed.error)}</p></div>` : feed.items.map(item => `
    <div class="trailer-slide">
      ${item.key ? `<iframe class="trailer-frame" src="https://www.youtube-nocookie.com/embed/${item.key}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${item.key}" allow="autoplay; encrypted-media" loading="lazy" title="${escapeHTML(titleOf(item))} trailer"></iframe>` : `<div class="trailer-skeleton skeleton"></div>`}
      <div class="trailer-shade" aria-hidden="true"></div>
      <div class="trailer-info"><span class="brand">${item.type === "tv" ? "SERIES" : "MOVIE"} · ${yearOf(item) || "NEW"}</span><h2>${escapeHTML(titleOf(item))}</h2><p>${escapeHTML(item.overview || "")}</p><div class="trailer-actions"><button class="primary" data-open="${item.type}:${item.id}">${t("Watch now")}</button><button class="ghost" data-trailer-next>${t("Next trailer")}</button></div></div>
    </div>`).join("");
  app.innerHTML = `<div class="trailer-feed"><button class="trailer-close" data-trailer-close aria-label="Close trailers">×</button>${slides}</div>`;
  bindCommon();
  document.querySelector("[data-trailer-close]").onclick = () => { state.route = "home"; scrollToTop(); render(); };
  document.querySelectorAll("[data-trailer-next]").forEach(button => button.onclick = () => { const next = button.closest(".trailer-slide")?.nextElementSibling; next?.scrollIntoView({ behavior: "smooth" }); });
}
async function ensurePlayerContext(player) {
  if (player.type !== "tv" || Number(state.series?.id) === Number(player.id) || state.playerContextKey) return;
  const contextKey = String(player.id), request = ++playerEpisodeContextRequest;
  state.playerContextKey = contextKey;
  try { await refreshPlayerEpisodeContext(Number(player.id), Number(player.season) || 1, request); }
  catch { /* The player remains available even if episode metadata cannot load. */ }
  finally { if (state.playerContextKey === contextKey) state.playerContextKey = null; }
}
async function refreshPlayerEpisodeContext(id, season, request = ++playerEpisodeContextRequest) {
  let series = Number(state.series?.id) === Number(id) ? state.series : normalize(await api(`tv/${id}`, { append_to_response:"credits,keywords,videos" }), "tv");
  if (request !== playerEpisodeContextRequest || state.route !== "player" || Number(state.player?.id) !== Number(id)) return;
  const activeSeason = Number(state.player.season) || Number(season) || 1;
  const episodes = Number(state.episodesSeriesId) === Number(id) && Number(state.episodesSeason) === activeSeason && state.episodes ? state.episodes : await api(`tv/${id}/season/${activeSeason}`);
  if (request !== playerEpisodeContextRequest || state.route !== "player" || Number(state.player?.id) !== Number(id) || Number(state.player?.season) !== activeSeason) return;
  state.series = series;
  state.selectedSeason = activeSeason;
  state.episodes = episodes;
  state.episodesSeriesId = Number(id);
  state.episodesSeason = activeSeason;
  syncPlayerEpisodeDisplay();
}
function syncPlayerEpisodeDisplay() {
  const player = state.player;
  if (!player || player.type !== "tv") return;
  const episode = Number(state.episodesSeriesId) === Number(player.id) && Number(state.episodesSeason) === Number(player.season) ? (state.episodes?.episodes || []).find(item => Number(item.episode_number) === Number(player.episode)) : null;
  if (episode) {
    player.title = episode.name || `Episode ${player.episode}`;
    player.overview = episode.overview || state.series?.overview || "";
    player.posterPath = state.series?.poster_path || episode.still_path || player.posterPath || null;
  }
  const label = document.querySelector("[data-player-episode-label]"), title = document.querySelector("[data-now-playing-title]");
  if (label) label.textContent = `Season ${player.season} · Episode ${player.episode}`;
  if (title) title.textContent = player.title || `Episode ${player.episode}`;
  const panel = document.querySelector("[data-player-episode-panel]");
  if (panel && Number(state.series?.id) === Number(player.id)) {
    panel.replaceWith(document.createRange().createContextualFragment(playerEpisodePanel(player)));
    bindPlayerEpisodes(player);
  }
}
async function followingNativeEpisode(player) {
  const id = Number(player.id), currentSeason = Number(player.season), currentEpisode = Number(player.episode);
  let series = Number(state.series?.id) === id ? state.series : null;
  if (!series) series = normalize(await api(`tv/${id}`, { append_to_response:"credits,keywords,videos" }), "tv");
  const seasons = (series.seasons || []).map(item => Number(item.season_number)).filter(number => number > currentSeason).sort((a, b) => a - b);
  const currentEpisodes = Number(state.episodesSeriesId) === id && Number(state.episodesSeason) === currentSeason && state.episodes ? state.episodes : await api(`tv/${id}/season/${currentSeason}`);
  const next = (currentEpisodes.episodes || []).find(item => Number(item.episode_number) > currentEpisode);
  if (next) return { season:currentSeason, episode:Number(next.episode_number) };
  for (const season of seasons) {
    const payload = await api(`tv/${id}/season/${season}`), first = (payload.episodes || []).find(item => Number(item.episode_number) > 0);
    if (first) return { season, episode:Number(first.episode_number) };
  }
  return null;
}
async function syncNativePlayerEpisode(change) {
  const previous = state.player;
  if (!previous || previous.type !== "tv") return;
  if (change.showId != null && Number(change.showId) !== Number(previous.id)) return;
  let target = change;
  if (change.next) target = await followingNativeEpisode(previous);
  if (state.route !== "player" || state.player !== previous) return;
  if (!target || !Number.isInteger(Number(target.season)) || !Number.isInteger(Number(target.episode))) return;
  const season = Number(target.season), episode = Number(target.episode);
  if (season < 0 || episode < 1 || (season === Number(previous.season) && episode === Number(previous.episode))) return;
  const oldEpisode = { ...previous };
  state.pendingEpisodeCompletion = isDirectNextEpisode(oldEpisode, { ...previous, season, episode }) && playbackProgressPercent(savedProgress(oldEpisode)) >= PREVIOUS_EPISODE_WATCHED_PERCENT ? oldEpisode : null;
  state.player = { ...previous, season, episode, title:`Episode ${episode}`, startAt:0 };
  state.selectedSeason = season;
  syncPlayerEpisodeDisplay();
  if (Number(state.episodesSeriesId) === Number(previous.id) && Number(state.episodesSeason) === season && Number(state.series?.id) === Number(previous.id)) return;
  const request = ++playerEpisodeContextRequest;
  try { await refreshPlayerEpisodeContext(Number(previous.id), season, request); }
  catch { /* Keep the counter in sync even if episode metadata is temporarily unavailable. */ }
}
function launchIntroEnabled() { try { const cached = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"), profile = cached?.profiles?.find(item => item.id === cached.activeProfileId), enabled = profile?.preferences?.introEnabled ?? cached?.preferences?.introEnabled; return enabled !== false; } catch { return true; } }
function dismissIntro() {
  if (!document.querySelector(".seven-intro")) return;
  clearTimeout(state.introTimer);
  clearTimeout(state.introSafetyTimer);
  state.introTimer = null;
  state.introSafetyTimer = null;
  document.documentElement.style.overflow = "";
  document.querySelector(".seven-intro")?.remove();
}
function maybeFinishIntro() {
  if (!state.startupReady || !state.introAnimationComplete || state.introExitStarted) return;
  const overlay = document.querySelector(".seven-intro");
  if (!overlay) return;
  state.introExitStarted = true;
  overlay.classList.add("exiting");
  clearTimeout(state.introSafetyTimer);
  state.introTimer = setTimeout(dismissIntro, 520);
}
function StartupIntro() {
  const overlay = document.createElement("div");
  overlay.className = "seven-intro";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `<div class="startup-intro-scene"><span class="startup-intro-rays"></span><span class="startup-intro-bloom"></span><span class="startup-intro-flare"></span><div class="startup-intro-logo"><img class="startup-intro-mark" src="assets/seven-wordmark-v2.png" alt="" fetchpriority="high" decoding="async"><span class="startup-intro-fallback" hidden>SEVEN</span><span class="startup-intro-sweep"></span></div></div>`;
  overlay.addEventListener("animationend", event => {
    if (event.target !== overlay) return;
    if (event.animationName === "intro-atmosphere") {
      state.introAnimationComplete = true;
      maybeFinishIntro();
    } else if (event.animationName === "intro-out") {
      dismissIntro();
    }
  });
  return overlay;
}
function renderLaunchIntro() {
  if (!launchIntroEnabled()) {
    state.introAnimationComplete = true;
    return;
  }
  if (document.querySelector(".seven-intro")) return;
  const overlay = StartupIntro();
  const logo = overlay.querySelector(".startup-intro-mark");
  const startIntro = loaded => {
    if (!overlay.isConnected) return;
    if (!loaded) {
      logo.hidden = true;
      overlay.querySelector(".startup-intro-fallback").hidden = false;
    }
    overlay.classList.add("live");
  };
  document.documentElement.style.overflow = "hidden";
  document.body.appendChild(overlay);
  state.introSafetyTimer = setTimeout(() => {
    state.startupReady = true;
    state.introAnimationComplete = true;
    if (!overlay.classList.contains("live")) startIntro(false);
    maybeFinishIntro();
  }, 12000);
  const imageReady = typeof logo.decode === "function"
    ? logo.decode().then(() => true, () => false)
    : new Promise(resolve => { logo.onload = () => resolve(true); logo.onerror = () => resolve(false); });
  Promise.race([imageReady, new Promise(resolve => setTimeout(() => resolve(false), 1800))]).then(startIntro);
}
function screenTimeState(profile = currentProfile()) {
  if (!profile?.kids || !profile.screenTime?.enabled) return null;
  const today = new Date().toISOString().slice(0, 10), st = profile.screenTime;
  if (st.date !== today) { st.date = today; st.used = 0; st.bonus = 0; }
  return st;
}
function screenTimeExceeded(st) { return (st.used || 0) >= st.minutes + (st.bonus || 0); }
function screenTimeMinutesLeft(st) { return Math.max(0, st.minutes + (st.bonus || 0) - (st.used || 0)); }
function syncScreenTimeBlock(profile, st) {
  const existing = document.querySelector(".screen-time-block");
  if (st && screenTimeExceeded(st)) { if (!existing) showScreenTimeBlock(profile, st); }
  else existing?.remove();
}
function tickScreenTime() {
  const profile = currentProfile(), st = screenTimeState(profile);
  if (!st || state.route === "profiles" || document.visibilityState !== "visible") return syncScreenTimeBlock(profile, st);
  if (!screenTimeExceeded(st)) {
    st.used = (st.used || 0) + 1;
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account));
    if (st.used % 5 === 0 && state.session) void saveAccount();
  }
  syncScreenTimeBlock(profile, st);
}
async function verifyParentCodeInput(code) {
  if (!code) return false;
  if (state.account.parentPinHash) return (await profileSecret(code)) === state.account.parentPinHash;
  try { const data = await localAPI("/api/account/parent-access", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ code }) }); return data.verified === true; } catch { return false; }
}
function extendScreenTime(profile, minutes) {
  const st = screenTimeState(profile);
  if (!st) return;
  st.bonus = (st.bonus || 0) + minutes;
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account));
  void saveAccount();
  document.querySelector(".screen-time-block")?.remove();
}
function showScreenTimeBlock(profile, st) {
  const overlay = document.createElement("div");
  overlay.className = "screen-time-block";
  const extendButtons = `<div class="screen-time-actions"><button type="button" data-extend-time="30">${t("+30 min")}</button><button type="button" data-extend-time="60">${t("+1 hour")}</button><button type="button" data-extend-time="1440" class="screen-time-off">${t("Off for today")}</button></div>`;
  overlay.innerHTML = `<div class="screen-time-card"><svg class="screen-time-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg><span class="brand">${t("SCREEN TIME")}</span><h2>${t("Time's up for today")}</h2><p>${escapeHTML(profile.name || "This profile")} has used all ${st.minutes} minutes of screen time. See you tomorrow!</p>${parentAccessConfigured() ? `<label class="screen-time-code">${t("Parent access code")}<input type="password" inputmode="numeric" maxlength="8" placeholder="Code" autocomplete="off"></label><p class="screen-time-error" hidden></p><div class="screen-time-actions"><button type="button" class="screen-time-unlock">${t("Unlock options")}</button></div>` : extendButtons}</div>`;
  overlay.addEventListener("click", event => event.stopPropagation());
  document.body.appendChild(overlay);
  const codeInput = overlay.querySelector(".screen-time-code input"), errorEl = overlay.querySelector(".screen-time-error"), unlockButton = overlay.querySelector(".screen-time-unlock");
  unlockButton?.addEventListener("click", async () => {
    if (!unlockButton.dataset.verified) {
      if (!await verifyParentCodeInput(codeInput.value)) { errorEl.hidden = false; errorEl.textContent = "That code is not correct."; return; }
      errorEl.hidden = true;
      unlockButton.dataset.verified = "1";
      unlockButton.closest(".screen-time-actions").outerHTML = extendButtons;
      bindExtendButtons(overlay, profile);
      codeInput.closest(".screen-time-code")?.remove();
      return;
    }
  });
  bindExtendButtons(overlay, profile);
}
function bindExtendButtons(overlay, profile) {
  overlay.querySelectorAll("[data-extend-time]").forEach(button => button.onclick = () => extendScreenTime(profile, Number(button.dataset.extendTime)));
}
const party = { code:null, role:null, socket:null, topic:null, ref:1, members:{}, hostKey:"", hostPosition:0, hostEvent:"", guestTime:0, lastHostTime:0, following:false, didInitialSync:false, outOfSync:false, chat:[], heartbeat:null, error:"" };
function partyCode() { const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let code = ""; for (let index = 0; index < 6; index++) code += alphabet[Math.floor(Math.random() * alphabet.length)]; return code; }
async function partyConnect(code, role) {
  await localAPI(`/api/party?code=${encodeURIComponent(code)}&limit=1`);
  party.code = code; party.role = role; party.error = ""; party.cursor = new Date(Date.now() - 4000).toISOString(); party.clientId ||= Math.random().toString(36).slice(2, 10);
  if (!party.pollTimer) party.pollTimer = setInterval(partyPoll, 2000);
  if (!party.hostTimer) party.hostTimer = setInterval(() => {
    if (party.role === "host") partyBroadcastState();
    Object.keys(party.members).forEach(name => { if (Date.now() - party.members[name].at > 45000) delete party.members[name]; });
    renderPartyPanel();
  }, 4000);
  void partyPoll();
}
async function partyPoll() {
  if (!party.code || party.pollingBusy) return;
  party.pollingBusy = true;
  try {
    const rows = await localAPI(`/api/party?code=${encodeURIComponent(party.code)}&since=${encodeURIComponent(party.cursor)}`);
    for (const row of Array.isArray(rows) ? rows : []) {
      const data = row.payload;
      if (row.created_at > party.cursor) party.cursor = row.created_at;
      if (!data || data.sender === party.clientId) continue;
      partyReceive(data);
    }
  } catch { /* Transient polling errors are retried on the next tick. */ }
  party.pollingBusy = false;
}
function partySend(data) {
  if (!party.code) return;
  data = { ...data, sender: party.clientId };
  void localAPI("/api/party", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ code:party.code, payload:data }) }).catch(() => {});
}
function partyTouchMember(name, color) { if (name) party.members[name] = { color:color || "#e50914", at:Date.now() }; }
function partyBroadcastState() {
  const p = state.player;
  if (!p || party.role !== "host") return;
  partySend({ kind:"state", key:`${p.type}:${p.id}:${p.season || 0}:${p.episode || 0}`, position:Math.floor(party.lastHostTime || 0), event:party.hostEvent, name:currentProfile()?.name || "Host", color:currentProfile()?.color });
}
function partyReceive(data) {
  if (data.kind === "hello" && party.role === "host") { partyTouchMember(data.name, data.color); partyBroadcastState(); renderPartyPanel(); return; }
  if (data.kind === "state" && party.role === "guest") {
    party.hostKey = data.key || ""; party.hostPosition = Number(data.position) || 0; partyTouchMember(data.name, data.color);
    const currentKey = state.player ? `${state.player.type}:${state.player.id}:${state.player.season || 0}:${state.player.episode || 0}` : "";
    if (data.key && data.key !== currentKey) { party.outOfSync = false; renderPartyPanel(); return; }
    const drift = Math.abs(party.guestTime - party.hostPosition);
    if (party.didInitialSync && drift > 12 && !party.outOfSync) { party.outOfSync = true; }
    else if (party.outOfSync && drift <= 8) { party.outOfSync = false; }
    if (!party.didInitialSync) { party.didInitialSync = true; if (drift > 20) partySyncToHost(); }
    renderPartyPanel();
    return;
  }
  if (data.kind === "chat") { party.chat.push({ name:String(data.name || "Guest").slice(0, 24), color:data.color || "#e50914", text:String(data.text || "").slice(0, 300) }); party.chat = party.chat.slice(-50); partyTouchMember(data.name, data.color); renderPartyPanel(); return; }
  if (data.kind === "join") { partyTouchMember(data.name, data.color); renderPartyPanel(); }
}
async function partyStart() {
  try {
    const code = partyCode();
    await partyConnect(code, "host");
    partySend({ kind:"join", name:currentProfile()?.name || "Host", color:currentProfile()?.color });
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("watch", code);
    if (state.player) url.searchParams.set("title", state.player.type === "tv" ? `tv:${state.player.id}:${state.player.season}:${state.player.episode}` : `movie:${state.player.id}`);
    history.replaceState(null, "", url);
    renderPartyPanel();
  } catch (error) { party.error = error.message; renderPartyPanel(); }
}
async function partyJoin(code) {
  try {
    await partyConnect(code, "guest");
    partySend({ kind:"hello", name:currentProfile()?.name || "Guest", color:currentProfile()?.color });
    renderPartyPanel();
  } catch (error) { party.error = error.message; renderPartyPanel(); }
}
function partyLeave() {
  try { party.socket?.close(); } catch {}
  clearInterval(party.pollTimer);
  clearInterval(party.hostTimer);
  party.pollTimer = null; party.hostTimer = null;
  party.code = null; party.role = null; party.socket = null; party.members = {}; party.chat = []; party.didInitialSync = false; party.outOfSync = false; party.following = false; party.hostKey = ""; party.hostPosition = 0; party.guestTime = 0; party.lastHostTime = 0; party.cursor = null;
  const url = new URL(location.href);
  url.searchParams.delete("watch");
  history.replaceState(null, "", url);
}
function partyFollowHost() {
  const [type, id, season, episode] = (party.hostKey || "").split(":");
  if (!type || !id) return;
  party.following = true;
  if (type === "movie") return openItem("movie", id);
  openItem("tv", id).then(() => {
    if (state.route === "series" && state.series && Number(state.series.id) === Number(id)) { state.selectedSeason = Number(season) || 1; playEpisode(Number(episode) || 1, false); }
  });
}
function partySyncToHost() {
  if (!state.player) return;
  party.syncPosition = party.hostPosition;
  party.outOfSync = false;
  render();
}
function ensurePartyPanel() {
  let panel = document.querySelector(".party-panel");
  if (!party.code && !party.error) { panel?.remove(); return null; }
  if (!panel && state.route === "player") {
    document.querySelector(".now")?.insertAdjacentHTML("afterend", `<section class="party-panel"></section>`);
    panel = document.querySelector(".party-panel");
  }
  return panel;
}
function renderPartyPanel() {
  if (party.code) document.querySelector("[data-party-start]")?.remove();
  const panel = ensurePartyPanel();
  if (!panel) return;
  if (!party.code) { if (party.error) panel.innerHTML = `<div class="party-head"><span class="brand">WATCH PARTY</span></div><p class="party-status">${escapeHTML(party.error)}</p>`; return; }
  const members = Object.entries(party.members);
  const currentKey = state.player ? `${state.player.type}:${state.player.id}:${state.player.season || 0}:${state.player.episode || 0}` : "";
  const differentTitle = party.role === "guest" && party.hostKey && party.hostKey !== currentKey;
  const inviteURL = (() => { const url = new URL(location.href); url.searchParams.set("watch", party.code); return url.href; })();
  panel.innerHTML = `
    <div class="party-head"><span class="brand">WATCH PARTY${party.role === "host" ? " · YOU'RE HOSTING" : ""}</span><button class="party-leave" data-party-leave>Leave</button></div>
    <div class="party-code-row"><code class="party-code">${party.code}</code><button class="party-copy" data-party-copy>Copy invite link</button></div>
    <div class="party-members"><b>${members.length + 1} ${members.length ? "people" : "person"} here</b><span>${escapeHTML(["You", ...members.map(([name]) => name)].slice(0, 6).join(", "))}</span></div>
    ${differentTitle ? `<button class="party-sync primary" data-party-follow>Play along with the host</button>` : party.role === "guest" && party.outOfSync ? `<button class="party-sync primary" data-party-sync>Sync with host</button>` : `<p class="party-status">${party.role === "host" ? "Share the invite link — friends join in one tap." : "You're watching in sync with the host."}</p>`}
    <div class="party-chat-log" data-party-log>${party.chat.length ? party.chat.map(message => `<p><b style="color:${escapeHTML(message.color)}">${escapeHTML(message.name)}</b> ${escapeHTML(message.text)}</p>`).join("") : `<p class="party-chat-empty">Say hi to your party.</p>`}</div>
    <form class="party-chat-form" data-party-chat><input type="text" maxlength="240" placeholder="Say something…" autocomplete="off"><button type="submit">Send</button></form>`;
  panel.querySelector("[data-party-leave]").onclick = () => { partyLeave(); render(); };
  panel.querySelector("[data-party-copy]").onclick = async event => { try { await navigator.clipboard.writeText(inviteURL); event.currentTarget.textContent = "Link copied!"; } catch { event.currentTarget.textContent = inviteURL; } };
  panel.querySelector("[data-party-follow]")?.addEventListener("click", partyFollowHost);
  panel.querySelector("[data-party-sync]")?.addEventListener("click", partySyncToHost);
  const log = panel.querySelector("[data-party-log]");
  log.scrollTop = log.scrollHeight;
  panel.querySelector("[data-party-chat]").onsubmit = event => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input"), text = input.value.trim();
    if (!text) return;
    const message = { kind:"chat", name:currentProfile()?.name || "Guest", color:currentProfile()?.color || "#e50914", text };
    party.chat.push({ name:message.name, color:message.color, text:message.text }); party.chat = party.chat.slice(-50);
    partySend(message);
    input.value = "";
    renderPartyPanel();
  };
}
function showPartyModal() {
  document.querySelector(".modal")?.remove();
  app.insertAdjacentHTML("beforeend", `<div class="modal party-modal"><section class="auth-card"><button class="modal-close" type="button" data-party-modal-close>×</button><span class="brand">WATCH PARTY</span><h2>Watch together</h2><p>Start a party and share the code — or join a friend's with theirs.</p><button class="primary auth-submit" type="button" data-party-start-modal>Start a party</button><div class="party-join-row"><input type="text" maxlength="6" placeholder="CODE" aria-label="Party code" autocomplete="off" spellcheck="false"><button class="secondary" type="button" data-party-join-modal>Join</button></div><p class="form-error" data-party-modal-error hidden></p></section></div>`);
  document.querySelector("[data-party-modal-close]").onclick = () => document.querySelector(".party-modal")?.remove();
  document.querySelector(".party-modal").addEventListener("click", event => { if (event.target.classList.contains("party-modal")) document.querySelector(".party-modal")?.remove(); });
  document.querySelector("[data-party-start-modal]").onclick = async () => { document.querySelector(".party-modal")?.remove(); await partyStart(); };
  const join = async () => {
    const input = document.querySelector(".party-join-row input"), error = document.querySelector("[data-party-modal-error]"), code = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) { error.hidden = false; error.textContent = "Enter the 6-character party code."; return; }
    document.querySelector(".party-modal")?.remove();
    await partyJoin(code);
  };
  document.querySelector("[data-party-join-modal]").onclick = join;
  document.querySelector(".party-join-row input").onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); join(); } };
}
function providerMenuHTML() {
  const labels = { cinesrc:"CineSrc 4K", vidfast:"VidFast 4K", multiembed:"MultiEmbed", vidsrc:"VidSrc", "2embed":"2Embed" }, current = selectedPlayerProvider();
  return `<div class="provider-menu"><button class="provider-toggle" data-provider-menu>${labels[current] || "CineSrc 4K"} ▾</button><div class="provider-list" data-provider-list hidden>${PLAYER_PROVIDERS.map(provider => `<button class="provider-option ${provider === current ? "active" : ""}" data-provider-select="${provider}">${labels[provider]}${provider === current ? " ✓" : ""}</button>`).join("")}</div></div>`;}
function renderPlayer() {
  const p = state.player, saved = JSON.parse(localStorage.getItem(watchKey(p)) || "{}"), label = p.type === "tv" ? `Season ${p.season} · Episode ${p.episode}` : "Movie", startAt = party.code ? Math.max(0, Number(party.syncPosition) || 0) : Math.max(0, Number(p.startAt) || 0), playbackNote = startAt ? (party.code ? `Playing with your party from ${timeLabel(startAt)}` : `Resuming from ${timeLabel(startAt)}`) : savedStart(p) ? `Resume is available from ${timeLabel(savedStart(p))}` : escapeHTML(p.overview || "Playback progress is saved on this device.");
  const media = `<iframe class="player" src="${playerURL(p, startAt)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen webkitallowfullscreen mozallowfullscreen></iframe>`;
  const partyControl = party.code ? "" : `<button class="party-quick" data-party-modal aria-label="Watch together" title="Watch together"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8.1" r="2.25"/><path d="M3.9 17.9c.45-3.03 1.92-4.62 4.1-4.62s3.65 1.59 4.1 4.62"/><circle cx="15.9" cy="9.3" r="1.7"/><path d="M14.2 14.3c.6-.58 1.18-.87 1.78-.87 1.6 0 2.72 1.22 3.08 3.46"/><path class="party-play" d="m16.8 5.2 3.35 1.95-3.35 1.95z"/></svg></button>`;
  app.innerHTML = `${header()}<button class="back" data-back>‹ Back</button><section class="player-stage"><div class="player-stage-bar"><span class="player-stage-context" data-player-episode-label>${label}</span><div class="player-stage-actions">${providerMenuHTML()}</div></div><div class="player-frame">${media}</div></section><section class="now"><div class="now-heading"><div><span class="brand">NOW PLAYING</span><h2 data-now-playing-title>${escapeHTML(p.title)}</h2></div>${partyControl}</div><div class="progress player-saved-progress"><i id="bar" style="width:${saved.progress || 0}%"></i></div><p id="time" class="player-saved-time">${playbackNote}</p></section>${party.code || state.pendingWatch ? `<section class="party-panel"></section>` : ""}${playerEpisodePanel(p)}${footer()}`;
  party.syncPosition = 0;
  bindCommon(); bindPlayerEpisodes(p); bindPlayerControlLift(); ensurePlayerContext(p); startPlayerProgressPolling();
  if (state.pendingWatch && !party.code) { const code = state.pendingWatch; state.pendingWatch = null; partyJoin(code); }
  document.querySelector("[data-party-modal]")?.addEventListener("click", showPartyModal);
  document.querySelector("[data-provider-menu]")?.addEventListener("click", event => { event.stopPropagation(); const list = document.querySelector("[data-provider-list]"); if (list) list.hidden = !list.hidden; });
  document.querySelectorAll("[data-provider-select]").forEach(option => option.onclick = async () => { updateCurrentPreferences({ playerProvider: option.dataset.providerSelect }); await saveAccount(); render(); });
  renderPartyPanel();
  document.querySelector("[data-back]").onclick = () => { state.route = p.type === "tv" ? "series" : "home"; render(); };
}
function simplifiedTitleQuery(query) {
  const simplified = query.trim().replace(/\b(new|latest|series|tv\s+show|show|movie|film|gameplay|trailer|official)\b/gi, " ").replace(/\s+/g, " ").trim();
  return simplified.length >= 2 && simplified.toLowerCase() !== query.trim().toLowerCase() ? simplified : null;
}
function searchResults(payload) {
  const titles = (payload.results || []).filter(item => item.media_type !== "person");
  return (currentProfile()?.kids ? titles.filter(item => contentAllowed(item)) : titles).map(item => normalize(item));
}
async function findTitles(query) {
  const primary = searchResults(await api("search/multi", { query }));
  if (primary.length) return primary;
  const fallback = simplifiedTitleQuery(query);
  return fallback ? searchResults(await api("search/multi", { query:fallback })) : primary;
}
async function search(query) { state.search = query; state.searchFilter = "all"; if (query.trim().length < 2) { state.searchResults = []; state.route = "home"; render(); return; } void addRecentSearch(query.trim()); try { state.searchResults = await findTitles(query); state.route = "search"; } catch (error) { state.error = error.message; state.route = "home"; } render(); }
function hideSearchSuggestions(input) { const menu = input?.closest(".search")?.querySelector(".search-suggestions"); if (menu) { menu.hidden = true; menu.innerHTML = ""; } }
function showRecentSearches(input) {
  const menu = input?.closest(".search")?.querySelector(".search-suggestions");
  if (!menu) return;
  const list = recentSearches();
  if (!list.length) return hideSearchSuggestions(input);
  menu.innerHTML = `<div class="search-recent-header"><span>RECENT SEARCHES</span><button type="button" class="search-recent-clear-all" data-clear-recent-searches>Clear</button></div><div class="search-recent-list">${list.slice(0, 3).map(query => `<div class="search-recent-item"><button type="button" class="search-recent-query" data-search-recent="${escapeHTML(query)}"><svg class="search-recent-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/></svg><span>${escapeHTML(query)}</span></button><button type="button" class="search-recent-remove" data-remove-recent-search="${escapeHTML(query)}" aria-label="Remove ${escapeHTML(query)}">×</button></div>`).join("")}</div>`;
  menu.hidden = false;
  menu.querySelectorAll("[data-search-recent]").forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = () => { const query = button.dataset.searchRecent; if (input) input.value = query; hideSearchSuggestions(input); search(query); }; });
  menu.querySelectorAll("[data-remove-recent-search]").forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = async () => { await removeRecentSearch(button.dataset.removeRecentSearch); if (input && input.value.trim().length < 2) showRecentSearches(input); }; });
  menu.querySelector("[data-clear-recent-searches]")?.addEventListener("click", async event => { event.preventDefault(); await clearRecentSearches(); hideSearchSuggestions(input); });
}
function showSearchSuggestions(input, query, items) { const menu = input.closest(".search")?.querySelector(".search-suggestions"); if (!menu) return; const picks = items.slice(0, 5); menu.innerHTML = picks.length ? `${picks.map(item => `<button class="search-suggestion" data-search-result="${item.type}:${item.id}"><img src="${posterOf(item)}" alt=""><span><b>${escapeHTML(titleOf(item))}</b><small>${yearOf(item) || "New"} · ${item.type === "tv" ? "Series" : "Movie"}</small></span></button>`).join("")}<button class="search-all" data-search-all>See all results for “${escapeHTML(query)}” <b>›</b></button>` : `<p class="search-empty">No quick matches yet.</p>`; menu.hidden = false; menu.querySelectorAll("[data-search-result]").forEach(button => button.onclick = () => { void addRecentSearch(query.trim()); const [type, id] = button.dataset.searchResult.split(":"); openItem(type, id); }); menu.querySelector("[data-search-all]")?.addEventListener("click", () => { void addRecentSearch(query.trim()); state.search = query; state.route = "search"; render(); }); }
async function suggestSearch(input) { const query = input.value.trim(), request = ++searchRequest; state.search = input.value; if (query.length < 2) return showRecentSearches(input); try { const found = await findTitles(query); if (request !== searchRequest || input.value.trim() !== query) return; state.searchResults = found; showSearchSuggestions(input, query, found); } catch { if (request === searchRequest) hideSearchSuggestions(input); } }
function renderSearch() { const filter = state.searchFilter || "all", items = state.searchResults.filter(item => filter === "all" || item.type === filter); app.innerHTML = `${header()}<section class="search-page"><span class="brand">DISCOVER</span><h2>Search results</h2>${state.searchResults.length ? `<div class="search-filters" role="group" aria-label="Filter search results">${[["all","All"],["movie","Movies"],["tv","Series"]].map(([value, label]) => `<button class="${filter === value ? "active" : ""}" data-search-filter="${value}">${label}</button>`).join("")}</div>${items.length ? `<div class="result-grid">${items.map(card).join("")}</div>` : `<p class="search-empty">No ${filter === "movie" ? "movies" : "series"} match this search.</p>`}` : "<p>No matches found. Try a movie, series, or actor name.</p>"}</section>${footer()}`; bindCommon(); document.querySelectorAll("[data-search-filter]").forEach(button => button.onclick = () => { state.searchFilter = button.dataset.searchFilter; renderSearch(); }); }
const GENRES = { 12:"Adventure", 16:"Animation", 18:"Drama", 28:"Action", 35:"Comedy", 53:"Thriller", 80:"Crime", 99:"Documentary", 10749:"Romance", 878:"Science fiction", 9648:"Mystery", 10751:"Family", 10759:"Action & adventure", 10765:"Sci-fi & fantasy" };
function watchedGenres(type = "") { const counts = {}; likedTitles().filter(entry => !type || entry.type === type).forEach(entry => (entry.genreIds || []).forEach(id => { counts[id] = (counts[id] || 0) + 3; })); historyEntries().filter(entry => !type || entry.type === type).forEach(entry => (entry.genreIds || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; })); return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => Number(id)); }
async function openForYou() {
  state.route = "for-you";
  state.forYou = { loading:true };
  render();
  const activity = historyEntries(), latest = activity[0], latestLike = likedTitles()[0], anchor = latestLike || latest;
  const preferences = currentPreferences(), savedGenreIds = new Set((Array.isArray(preferences.favoriteGenres) ? preferences.favoriteGenres : []).map(Number));
  const pickedGenres = ONBOARDING_GENRES.filter(([id]) => savedGenreIds.has(id)).slice(0, 3);
  const movieGenre = pickedGenres.length ? pickedGenres.map(([id]) => id).join("|") : watchedGenres("movie")[0] || watchedGenres()[0];
  const seriesGenre = pickedGenres.length ? [...new Set(pickedGenres.map(([, , tvId]) => tvId).filter(Boolean))].join("|") : watchedGenres("tv")[0] || watchedGenres()[0];
  const showMovies = preferences.contentMix !== "series", showSeries = preferences.contentMix !== "movies", familySafe = useFamilyCatalog();
  const movieParams = { ...(movieGenre ? { with_genres:movieGenre } : {}), sort_by:"popularity.desc" };
  const seriesParams = { ...(seriesGenre ? { with_genres:seriesGenre } : {}), sort_by:"popularity.desc" };
  if (familySafe) {
    movieParams.certification_country = "US";
    movieParams["certification.lte"] = currentProfile()?.kids ? "PG" : "PG-13";
    seriesParams.certification_country = "US";
    seriesParams["certification.lte"] = "TV-PG";
  }
  const pickedNames = pickedGenres.map(([, name]) => name);
  const reason = pickedNames.length ? `Selected for your taste: ${pickedNames.join(", ")}.` : latestLike ? `Built around what ${currentProfile()?.name || "you"} likes.` : latest ? `Built around ${currentProfile()?.name || "your"} viewing activity.` : "Play a title or rate one to tune this page.";
  try {
    const [movies, series, freshMovies, freshSeries] = await Promise.all([
      showMovies ? api("discover/movie", movieParams) : Promise.resolve({ results:[] }),
      showSeries ? api("discover/tv", seriesParams) : Promise.resolve({ results:[] }),
      showMovies ? (pickedGenres.length || familySafe ? api("discover/movie", { ...movieParams, "primary_release_date.gte":`${new Date().getFullYear() - 1}-01-01`, "primary_release_date.lte":new Date().toISOString().slice(0,10), sort_by:"primary_release_date.desc" }) : api("movie/now_playing")) : Promise.resolve({ results:[] }),
      showSeries ? (pickedGenres.length || familySafe ? api("discover/tv", { ...seriesParams, "first_air_date.gte":`${new Date().getFullYear() - 1}-01-01`, "first_air_date.lte":new Date().toISOString().slice(0,10), sort_by:"first_air_date.desc" }) : api("tv/on_the_air")) : Promise.resolve({ results:[] })
    ]);
    const rails = {};
    if (showMovies) {
      const movieHeading = pickedNames.length ? `More ${pickedNames.slice(0, 2).join(" & ")} movies` : movieGenre ? anchor?.title ? latestLike ? `Because you liked ${anchor.title}` : `Because you watched ${anchor.title}` : `${GENRES[movieGenre] || "Personalized"} movies for you` : "Popular movies for you";
      rails[movieHeading] = results(movies);
      rails["New movies"] = results(freshMovies);
    }
    if (showSeries) {
      const seriesHeading = pickedNames.length ? `More ${pickedNames.slice(0, 2).join(" & ")} series` : seriesGenre ? `${GENRES[seriesGenre] || "Personalized"} series for you` : "Popular series for you";
      rails[seriesHeading] = results(series);
      rails["New series"] = results(freshSeries);
    }
    state.forYou = { genre:movieGenre || seriesGenre, latest, reason, rails };
  } catch (error) { state.forYou = { error:error.message, rails:{} }; }
  render();
}
function renderForYou() { const view = state.forYou || { loading:true }; app.innerHTML = `${header()}<section class="browse-page"><span class="brand">MADE FOR YOU</span><h2>For You</h2><p>${escapeHTML(view.reason || (view.genre ? `Personal picks based on ${currentProfile()?.name || "your profile"}’s viewing activity.` : "Play a title or rate one to tune this page."))}</p></section>${view.loading ? `<section class="rail"><div class="skeleton-line wide"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section>` : view.error ? `<p class="setup">${escapeHTML(view.error)}</p>` : Object.entries(view.rails).map(([name, items]) => rail(name, items)).join("")}${footer()}`; bindCommon(); }
const MOVIE_FILTERS = [["All",null],["Action",28],["Adventure",12],["Animation",16],["Comedy",35],["Crime",80],["Drama",18],["Family",10751],["Horror",27],["Romance",10749],["Sci-Fi",878],["Thriller",53]];
const SERIES_FILTERS = [["All",null],["Action",10759],["Animation",16],["Comedy",35],["Crime",80],["Documentary",99],["Drama",18],["Mystery",9648],["Sci-Fi",10765]];
function discoverGenre(type, genre, sortBy) { const params = { with_genres:genre, sort_by:sortBy }; if (sortBy === "vote_average.desc") params["vote_count.gte"] = 100; return api(`discover/${type}`, params); }
const DEFAULT_CATALOG_FILTERS = { date:"any", score:"", sort:"popularity.desc", certificate:"" };
function filterTrigger() { return `<button class="filter-trigger" data-open-filters aria-label="Open filters"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4"/></svg> Filters</button>`; }
function discoveryParams(type, page, genre, filters) { const params = { sort_by:filters.sort || "popularity.desc", page }; if (genre) params.with_genres = genre; if (filters.score) { params["vote_average.gte"] = filters.score; params["vote_count.gte"] = 50; } const year = new Date().getFullYear(), dateKey = type === "movie" ? "primary_release_date" : "first_air_date"; if (filters.date === "year") params[`${dateKey}.gte`] = `${year}-01-01`; if (filters.date === "five") params[`${dateKey}.gte`] = `${year - 5}-01-01`; if (filters.date === "2010s") { params[`${dateKey}.gte`] = "2010-01-01"; params[`${dateKey}.lte`] = "2019-12-31"; } if (filters.date === "older") params[`${dateKey}.lte`] = "2009-12-31"; if (type === "movie" && filters.certificate) { params.certification_country = "US"; params.certification = filters.certificate; } return params; }
function showCatalogFilters(type) { const saved = { ...DEFAULT_CATALOG_FILTERS, ...(state.catalogFilters?.[type] || {}) }, isMovie = type === "movie"; document.querySelector(".modal")?.remove(); app.insertAdjacentHTML("beforeend", `<div class="modal"><form class="filter-panel" id="catalog-filter-form"><button type="button" class="modal-close" data-close>×</button><span class="brand">FILTER ${isMovie ? "MOVIES" : "SERIES"}</span><h2>Refine your picks</h2><label>Release date<select name="date"><option value="any">Any time</option><option value="year">This year</option><option value="five">Last 5 years</option><option value="2010s">2010–2019</option><option value="older">Before 2010</option></select></label><label>Minimum audience score<select name="score"><option value="">Any score</option><option value="5">5.0+</option><option value="6">6.0+</option><option value="7">7.0+</option><option value="8">8.0+</option></select></label>${isMovie ? `<label>Age rating (US)<select name="certificate"><option value="">Any rating</option><option value="G">G</option><option value="PG">PG</option><option value="PG-13">PG-13</option><option value="R">R</option></select></label>` : `<p class="filter-note">TV age ratings vary by region; SEVEN keeps date and audience-score filters available here.</p>`}<label>Sort by<select name="sort"><option value="popularity.desc">Most popular</option><option value="primary_release_date.desc">Newest release</option><option value="first_air_date.desc">Newest release</option><option value="vote_average.desc">Highest rated</option></select></label><button class="primary auth-submit" type="submit">Show results</button><button class="filter-clear" type="button" data-clear-filters>Clear filters</button></form></div>`); const form = document.querySelector("#catalog-filter-form"); Object.entries(saved).forEach(([name, value]) => { const field = form.elements.namedItem(name); if (field) field.value = value; }); document.querySelector("[data-close]").onclick = () => document.querySelector(".modal")?.remove(); document.querySelector("[data-clear-filters]").onclick = () => { state.catalogFilters ||= {}; state.catalogFilters[type] = { ...DEFAULT_CATALOG_FILTERS }; document.querySelector(".modal")?.remove(); openAllCatalog(type); }; form.onsubmit = event => { event.preventDefault(); const values = new FormData(form); const filters = { date:values.get("date"), score:values.get("score"), sort:values.get("sort"), certificate:values.get("certificate") || "" }; if (type === "tv" && filters.sort === "primary_release_date.desc") filters.sort = "first_air_date.desc"; state.catalogFilters ||= {}; state.catalogFilters[type] = filters; document.querySelector(".modal")?.remove(); openAllCatalog(type, null, 1, false, filters); }; }
async function openCatalog(type, genre = null) { state.route = "catalog"; state.browse = { type, genre, loading:true }; render(); const baseRoutes = type === "movie" ? [["Now playing","movie/now_playing"],["Popular movies","movie/popular"],["Top rated movies","movie/top_rated"],["Coming soon","movie/upcoming"]] : [["On the air","tv/on_the_air"],["Popular series","tv/popular"],["Top rated series","tv/top_rated"],["Airing today","tv/airing_today"]]; const routes = genre ? [[`Popular ${GENRES[genre] || ""}`.trim(),"popularity.desc"],[`Top rated ${GENRES[genre] || ""}`.trim(),"vote_average.desc"],[`New ${GENRES[genre] || ""}`.trim(), type === "movie" ? "primary_release_date.desc" : "first_air_date.desc"]] : baseRoutes; try { const responses = await Promise.all(routes.map(([, route]) => genre ? discoverGenre(type, genre, route) : api(route))); state.browse = { type, genre, rails:Object.fromEntries(routes.map(([name], index) => [name, results(responses[index])])) }; } catch (error) { state.browse = { type, genre, error:error.message, rails:{} }; } render(); }
function renderCatalog() { const view = state.browse || { loading:true, type:"movie" }, label = view.type === "movie" ? "Movies" : "Series", filters = view.type === "movie" ? MOVIE_FILTERS : SERIES_FILTERS; app.innerHTML = `${header()}<section class="browse-page"><span class="brand">EXPLORE SEVEN</span><h2>${label}</h2><p>${view.type === "movie" ? "New releases, crowd favorites, and top-rated films." : "Series that are airing now, popular, and highly rated."}</p><div class="catalog-type-switch" role="tablist" aria-label="Browse movies or series"><button type="button" role="tab" aria-selected="${view.type === "movie"}" class="${view.type === "movie" ? "active" : ""}" data-catalog-type="movie">Movies</button><button type="button" role="tab" aria-selected="${view.type === "tv"}" class="${view.type === "tv" ? "active" : ""}" data-catalog-type="tv">Series</button></div><div class="catalog-actions">${filterTrigger()}<button class="all-catalog" data-all-catalog>Browse all ${label.toLowerCase()} <b>›</b></button></div><div class="filter-row" aria-label="Filter ${label}">${filters.map(([name, id]) => `<button class="filter ${view.genre === id ? "active" : ""}" data-filter="${id ?? "all"}">${name}</button>`).join("")}</div></section>${view.loading ? `<section class="rail"><div class="skeleton-line wide"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section>` : view.error ? `<p class="setup">${escapeHTML(view.error)}</p>` : Object.entries(view.rails).map(([name, items]) => rail(name, items)).join("")}${footer()}`; bindCommon(); document.querySelector("[data-open-filters]").onclick = () => showCatalogFilters(view.type); document.querySelector("[data-all-catalog]").onclick = () => openAllCatalog(view.type); document.querySelectorAll("[data-catalog-type]").forEach(button => button.onclick = () => { state.mobileBrowseType = button.dataset.catalogType; openCatalog(button.dataset.catalogType); }); document.querySelectorAll("[data-filter]").forEach(button => button.onclick = () => openCatalog(view.type, button.dataset.filter === "all" ? null : Number(button.dataset.filter))); }
async function openAllCatalog(type, genre = null, page = 1, append = false, selectedFilters = null) { const filters = { ...DEFAULT_CATALOG_FILTERS, ...(selectedFilters || state.catalogFilters?.[type] || {}) }, existing = append ? (state.allCatalog?.items || []) : []; state.route = "all-catalog"; state.allCatalog = { type, genre, page, filters, items:existing, loading:true }; render(); try { const response = await api(`discover/${type}`, discoveryParams(type, page, genre, filters)); state.allCatalog = { type, genre, page, filters, totalPages:Math.min(response.total_pages || 1, 500), items:[...existing, ...results(response)] }; } catch (error) { state.allCatalog = { type, genre, page, filters, items:existing, error:error.message }; } render(); }
function renderAllCatalog() {
  const view = state.allCatalog || { loading:true, type:"movie", items:[] }, label = view.type === "movie" ? "All movies" : "All series", filters = view.type === "movie" ? MOVIE_FILTERS : SERIES_FILTERS;
  const loading = view.loading ? `<div class="catalog-loading skeleton"></div>` : view.page < (view.totalPages || 1) ? `<button class="load-more" data-load-more>Load more ${view.type === "movie" ? "movies" : "series"}</button>` : "";
  const body = view.error ? `<p class="setup">${escapeHTML(view.error)}</p>` : `<div class="result-grid explore-grid">${view.items.map(card).join("")}</div>${loading}`;
  app.innerHTML = `${header()}<button class="back" data-back-all>‹ ${view.type === "movie" ? "Movies" : "Series"}</button><section class="browse-page"><span class="brand">COMPLETE CATALOG</span><h2>${label}</h2><p>Browse the full TMDB catalog, filtered the way you want.</p><div class="catalog-actions">${filterTrigger()}</div><div class="filter-row" aria-label="Filter ${label}">${filters.map(([name, id]) => `<button class="filter ${view.genre === id ? "active" : ""}" data-all-filter="${id ?? "all"}">${name}</button>`).join("")}</div></section>${body}${footer()}`;
  bindCommon(); document.querySelector("[data-back-all]").onclick = () => { state.route = "catalog"; render(); }; document.querySelector("[data-open-filters]").onclick = () => showCatalogFilters(view.type); document.querySelectorAll("[data-all-filter]").forEach(button => button.onclick = () => openAllCatalog(view.type, button.dataset.allFilter === "all" ? null : Number(button.dataset.allFilter))); document.querySelector("[data-load-more]")?.addEventListener("click", () => openAllCatalog(view.type, view.genre, view.page + 1, true));
}
function renderExplore() { const view = state.exploreView; if (!view) { state.route = "home"; return renderHome(); } app.innerHTML = `${header()}<button class="back" data-back-explore>‹ Back</button><section class="search-page"><span class="brand">SEVEN COLLECTION</span><h2>${escapeHTML(view.name)}</h2><p>Browse all ${view.items.length} titles in this collection.</p><div class="result-grid explore-grid">${view.items.map(card).join("")}</div></section>${footer()}`; bindCommon(); document.querySelector("[data-back-explore]").onclick = () => { state.route = view.fromRoute; state.exploreView = null; render(); }; }
function renderHistory() { const filter = state.historyFilter || "all", allEntries = historyEntries(), entries = allEntries.filter(entry => filter === "all" || filter === "progress" && !entry.watched || filter === "watched" && entry.watched); app.innerHTML = `${header()}<button class="back" data-history-back>‹ Browse</button><section class="history-page"><span class="brand">VIEWING ACTIVITY</span><h2>${escapeHTML(currentProfile()?.name || "Your")} history</h2><p>Everything watched with this profile. You can replay, resume, or hide an item from this device and your synced history.</p>${allEntries.length ? `<div class="history-toolbar"><div class="history-filters" role="group" aria-label="Filter viewing activity">${[["all","All"],["progress","In progress"],["watched","Watched"]].map(([value, label]) => `<button class="${filter === value ? "active" : ""}" data-history-filter="${value}">${label}</button>`).join("")}</div><span>${entries.length} ${entries.length === 1 ? "title" : "titles"}</span></div>${entries.length ? `<div class="history-list">${entries.map(entry => `<article class="history-item"><button class="history-main" data-history="${encodeURIComponent(entry.key)}"><img src="${entry.posterPath ? TMDB_IMAGE + entry.posterPath : "icon.svg"}" alt=""><span><b>${escapeHTML(entry.title)}</b><small>${entry.type === "tv" ? `Series · S${entry.season} E${entry.episode}` : "Movie"} · ${historyDate(entry.lastWatchedAt)}</small><em>${entry.watched ? "Watched" : `Resume from ${timeLabel(Math.floor(entry.currentTime || 0))}`}</em></span><i>›</i></button><button class="history-remove" data-remove-history="${encodeURIComponent(entry.key)}" aria-label="Hide ${escapeHTML(entry.title)}">×</button></article>`).join("")}</div>` : `<p class="history-empty">No ${filter === "progress" ? "unfinished titles" : "completed titles"} in this profile’s activity yet.</p>`}` : `<p class="history-empty">No viewing activity for this profile yet.</p>`}</section>${footer()}`; bindCommon(); document.querySelector("[data-history-back]").onclick = () => { state.route = state.historyReturn || "home"; state.historyReturn = null; render(); }; document.querySelectorAll("[data-history-filter]").forEach(button => button.onclick = () => { state.historyFilter = button.dataset.historyFilter; render(); }); document.querySelectorAll("[data-history]").forEach(button => button.onclick = () => openHistoryItem(decodeURIComponent(button.dataset.history))); document.querySelectorAll("[data-remove-history]").forEach(button => button.onclick = () => removeHistoryItem(decodeURIComponent(button.dataset.removeHistory))); }
function renderMyList() {
  if (!state.user) { app.innerHTML = `${header()}<main class="favourites-locked"><button class="primary" data-favourites-auth>Sign in</button></main>`; bindCommon(); document.querySelector("[data-favourites-auth]").onclick = () => showAuth(); return; }
  const filter = state.myListFilter || "all", sort = state.myListSort || "recent", allItems = listItems(), items = allItems.filter(item => filter === "all" || item.type === filter).sort((a, b) => sort === "title" ? titleOf(a).localeCompare(titleOf(b)) : sort === "rating" ? b.vote_average - a.vote_average : new Date(b.addedAt) - new Date(a.addedAt));
  app.innerHTML = `${header()}<main class="my-list-page"><button class="account-back" data-my-list-back>‹ Browse</button><span class="brand">MY LIST</span><h1>${escapeHTML(currentProfile()?.name || "Your")} List</h1><p>Saved movies and series, ready whenever you are.</p>${allItems.length ? `<div class="favourites-toolbar"><div class="favourites-filters" role="group" aria-label="Filter favourites">${[["all","All"],["movie","Movies"],["tv","Series"]].map(([value, label]) => `<button class="${filter === value ? "active" : ""}" data-list-filter="${value}">${label}</button>`).join("")}</div><label>Sort <select data-list-sort><option value="recent" ${sort === "recent" ? "selected" : ""}>Recently added</option><option value="title" ${sort === "title" ? "selected" : ""}>Title A–Z</option><option value="rating" ${sort === "rating" ? "selected" : ""}>Highest rated</option></select></label></div>${items.length ? `<div class="my-list-grid">${items.map(item => `<article class="my-list-card"><button class="my-list-open" data-open="${item.type}:${item.id}"><img src="${posterOf(item)}" alt=""><span><b>${escapeHTML(titleOf(item))}</b><small>${item.type === "tv" ? "Series" : "Movie"}${item.release_date ? ` · ${String(item.release_date).slice(0, 4)}` : ""}</small></span></button><button class="my-list-remove" data-remove-list="${item.type}:${item.id}" aria-label="Remove ${escapeHTML(titleOf(item))} from My List">Remove</button></article>`).join("")}</div>` : `<div class="my-list-empty"><b>No ${filter === "tv" ? "series" : "movies"} saved yet.</b><p>Switch filters or save more titles to this profile.</p></div>`}` : `<div class="my-list-empty"><b>Your list is waiting.</b><p>Save movies or series from any title page and they’ll appear here.</p><button class="primary" data-my-list-browse>Browse titles</button></div>`}</main>`;
  bindCommon(); document.querySelector("[data-my-list-back]").onclick = () => { state.route = state.myListReturn || "home"; state.myListReturn = null; render(); }; document.querySelector("[data-my-list-browse]")?.addEventListener("click", () => openCatalog("movie")); document.querySelectorAll("[data-list-filter]").forEach(button => button.onclick = () => { state.myListFilter = button.dataset.listFilter; render(); }); document.querySelector("[data-list-sort]")?.addEventListener("change", event => { state.myListSort = event.currentTarget.value; render(); }); document.querySelectorAll("[data-remove-list]").forEach(button => button.onclick = () => { const [type, id] = button.dataset.removeList.split(":"); const item = allItems.find(entry => entry.type === type && Number(entry.id) === Number(id)); if (item) toggleMyList(item); });
}
function renderWatchlist() {
  const ownerId = accountWatchlistUserId();
  if (!ownerId) {
    state.watchlist = []; state.watchlistOwnerId = null;
    app.innerHTML = `${header()}<main class="watchlist-page watchlist-locked"><span class="brand">WATCHLIST</span><h1>Sign in to continue</h1><p>Your Watchlist is saved to your profile.</p><button class="primary" data-watchlist-auth>Sign in</button><button class="watchlist-create-account" data-watchlist-create>Create account</button></main>${footer()}`;
    bindCommon(); document.querySelector("[data-watchlist-auth]").onclick = () => showAuth("login", "Sign in to open your profile Watchlist."); document.querySelector("[data-watchlist-create]").onclick = () => showAuth("signup"); return;
  }
  if (state.watchlistOwnerId !== ownerId || state.watchlistProfileId !== activeProfileId()) hydrateWatchlist();
  const filter = state.watchlistFilter || "all", sort = state.watchlistSort || "recent", allItems = state.watchlist, items = allItems.filter(item => filter === "all" || item.type === filter).slice().sort((a, b) => sort === "title" ? titleOf(a).localeCompare(titleOf(b)) : sort === "rating" ? b.vote_average - a.vote_average : new Date(b.addedAt) - new Date(a.addedAt));
  const syncStatus = state.watchlistError ? `<div class="watchlist-sync-error" role="status"><span>Couldn’t sync your Watchlist.</span><button type="button" data-watchlist-retry>Try again</button></div>` : state.watchlistLoading ? `<p class="watchlist-sync-note" role="status">Loading…</p>` : "";
  const itemsMarkup = state.watchlistLoading && !state.watchlistLoaded && !allItems.length ? `<div class="watchlist-loading" aria-label="Loading Watchlist">${Array.from({ length:8 }, () => `<div class="watchlist-skeleton skeleton"></div>`).join("")}</div>` : items.length ? `<div class="watchlist-grid">${items.map(item => { const added = new Date(item.addedAt), addedText = Number.isNaN(added.getTime()) ? "Saved recently" : `Added ${added.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })}`; return `<article class="watchlist-card"><button class="watchlist-open" data-open="${item.type}:${item.id}" aria-label="Open ${escapeHTML(titleOf(item))}"><img src="${posterOf(item)}" alt="" loading="lazy"><span><b>${escapeHTML(titleOf(item))}</b><small>${item.type === "tv" ? "Series" : "Movie"}${item.release_date ? ` · ${String(item.release_date).slice(0, 4)}` : ""}</small><small>${escapeHTML(addedText)}</small></span><i aria-hidden="true">›</i></button><button class="watchlist-remove" type="button" data-watchlist-remove="${item.type}:${item.id}" aria-label="Remove ${escapeHTML(titleOf(item))} from Watchlist">Remove</button></article>`; }).join("")}</div>` : allItems.length ? `<div class="watchlist-empty"><b>No titles.</b></div>` : `<div class="watchlist-empty watchlist-empty-start"><b>Your Watchlist is empty.</b><button class="secondary" type="button" data-watchlist-browse="movie">Browse titles</button></div>`;
  app.innerHTML = `${header()}<main class="watchlist-page"><button class="account-back" data-watchlist-back>‹ Browse</button><div class="watchlist-heading"><span class="brand">${escapeHTML(currentProfile()?.name || "PROFILE")} · WATCHLIST</span><h1>Watchlist</h1><span class="watchlist-count">${allItems.length} ${allItems.length === 1 ? "title" : "titles"}</span></div>${syncStatus}${allItems.length ? `<div class="watchlist-toolbar"><div class="watchlist-filters" role="group" aria-label="Filter your Watchlist">${[["all","All"],["movie","Movies"],["tv","Series"]].map(([value, label]) => `<button type="button" class="${filter === value ? "active" : ""}" data-watchlist-filter="${value}" aria-pressed="${filter === value}">${label}</button>`).join("")}</div><label>Sort <select data-watchlist-sort><option value="recent" ${sort === "recent" ? "selected" : ""}>Recently added</option><option value="title" ${sort === "title" ? "selected" : ""}>Title A–Z</option><option value="rating" ${sort === "rating" ? "selected" : ""}>Highest rated</option></select></label></div>` : ""}${itemsMarkup}</main>${footer()}`;
  bindCommon();
  if (!state.watchlistLoaded && !state.watchlistLoading) void loadAccountWatchlist(true);
  document.querySelector("[data-watchlist-back]").onclick = () => { state.route = state.watchlistReturn || "home"; state.watchlistReturn = null; render(); };
  document.querySelectorAll("[data-watchlist-filter]").forEach(button => button.onclick = () => { state.watchlistFilter = button.dataset.watchlistFilter; render(); });
  document.querySelector("[data-watchlist-sort]")?.addEventListener("change", event => { state.watchlistSort = event.currentTarget.value; render(); });
  document.querySelectorAll("[data-watchlist-remove]").forEach(button => button.onclick = () => { const [type, id] = button.dataset.watchlistRemove.split(":"); const item = allItems.find(entry => entry.type === type && Number(entry.id) === Number(id)); if (item) void toggleWatchlist(item); });
  document.querySelectorAll("[data-watchlist-browse]").forEach(button => button.onclick = () => openCatalog(button.dataset.watchlistBrowse));
  document.querySelector("[data-watchlist-retry]")?.addEventListener("click", () => void loadAccountWatchlist(true));
}
function openWatchlist() { state.watchlistReturn = state.route; state.route = "watchlist"; scrollToTop(); render(); }
function openHistoryItem(key) { const saved = JSON.parse(localStorage.getItem(key) || "{}"), item = { type:saved.type, id:Number(saved.id), season:Number(saved.season) || undefined, episode:Number(saved.episode) || undefined, title:saved.title, overview:"", posterPath:saved.posterPath, genreIds:saved.genreIds || [], startAt:savedStart(saved) }; if (!item.type || !item.id) return; state.player = item; state.route = "player"; render(); scrollToTop(); }
async function removeHistoryItem(key) { localStorage.removeItem(key); forgetAccountProgress(key); if (state.session) try { await localAPI(`/api/account/progress?key=${encodeURIComponent(key)}`, { method:"DELETE", headers:authorizedHeaders() }); } catch {} renderHistory(); }
function showAuth(mode = "login", message = "", email = "") {
  document.querySelector(".modal")?.remove();
  const create = mode === "signup";
  app.insertAdjacentHTML("beforeend", `<div class="modal"><form class="auth-card auth-flow" id="auth-form" aria-busy="false"><div class="auth-content"><button type="button" class="modal-close" data-close aria-label="Close">×</button><span class="brand">SEVEN ACCOUNT</span><h2>${create ? "Create your account" : "Welcome back"}</h2><p>${create ? "Save your progress, watched titles, and settings across devices." : "Sign in to restore your SEVEN history."}</p>${create ? `<label>Display name<input name="displayName" maxlength="50" placeholder="Optional"></label>` : ""}<label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="${create ? "new-password" : "current-password"}" placeholder="At least 8 characters"></label><p class="form-error" id="auth-message" role="status" aria-live="polite">${escapeHTML(message)}</p><button class="primary auth-submit" type="submit">${create ? "Create account" : "Sign in"}</button><button class="auth-switch" type="button" data-switch>${create ? "Already have an account? Sign in" : "New to SEVEN? Create an account"}</button></div><section class="auth-success-stage" role="status" aria-live="polite" aria-atomic="true"><span class="brand">SEVEN ACCOUNT</span><h2 data-auth-success-title></h2><p data-auth-success-copy></p><button type="button" class="auth-pending-login" data-pending-login hidden>Continue to sign in</button></section></form></div>`);
  if (email) document.querySelector('#auth-form input[name="email"]').value = email;
  document.querySelector("[data-close]").onclick = () => document.querySelector(".modal")?.remove();
  document.querySelector("[data-switch]").onclick = () => showAuth(create ? "login" : "signup");
  document.querySelector("#auth-form").onsubmit = event => submitAuth(event, mode);
}
async function showAuthSuccess(form, title, description) {
  form.querySelector("[data-auth-success-title]").textContent = title;
  form.querySelector("[data-auth-success-copy]").textContent = description;
  form.querySelector("[data-close]").disabled = true;
  form.classList.remove("auth-submitting", "auth-waiting");
  form.classList.add("auth-success");
  form.setAttribute("aria-busy", "false");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  await new Promise(resolve => setTimeout(resolve, reducedMotion ? 180 : 900));
}
function readPendingEmailVerification() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_EMAIL_VERIFICATION_KEY) || "null");
    return pending?.email ? { email:String(pending.email), createdAt:Number(pending.createdAt) || 0 } : null;
  } catch { return null; }
}
async function consumeEmailVerificationRedirect() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token"), type = params.get("type"), pending = readPendingEmailVerification();
  if (!accessToken || (type && type !== "signup") || (!type && !pending)) return null;
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  try {
    const user = await localAPI("/api/auth/user", { headers:{ Authorization:`Bearer ${accessToken}` } });
    const email = String(user?.email || "").trim().toLowerCase();
    if (!email || (pending?.email && pending.email.trim().toLowerCase() !== email)) return null;
    localStorage.setItem(VERIFIED_EMAIL_KEY, JSON.stringify({ email, verifiedAt:Date.now() }));
    localStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
    return email;
  } catch { return null; }
}
function showAuthPending(email, pending = null) {
  let form = document.querySelector("#auth-form");
  if (!form) { showAuth("signup"); form = document.querySelector("#auth-form"); }
  const current = pending || readPendingEmailVerification() || { email, createdAt:Date.now() };
  state.pendingEmailVerification = { email:String(email || current.email), createdAt:current.createdAt };
  form.querySelector("[data-auth-success-title]").textContent = "Verify your email";
  form.querySelector("[data-auth-success-copy]").textContent = `We sent a verification link to ${email}. This screen will stay here until your email is verified.`;
  form.querySelector("[data-close]").disabled = true;
  form.querySelectorAll("input, [data-switch], [type=submit]").forEach(control => { control.disabled = true; });
  const continueButton = form.querySelector("[data-pending-login]");
  if (continueButton) {
    continueButton.hidden = false;
    continueButton.onclick = () => {
      localStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
      state.pendingEmailVerification = null;
      showAuth("login", "Sign in to finish setting up your account.", email);
    };
  }
  form.classList.remove("auth-submitting");
  form.classList.add("auth-success", "auth-waiting");
  form.setAttribute("aria-busy", "false");
}
async function finishEmailVerification(email) {
  localStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
  state.pendingEmailVerification = null;
  let form = document.querySelector("#auth-form");
  if (!form) { showAuth("login"); form = document.querySelector("#auth-form"); }
  await showAuthSuccess(form, "Email verified successfully", "Taking you to sign in…");
  showAuth("login", "Email verified successfully. Sign in to continue.", email);
}
window.addEventListener("storage", event => {
  if (event.key !== VERIFIED_EMAIL_KEY || !event.newValue || !state.pendingEmailVerification) return;
  try {
    const verified = JSON.parse(event.newValue), pending = state.pendingEmailVerification;
    if (verified?.email?.trim().toLowerCase() === pending.email.trim().toLowerCase() && Number(verified.verifiedAt) >= pending.createdAt) void finishEmailVerification(verified.email);
  } catch { /* Ignore invalid cross-tab auth notices. */ }
});
function showChangePassword() {
  document.querySelector(".modal")?.remove();
  app.insertAdjacentHTML("beforeend", `<div class="modal password-change"><form class="auth-card" id="password-change-form"><button type="button" class="modal-close" data-close>×</button><span class="brand">ACCOUNT SECURITY</span><h2>Change password</h2><p>Enter your current password, then choose a new one. Email confirmation can be added later.</p><label>Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>New password<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label><label>Confirm new password<input name="confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Repeat your new password"></label><p class="form-error" id="password-change-error"></p><button class="primary auth-submit" type="submit">Update password</button></form></div>`);
  document.querySelector(".password-change [data-close]").onclick = () => document.querySelector(".password-change")?.remove();
  document.querySelector("#password-change-form").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form), currentPassword = String(values.get("currentPassword") || ""), password = String(values.get("password") || ""), confirmation = String(values.get("confirmPassword") || ""), message = form.querySelector("#password-change-error"), submit = form.querySelector("[type=submit]");
    message.textContent = "";
    if (password !== confirmation) return void (message.textContent = "New passwords do not match.");
    if (password === currentPassword) return void (message.textContent = "Choose a password different from your current password.");
    try {
      submit.disabled = true;
      await localAPI("/api/account/settings", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ account:state.account, currentPassword, password }) });
      document.querySelector(".password-change")?.remove();
      app.insertAdjacentHTML("beforeend", `<div class="seven-update password-success"><span>Password updated.</span><button type="button" data-close-password-success>Done</button></div>`);
      document.querySelector("[data-close-password-success]").onclick = () => document.querySelector(".password-success")?.remove();
    } catch (error) { message.textContent = error.message; } finally { submit.disabled = false; }
  };
}
async function submitAuth(event, mode) {
  event.preventDefault();
  const formElement = event.currentTarget, values = new FormData(formElement), message = formElement.querySelector("#auth-message"), submit = formElement.querySelector("[type=submit]"), close = formElement.querySelector("[data-close]"), create = mode === "signup";
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  submit.textContent = create ? "Creating account…" : "Signing in…";
  close.disabled = true;
  formElement.querySelectorAll("input, [data-switch]").forEach(control => { control.disabled = true; });
  formElement.classList.add("auth-submitting");
  formElement.setAttribute("aria-busy", "true");
  message.textContent = "";
  try {
    const payload = { email:values.get("email"), password:values.get("password"), displayName:values.get("displayName") };
    const data = await localAPI(`/api/auth/${create ? "signup" : "login"}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    if (create && !data.session?.access_token && data.user) {
      const pending = { email:String(payload.email || "").trim().toLowerCase(), createdAt:Date.now() };
      state.pendingEmailVerification = pending;
      localStorage.setItem(PENDING_EMAIL_VERIFICATION_KEY, JSON.stringify(pending));
      showAuthPending(pending.email, pending);
      return;
    }
    if (!data.session?.access_token) throw new Error("No sign-in session was returned. Please try again.");
    persistSession(data.session, Date.now());
    localStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
    state.pendingEmailVerification = null;
    state.user = data.user || data.session.user || await localAPI("/api/auth/user", { headers:authorizedHeaders() });
    if (!state.user?.id) throw new Error("Your account was created, but we couldn’t finish signing you in. Please try signing in.");
    hydrateAccount();
    await refreshParentAccessStatus();
    hydrateMyList();
    hydrateWatchlist();
    await Promise.allSettled([loadCloudProgress(), loadMyList(), loadAccountWatchlist()]);
    migrateLegacyProgress();
    scheduleSessionRefresh();
    const firstRun = create || needsFirstRunOnboarding();
    await showAuthSuccess(formElement, create ? "Account created" : "Signed in successfully", firstRun ? "Let’s set up your profile…" : "Taking you to your profiles…");
    if (firstRun) { beginOnboarding(); state.route = "onboarding"; }
    else state.route = "profiles";
    render();
  } catch (error) {
    formElement.classList.remove("auth-submitting", "auth-success");
    formElement.setAttribute("aria-busy", "false");
    message.textContent = error.message || "We couldn’t sign you in. Please try again.";
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
    if (formElement.isConnected && !formElement.classList.contains("auth-success")) {
      submit.textContent = create ? "Create account" : "Sign in";
      close.disabled = false;
      formElement.querySelectorAll("input, [data-switch]").forEach(control => { control.disabled = false; });
    }
  }
}
function renderProfileStats() {
  const profile = currentProfile(), stats = profileStats(), top = stats.titles.slice(0, 4);
  app.innerHTML = `${header()}<main class="profile-stats-page"><button class="account-back" data-stats-back>‹ Account</button><span class="brand">YOUR VIEWING RECAP</span><h1>${escapeHTML(profile?.name || "Your")} stats</h1><p>Earlier saved progress is an estimate; new watch time is counted as playback advances.</p>${stats.titlesStarted ? `<section class="stats-summary"><div><strong>${watchTimeLabel(stats.seconds)}</strong><span>Watch time</span></div><div><strong>${stats.titlesStarted}</strong><span>Titles started</span></div><div><strong>${stats.moviesFinished}</strong><span>Movies finished</span></div><div><strong>${stats.episodesWatched}</strong><span>Episodes watched</span></div></section><section class="stats-detail-grid"><article><span class="brand">WATCHING STREAK</span><strong>${stats.streak} ${stats.streak === 1 ? "day" : "days"}</strong><p>Longest run of consecutive days with playback.</p></article><article><span class="brand">TOP GENRES</span><div class="stats-genres">${stats.genres.length ? stats.genres.map(genre => `<span>${escapeHTML(genre)}</span>`).join("") : "<small>Watch a title to reveal your tastes.</small>"}</div></article></section><section class="stats-most-watched"><div class="rail-title"><div><span class="brand">MOST WATCHED</span><h2>Time well spent</h2></div><span>Based on playback time</span></div><div class="stats-title-grid">${top.map(item => `<button class="stats-title" data-open="${item.type}:${item.id}"><img src="${item.posterPath ? TMDB_IMAGE + item.posterPath : "icon.svg"}" alt=""><span><b>${escapeHTML(item.title)}</b><small>${item.type === "tv" ? "Series" : "Movie"} · ${watchTimeLabel(item.seconds)}</small></span></button>`).join("")}</div></section>` : `<section class="stats-empty"><b>Your recap will appear here</b><p>Start watching a movie or episode and SEVEN will build your real profile stats.</p><button class="primary" data-home>Browse titles</button></section>`}</main>${footer()}`;
  bindCommon();
  document.querySelectorAll("[data-stats-back]").forEach(button => button.onclick = () => { state.route = "account"; render(); });
}
function renderHiddenTitles() {
  const items = hiddenTitles();
  app.innerHTML = `${header()}<main class="my-list-page hidden-titles-page"><button class="account-back" data-hidden-back>‹ Account</button><span class="brand">NOT FOR ME</span><h1>Hidden titles</h1><p>These titles are hidden from ${escapeHTML(currentProfile()?.name || "this profile")}’s recommendations and browse rows.</p>${items.length ? `<div class="my-list-grid">${items.map(item => `<article class="my-list-card"><button class="my-list-open" data-open="${item.type}:${item.id}"><img src="${posterOf(item)}" alt=""><b>${escapeHTML(item.title)}</b><small>${item.type === "tv" ? "Series" : "Movie"}${item.release_date ? ` · ${escapeHTML(String(item.release_date).slice(0, 4))}` : ""}</small></button><button class="my-list-remove" data-restore-hidden="${escapeHTML(hiddenTitleKey(item))}">Show this title again</button></article>`).join("")}</div>` : `<div class="my-list-empty"><b>Nothing is hidden</b><p>Use “Not for me” on a movie or series page to keep your recommendations focused.</p><button class="primary" data-hidden-back>Back to Account</button></div>`}</main>${footer()}`;
  bindCommon();
  document.querySelectorAll("[data-hidden-back]").forEach(button => button.onclick = () => { state.route = "account"; render(); });
  document.querySelectorAll("[data-restore-hidden]").forEach(button => button.onclick = () => restoreHiddenTitle(button.dataset.restoreHidden));
}
function renderLikedTitles() {
  const items = likedTitles();
  app.innerHTML = `${header()}<main class="my-list-page liked-titles-page"><button class="account-back" data-liked-back>‹ Account</button><span class="brand">YOUR RATINGS</span><h1>Titles you liked</h1><p>These preferences help tailor ${escapeHTML(currentProfile()?.name || "this profile")}’s For You page.</p>${items.length ? `<div class="my-list-grid">${items.map(item => `<article class="my-list-card"><button class="my-list-open" data-open="${item.type}:${item.id}"><img src="${posterOf(item)}" alt=""><b>${escapeHTML(item.title)}</b><small>${item.type === "tv" ? "Series" : "Movie"}${item.release_date ? ` · ${escapeHTML(String(item.release_date).slice(0, 4))}` : ""}</small></button><button class="my-list-remove" data-remove-like="${escapeHTML(hiddenTitleKey(item))}">Remove rating</button></article>`).join("")}</div>` : `<div class="my-list-empty"><b>No ratings yet</b><p>Tap “I like this” on any movie or series page to personalize recommendations.</p><button class="primary" data-liked-back>Back to Account</button></div>`}</main>${footer()}`;
  bindCommon();
  document.querySelectorAll("[data-liked-back]").forEach(button => button.onclick = () => { state.route = "account"; render(); });
  document.querySelectorAll("[data-remove-like]").forEach(button => button.onclick = async () => { const profile = currentProfile(); profile.likedTitles = likedTitles().filter(item => hiddenTitleKey(item) !== button.dataset.removeLike); await saveAccount(); renderLikedTitles(); });
}
const PROFILE_COLORS = ["#d41520", "#2f73c9", "#8e44ad", "#008f73", "#d08a16"];
const AVATAR_OPTIONS = [
  ["Red panda", "assets/avatars/red-panda.png"], ["Black cat", "assets/avatars/black-cat.png"], ["Astronaut", "assets/avatars/astronaut.png"],
  ["Dinosaur", "assets/avatars/dino.png"], ["Duck", "assets/avatars/duck.png"], ["Robot", "assets/avatars/robot.png"]
];
const ONBOARDING_GENRES = [[28,"Action",10759],[12,"Adventure",10759],[16,"Animation",16],[35,"Comedy",35],[80,"Crime",80],[99,"Documentary",99],[18,"Drama",18],[10751,"Family",10751],[27,"Horror",27],[9648,"Mystery",9648],[10749,"Romance",10749],[53,"Thriller",53]];
const FAMILY_FRIENDLY_GENRES = new Set([12,16,35,99,10751]);
function isProfileAvatar(value) { return AVATAR_OPTIONS.some(([, path]) => path === value) || /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(String(value || "")); }
function prepareUploadedAvatar(file) { return new Promise((resolve, reject) => { if (!file?.type?.startsWith("image/")) return reject(new Error("Choose an image file.")); if (file.size > 10 * 1024 * 1024) return reject(new Error("Choose an image smaller than 10 MB.")); const reader = new FileReader(); reader.onerror = () => reject(new Error("That image could not be read.")); reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error("That image format is not supported.")); image.onload = () => { const edge = 120, canvas = document.createElement("canvas"), scale = Math.max(edge / image.naturalWidth, edge / image.naturalHeight), width = image.naturalWidth * scale, height = image.naturalHeight * scale; canvas.width = edge; canvas.height = edge; canvas.getContext("2d").drawImage(image, (edge - width) / 2, (edge - height) / 2, width, height); const avatar = canvas.toDataURL("image/jpeg", .78); if (avatar.length > 30000) return reject(new Error("Choose a simpler photo so it can sync with your profile.")); resolve(avatar); }; image.src = String(reader.result); }; reader.readAsDataURL(file); }); }
function needsFirstRunOnboarding() {
  const saved = state.user?.user_metadata?.seven_account;
  if (saved && Object.hasOwn(saved, "onboardingComplete")) return saved.onboardingComplete === false;
  if (state.account?.onboardingComplete === false) return true;
  const createdAt = Date.parse(state.user?.created_at || "");
  return Number.isFinite(createdAt) && Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000;
}
function beginOnboarding() {
  const profile = currentProfile() || state.account?.profiles?.[0] || defaultAccount().profiles[0], preferences = currentPreferences();
  const savedStep = Number(state.account?.onboardingStep);
  state.onboardingStep = Number.isInteger(savedStep) && savedStep >= 2 && savedStep <= 4 ? savedStep : 1;
  state.onboardingDraft = { name:profile.name || "", avatar:profile.avatar || AVATAR_OPTIONS[0][1], favoriteGenres:(preferences.favoriteGenres || []).map(Number).filter(id => ONBOARDING_GENRES.some(([genreId]) => genreId === id)).slice(0,3), contentMix:preferences.contentMix || "both", familySafe:preferences.familySafe === true };
}
function renderOnboarding() {
  if (!state.onboardingDraft) beginOnboarding();
  const draft = state.onboardingDraft, step = state.onboardingStep || 1, profile = { name:draft.name, avatar:draft.avatar, color:"#d3131c" };
  const avatarChoices = AVATAR_OPTIONS.map(([name, path]) => `<button type="button" class="onboarding-avatar ${draft.avatar === path ? "selected" : ""}" data-onboarding-avatar="${path}" aria-label="Choose ${name}" aria-pressed="${draft.avatar === path}"><img src="${path}" alt=""><span>${name}</span></button>`).join("");
  const genreChoices = ONBOARDING_GENRES.filter(([id]) => !draft.familySafe || FAMILY_FRIENDLY_GENRES.has(id)).map(([id, name]) => `<button type="button" class="onboarding-chip ${draft.favoriteGenres.includes(id) ? "selected" : ""}" data-onboarding-genre="${id}" aria-pressed="${draft.favoriteGenres.includes(id)}" ${draft.favoriteGenres.length >= 3 && !draft.favoriteGenres.includes(id) ? "disabled" : ""}>${name}</button>`).join("");
  const mixChoices = [["both","Movies & series","A balanced mix of films and series."],["movies","Movies only","Keep your discovery focused on films."],["series","Series only","Find your next series to settle into."]].map(([value,label,detail]) => `<button type="button" class="onboarding-mix ${draft.contentMix === value ? "selected" : ""}" data-onboarding-mix="${value}" aria-pressed="${draft.contentMix === value}"><span><b>${label}</b><small>${detail}</small></span><i aria-hidden="true"></i></button>`).join("");
  const actions = (label, nextStep) => `<p class="onboarding-error" data-onboarding-error role="status" aria-live="polite"></p><div class="onboarding-actions"><div class="onboarding-actions-start"><button class="onboarding-back" type="button" data-onboarding-back>← Back</button></div><button class="primary" type="button" data-onboarding-continue data-next-step="${nextStep}">${label} <span aria-hidden="true">→</span></button></div>`;
  const defaultAction = (label, step) => `<button class="onboarding-default-action" type="button" data-onboarding-default="${step}" data-default-label="${escapeHTML(label)}"><span>${label}</span><i aria-hidden="true">→</i></button>`;
  const profileStep = `<section class="onboarding-panel"><div class="onboarding-kicker">01 / PROFILE</div><h1>Let’s make this profile yours.</h1><p>Choose a name and picture. You can change them later.</p><div class="onboarding-identity"><div class="onboarding-avatar-preview">${profileAvatar(profile)}</div><label class="onboarding-name">Profile name<input data-onboarding-name maxlength="24" required value="${escapeHTML(draft.name)}" placeholder="What should we call you?"></label></div><div class="onboarding-avatar-grid">${avatarChoices}<label class="onboarding-avatar-upload"><input type="file" accept="image/png,image/jpeg,image/webp" data-onboarding-upload><span>＋</span><b>Use a photo</b></label></div><p class="onboarding-error" data-onboarding-error role="status" aria-live="polite"></p><div class="onboarding-actions onboarding-actions-profile"><div class="onboarding-actions-start"></div><button class="primary" type="button" data-onboarding-next>Continue <span aria-hidden="true">→</span></button></div>${defaultAction("Keep current profile", 1)}</section>`;
  const genresStep = `<section class="onboarding-panel onboarding-panel-choices"><div class="onboarding-kicker">02 / YOUR TASTE</div><h1>What do you like watching?</h1><p>Pick up to three genres. We’ll use them to shape your For You page.</p><div class="onboarding-choice-group"><div class="onboarding-choice-heading"><b>Choose your favourites</b><span>${draft.favoriteGenres.length} of 3 selected</span></div><div class="onboarding-genre-grid">${genreChoices}</div></div>${actions("Continue", 3)}${defaultAction("No genre preference", 2)}</section>`;
  const mixStep = `<section class="onboarding-panel onboarding-panel-choices"><div class="onboarding-kicker">03 / YOUR MIX</div><h1>What would you like to browse?</h1><p>We’ll tune your movie and series rows around what you enjoy.</p><div class="onboarding-choice-group"><div class="onboarding-choice-heading"><b>Your SEVEN mix</b><span>Choose one</span></div><div class="onboarding-mix-grid">${mixChoices}</div></div>${actions("Continue", 4)}${defaultAction("Keep both", 3)}</section>`;
  const familyStep = `<section class="onboarding-panel onboarding-panel-choices"><div class="onboarding-kicker">04 / CONTENT FILTER</div><h1>Who’s watching?</h1><p>Set the tone for browsing and recommendations. You can change this any time in profile settings.</p><div class="onboarding-choice-group"><div class="onboarding-choice-heading"><b>Content preferences</b><span>Choose one</span></div><div class="onboarding-family-grid"><button class="onboarding-family-choice ${!draft.familySafe ? "selected" : ""}" type="button" data-onboarding-safe="false" aria-pressed="${!draft.familySafe}"><span class="onboarding-family-icon" aria-hidden="true">◉</span><span><b>Show me everything</b><small>Keep the full SEVEN catalog in browsing and picks.</small></span><i aria-hidden="true"></i></button><button class="onboarding-family-choice ${draft.familySafe ? "selected" : ""}" type="button" data-onboarding-safe="true" aria-pressed="${draft.familySafe}"><span class="onboarding-family-icon" aria-hidden="true">✦</span><span><b>Keep it family-friendly</b><small>Favor age-friendly titles across browsing and recommendations.</small></span><i aria-hidden="true"></i></button></div></div>${actions("Start watching", 4)}${defaultAction("Show everything", 4)}</section>`;
  const steps = { 1:profileStep, 2:genresStep, 3:mixStep, 4:familyStep }, stepMarkup = steps[step] || profileStep;
  app.innerHTML = `<main class="onboarding-page"><header class="onboarding-top"><span class="brand">SEVEN</span><span>YOUR EXPERIENCE</span></header><div class="onboarding-progress" role="progressbar" aria-label="Personalization progress" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${step}"><i style="width:${step * 25}%"></i></div><div class="onboarding-step-count">STEP ${String(step).padStart(2,"0")} <span>OF 04</span></div>${stepMarkup}</main>`;
  bindOnboarding();
}
function updateOnboardingAvatarUI() {
  const draft = state.onboardingDraft;
  document.querySelectorAll("[data-onboarding-avatar]").forEach(button => {
    const selected = draft.avatar === button.dataset.onboardingAvatar;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const preview = document.querySelector(".onboarding-avatar-preview");
  if (preview) preview.innerHTML = profileAvatar({ name:draft.name, avatar:draft.avatar, color:"#d3131c" });
}
function updateOnboardingGenresUI() {
  const draft = state.onboardingDraft;
  document.querySelectorAll("[data-onboarding-genre]").forEach(button => {
    const selected = draft.favoriteGenres.includes(Number(button.dataset.onboardingGenre));
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = draft.favoriteGenres.length >= 3 && !selected;
  });
  const count = document.querySelector(".onboarding-choice-heading span");
  if (count) count.textContent = `${draft.favoriteGenres.length} of 3 selected`;
}
function updateOnboardingMixUI() {
  document.querySelectorAll("[data-onboarding-mix]").forEach(button => {
    const selected = state.onboardingDraft.contentMix === button.dataset.onboardingMix;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
function updateOnboardingFamilyUI() {
  document.querySelectorAll("[data-onboarding-safe]").forEach(button => {
    const selected = state.onboardingDraft.familySafe === (button.dataset.onboardingSafe === "true");
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
function bindOnboarding() {
  const draft = state.onboardingDraft;
  document.querySelector("[data-onboarding-name]")?.addEventListener("input", event => { draft.name = event.currentTarget.value; });
  document.querySelector("[data-onboarding-next]")?.addEventListener("click", () => {
    draft.name = String(document.querySelector("[data-onboarding-name]")?.value || "").trim();
    if (!draft.name) { document.querySelector("[data-onboarding-error]").textContent = "Add a profile name to continue."; return; }
    void saveOnboardingProfile();
  });
  document.querySelectorAll("[data-onboarding-avatar]").forEach(button => button.addEventListener("click", () => { draft.avatar = button.dataset.onboardingAvatar; updateOnboardingAvatarUI(); }));
  document.querySelector("[data-onboarding-upload]")?.addEventListener("change", async event => {
    try { draft.avatar = await prepareUploadedAvatar(event.currentTarget.files?.[0]); updateOnboardingAvatarUI(); }
    catch (error) { document.querySelector("[data-onboarding-error]").textContent = error.message; }
  });
  document.querySelectorAll("[data-onboarding-genre]").forEach(button => button.addEventListener("click", () => {
    const id = Number(button.dataset.onboardingGenre), selected = new Set(draft.favoriteGenres);
    if (selected.has(id)) selected.delete(id); else if (selected.size < 3) selected.add(id);
    draft.favoriteGenres = [...selected]; updateOnboardingGenresUI();
  }));
  document.querySelectorAll("[data-onboarding-mix]").forEach(button => button.addEventListener("click", () => { draft.contentMix = button.dataset.onboardingMix; updateOnboardingMixUI(); }));
  document.querySelectorAll("[data-onboarding-safe]").forEach(button => button.addEventListener("click", () => {
    draft.familySafe = button.dataset.onboardingSafe === "true";
    if (draft.familySafe) draft.favoriteGenres = draft.favoriteGenres.filter(id => FAMILY_FRIENDLY_GENRES.has(id));
    updateOnboardingFamilyUI();
  }));
  document.querySelector("[data-onboarding-continue]")?.addEventListener("click", event => {
    const nextStep = Number(event.currentTarget.dataset.nextStep);
    if (Number(state.onboardingStep) === 4) void finishOnboarding();
    else void saveOnboardingChoices(nextStep);
  });
  document.querySelector("[data-onboarding-default]")?.addEventListener("click", event => {
    const button = event.currentTarget, step = Number(button.dataset.onboardingDefault);
    if (step === 1) {
      const profile = currentProfile();
      draft.name = profile?.name || state.user?.user_metadata?.display_name || state.user?.email?.split("@")[0] || "Main profile";
      draft.avatar = profile?.avatar || AVATAR_OPTIONS[0][1];
      void saveOnboardingProfile(button);
    } else if (step === 2) {
      draft.favoriteGenres = [];
      void saveOnboardingChoices(3, button);
    } else if (step === 3) {
      draft.contentMix = "both";
      void saveOnboardingChoices(4, button);
    } else if (step === 4) {
      draft.familySafe = false;
      void finishOnboarding(button);
    }
  });
  document.querySelector("[data-onboarding-back]")?.addEventListener("click", () => { state.onboardingStep = Math.max(1, Number(state.onboardingStep || 1) - 1); renderOnboarding(); });
}
async function persistOnboardingAccount() {
  if (!state.session?.access_token) throw new Error("Sign in again to save this profile.");
  persistLocalAccount();
  const account = JSON.parse(JSON.stringify(state.account));
  if (account.parentAccessEnabled) delete account.parentPinHash;
  state.user = await localAPI("/api/account/settings", { method:"PUT", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify({ account }) });
}
async function saveOnboardingProfile(submitButton = null) {
  const draft = state.onboardingDraft, profile = currentProfile(), error = document.querySelector("[data-onboarding-error]"), button = submitButton || document.querySelector("[data-onboarding-next]");
  if (!draft || !profile) { if (error) error.textContent = "This profile could not be loaded. Please try again."; return; }
  if (button) { button.disabled = true; button.textContent = submitButton ? "Keeping profile…" : "Saving profile…"; }
  profile.name = String(draft.name).trim().slice(0,24);
  profile.avatar = isProfileAvatar(draft.avatar) ? draft.avatar : AVATAR_OPTIONS[0][1];
  profile.color = "#d3131c";
  state.account.onboardingComplete = false;
  state.account.onboardingStep = 2;
  try { await persistOnboardingAccount(); state.onboardingStep = 2; renderOnboarding(); }
  catch (failure) {
    if (error) error.textContent = failure.message || "We couldn’t save your profile. Try again.";
    if (button) { button.disabled = false; button.innerHTML = submitButton ? `<span>${escapeHTML(button.dataset.defaultLabel)}</span><i aria-hidden="true">→</i>` : 'Continue <span aria-hidden="true">→</span>'; }
  }
}
async function saveOnboardingChoices(nextStep, submitButton = null) {
  const draft = state.onboardingDraft, profile = currentProfile(), error = document.querySelector("[data-onboarding-error]"), button = submitButton || document.querySelector("[data-onboarding-continue]");
  if (!draft || !profile) { if (error) error.textContent = "This profile could not be loaded. Please try again."; return; }
  if (button) { button.disabled = true; button.textContent = submitButton ? "Saving…" : "Saving your choices…"; }
  profile.preferences = { ...currentPreferences(), favoriteGenres:draft.favoriteGenres.slice(0,3), contentMix:["movies","series"].includes(draft.contentMix) ? draft.contentMix : "both", familySafe:draft.familySafe === true };
  state.account.onboardingComplete = false;
  state.account.onboardingStep = nextStep;
  try { await persistOnboardingAccount(); state.onboardingStep = nextStep; renderOnboarding(); }
  catch (failure) {
    if (error) error.textContent = failure.message || "We couldn’t save your choices. Try again.";
    if (button) { button.disabled = false; button.innerHTML = submitButton ? `<span>${escapeHTML(button.dataset.defaultLabel)}</span><i aria-hidden="true">→</i>` : 'Continue <span aria-hidden="true">→</span>'; }
  }
}
async function finishOnboarding(submitButton = null) {
  const draft = state.onboardingDraft, error = document.querySelector("[data-onboarding-error]"), submit = submitButton || document.querySelector("[data-onboarding-continue]");
  if (!draft || !state.session?.access_token) { if (error) error.textContent = "Sign in again to save this profile."; return; }
  const profile = currentProfile();
  if (!profile) { if (error) error.textContent = "This profile could not be loaded. Please try again."; return; }
  if (!String(draft.name || "").trim()) { if (error) error.textContent = "Add a profile name before continuing."; return; }
  if (submit) { submit.disabled = true; submit.textContent = submit.hasAttribute("data-onboarding-default") ? "Saving…" : "Saving your profile…"; }
  profile.name = String(draft.name).trim().slice(0,24);
  profile.avatar = isProfileAvatar(draft.avatar) ? draft.avatar : AVATAR_OPTIONS[0][1];
  profile.color = "#d3131c";
  profile.preferences = { ...currentPreferences(), favoriteGenres:draft.favoriteGenres.slice(0,3), contentMix:["movies","series"].includes(draft.contentMix) ? draft.contentMix : "both", familySafe:draft.familySafe === true };
  state.account.activeProfileId = profile.id;
  state.account.onboardingComplete = true;
  delete state.account.onboardingStep;
  try {
    await persistOnboardingAccount();
    state.catalogKey = null; state.catalogRequest = null; state.onboardingDraft = null;
    state.route = "profiles"; render();
  } catch (failure) {
    state.account.onboardingComplete = false;
    state.account.onboardingStep = Number(state.onboardingStep) || 1;
    if (error) error.textContent = failure.message || "We couldn’t save your profile. Try again.";
    if (submit) { submit.disabled = false; submit.innerHTML = submit.hasAttribute("data-onboarding-default") ? `<span>${escapeHTML(submit.dataset.defaultLabel)}</span><i aria-hidden="true">→</i>` : 'Start watching <span aria-hidden="true">→</span>'; }
  }
}
function currentProfile() { return state.account?.profiles?.find(profile => profile.id === activeProfileId()) || state.account?.profiles?.[0]; }
function recentSearches(profile = currentProfile()) {
  if (Array.isArray(profile?.recentSearches)) return profile.recentSearches.filter(query => typeof query === "string" && query.trim());
  try { const raw = JSON.parse(localStorage.getItem(`seven-recent-searches-${activeProfileId()}`) || "[]"); return Array.isArray(raw) ? raw.filter(query => typeof query === "string" && query.trim()) : []; } catch { return []; }
}
async function addRecentSearch(query, profile = currentProfile()) {
  const clean = typeof query === "string" ? query.trim() : "";
  if (clean.length < 2) return;
  const updated = [clean, ...recentSearches(profile).filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 12);
  if (profile) profile.recentSearches = updated;
  localStorage.setItem(`seven-recent-searches-${activeProfileId()}`, JSON.stringify(updated));
  if (state.user) await saveAccount();
}
async function removeRecentSearch(query, profile = currentProfile()) {
  const clean = typeof query === "string" ? query.trim() : "";
  const updated = recentSearches(profile).filter(item => item.toLowerCase() !== clean.toLowerCase());
  if (profile) profile.recentSearches = updated;
  localStorage.setItem(`seven-recent-searches-${activeProfileId()}`, JSON.stringify(updated));
  if (state.user) await saveAccount();
}
async function clearRecentSearches(profile = currentProfile()) {
  if (profile) profile.recentSearches = [];
  localStorage.removeItem(`seven-recent-searches-${activeProfileId()}`);
  if (state.user) await saveAccount();
}
function hiddenTitleKey(item) { return `${item.type}:${Number(item.id)}`; }
function hiddenTitles() { return Array.isArray(currentProfile()?.hiddenTitles) ? currentProfile().hiddenTitles.filter(item => item?.type && item?.id) : []; }
function isHiddenTitle(item) { return hiddenTitles().some(hidden => hiddenTitleKey(hidden) === hiddenTitleKey(item)); }
function likedTitles() { return Array.isArray(currentProfile()?.likedTitles) ? currentProfile().likedTitles.filter(item => item?.type && item?.id) : []; }
function isLikedTitle(item) { return likedTitles().some(liked => hiddenTitleKey(liked) === hiddenTitleKey(item)); }
function hideAction() { return ""; }
function ratingAction(item) { if (!state.user) return ""; const liked = isLikedTitle(item); return `<div class="title-feedback"><span>Rate this title</span><div class="rate-buttons"><button type="button" class="rate-btn up ${liked ? "selected" : ""}" data-like-title aria-label="I like this"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h3V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.3l1-4.6c.1-.5-.1-1-.5-1.3l-1.1-1c-.4-.4-1-.4-1.4 0L6 7v14h11c.8 0 1.5-.5 1.8-1.3l2.1-7c.1-.2.1-.4.1-.7v-2z"/></svg></button><button type="button" class="rate-btn down" data-hide-title aria-label="Not for me"><svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(180deg)"><path d="M2 21h3V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.3l1-4.6c.1-.5-.1-1-.5-1.3l-1.1-1c-.4-.4-1-.4-1.4 0L6 7v14h11c.8 0 1.5-.5 1.8-1.3l2.1-7c.1-.2.1-.4.1-.7v-2z"/></svg></button></div><em class="rate-note">${liked ? "Thanks — recommendations updated." : ""}</em></div>`; }
async function likeTitle(item) {
  const profile = currentProfile();
  if (!profile) return showAuth();
  const key = hiddenTitleKey(item), existing = likedTitles().filter(liked => hiddenTitleKey(liked) !== key);
  if (isLikedTitle(item)) profile.likedTitles = existing;
  else profile.likedTitles = [{ type:item.type, id:Number(item.id), title:titleOf(item), poster_path:item.poster_path || null, release_date:item.release_date || item.first_air_date || null, vote_average:Number(item.vote_average) || 0, genreIds:item.genre_ids || (item.genres || []).map(genre => genre.id), likedAt:new Date().toISOString() }, ...existing];
  await saveAccount();
  render();
}
async function hideTitle(item) {
  const profile = currentProfile();
  if (!profile) return showAuth();
  const key = hiddenTitleKey(item);
  const record = { type:item.type, id:Number(item.id), title:titleOf(item), poster_path:item.poster_path || null, release_date:item.release_date || item.first_air_date || null, vote_average:Number(item.vote_average) || 0, hiddenAt:new Date().toISOString() };
  profile.hiddenTitles = [record, ...hiddenTitles().filter(hidden => hiddenTitleKey(hidden) !== key)];
  profile.likedTitles = likedTitles().filter(liked => hiddenTitleKey(liked) !== key);
  state.featuredPool = state.featuredPool.filter(featured => !isHiddenTitle(featured));
  if (isHiddenTitle(state.featured)) { state.featuredIndex = 0; state.featured = state.featuredPool[0] || null; }
  await saveAccount();
  state.route = "home";
  scrollToTop();
  render();
}
async function restoreHiddenTitle(key) {
  const profile = currentProfile();
  if (!profile) return;
  profile.hiddenTitles = hiddenTitles().filter(item => hiddenTitleKey(item) !== key);
  await saveAccount();
  renderHiddenTitles();
}
function currentPreferences() { return { ...DEFAULT_PREFERENCES, ...(state.account?.preferences || {}), ...(currentProfile()?.preferences || {}) }; }
function updateCurrentPreferences(values) { const profile = currentProfile(); if (profile) profile.preferences = { ...currentPreferences(), ...values }; }
function profileAvatar(profile) { const avatar = isProfileAvatar(profile?.avatar) ? `<img src="${escapeHTML(profile.avatar)}" alt="">` : escapeHTML(profile?.name?.slice(0, 1).toUpperCase() || "?"); return `<span class="profile-avatar" style="--profile-color:${escapeHTML(profile?.color || "#d41520")}">${avatar}</span>`; }
function accountNavItem(tab, icon, label, active) { return `<button class="account-nav-item ${tab === active ? "active" : ""}" data-account-tab="${tab}" aria-current="${tab === active ? "page" : "false"}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`; }
function accountAction(icon, title, detail, action, value = "Open") { return `<button class="account-action-card" ${action}><i aria-hidden="true">${icon}</i><span><b>${t(title)}</b><small>${t(detail)}</small></span><em>${t(String(value))} ›</em></button>`; }
function parentAccessCodeAction() { const hasCode = parentAccessConfigured(); return `<button type="button" class="account-action-card profile-parent-code-action" data-change-parent-code><i aria-hidden="true">⌘</i><span><b>${t(hasCode ? "Change parent access code" : "Set parent access code")}</b><small>${t(hasCode ? "Confirm your current code before changing or turning it off." : "Protect profile and account settings without locking the profile picker.")}</small></span><em>${hasCode ? "Change" : "Set"} ›</em></button>`; }
function playbackPreferencesPanel(account, profile) { return `<section class="account-content-panel"><div class="account-content-heading"><span class="brand">PLAYBACK & ACCESS</span><h2>${t("Viewing preferences")}</h2><p>These choices apply only to ${escapeHTML(profile?.name || "this profile")}.</p></div><div class="settings-stack"><label class="account-toggle"><span>Autoplay next episode<small>Continue series automatically when available</small></span><input type="checkbox" data-pref="autoplayNext" ${account.preferences.autoplayNext !== false ? "checked" : ""}><i></i></label><label class="account-toggle"><span>Cinematic intro<small>Play the SEVEN ident when the app opens</small></span><input type="checkbox" data-pref="introEnabled" ${account.preferences.introEnabled !== false ? "checked" : ""}><i></i></label><label class="account-toggle"><span>Autoplay spotlight<small>Rotate featured titles on Home</small></span><input type="checkbox" data-pref="autoplayPreviews" ${account.preferences.autoplayPreviews !== false ? "checked" : ""}><i></i></label><label class="account-toggle"><span>New episode alerts<small>Notify me when a show in Favourites has a new episode</small></span><input type="checkbox" data-pref="episodeAlerts" ${account.preferences.episodeAlerts === true ? "checked" : ""}><i></i></label><div class="account-selects"><label class="account-select">Maturity setting<select data-pref="maturity"><option ${account.preferences.maturity === "Kids" ? "selected" : ""}>Kids</option><option ${account.preferences.maturity === "13+" ? "selected" : ""}>13+</option><option ${account.preferences.maturity === "16+" ? "selected" : ""}>16+</option><option ${account.preferences.maturity === "18+" ? "selected" : ""}>18+</option></select></label><label class="account-select">Video player<select data-pref="playerProvider"><option value="cinesrc" ${account.preferences.playerProvider === "cinesrc" || !PLAYER_PROVIDERS.includes(account.preferences.playerProvider) ? "selected" : ""}>CineSrc 4K (recommended)</option><option value="vidfast" ${account.preferences.playerProvider === "vidfast" ? "selected" : ""}>VidFast 4K</option><option value="multiembed" ${account.preferences.playerProvider === "multiembed" ? "selected" : ""}>MultiEmbed</option><option value="vidsrc" ${account.preferences.playerProvider === "vidsrc" ? "selected" : ""}>VidSrc</option><option value="2embed" ${account.preferences.playerProvider === "2embed" ? "selected" : ""}>2Embed</option></select></label><label class="account-select">Display language<select data-pref="language"><option ${account.preferences.language === "English" ? "selected" : ""}>English</option><option ${account.preferences.language === "Arabic" ? "selected" : ""}>Arabic</option><option ${account.preferences.language === "French" ? "selected" : ""}>French</option></select></label></div></section>`; }
function accountPanel(account, profile, tab) {
  if (tab === "playback") return playbackPreferencesPanel(account, profile);
  if (tab === "activity") return `<section class="account-content-panel"><div class="account-content-heading"><span class="brand">YOUR SEVEN</span><h2>${escapeHTML(profile?.name || "Your")} activity</h2><p>Everything this profile has saved, watched, rated, or hidden.</p></div><div class="account-action-grid">${accountAction("◴", "Profile stats", "Watch time, streaks, genres, and completed titles", "data-profile-stats")}${accountAction("♥", "Favourites", `Movies and series saved by ${escapeHTML(profile?.name || "this profile")}`, "data-my-list")}${accountAction("▤", "Viewing activity", "Review or remove watched titles", "data-view-history")}${accountAction("★", "Your ratings", "Titles used to shape recommendations", "data-liked-titles", likedTitles().length || "View")}${accountAction("⊘", "Not for me", "Bring hidden titles back into browse rows", "data-hidden-titles", hiddenTitles().length || "View")}</div></section>`;
  if (tab === "security") return `<section class="account-content-panel"><div class="account-content-heading"><span class="brand">ACCOUNT & DEVICE</span><h2>${t("Security and privacy")}</h2><p>Manage this device and your account credentials.</p></div><div class="account-security-layout"><div class="account-action-grid">${accountAction("⌁", "Change password", "Confirm your current password before setting a new one", "data-change-password", "Change")}${accountAction("⌂", "Install SEVEN", "Add SEVEN to this device’s Home Screen", "data-install-seven", "Install")}${accountAction("⌫", "Clear viewing history", `Remove activity for ${escapeHTML(profile?.name || "this profile")}`, "data-clear-history", "Clear")}${accountAction("↪", "Sign out", "End this device session", "data-signout", "Sign out")}</div></div></section>`;
  const profiles = account.profiles.map(item => `<div class="profile-card ${item.id === profile?.id ? "active" : ""}"><button data-select-profile="${item.id}">${profileAvatar(item)}<b>${escapeHTML(item.name)}</b><small>${item.kids ? "Kids" : "Standard"}</small></button><button class="profile-edit" data-edit-profile="${item.id}" aria-label="Edit ${escapeHTML(item.name)}">✎</button></div>`).join("");
  const profileAdd = account.profiles.length < 5 ? `<button class="profile-add" data-add-profile><span>+</span><b>Add profile</b></button>` : "";
  return `<section class="account-content-panel account-profiles-panel"><div class="account-content-heading"><span class="brand">PROFILES</span><h2>${t("Who’s watching?")}</h2><p>Choose a profile, or edit its avatar, PIN, and maturity settings.</p></div><div class="profiles">${profiles}${profileAdd}</div></section>`;
}
function accountHub() {
  const account = { ...(state.account || defaultAccount()), preferences:currentPreferences() }, profile = currentProfile(), tab = state.accountTab || "profiles", navOpen = state.accountSidebarOpen !== false;
  return `${header()}<main class="account-page account-workspace-page"><div class="account-page-top"><button class="account-back" data-account-back>‹ ${t("Browse")}</button><div class="account-heading"><span class="brand">SEVEN ACCOUNT</span><h1>${t("Account")}</h1><p>${escapeHTML(state.user?.email || "Signed in")}</p></div><div class="account-active-profile">${profileAvatar(profile)}<span><b>${escapeHTML(profile?.name || "Profile")}</b><small>${t("Watching now")}</small></span></div></div><div class="account-workspace ${navOpen ? "nav-open" : "nav-closed"}"><aside class="account-sidebar" aria-label="Account categories"><button class="account-nav-toggle" data-toggle-account-nav aria-label="${navOpen ? "Collapse" : "Expand"} account categories">☰ <span>${t("Categories")}</span></button><nav>${accountNavItem("profiles", "◉", t("Profiles"), tab)}${accountNavItem("activity", "▦", t("Your SEVEN"), tab)}${accountNavItem("playback", "▷", t("Playback"), tab)}${accountNavItem("security", "⌾", t("Security"), tab)}</nav></aside><div class="account-workspace-content">${accountPanel(account, profile, tab)}</div></div></main>`;
}
function showProfileEditor(id = "") {
  const existing = state.account.profiles.find(profile => profile.id === id);
  state.profileDraft = existing ? { ...existing } : { id:`profile-${Date.now()}`, name:"", color:PROFILE_COLORS[state.account.profiles.length % PROFILE_COLORS.length], kids:false };
  state.profileEditorIsNew = !existing;
  state.profileSettingsReturn = "account";
  state.route = "profile-settings"; scrollToTop(); render();
}
function profileCategoryRow(id, title, detail) {
  const paths = {
    profiles:`<circle cx="9" cy="8" r="3.25"/><path d="M3 19c.5-3.3 2.4-5 6-5 1.3 0 2.4.2 3.2.7M16 8a3 3 0 0 1 0 6m1.2 1c2.1.7 3.3 2.2 3.8 4"/>`,
    profile:`<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.6-4 3-6 7.5-6 2.2 0 3.9.5 5.2 1.6M17.5 4.5l2 2M17 14l3.5-3.5 2 2L19 17h-2z"/>`,
    family:`<path d="M12 3 20 6v5c0 5.1-3.2 8.2-8 10-4.8-1.8-8-4.9-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>`,
    playback:`<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>`,
    language:`<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.4 2.4 3.6 5.4 3.6 9S14.4 18.6 12 21c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3z"/>`,
    activity:`<path d="M4 19V9m5 10V5m6 14v-7m5 7V8"/><path d="M2.5 21h19"/>`,
    security:`<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>`
  };
  return `<button class="profile-category-row" data-profile-category="${id}"><span class="profile-category-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.profile}</svg></span><span class="profile-category-copy"><b>${t(title)}</b><small>${t(detail)}</small></span><span class="profile-category-arrow" aria-hidden="true">→</span></button>`;
}
function profileSettingsHome(profile, isNew) {
  const saved = state.profileSettingsNotice ? `<p class="profile-settings-notice" role="status">${t(state.profileSettingsNotice)}</p>` : "";
  state.profileSettingsNotice = "";
  return `<section class="profile-settings-hub"><header class="profile-settings-intro"><span class="brand">SEVEN ACCOUNT <i aria-hidden="true"></i> ${t("Settings")}</span><h2>${t(isNew ? "Create a profile" : "Your profile")}</h2><p>${t("Manage people, playback, and privacy for this profile.")}</p></header>${saved}<section class="profile-hub-hero"><button class="profile-hub-avatar" data-profile-category="profile" aria-label="Edit ${escapeHTML(profile.name || "profile")}">${profileAvatar(profile)}<i aria-hidden="true">✎</i></button><div class="profile-hub-identity"><span class="brand">${t("CURRENT PROFILE")}</span><h3>${escapeHTML(profile.name || "New profile")}</h3><p>${t(profile.kids ? "Kids profile" : "Standard profile")}</p></div><button class="profile-hub-edit" data-profile-category="profile">${t("Edit this profile")}<span aria-hidden="true">→</span></button></section><div class="profile-settings-groups"><section class="profile-settings-group"><div class="profile-settings-group-heading"><span class="brand">01</span><h3>${t("Profile & parental controls")}</h3></div><div class="profile-category-list">${profileCategoryRow("profiles", "Manage profiles", "Add or edit who can watch")}${profileCategoryRow("profile", "Edit this profile", "Name and avatar")}${profileCategoryRow("family", "Family controls", "Maturity, title restrictions, and kids mode")}</div></section><section class="profile-settings-group"><div class="profile-settings-group-heading"><span class="brand">02</span><h3>${t("Viewing experience")}</h3></div><div class="profile-category-list">${profileCategoryRow("playback", "Playback", "Autoplay and episode alerts")}${profileCategoryRow("language", "Language & display", "Language used throughout SEVEN")}</div></section><section class="profile-settings-group"><div class="profile-settings-group-heading"><span class="brand">03</span><h3>${t("Activity & privacy")}</h3></div><div class="profile-category-list">${profileCategoryRow("activity", "Your SEVEN activity", "Stats, favourites, and viewing history")}${profileCategoryRow("security", "Privacy & security", "Profile PIN, device, and account actions")}</div></section></div>${isNew ? `<p class="profile-hub-note">Finish your profile details, then save to add it to this account.</p>` : ""}</section>`;
}
function iosDnsProtectionCard() {
  return `<section class="profile-pin-card dns-filtering-card"><span class="brand">OPTIONAL · IPHONE-WIDE</span><h2>Block known ad domains</h2><p>SEVEN blocks many player pop-ups. For broader filtering, use AdGuard’s free public DNS profile on iPhone. It can reduce requests to known ad and tracker domains, but cannot catch every ad.</p><a class="dns-filtering-link" href="https://adguard-dns.io/en/public-dns.html" target="_blank" rel="noopener noreferrer">View iPhone DNS setup <span aria-hidden="true">↗</span></a><small>On the official page, choose the Default server and download its iOS profile. Then review and install it in Settings. This changes DNS for the whole iPhone, not just SEVEN, and may affect playback.</small></section>`;
}
function profileSettingsDetail(profile, category, preferences, isNew) {
  const canRemove = !isNew && state.account.profiles.length > 1, save = `<div class="profile-settings-actions"><button class="primary" type="submit">${t(isNew ? "Create profile" : "Save changes")}</button></div>`;
  if (category === "profiles") { const profiles = state.account.profiles.map(item => `<button class="profile-manager-card ${item.id === activeProfileId() ? "current" : ""}" data-manage-profile="${item.id}" ${item.id === activeProfileId() ? 'aria-current="true"' : ""}>${profileAvatar(item)}<b>${escapeHTML(item.name)}</b><small>${item.kids ? "Kids" : "Standard"}${item.id === activeProfileId() ? " · Current" : ""}</small></button>`).join(""); return `<section class="profile-detail-card profile-manager"><span class="brand">PROFILES</span><h2>Manage profiles</h2><p>Add up to five profiles, each with its own viewing preferences and PIN.</p><div class="profile-manager-grid">${profiles}${state.account.profiles.length < 5 ? `<button class="profile-manager-add" data-add-profile-mobile><span>+</span><b>Add profile</b></button>` : ""}</div></section>`; }
  if (category === "profile") return `<form id="profile-settings-form" class="profile-settings-form"><section class="profile-detail-card"><span class="brand">PROFILE</span><div class="profile-mobile-identity"><div class="profile-settings-avatar" data-avatar-preview>${profileAvatar(profile)}</div><button class="profile-avatar-change" type="button" data-toggle-avatar-picker aria-expanded="false" aria-controls="avatar-choices">✎</button><label class="profile-name-field">Profile name<input name="name" required maxlength="24" value="${escapeHTML(profile.name)}" placeholder="Profile name"></label><small class="profile-name-hint">This name appears in the profile picker.</small></div><section class="profile-avatar-chooser" id="avatar-choices" hidden><span class="brand">CHOOSE AN AVATAR</span><div class="profile-avatar-grid">${AVATAR_OPTIONS.map(([name, path]) => `<button type="button" data-avatar-option="${path}" class="${profile.avatar === path ? "selected" : ""}" aria-label="Choose ${name}"><img src="${path}" alt="${name}"><span>${name}</span></button>`).join("")}<label class="profile-avatar-upload"><input type="file" accept="image/png,image/jpeg,image/webp" data-avatar-upload><span>＋</span><b>Upload photo</b></label></div></section></section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form>${canRemove ? `<section class="profile-danger-zone"><h2>Remove this profile</h2><p>Its preferences and profile-only data will be deleted from this account.</p>${accountAction("×", "Delete profile", `Delete ${escapeHTML(profile.name)} and its preferences`, "data-remove-profile", "Delete")}</section>` : ""}`;
  if (category === "family") { const blocked = restrictedTitles(profile), parentCode = `<section class="profile-pin-card parent-access-card family-parent-code"><h2>${t("Parent access code")}</h2><p>${state.account?.parentPinHash ? "This code opens account and profile settings only. It never locks the profile chooser." : "Set a code to protect account and profile settings without locking a profile."}</p><label class="profile-pin-field">${t(state.account?.parentPinHash ? "Change parent access code" : "Set parent access code")}<input name="parentPin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="${state.account?.parentPinHash ? "Leave blank to keep current code" : "4–8 digits"}"></label>${state.account?.parentPinHash ? `<label class="profile-remove-pin"><input type="checkbox" name="removeParentPin"> Turn off parent access code</label>` : ""}</section>`; return `<form id="profile-settings-form"><section class="profile-detail-card family-controls"><span class="brand">FAMILY CONTROLS</span><label class="profile-mobile-row profile-mobile-toggle"><i aria-hidden="true">♙</i><span><b>${t("Kids profile")}</b><small>Use child-friendly browsing and stricter content filtering.</small></span><input name="kids" type="checkbox" ${profile.kids ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-select"><i aria-hidden="true">◈</i><span><b>${t("Maturity rating")}</b><small>Choose the highest rating this profile can browse.</small></span><select name="maturity"><option ${preferences.maturity === "Kids" ? "selected" : ""}>Kids</option><option ${preferences.maturity === "13+" ? "selected" : ""}>13+</option><option ${preferences.maturity === "16+" ? "selected" : ""}>16+</option><option ${preferences.maturity === "18+" ? "selected" : ""}>18+</option></select></label><div class="screen-time-rows ${profile.kids ? "" : "row-disabled"}"><label class="profile-mobile-row profile-mobile-toggle"><i aria-hidden="true">⏱</i><span><b>${t("Screen time limit")}</b><small>${profile.kids ? "Limit how long this profile can watch each day." : "Turn on Kids profile to use screen time limits."}</small></span><input name="screenTimeEnabled" type="checkbox" ${profile.kids && profile.screenTime?.enabled ? "checked" : ""} ${profile.kids ? "" : "disabled"}"><em></em></label><label class="profile-mobile-row profile-mobile-select"><i aria-hidden="true">◔</i><span><b>${t("Daily limit")}</b><small>Minutes of screen time per day.</small></span><select name="screenTimeMinutes" ${profile.kids ? "" : "disabled"}>${[30, 60, 90, 120, 180].map(minutes => `<option value="${minutes}" ${Number(profile.screenTime?.minutes || 60) === minutes ? "selected" : ""}>${minutes} min</option>`).join("")}</select></label></div><label class="profile-mobile-row profile-mobile-toggle"><i aria-hidden="true">♥</i><span><b>Extra family-safe filtering</b><small>Hide intense crime, war, mystery, thriller, and horror titles.</small></span><input name="familySafe" type="checkbox" ${preferences.familySafe === true ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><i aria-hidden="true">◐</i><span><b>Block scary titles</b><small>Hide horror, thriller, and mystery titles from browsing.</small></span><input name="blockScary" type="checkbox" ${preferences.blockScary === true ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><i aria-hidden="true">⌕</i><span><b>Allow title search</b><small>Turn off search to keep this profile’s browsing simple.</small></span><input name="searchEnabled" type="checkbox" ${preferences.searchEnabled !== false ? "checked" : ""}><em></em></label>${parentCode}</section><section class="profile-detail-card family-restrictions"><span class="brand">TITLE RESTRICTIONS</span><h2>Block specific titles</h2><p>Blocked titles disappear from Home, search, collections, and catalogs for this profile.</p>${isNew ? `<p class="family-restriction-note">Create this profile before adding title restrictions.</p>` : `<label class="family-title-search">Find a title to block<span><input id="family-title-search" placeholder="Search titles" maxlength="80" autocomplete="off"><button type="button" data-family-search>Find</button></span></label><div class="family-title-results" id="family-title-results" hidden></div><div class="family-blocked-list">${blocked.length ? blocked.map(item => `<article><img src="${item.posterPath ? TMDB_IMAGE + escapeHTML(item.posterPath) : "icon.svg"}" alt=""><span><b>${escapeHTML(item.title)}</b><small>${item.type === "tv" ? "Series" : "Movie"}</small></span><button type="button" data-unblock-title="${item.type}:${item.id}">Allow</button></article>`).join("") : `<small class="family-restriction-note">No titles are blocked on this profile.</small>`}</div>`}</section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form>`; }
  if (category === "playback") { const provider = PLAYER_PROVIDERS.includes(preferences.playerProvider) ? preferences.playerProvider : "cinesrc"; return `<form id="profile-settings-form" class="profile-settings-form"><section class="profile-detail-card"><span class="brand">PLAYBACK</span><h2 class="profile-settings-card-title">Playback behavior</h2><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("Autoplay next episode")}</b><small>Continue a series automatically when an episode ends.</small></span><input name="autoplayNext" type="checkbox" ${preferences.autoplayNext !== false ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("Cinematic intro")}</b><small>Play the SEVEN ident when this profile opens the app.</small></span><input name="introEnabled" type="checkbox" ${preferences.introEnabled !== false ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("Autoplay spotlight")}</b><small>Rotate featured titles automatically on Home.</small></span><input name="autoplayPreviews" type="checkbox" ${preferences.autoplayPreviews !== false ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("New episode alerts")}</b><small>Notify you when a series in Favourites has a new episode.</small></span><input name="episodeAlerts" type="checkbox" ${preferences.episodeAlerts === true ? "checked" : ""}><em></em></label><div class="profile-settings-subsection"><h2 class="profile-settings-card-title">Preferred video source</h2><label class="profile-mobile-row profile-mobile-select"><span><b>${t("Preferred player")}</b><small>Choose which available source opens first.</small></span><select name="playerProvider" class="preferred-player-select"><option value="cinesrc" ${provider === "cinesrc" ? "selected" : ""}>CineSrc 4K</option><option value="vidfast" ${provider === "vidfast" ? "selected" : ""}>VidFast 4K</option><option value="multiembed" ${provider === "multiembed" ? "selected" : ""}>MultiEmbed</option><option value="vidsrc" ${provider === "vidsrc" ? "selected" : ""}>VidSrc</option><option value="2embed" ${provider === "2embed" ? "selected" : ""}>2Embed</option></select></label></div></section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form>`; }
  if (category === "language") return `<form id="profile-settings-form" class="profile-settings-form"><section class="profile-detail-card"><span class="brand">LANGUAGE & DISPLAY</span><h2 class="profile-settings-card-title">App language</h2><label class="profile-mobile-row profile-mobile-select"><span><b>${t("Display language")}</b><small>Choose the language used throughout SEVEN.</small></span><select name="language"><option ${preferences.language === "English" ? "selected" : ""}>English</option><option ${preferences.language === "Arabic" ? "selected" : ""}>Arabic</option><option ${preferences.language === "French" ? "selected" : ""}>French</option></select></label><div class="profile-settings-subsection"><h2 class="profile-settings-card-title">Browse preferences</h2><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("Show movies")}</b><small>Include films in Home, search, and browse rows.</small></span><input name="moviesEnabled" type="checkbox" ${preferences.moviesEnabled !== false ? "checked" : ""}><em></em></label><label class="profile-mobile-row profile-mobile-toggle"><span><b>${t("Show series")}</b><small>Include series in Home, search, and browse rows.</small></span><input name="seriesEnabled" type="checkbox" ${preferences.seriesEnabled !== false ? "checked" : ""}><em></em></label></div></section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form>`;
  if (category === "activity") return `<section class="profile-detail-card"><span class="brand">YOUR SEVEN ACTIVITY</span><div class="profile-category-actions">${accountAction("◴", "Profile stats", "Watch time, streaks, genres, and completed titles", "data-profile-stats")}${accountAction("♥", "Favourites", "Movies and series saved by this profile", "data-my-list")}${accountAction("▤", "Viewing activity", "Review or remove watched titles", "data-view-history")}${accountAction("★", "Your ratings", "Titles shaping recommendations", "data-liked-titles")}${accountAction("⊘", "Not for me", "Restore titles hidden from browse rows", "data-hidden-titles", hiddenTitles().length || "View")}</div></section>`;
  if (profile.kids) return `<section class="profile-detail-card"><span class="brand">PRIVACY & SECURITY</span><form id="profile-settings-form"><section class="profile-pin-card parent-access-card"><h2>${t("Parent access code")}</h2><p>${state.account?.parentPinHash ? "This code protects profile and account settings for 15 minutes after it is entered. Kids profiles do not use a profile-picker PIN." : "Set one code to protect kids settings and profile management on shared devices."}</p><label class="profile-pin-field">${t(state.account?.parentPinHash ? "Change parent access code" : "Set parent access code")}<input name="parentPin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="${state.account?.parentPinHash ? "Leave blank to keep current code" : "Optional: 4–8 digits"}"></label>${state.account?.parentPinHash ? `<label class="profile-remove-pin"><input type="checkbox" name="removeParentPin"> Turn off parent access code</label>` : ""}</section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form><div class="profile-category-actions">${accountAction("⌂", "Install SEVEN", "Add SEVEN to this device’s Home Screen", "data-install-seven", "Install")}${accountAction("⌫", "Clear viewing history", "Remove activity for this profile", "data-clear-history", "Clear")}</div></section>`;
  return `<section class="profile-detail-card"><span class="brand">PRIVACY & SECURITY</span><form id="profile-settings-form"><section class="profile-pin-card"><h2>${t("Profile PIN")}</h2><p>Keep this profile private on shared devices.</p><label class="profile-pin-field">${t(profile.pinHash ? "Change profile PIN" : "Set a profile PIN")}<input name="pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="${profile.pinHash ? "Leave blank to keep current PIN" : "Optional: 4–8 digits"}"></label>${profile.pinHash ? `<label class="profile-remove-pin"><input type="checkbox" name="removePin"> Remove PIN protection</label>` : ""}</section><section class="profile-pin-card parent-access-card"><h2>${t("Parent access code")}</h2><p>${state.account?.parentPinHash ? "This code protects profile and account settings for 15 minutes after it is entered." : "Set one code to protect profile and account settings on shared devices."}</p><label class="profile-pin-field">${t(state.account?.parentPinHash ? "Change parent access code" : "Set parent access code")}<input name="parentPin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,8}" minlength="4" maxlength="8" placeholder="${state.account?.parentPinHash ? "Leave blank to keep current code" : "Optional: 4–8 digits"}"></label>${state.account?.parentPinHash ? `<label class="profile-remove-pin"><input type="checkbox" name="removeParentPin"> Turn off parent access code</label>` : ""}</section><p class="form-error profile-settings-error" id="profile-error"></p>${save}</form><div class="profile-category-actions">${accountAction("⌂", "Install SEVEN", "Add SEVEN to this device’s Home Screen", "data-install-seven", "Install")}${accountAction("⌫", "Clear viewing history", "Remove activity for this profile", "data-clear-history", "Clear")}</div></section>`;
}
function renderProfileSettings() {
  const profile = state.profileDraft;
  if (!profile) { state.route = "account"; return render(); }
  const isNew = state.profileEditorIsNew, preferences = { ...currentPreferences(), ...(profile.preferences || {}) }, category = state.profileSettingsCategory || "home", titles = { profiles:"Manage profiles", profile:"Edit this profile", family:"Family controls", playback:"Playback", language:"Language & display", activity:"Your SEVEN activity", security:"Privacy & security" }, descriptions = { profiles:"Manage each profile's details and viewing limits.", profile:"Choose a profile name and avatar.", family:"Choose what this profile can discover and watch.", playback:"Make playback fit your preferences.", language:"Choose the language and content you want to see.", activity:"Review saved titles, ratings, and watch history.", security:"Protect the profile and manage account access." };
  const detailHeading = category === "home" ? "" : `<header class="profile-settings-page-heading"><button class="profile-category-back" data-profile-category-back>‹ ${t("All settings")}</button><div class="profile-settings-heading-copy"><span class="brand">${t("PROFILE SETTINGS")}</span><h2>${t(titles[category])}</h2></div><p>${t(descriptions[category])}</p></header>`;
  app.innerHTML = `${header()}<main class="profile-settings-page profile-settings-mobile-first profile-settings-redesign"><div class="profile-settings-topbar"><button class="account-back" data-profile-settings-back>‹ ${t("Browse")}</button><button class="profile-settings-switch" data-switch-profile><span>${t("Switch profile")}</span><i aria-hidden="true">⇄</i></button></div>${category === "home" ? profileSettingsHome(profile, isNew) : `<div class="profile-settings-detail-page">${detailHeading}${profileSettingsDetail(profile, category, preferences, isNew)}</div>`}</main>`;
  if (category === "security") document.querySelector(".profile-settings-detail-page")?.insertAdjacentHTML("beforeend", iosDnsProtectionCard());
  document.querySelectorAll(".screen-time-rows input, .screen-time-rows select").forEach(field => { field.disabled = !profile.kids; });
  bindCommon();
  document.querySelectorAll(".parent-access-card").forEach(card => { const detail = parentAccessConfigured() ? "This code protects profile and account settings. It never locks the profile picker." : "Set a code to protect profile and account settings without locking the profile picker."; card.innerHTML = `<h2>${t("Parent access code")}</h2><p>${escapeHTML(detail)}</p>${parentAccessCodeAction()}`; });
  document.querySelector("[data-profile-settings-back]").onclick = () => { state.profileDraft = null; state.profileEditorIsNew = null; state.profileSettingsCategory = null; state.route = state.profileSettingsReturn || "account"; state.profileSettingsReturn = null; render(); };
  document.querySelector("[data-switch-profile]")?.addEventListener("click", () => { state.profileDraft = null; state.profileEditorIsNew = null; state.profileSettingsCategory = null; state.profileSettingsReturn = null; state.route = "profiles"; scrollToTop(); render(); });
  document.querySelector("[data-profile-category-back]")?.addEventListener("click", () => { state.profileSettingsCategory = "home"; renderProfileSettings(); scrollToTop(); });
  document.querySelectorAll("[data-profile-category]").forEach(button => button.onclick = () => { state.profileSettingsCategory = button.dataset.profileCategory; renderProfileSettings(); scrollToTop(); });
  document.querySelectorAll("[data-manage-profile]").forEach(button => button.onclick = () => { const selected = state.account.profiles.find(item => item.id === button.dataset.manageProfile); if (!selected) return; state.profileDraft = { ...selected }; state.profileEditorIsNew = false; state.profileSettingsCategory = "profile"; renderProfileSettings(); });
  document.querySelector("[data-add-profile-mobile]")?.addEventListener("click", () => { state.profileDraft = { id:`profile-${Date.now()}`, name:"", color:PROFILE_COLORS[state.account.profiles.length % PROFILE_COLORS.length], kids:false }; state.profileEditorIsNew = true; state.profileSettingsCategory = "profile"; renderProfileSettings(); });
  document.querySelector("[data-toggle-avatar-picker]")?.addEventListener("click", event => { const picker = document.querySelector("#avatar-choices"), open = picker.hasAttribute("hidden"); picker.toggleAttribute("hidden", !open); event.currentTarget.setAttribute("aria-expanded", String(open)); });
  document.querySelectorAll("[data-change-parent-code]").forEach(button => button.addEventListener("click", showParentCodeChange));
  document.querySelectorAll("[data-avatar-option]").forEach(button => button.onclick = () => { profile.avatar = button.dataset.avatarOption; document.querySelector("[data-avatar-preview]").innerHTML = profileAvatar(profile); document.querySelectorAll("[data-avatar-option]").forEach(option => option.classList.toggle("selected", option === button)); });
  document.querySelector("[data-avatar-upload]")?.addEventListener("change", async event => { const error = document.querySelector("#profile-error"); try { error.textContent = ""; profile.avatar = await prepareUploadedAvatar(event.currentTarget.files?.[0]); document.querySelector("[data-avatar-preview]").innerHTML = profileAvatar(profile); document.querySelectorAll("[data-avatar-option]").forEach(option => option.classList.remove("selected")); } catch (failure) { error.textContent = failure.message; } });
  document.querySelector('[name="kids"]')?.addEventListener("change", event => { const rows = document.querySelector(".screen-time-rows"), enabled = event.currentTarget.checked && parentAccessConfigured(); rows?.classList.toggle("row-disabled", !enabled); rows?.querySelectorAll("input, select").forEach(field => { field.disabled = !enabled; }); if (event.currentTarget.checked && !parentAccessConfigured()) showParentCodeSetup(); });
  document.querySelector("[data-family-search]")?.addEventListener("click", async () => { const input = document.querySelector("#family-title-search"), resultsSlot = document.querySelector("#family-title-results"), error = document.querySelector("#profile-error"), query = input.value.trim(); if (query.length < 2) { error.textContent = "Enter at least two characters to find a title."; return; } try { error.textContent = ""; resultsSlot.hidden = false; resultsSlot.innerHTML = `<small>Searching…</small>`; const response = await api("search/multi", { query }), found = (response.results || []).filter(item => item.media_type !== "person" && ["movie", "tv"].includes(contentType(item))).slice(0, 6).map(item => normalize(item)); state.familyTitleResults = found; resultsSlot.innerHTML = found.length ? found.map(item => `<article><img src="${posterOf(item)}" alt=""><span><b>${escapeHTML(titleOf(item))}</b><small>${item.type === "tv" ? "Series" : "Movie"} · ${yearOf(item) || "New"}</small></span><button type="button" data-block-title="${item.type}:${item.id}">Block</button></article>`).join("") : `<small>No titles found.</small>`; resultsSlot.querySelectorAll("[data-block-title]").forEach(button => button.onclick = async () => { const [type, id] = button.dataset.blockTitle.split(":"), item = state.familyTitleResults.find(result => result.type === type && Number(result.id) === Number(id)); if (!item) return; profile.restrictedTitles = [...restrictedTitles(profile).filter(entry => !(entry.type === type && Number(entry.id) === Number(id))), { id:Number(item.id), type:item.type, title:titleOf(item), posterPath:item.poster_path || item.posterPath || null }]; state.account.profiles = state.account.profiles.map(entry => entry.id === profile.id ? { ...profile } : entry); await saveAccount(); renderProfileSettings(); }); } catch (failure) { resultsSlot.hidden = true; error.textContent = failure.message; } });
  document.querySelectorAll("[data-unblock-title]").forEach(button => button.onclick = async () => { const [type, id] = button.dataset.unblockTitle.split(":" ); profile.restrictedTitles = restrictedTitles(profile).filter(item => !(item.type === type && Number(item.id) === Number(id))); state.account.profiles = state.account.profiles.map(entry => entry.id === profile.id ? { ...profile } : entry); await saveAccount(); renderProfileSettings(); });
  document.querySelector("#profile-settings-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form), pin = String(values.get("pin") || ""), parentPin = String(values.get("parentPin") || ""), error = document.querySelector("#profile-error"), next = { ...profile, preferences:{ ...(profile.preferences || {}) } };
    try {
      if (form.elements.name) { next.name = String(values.get("name") || "").trim(); if (!next.name) throw new Error("Enter a profile name."); }
      ["maturity", "language", "playerProvider"].forEach(name => { if (form.elements[name]) next.preferences[name] = String(values.get(name)); });
      ["kids", "autoplayNext", "introEnabled", "autoplayPreviews", "episodeAlerts", "familySafe", "blockScary", "searchEnabled", "moviesEnabled", "seriesEnabled"].forEach(name => { if (form.elements[name]) { if (name === "kids") next.kids = form.elements[name].checked; else next.preferences[name] = form.elements[name].checked; } });
      if (form.elements.episodeAlerts?.checked && !await requestEpisodeAlerts()) { form.elements.episodeAlerts.checked = false; throw new Error("Allow browser notifications to enable episode alerts."); }
      const refreshFamilyCatalog = next.id === activeProfileId() && ["kids", "maturity", "familySafe", "blockScary", "language"].some(name => form.elements[name]);
      if (next.kids) { if (!parentAccessConfigured()) throw new Error("Set a parent access code before enabling Kids profile."); next.preferences.maturity = "Kids"; delete next.pinHash; if (form.elements.screenTimeEnabled) next.screenTime = { ...(next.screenTime || {}), enabled: form.elements.screenTimeEnabled.checked, minutes: Number(values.get("screenTimeMinutes")) || 60 }; } else { delete next.screenTime; if (pin) next.pinHash = await profileSecret(pin); else if (form.elements.removePin?.checked) delete next.pinHash; }
      if (isNew) { state.account.profiles.push(next); state.profileEditorIsNew = false; } else state.account.profiles = state.account.profiles.map(item => item.id === profile.id ? next : item);
      state.profileDraft = next;
      await saveAccount();
      if (form.elements.language) applyLocale();
      if (category === "playback" && form.elements.episodeAlerts?.checked) notifyNewEpisodes();
      if (refreshFamilyCatalog) try { await refreshCatalogForLanguage(); } catch { /* Existing filtered catalog remains available offline. */ }
      state.profileSettingsCategory = "home";
      state.profileSettingsNotice = "Settings saved.";
      renderProfileSettings();
    } catch (failure) { error.textContent = failure.message; }
  });
  document.querySelector("[data-profile-stats]")?.addEventListener("click", () => { state.route = "stats"; scrollToTop(); render(); });
  document.querySelector("[data-my-list]")?.addEventListener("click", () => { state.myListReturn = "profile-settings"; state.route = "my-list"; render(); });
  document.querySelector("[data-view-history]")?.addEventListener("click", () => { state.historyReturn = "profile-settings"; state.route = "history"; render(); });
  document.querySelector("[data-liked-titles]")?.addEventListener("click", () => { state.route = "liked"; scrollToTop(); render(); });
  document.querySelector("[data-hidden-titles]")?.addEventListener("click", () => { state.route = "hidden"; scrollToTop(); render(); });
  document.querySelector("[data-install-seven]")?.addEventListener("click", showInstallSEVEN);
  document.querySelector("[data-clear-history]")?.addEventListener("click", async () => { if (!confirm(`Clear viewing history for ${profile.name || "this profile"}?`)) return; const profileId = activeProfileId(), prefix = `seven-progress-${profileId}-`; Object.keys(localStorage).filter(key => key.startsWith(prefix)).forEach(key => localStorage.removeItem(key)); forgetProfileProgress(profileId); await clearProfilePlaybackStats(profileId); if (state.session) try { await localAPI(`/api/account/progress?profile=${encodeURIComponent(profileId)}`, { method:"DELETE", headers:authorizedHeaders() }); } catch {} renderProfileSettings(); });
  if (category === "security") {
    document.querySelector(".profile-category-actions")?.insertAdjacentHTML("afterbegin", accountAction("⌁", "Change account password", "Use your current password to set a new one", "data-change-password", "Change"));
    document.querySelector(".profile-category-actions")?.insertAdjacentHTML("afterbegin", accountAction("↪", "Sign out", "Sign out of your SEVEN account on this device", "data-signout", "Sign out"));
  }
  document.querySelector("[data-change-password]")?.addEventListener("click", showChangePassword);
  document.querySelector("[data-signout]")?.addEventListener("click", signOut);
  document.querySelector("[data-remove-profile]")?.addEventListener("click", async () => { if (!confirm(`Delete ${profile.name || "this"} profile?`)) return; const ownerId = accountWatchlistUserId(), wasActive = state.account.activeProfileId === profile.id; state.account.profiles = state.account.profiles.filter(item => item.id !== profile.id); if (wasActive) state.account.activeProfileId = state.account.profiles[0].id; clearWatchlistCache(ownerId, profile.id); if (state.session && ownerId) void localAPI(`/api/account/watchlist?profile=${encodeURIComponent(profile.id)}&all=true`, { method:"DELETE", headers:authorizedHeaders() }).catch(() => {}); if (wasActive) { hydrateWatchlist(); void loadAccountWatchlist(); } await saveAccount(); state.profileDraft = null; state.profileEditorIsNew = null; state.profileSettingsCategory = null; state.route = state.profileSettingsReturn || "account"; state.profileSettingsReturn = null; render(); });
}
function renderAccount() {
  app.innerHTML = accountHub(); bindCommon();
  document.querySelector("[data-account-back]").onclick = () => { state.route = state.accountReturn || "home"; state.accountReturn = null; render(); };
  document.querySelector("[data-toggle-account-nav]").onclick = () => { state.accountSidebarOpen = state.accountSidebarOpen === false; render(); };
  document.querySelectorAll("[data-account-tab]").forEach(button => button.onclick = () => { state.accountTab = button.dataset.accountTab; render(); });
  document.querySelectorAll("[data-select-profile]").forEach(button => button.onclick = async () => { state.account.activeProfileId = button.dataset.selectProfile; hydrateWatchlist(); void loadAccountWatchlist(); await saveAccount(); try { await loadMyList(); await refreshCatalogForLanguage(); } catch {} render(); });
  document.querySelectorAll("[data-edit-profile]").forEach(button => button.onclick = () => showProfileEditor(button.dataset.editProfile));
  document.querySelector("[data-add-profile]")?.addEventListener("click", () => showProfileEditor());
  document.querySelector("[data-view-history]")?.addEventListener("click", () => { state.historyReturn = "account"; state.route = "history"; render(); });
  document.querySelector("[data-my-list]")?.addEventListener("click", () => { state.myListReturn = "account"; state.route = "my-list"; render(); });
  document.querySelector("[data-hidden-titles]")?.addEventListener("click", () => { state.route = "hidden"; scrollToTop(); render(); });
  document.querySelector("[data-profile-stats]")?.addEventListener("click", () => { state.route = "stats"; scrollToTop(); render(); });
  document.querySelector("[data-liked-titles]")?.addEventListener("click", () => { state.route = "liked"; scrollToTop(); render(); });
  document.querySelector("[data-install-seven]")?.addEventListener("click", showInstallSEVEN);
  document.querySelectorAll("[data-pref]").forEach(field => field.onchange = async () => { if (field.dataset.pref === "episodeAlerts" && field.checked && !await requestEpisodeAlerts()) field.checked = false; updateCurrentPreferences({ [field.dataset.pref]:field.type === "checkbox" ? field.checked : field.value }); await saveAccount(); if (field.dataset.pref === "episodeAlerts" && field.checked) notifyNewEpisodes(); if (["language", "maturity"].includes(field.dataset.pref)) { applyLocale(); try { await refreshCatalogForLanguage(); } catch { /* The saved setting is used by the next successful TMDB request. */ } } });
  document.querySelector("[data-clear-history]")?.addEventListener("click", async () => { if (!confirm(`Clear viewing history for ${currentProfile()?.name || "this profile"}?`)) return; const profileId = activeProfileId(), prefix = `seven-progress-${profileId}-`; Object.keys(localStorage).filter(key => key.startsWith(prefix)).forEach(key => localStorage.removeItem(key)); forgetProfileProgress(profileId); await clearProfilePlaybackStats(profileId); if (state.session) try { await localAPI(`/api/account/progress?profile=${encodeURIComponent(profileId)}`, { method:"DELETE", headers:authorizedHeaders() }); } catch {} showAccount(); });
  document.querySelector("[data-change-password]")?.addEventListener("click", showChangePassword);
  document.querySelector("[data-signout]")?.addEventListener("click", signOut);
}
function openAccount() {
  if (currentProfile()) { state.profileDraft = { ...currentProfile() }; state.profileEditorIsNew = false; state.profileSettingsCategory = null; state.profileSettingsReturn = state.route === "profile-settings" ? state.profileSettingsReturn || "home" : state.route || "home"; state.route = "profile-settings"; scrollToTop(); render(); return; }
  if (state.route !== "account") state.accountReturn = state.route;
  state.route = "account"; scrollToTop(); render();
}
function showAccount() { if (!hasParentAccess()) { showParentUnlock(); return; } openAccount(); }
function showInstallSEVEN() {
  document.querySelector(".modal")?.remove();
  const isInstalled = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const body = isInstalled ? `<p>SEVEN is already installed on this device. Open it from your Home Screen for the full app experience.</p>` : isIOS ? `<p>Add SEVEN to your Home Screen so it opens full screen, without browser controls.</p><ol class="install-steps"><li>Tap the <b>Share</b> button in Safari.</li><li>Scroll down and choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b> to finish.</li></ol>` : `<p>Install SEVEN for a cleaner, full-screen experience and faster loading.</p>${deferredInstallPrompt ? `<button class="primary" data-confirm-install>Install SEVEN</button>` : `<ol class="install-steps"><li>Open your browser menu.</li><li>Choose <b>Install app</b> or <b>Add to Home Screen</b>.</li></ol>`}`;
  app.insertAdjacentHTML("beforeend", `<div class="modal install-modal"><section class="auth-card install-card" role="dialog" aria-modal="true" aria-label="Install SEVEN"><button class="modal-close" type="button" data-close-install>×</button><span class="brand">SEVEN ON YOUR PHONE</span><h2>${isInstalled ? "You’re all set" : "Install SEVEN"}</h2>${body}</section></div>`);
  document.querySelector("[data-close-install]").onclick = () => document.querySelector(".install-modal")?.remove();
  document.querySelector("[data-confirm-install]")?.addEventListener("click", async () => { const prompt = deferredInstallPrompt; if (!prompt) return; prompt.prompt(); await prompt.userChoice; deferredInstallPrompt = null; document.querySelector(".install-modal")?.remove(); });
}
function queueProgressSync(item, currentTime, duration, progress, immediate = false) {
  if (!state.session) return;
  const payload = { content_key:watchKey(item), content_type:item.type, tmdb_id:item.id, season:item.season || null, episode:item.episode || null, title:item.title || "Untitled", poster_path:item.posterPath || null, progress_seconds:currentTime, duration_seconds:duration, is_watched:progress >= 90, last_watched_at:new Date().toISOString() };
  upsertAccountProgress(payload);
  if (immediate) {
    clearTimeout(state.progressTimer); state.pendingProgress = null;
    void localAPI("/api/account/progress", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify(payload) }).catch(() => {});
    return;
  }
  state.pendingProgress = payload;
  clearTimeout(state.progressTimer);
  const pending = payload;
  state.progressTimer = setTimeout(async () => {
    if (!state.session || state.pendingProgress !== pending) return;
    try { await localAPI("/api/account/progress", { method:"POST", headers:{ "Content-Type":"application/json", ...authorizedHeaders() }, body:JSON.stringify(pending) }); }
    catch { /* Account progress remains available in this session and retries on the next update. */ }
    if (state.pendingProgress === pending) state.pendingProgress = null;
  }, 1200);
}
function bindCommon() {
  document.querySelectorAll("[data-home]").forEach(button => button.onclick = () => { state.route = "home"; render(); });
  document.querySelectorAll("[data-open]").forEach(button => button.onclick = () => { const [type, id] = button.dataset.open.split(":"); openItem(type, id); });
  document.querySelectorAll("[data-person]").forEach(button => button.onclick = () => openPerson(button.dataset.person));
  document.querySelectorAll("[data-continue]").forEach(button => button.onclick = () => { const [type, id, season, episode] = button.dataset.continue.split(":"), item = { type, id:Number(id), season:Number(season) || undefined, episode:Number(episode) || undefined }, saved = JSON.parse(localStorage.getItem(watchKey(item)) || "{}"); state.player = { ...item, title:saved.title, overview:"", posterPath:saved.posterPath, genreIds:saved.genreIds || [], startAt:savedStart(item) }; state.route = "player"; render(); scrollToTop(); });
  document.querySelectorAll("[data-explore]").forEach(button => button.onclick = () => { const view = state.explorable?.[button.dataset.explore]; if (!view) return; state.exploreView = view; state.route = "explore"; render(); });
  const input = document.querySelector("#search"); let timer;
  if (input) {
    input.closest(".search")?.querySelector("span")?.addEventListener("click", () => input.focus());
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => suggestSearch(input), 350); };
    input.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); searchRequest++; hideSearchSuggestions(input); search(input.value); } };
    input.onblur = () => setTimeout(() => hideSearchSuggestions(input), 160);
    input.onfocus = () => { if (input.value.trim().length < 2) return showRecentSearches(input); if (state.searchResults?.length) showSearchSuggestions(input, input.value.trim(), state.searchResults); };
  }
  document.querySelectorAll("[data-search-focus]").forEach(button => button.onclick = () => input?.focus());
  document.querySelectorAll("[data-for-you]").forEach(button => button.onclick = openForYou);
  document.querySelectorAll("[data-movies]").forEach(button => button.onclick = () => { state.mobileBrowseType = "movie"; openCatalog("movie"); });
  document.querySelectorAll("[data-shows]").forEach(button => button.onclick = () => { state.mobileBrowseType = "tv"; openCatalog("tv"); });
  document.querySelectorAll("[data-mobile-browse]").forEach(button => button.onclick = () => openCatalog(state.mobileBrowseType || "movie"));
  document.querySelectorAll("[data-toggle-watchlist]").forEach(button => button.onclick = event => { event.stopPropagation(); const item = state.watchlistTargets.get(button.dataset.toggleWatchlist); if (item) void toggleWatchlist(item); });
  document.querySelectorAll("[data-auth]").forEach(button => button.onclick = () => showAuth());
  document.querySelectorAll("[data-msearch]").forEach(button => button.onclick = openMobileSearch);
  document.querySelectorAll("[data-account]").forEach(button => button.onclick = showAccount);
}
let lastMobileHeaderY = window.scrollY || 0;
function syncHeaderScroll() {
  const header = document.querySelector("header.main-header.app-header"), currentY = Math.max(0, window.scrollY || 0);
  if (!header) { lastMobileHeaderY = currentY; return; }
  header.classList.toggle("scrolled", currentY > 12);
  if (!window.matchMedia("(max-width: 650px)").matches) {
    header.classList.remove("scroll-hidden"); lastMobileHeaderY = currentY; return;
  }
  const delta = currentY - lastMobileHeaderY;
  if (currentY <= 48) header.classList.remove("scroll-hidden");
  else if (delta >= 6 && !header.contains(document.activeElement) && !document.querySelector(".msearch-page")) header.classList.add("scroll-hidden");
  else if (delta <= -6) header.classList.remove("scroll-hidden");
  if (Math.abs(delta) >= 6 || currentY <= 48) lastMobileHeaderY = currentY;
}
window.addEventListener("scroll", syncHeaderScroll, { passive: true });
window.addEventListener("click", () => { const providerList = document.querySelector("[data-provider-list]"); if (providerList && !providerList.hidden) providerList.hidden = true; });
function recordPlaybackEvent(data) {
  const duration = Number(data.duration) || 0, currentTime = Number(data.currentTime) || 0;
  if (!duration) return;
  samplePlaybackWatchTime(currentTime);
  if (party.code) { if (party.role === "host") { party.lastHostTime = currentTime; party.hostEvent = String(data.event || ""); } else { party.guestTime = currentTime; } }
  const progress = Math.min(100, currentTime / duration * 100);
  localStorage.setItem(watchKey(state.player), JSON.stringify({currentTime,duration,progress,watched:progress >= 90,genreIds:state.player.genreIds || [],type:state.player.type,id:state.player.id,season:state.player.season || null,episode:state.player.episode || null,title:state.player.title,posterPath:state.player.posterPath || null,lastWatchedAt:new Date().toISOString()}));
  queueProgressSync(state.player, currentTime, duration, progress);
  const pendingPrevious = state.pendingEpisodeCompletion;
  if (pendingPrevious && shouldConfirmPreviousEpisode(pendingPrevious, state.player, savedProgress(pendingPrevious), progress)) { markEpisodeWatched(pendingPrevious); state.pendingEpisodeCompletion = null; }
  else if (pendingPrevious && !isDirectNextEpisode(pendingPrevious, state.player)) state.pendingEpisodeCompletion = null;
  const bar = document.querySelector("#bar"), time = document.querySelector("#time");
  if (bar) bar.style.width = `${progress}%`;
  if (time) time.textContent = `${Math.floor(currentTime)}s of ${Math.floor(duration)}s`;
}
function bindPlayerControlLift() { const frame = document.querySelector(".player-frame"); if (!frame) return; let idleTimer; const show = () => { clearTimeout(idleTimer); frame.classList.add("player-controls-active"); }; const deferHide = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => frame.classList.remove("player-controls-active"), 1800); }; frame.addEventListener("pointerenter", show); frame.addEventListener("pointermove", show); frame.addEventListener("pointerleave", deferHide); frame.addEventListener("focusin", show); frame.addEventListener("focusout", deferHide); }
function markEpisodeWatched(item) { const saved = savedProgress(item), duration = Math.max(1, Number(saved.duration) || 0), record = { ...saved, currentTime:duration, duration, progress:100, watched:true, type:item.type, id:item.id, season:item.season || null, episode:item.episode || null, title:saved.title || item.title || "Untitled", posterPath:saved.posterPath || item.posterPath || null, genreIds:saved.genreIds || item.genreIds || [], lastWatchedAt:new Date().toISOString() }; localStorage.setItem(watchKey(item), JSON.stringify(record)); state.seriesNext = null; queueProgressSync(item, duration, duration, 100, true); }
window.addEventListener("message", async event => {
  let payload;
  try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
  if (state.route !== "player") return;
  const iframe = document.querySelector("iframe.player");
  const provider = selectedPlayerProvider();
  if (window.SEVENPlayerSecurity?.validPlayerResponse(payload)) {
    const security = window.SEVENPlayerSecurity;
    if (iframe?.contentWindow && event.source === iframe.contentWindow && event.origin === security.playerCommandFrame(provider)) handlePlayerResponse(payload);
    return;
  }
  const security = window.SEVENPlayerSecurity, playerEvent = { origin:event.origin, source:event.source, data:payload }, episodeChange = security?.normalizePlayerEpisodeChange(payload), trustedEpisodeChange = security?.isTrustedPlayerEpisodeChange(playerEvent, iframe, provider);
  const normalized = security?.normalizePlayerEvent(payload);
  if (trustedEpisodeChange && episodeChange) {
    if (normalized) { try { await syncNativePlayerEpisode(episodeChange); } catch { /* Progress still syncs if episode metadata lookup fails. */ } }
    else { void syncNativePlayerEpisode(episodeChange).catch(() => {}); return; }
  }
  if (!security?.isTrustedPlayerMessage(playerEvent, iframe, provider)) return;
  if (normalized) recordPlaybackEvent(normalized.data);
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js?v=311", { updateViaCache:"none" }).then(registration => registration.update()).catch(() => { /* The app keeps working from the network when registration fails. */ });
}
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; });
window.addEventListener("resize", () => {
  clearTimeout(coverflowResizeTimer);
  coverflowResizeTimer = setTimeout(() => {
    // Android resizes the viewport when its keyboard opens. The auth dialog is
    // mounted inside #app, so re-rendering home here would destroy the form.
    if (document.querySelector(".modal")) return;
    const viewportWidth = window.innerWidth;
    if (viewportWidth === coverflowViewportWidth) return;
    coverflowViewportWidth = viewportWidth;
    if (state.route === "home") render();
  }, 120);
}, { passive:true });
function keepFavouritesUI() {
  app.querySelectorAll("header nav, .app-mobile-nav").forEach(navigation => {
    if (!navigation.querySelector("[data-favourites]")) navigation.insertAdjacentHTML("beforeend", `<button class="nav-link" data-favourites><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.4a5.5 5.5 0 0 0-.1-7.8Z"/></svg><span>${t("Favourites")}</span></button>`);
    if (!navigation.querySelector("[data-watchlist]")) navigation.insertAdjacentHTML("beforeend", `<button class="nav-link" data-watchlist><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12v17l-6-3.8-6 3.8z"/></svg><span>${t("Watchlist")}</span></button>`);
    const favourites = navigation.querySelector("[data-favourites]"), active = state.route === "my-list";
    favourites?.classList.toggle("active", active);
    if (active) favourites?.setAttribute("aria-current", "page"); else favourites?.removeAttribute("aria-current");
    const watchlist = navigation.querySelector("[data-watchlist]"), watchlistActive = state.route === "watchlist";
    watchlist?.classList.toggle("active", watchlistActive);
    if (watchlistActive) watchlist?.setAttribute("aria-current", "page"); else watchlist?.removeAttribute("aria-current");
  });
  app.querySelectorAll("[data-toggle-my-list]").forEach(button => { const label = button.classList.contains("saved") ? "In Favourites" : "Add to Favourites", text = button.querySelector("span"); if (text) text.textContent = label; else button.textContent = `♡ ${label}`; });
  const favouritePage = app.querySelector(".my-list-page");
  if (favouritePage) {
    favouritePage.querySelector(".brand").textContent = "FAVOURITES";
    favouritePage.querySelector("h1").textContent = `${currentProfile()?.name || "Your"} Favourites`;
    favouritePage.querySelectorAll(".my-list-remove").forEach(button => { button.setAttribute("aria-label", button.getAttribute("aria-label").replace("My List", "Favourites")); });
  }
  app.querySelector(".new-episode-rail .rail-title span")?.replaceChildren("From Favourites");
  const favouriteRow = app.querySelector("[data-my-list]");
  if (favouriteRow) { favouriteRow.querySelector("b").textContent = "Favourites"; favouriteRow.querySelector("small").textContent = `Browse the titles saved by ${currentProfile()?.name || "this profile"}`; }
  const profileActivity = app.querySelector(".profile-detail-card .profile-category-actions");
  if (profileActivity && !profileActivity.querySelector("[data-watchlist]")) profileActivity.insertAdjacentHTML("beforeend", accountAction("▤", "Watchlist", `Saved for ${currentProfile()?.name || "this profile"}`, "data-watchlist"));
}
const favouritesObserver = new MutationObserver(keepFavouritesUI);
favouritesObserver.observe(app, { childList:true });
document.addEventListener("click", event => {
  const topLink = event.target?.closest?.(".footer-top");
  if (!topLink) return;
  event.preventDefault();
  animateScrollToTop();
}, true);
function closeTitleMenus(restoreFocus = false) { document.querySelectorAll("[data-title-more][aria-expanded='true']").forEach(trigger => { trigger.setAttribute("aria-expanded", "false"); const menu = trigger.parentElement?.querySelector(".title-more-menu"); if (menu) menu.hidden = true; if (restoreFocus) trigger.focus(); }); }
document.addEventListener("click", event => {
  const trigger = event.target?.closest?.("[data-title-more]");
  if (trigger) { const menu = trigger.parentElement.querySelector(".title-more-menu"), open = trigger.getAttribute("aria-expanded") !== "true"; closeTitleMenus(); trigger.setAttribute("aria-expanded", String(open)); if (menu) menu.hidden = !open; return; }
  if (event.target?.closest?.(".title-more-menu button")) { closeTitleMenus(); return; }
  if (!event.target?.closest?.(".title-more")) closeTitleMenus();
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && document.querySelector("[data-title-more][aria-expanded='true']")) closeTitleMenus(true); });
app.addEventListener("click", event => {
  const watchlistButton = event.target.closest("[data-watchlist]");
  if (watchlistButton) { event.preventDefault(); openWatchlist(); return; }
  const button = event.target.closest("[data-favourites]");
  if (!button) return;
  event.preventDefault();
  state.myListReturn = state.route;
  state.route = "my-list";
  scrollToTop();
  render();
});
window.addEventListener("online", () => { if (document.querySelector(".offline-screen")) void retryConnection(); refreshSessionIfNeeded(); });
window.addEventListener("focus", refreshSessionIfNeeded);
window.addEventListener("visibilitychange", () => { if (!document.hidden) { tickScreenTime(); refreshSessionIfNeeded(); } });
window.addEventListener("pagehide", () => { void flushWatchTime(); });
setInterval(tickScreenTime, 60000);
renderLaunchIntro();
const markStartupReady = () => { state.startupReady = true; maybeFinishIntro(); };
void boot().then(markStartupReady, error => {
  state.error = error?.message || "Startup failed";
  renderOfflineScreen();
  markStartupReady();
});
