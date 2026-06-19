// ===== CONFIG =====
const XP_PER_CORRECT = 10;
const XP_LESSON_BONUS = 15;
const MAX_HEARTS = 5;
const EXERCISES_PER_LESSON = 7;
const HEART_REFILL_MINUTES = 30;
const PHASE_NAMES = ['Fundamentos','Presente','Pasado','Futuro y Complejo','Conversaci\u00f3n'];

// ===== STATE =====
let state = loadState();
let lesson = null;

function defaultState() {
  return {
    completed:[], xp:0, hearts:5, lastHeartRefill:null, streak:0, lastActive:null, gems:0,
    failedConcepts:[], useSpanish:false, darkMode:true,
    totalCorrect:0, totalWrong:0, wordsLearned:0, perfectLessons:0,
    badges:[],
    dailyQuests:null, lastQuestDate:'',
    dailyActivity:{},
    dueReview:{},
    voiceURI:'', spanishVariant:'es-MX', compactMode:false, compactPos:null
  };
}
function t(en, es) { return state.useSpanish ? (es || en) : en; }
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('es150duo'));
    if (s) return { ...defaultState(), ...s };
  } catch(e) {}
  return defaultState();
}
function saveState() { localStorage.setItem('es150duo', JSON.stringify(state)); }

function now() { return Date.now(); }

// ===== STATE HELPERS =====
function isCompleted(day) { return state.completed.includes(day); }
function isUnlocked(day) {
  if (day === 1) return true;
  const current = CURRICULUM.find(d => d.day === day);
  const prev = CURRICULUM.find(d => d.day === day - 1);
  if (!current) return true;
  if (current.checkpoint) {
    const phaseDays = CURRICULUM.filter(d => d.phase === current.phase && !d.checkpoint);
    return phaseDays.every(d => isCompleted(d.day));
  }
  if (prev && prev.checkpoint) return isCompleted(day - 1);
  if (!prev) return true;
  return isCompleted(day - 1);
}
function getDayData(day) { return CURRICULUM.find(d => d.day === day); }
function getPhase(day) {
  const d = getDayData(day);
  return d ? d.phase : 1;
}

// ===== HEARTS =====
function loseHeart() {
  if (state.hearts > 0) state.hearts--;
  if (state.lastHeartRefill === null) state.lastHeartRefill = now();
  saveState();
}
function refillHearts() {
  if (state.hearts >= MAX_HEARTS) return;
  const elapsed = now() - (state.lastHeartRefill || 0);
  const refillCount = Math.floor(elapsed / (HEART_REFILL_MINUTES * 60000));
  if (refillCount > 0) {
    state.hearts = Math.min(MAX_HEARTS, state.hearts + refillCount);
    if (state.hearts < MAX_HEARTS) state.lastHeartRefill = now();
    else state.lastHeartRefill = null;
    saveState();
  }
}
function addXp(amount) { state.xp += amount; saveState(); }
function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastActive !== today) {
    const yesterday = new Date(now() - 86400000).toDateString();
    if (state.lastActive === yesterday) state.streak++;
    else if (state.lastActive !== today) state.streak = 1;
    state.lastActive = today;
    saveState();
  }
}

function trackCorrect(ex) {
  state.totalCorrect++;
  const word = ex.sourceEs || ex.answer || '';
  if (word) {
    const idx = state.failedConcepts.findIndex(c => c.es === word);
    if (idx !== -1) {
      state.failedConcepts.splice(idx, 1);
      saveState();
    }
    // Remove from spaced repetition due list
    Object.keys(state.dueReview).forEach(day => {
      const dIdx = state.dueReview[day].indexOf(word);
      if (dIdx !== -1) {
        state.dueReview[day].splice(dIdx, 1);
        saveState();
      }
    });
  }
}
function trackWrong(ex) {
  state.totalWrong++;
}
function getAllUnlockedWords() {
  const words = [];
  state.completed.forEach(day => {
    const d = getDayData(day);
    if (d && d.vocab && d.vocab.words) d.vocab.words.forEach(w => { if (!words.some(x => x.es === w.es)) words.push(w); });
  });
  return words;
}

// ===== BADGES =====
const ALL_BADGES = [
  { id:'first_lesson', icon:'🌟', nameEn:'First Steps', nameEs:'Primeros Pasos', descEn:'Complete your first lesson', descEs:'Completa tu primera lección' },
  { id:'streak_3', icon:'🔥', nameEn:'On Fire', nameEs:'En Racha', descEn:'3-day streak', descEs:'Racha de 3 días' },
  { id:'streak_7', icon:'⚡', nameEn:'Unstoppable', nameEs:'Imparable', descEn:'7-day streak', descEs:'Racha de 7 días' },
  { id:'streak_30', icon:'💪', nameEn:'Dedicated', nameEs:'Dedicado', descEn:'30-day streak', descEs:'Racha de 30 días' },
  { id:'lessons_10', icon:'📚', nameEn:'Bookworm', nameEs:'Ratón de Biblioteca', descEn:'Complete 10 lessons', descEs:'Completa 10 lecciones' },
  { id:'lessons_50', icon:'🎓', nameEn:'Scholar', nameEs:'Estudioso', descEn:'Complete 50 lessons', descEs:'Completa 50 lecciones' },
  { id:'words_100', icon:'🗣️', nameEn:'Chatterbox', nameEs:'Hablador', descEn:'Learn 100 words', descEs:'Aprende 100 palabras' },
  { id:'words_500', icon:'📖', nameEn:'Well Read', nameEs:'Culto', descEn:'Learn 500 words', descEs:'Aprende 500 palabras' },
  { id:'perfect_lesson', icon:'💎', nameEn:'Perfect', nameEs:'Perfecto', descEn:'Complete a lesson with no mistakes', descEs:'Completa una lección sin errores' },
  { id:'checkpoint', icon:'🏆', nameEn:'Champion', nameEs:'Campeón', descEn:'Pass a checkpoint', descEs:'Aprueba un checkpoint' },
  { id:'phase_5', icon:'👑', nameEn:'Conqueror', nameEs:'Conquistador', descEn:'Reach Phase 5', descEs:'Llega a la Fase 5' },
  { id:'gems_100', icon:'💎', nameEn:'Gem Collector', nameEs:'Coleccionista', descEn:'Collect 100 gems', descEs:'Colecciona 100 gemas' },
];
function badgeLabel(b) { return t(b.nameEn, b.nameEs); }
function badgeDesc(b) { return t(b.descEn, b.descEs); }
function checkBadges() {
  let earned = false;
  ALL_BADGES.forEach(b => {
    if (state.badges.includes(b.id)) return;
    let earn = false;
    if (b.id === 'first_lesson' && state.completed.length > 0) earn = true;
    if (b.id === 'streak_3' && state.streak >= 3) earn = true;
    if (b.id === 'streak_7' && state.streak >= 7) earn = true;
    if (b.id === 'streak_30' && state.streak >= 30) earn = true;
    if (b.id === 'lessons_10' && state.completed.length >= 10) earn = true;
    if (b.id === 'lessons_50' && state.completed.length >= 50) earn = true;
    if (b.id === 'words_100' && state.totalCorrect >= 100) earn = true;
    if (b.id === 'words_500' && state.totalCorrect >= 500) earn = true;
    if (b.id === 'phase_5') earn = state.completed.some(d => { const dd = getDayData(d); return dd && dd.phase >= 5; });
    if (b.id === 'gems_100' && state.gems >= 100) earn = true;
    if (earn) { state.badges.push(b.id); saveState(); showToast('🏆 ' + badgeLabel(b)); playSFX('badge'); earned = true; }
  });
  if (earned) celebrate(3000);
}

// ===== DAILY QUESTS =====
const ALL_QUESTS = [
  { id:'q_lesson', icon:'📖', nameEn:'Complete 1 lesson', nameEs:'Completa 1 lección', done:() => state.completed.length },
  { id:'q_lessons3', icon:'📚', nameEn:'Complete 3 lessons', nameEs:'Completa 3 lecciones', done:() => state.completed.length },
  { id:'q_correct10', icon:'✅', nameEn:'Get 10 answers right', nameEs:'10 respuestas correctas', done:() => state.totalCorrect },
  { id:'q_correct20', icon:'✅', nameEn:'Get 20 answers right', nameEs:'20 respuestas correctas', done:() => state.totalCorrect },
  { id:'q_xp50', icon:'⭐', nameEn:'Earn 50 XP', nameEs:'Gana 50 XP', done:() => state.xp },
  { id:'q_xp100', icon:'⭐', nameEn:'Earn 100 XP', nameEs:'Gana 100 XP', done:() => state.xp },
  { id:'q_gems5', icon:'💎', nameEn:'Collect 5 gems', nameEs:'Colecciona 5 gemas', done:() => state.gems },
  { id:'q_no_mistakes', icon:'💪', nameEn:'Complete a lesson perfectly', nameEs:'Lección perfecta', done:() => state.perfectLessons || 0 },
];
function questLabel(q) { return t(q.nameEn, q.nameEs); }
function generateDailyQuests() {
  const today = new Date().toDateString();
  if (state.lastQuestDate === today && state.dailyQuests) return;
  const shuffled = shuffle(ALL_QUESTS);
  const picked = shuffled.slice(0, 3);
  state.dailyQuests = picked.map(q => {
    let goal = 1;
    if (q.id === 'q_correct10') goal = 10;
    if (q.id === 'q_correct20') goal = 20;
    if (q.id === 'q_xp50') goal = 50;
    if (q.id === 'q_xp100') goal = 100;
    if (q.id === 'q_gems5') goal = 5;
    return { ...q, goal, progress:0, done:false, startVal: q.done() };
  });
  state.lastQuestDate = today;
  saveState();
}
function updateQuestProgress() {
  if (!state.dailyQuests) return;
  state.dailyQuests.forEach(q => {
    if (q.done) return;
    const current = q.done();
    q.progress = Math.min(q.goal, current - (q.startVal || 0));
    if (q.progress >= q.goal) { q.done = true; showToast('🎯 ' + t('Quest complete! +10 XP','¡Misión completada! +10 XP')); addXp(10); }
  });
  saveState();
}

// ===== SPACED REPETITION =====
function scheduleReview(day, es) {
  if (!state.dueReview[day]) state.dueReview[day] = [];
  if (!state.dueReview[day].includes(es)) state.dueReview[day].push(es);
  saveState();
}
function getDueReviews() {
  const seen = new Set();
  const due = [];
  Object.keys(state.dueReview).forEach(day => {
    if (state.dueReview[day].length === 0) return;
    const words = state.dueReview[day];
    words.forEach(es => {
      if (seen.has(es)) return;
      seen.add(es);
      const dd = getDayData(parseInt(day));
      if (dd) {
        const w = dd.vocab && dd.vocab.words ? dd.vocab.words.find(v => v.es === es) : null;
        if (w) due.push(w);
      }
    });
  });
  return due;
}

// ===== AUDIO =====
let _voiceCache = [];
function initVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) _voiceCache = v;
  window.speechSynthesis.onvoiceschanged = () => { _voiceCache = window.speechSynthesis.getVoices(); };
}
function getSpanishVoices() {
  if (_voiceCache.length === 0 && window.speechSynthesis) _voiceCache = window.speechSynthesis.getVoices();
  const variant = state.spanishVariant || 'es-MX';
  let voices = _voiceCache.filter(v => v.lang && v.lang.startsWith(variant));
  if (voices.length === 0) voices = _voiceCache.filter(v => v.lang && v.lang.startsWith('es'));
  return voices;
}
function getBestVoice() {
  const voices = getSpanishVoices();
  if (voices.length === 0) return null;
  if (state.voiceURI) { const f = voices.find(v => v.voiceURI === state.voiceURI); if (f) return f; }
  const google = voices.find(v => v.name.includes('Google'));
  if (google) return google;
  const nonMs = voices.find(v => !v.name.includes('Microsoft'));
  if (nonMs) return nonMs;
  return voices[0];
}
function speak(text, rate) {
  if (!window.speechSynthesis) return Promise.resolve();
  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.spanishVariant || 'es-MX';
    u.rate = rate || 0.82;
    const voice = getBestVoice();
    if (voice) u.voice = voice;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });
}

// ===== SFX SYSTEM (Duolingo-style Web Audio API) =====
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playNote(freq, duration, opts) {
  const ctx = getAudioCtx(); if (!ctx) return;
  opts = opts || {};
  const t = ctx.currentTime + (opts.delay || 0);
  const v = opts.volume || 0.12;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.value = freq;
  if (opts.detune) osc.detune.value = opts.detune;
  const a = opts.attack || 0.005;
  const r = opts.release || 0.08;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(v, t + a);
  gain.gain.setValueAtTime(v, t + duration - r);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}
const SFX = {
  correct: () => {
    playNote(523.25, 0.12, { volume: 0.14, attack: 0.003 });
    playNote(659.25, 0.2, { delay: 0.08, volume: 0.14, attack: 0.003 });
    playNote(1046.5, 0.15, { delay: 0.1, volume: 0.04, type: 'sine' });
  },
  incorrect: () => {
    playNote(150, 0.18, { volume: 0.16, type: 'sawtooth', attack: 0.002, release: 0.05 });
    playNote(110, 0.22, { delay: 0.05, volume: 0.1, type: 'square', attack: 0.002, release: 0.05 });
  },
  click: () => playNote(1200, 0.04, { volume: 0.05, attack: 0.001, release: 0.02 }),
  levelUp: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      playNote(f, 0.25, { delay: i * 0.08, volume: 0.1, type: 'triangle', attack: 0.005 });
    });
    playNote(1567.98, 0.35, { delay: 0.4, volume: 0.05, type: 'sine' });
  },
  streak: () => {
    [659.25, 880, 1046.5, 1318.51].forEach((f, i) => {
      playNote(f, 0.18, { delay: i * 0.06, volume: 0.09, type: 'sine', attack: 0.003 });
    });
  },
  heartLoss: () => {
    playNote(349.23, 0.15, { volume: 0.12, type: 'triangle' });
    playNote(261.63, 0.25, { delay: 0.1, volume: 0.12, type: 'triangle' });
  },
  gem: () => {
    playNote(1046.5, 0.1, { volume: 0.08, type: 'sine', attack: 0.002 });
    playNote(1318.51, 0.15, { delay: 0.05, volume: 0.08, type: 'sine', attack: 0.002 });
  },
  matchCorrect: () => {
    playNote(783.99, 0.1, { volume: 0.09, type: 'sine', attack: 0.002 });
    playNote(987.77, 0.12, { delay: 0.04, volume: 0.09, type: 'sine', attack: 0.002 });
  },
  matchWrong: () => playNote(200, 0.12, { volume: 0.1, type: 'square', attack: 0.002, release: 0.03 }),
  checkpoint: () => {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      playNote(f, 0.35, { delay: i * 0.12, volume: 0.1, type: 'triangle', attack: 0.01 });
    });
  },
  badge: () => {
    [783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => {
      playNote(f, 0.22, { delay: i * 0.08, volume: 0.09, type: 'sine', attack: 0.005 });
    });
  },
  xpGain: () => playNote(659.25, 0.08, { volume: 0.07, type: 'sine', attack: 0.002 }),
};
function playSFX(name) { if (SFX[name]) SFX[name](); }

// ===== CELEBRATION SYSTEM (Confetti) =====
function celebrate(duration) {
  duration = duration || 2000;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:${state.compactMode?'absolute':'fixed'};inset:0;width:100%;height:100%;pointer-events:none;z-index:9999`;
  canvas.width = state.compactMode ? (document.getElementById('root')?.clientWidth || 420) : window.innerWidth;
  canvas.height = state.compactMode ? (document.getElementById('root')?.clientHeight || 700) : window.innerHeight;
  olParent().appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#58cc02','#1cb0f6','#ff9600','#ff4b4b','#ce82ff','#ff9600','#fff'];
  const particles = [];
  const count = 120;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 6 - 3,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      rv: Math.random() * 10 - 5,
      opacity: 1
    });
  }
  const start = performance.now();
  function draw(now) {
    const elapsed = now - start;
    if (elapsed > duration) { canvas.remove(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += 0.1;
      p.y += p.vy;
      p.rot += p.rv;
      if (elapsed > duration * 0.7) p.opacity = Math.max(0, 1 - (elapsed - duration * 0.7) / (duration * 0.3));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ===== HELPERS =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function normalize(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getVocabWords(dayData) {
  return dayData.vocab && dayData.vocab.words ? dayData.vocab.words : [];
}
function getExerciseItems(dayData) {
  const items = [];
  if (dayData.exercises) dayData.exercises.forEach(ex => { if (ex.items) ex.items.forEach(item => items.push(item)); });
  return items;
}
function getAllPhaseVocab(phase) {
  const words = [];
  CURRICULUM.filter(d => d.phase === phase && d.vocab).forEach(d => {
    if (d.vocab.words) d.vocab.words.forEach(w => { if (!words.some(x => x.es === w.es)) words.push(w); });
  });
  return words;
}

// ===== WORD BANK (Chip-based answering) =====
function generateWordBank(ex) {
  const answer = ex.answer || '';
  const answerWords = answer.split(/\s+/).filter(w => w.length > 0);
  const pool = new Set();
  answerWords.forEach(w => pool.add(w));
  const allWords = getAllUnlockedWords();
  const extras = shuffle(allWords.filter(w => !answerWords.includes(w.es) && !answer.includes(w.es))).slice(0, 4);
  extras.forEach(w => pool.add(w.es));
  if (pool.size < answerWords.length + 2) {
    const fallbacks = ['el','la','un','una','y','en','de','no','es','son','por','para','con','mi','tu','su','yo','tú','él','ella','nosotros','ellos','bien','muy','pero','más','que','como','este','esta','hay','tengo','soy','eres','está','estoy','con','sin','a','al','del','lo','las','los','se','me','te','le','nos','les','casa','libro','amigo','agua','tiempo','persona','gracias','hola','adiós','sí','no','nunca','siempre','también','bien','mal','grande','pequeño','nuevo','bueno','malo','mismo','otro','cada','mucho','poco','todo','solo','primero','último','largo','corto','feliz','triste','fácil','difícil','rápido','lento','cerca','lejos','arriba','abajo','dentro','fuera','antes','después','hoy','mañana','ayer','noche','día','semana','mes','año','hora','minuto','siempre','nunca','ya','todavía','ahora','luego','pronto','tarde','temprano','solo','también','además','aquí','allí','ahí','dónde','cómo','qué','quién','cuándo','cuánto','por qué','porque','pero','sin embargo','aunque','entonces','así','también','tampoco','si','no','quizás','tal vez','ojalá'];
    while (pool.size < answerWords.length + 2 && fallbacks.length > 0) {
      const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      if (!answerWords.includes(fb)) pool.add(fb);
    }
  }
  return shuffle([...pool]);
}
function renderWordBank(ex) {
  const bank = generateWordBank(ex);
  if (!bank || bank.length < 2) return '';
  return `<div class="word-bank" id="wordBank">${bank.map(w => 
    `<button class="word-bank-chip" data-word="${w.replace(/"/g, '&quot;')}">${w}</button>`
  ).join('')}</div>`;
}

// ===== CONCEPT INFO BUILDER =====
function getConceptInfo(es, en) {
  const isVerb = /(?:ar|er|ir)$/i.test(es) && es.length > 1 && /^to\b/i.test(en);
  const endsO = /o$/.test(es);
  const endsA = /a$/.test(es);
  const isAdjEnding = /able$/.test(es) || /ible$/.test(es) || /[ae]s$/.test(es);
  const hasMulti = es.includes(' ');

  const tc = (e, s) => t(e, s);

  let info = { word: es, translation: en, type: 'vocabulary', typeLabel: tc('Vocabulary','Vocabulario'), gender: null, notes: '', examples: [], bilingualExamples: [], conjugations: [], conjugationDetails: [], verbType: null, relatedForms: [] };
  const normEs = normalize(es);
  const pluralizeNoun = word => /z$/i.test(word) ? `${word.slice(0, -1)}ces` : (/[aeiouáéíóú]$/i.test(word) ? `${word}s` : `${word}es`);
  const setNounInfo = isFeminine => {
    const article = isFeminine ? 'La' : 'El';
    const pluralArticle = isFeminine ? 'Las' : 'Los';
    const plural = pluralizeNoun(es);
    const adjective = isFeminine ? 'bonita' : 'bonito';
    const pluralAdjective = isFeminine ? 'nuevas' : 'nuevos';
    info.type = 'sustantivo';
    info.gender = isFeminine ? tc('Feminine','femenino') : tc('Masculine','masculino');
    info.typeLabel = tc(isFeminine ? 'Noun (feminine)' : 'Noun (masculine)', isFeminine ? 'Sustantivo (femenino)' : 'Sustantivo (masculino)');
    info.notes = tc(
      `${isFeminine ? 'Feminine' : 'Masculine'} noun. The article is "${isFeminine ? 'la' : 'el'}" in singular, "${isFeminine ? 'las' : 'los'}" in plural.`,
      `Sustantivo ${isFeminine ? 'femenino' : 'masculino'}. El artículo es "${isFeminine ? 'la' : 'el'}" en singular, "${isFeminine ? 'las' : 'los'}" en plural.`
    );
    info.relatedForms = [es, plural];
    info.examples = [`${article} ${es} es ${adjective}.`, `${pluralArticle} ${plural} son ${pluralAdjective}.`];
    info.bilingualExamples = [
      {es:`${article} ${es} es ${adjective}.`, en:`The ${en} is nice.`},
      {es:`${pluralArticle} ${plural} son ${pluralAdjective}.`, en:`The ${en}s are new.`}
    ];
    return info;
  };

  const functionWords = {
    el: {
      type: tc('Definite article','Artículo definido'),
      notes: tc('Masculine singular article ("the"). The feminine form is "la".', 'Artículo masculino singular ("el"). La forma femenina es "la".'),
      examples: [{es:'El libro es interesante.', en:'The book is interesting.'}, {es:'Veo el perro.', en:'I see the dog.'}, {es:'La casa es grande.', en:'The house is big.'}]
    },
    la: {
      type: tc('Definite article','Artículo definido'),
      notes: tc('Feminine singular article ("the"). The masculine form is "el".', 'Artículo femenino singular ("la"). La forma masculina es "el".'),
      examples: [{es:'La casa es grande.', en:'The house is big.'}, {es:'Veo la mesa.', en:'I see the table.'}, {es:'El libro es interesante.', en:'The book is interesting.'}]
    },
    los: {
      type: tc('Definite article','Artículo definido'),
      notes: tc('Masculine plural article ("the"). The feminine plural is "las".', 'Artículo masculino plural ("los"). La forma femenina plural es "las".'),
      examples: [{es:'Los libros son nuevos.', en:'The books are new.'}, {es:'Veo los perros.', en:'I see the dogs.'}, {es:'Las casas son grandes.', en:'The houses are big.'}]
    },
    las: {
      type: tc('Definite article','Artículo definido'),
      notes: tc('Feminine plural article ("the"). The masculine plural is "los".', 'Artículo femenino plural ("las"). La forma masculina plural es "los".'),
      examples: [{es:'Las casas son grandes.', en:'The houses are big.'}, {es:'Veo las mesas.', en:'I see the tables.'}, {es:'Los libros son nuevos.', en:'The books are new.'}]
    },
    un: {
      type: tc('Indefinite article','Artículo indefinido'),
      notes: tc('Masculine singular article ("a/an"). The feminine form is "una".', 'Artículo masculino singular ("un"). La forma femenina es "una".'),
      examples: [{es:'Tengo un libro.', en:'I have a book.'}, {es:'Veo un perro.', en:'I see a dog.'}, {es:'Tengo una casa.', en:'I have a house.'}]
    },
    una: {
      type: tc('Indefinite article','Artículo indefinido'),
      notes: tc('Feminine singular article ("a/an"). The masculine form is "un".', 'Artículo femenino singular ("una"). La forma masculina es "un".'),
      examples: [{es:'Tengo una casa.', en:'I have a house.'}, {es:'Veo una mesa.', en:'I see a table.'}, {es:'Tengo un libro.', en:'I have a book.'}]
    },
    unos: {
      type: tc('Indefinite article','Artículo indefinido'),
      notes: tc('Masculine plural article ("some"). The feminine plural form is "unas".', 'Artículo masculino plural ("unos"). La forma femenina plural es "unas".'),
      examples: [{es:'Tengo unos libros.', en:'I have some books.'}, {es:'Unos amigos vienen hoy.', en:'Some friends are coming today.'}, {es:'Tengo unas flores.', en:'I have some flowers.'}]
    },
    unas: {
      type: tc('Indefinite article','Artículo indefinido'),
      notes: tc('Feminine plural article ("some"). The masculine plural form is "unos".', 'Artículo femenino plural ("unas"). La forma masculina plural es "unos".'),
      examples: [{es:'Tengo unas flores.', en:'I have some flowers.'}, {es:'Unas amigas vienen hoy.', en:'Some friends are coming today.'}, {es:'Tengo unos libros.', en:'I have some books.'}]
    },
    de: {
      type: tc('Preposition','Preposición'),
      notes: tc('Means "of" or "from". It often shows possession, origin, or material.', 'Significa "de". Suele indicar posesión, origen o material.'),
      examples: [{es:'Soy de México.', en:'I am from Mexico.'}, {es:'El libro de Ana es nuevo.', en:"Ana's book is new."}]
    },
    del: {
      type: tc('Contraction','Contracción'),
      notes: tc('Contraction of "de + el" meaning "of the" or "from the" before a masculine singular noun.', 'Contracción de "de + el" antes de un sustantivo masculino singular.'),
      examples: [{es:'Vengo del parque.', en:'I come from the park.'}, {es:'El libro del profesor es interesante.', en:"The teacher's book is interesting."}]
    },
    mi: {
      type: tc('Possessive adjective','Adjetivo posesivo'),
      notes: tc('Means "my" and goes before a singular noun.', 'Significa "mi" y va antes de un sustantivo singular.'),
      examples: [{es:'Mi casa es pequeña.', en:'My house is small.'}, {es:'Mi amigo estudia español.', en:'My friend studies Spanish.'}]
    },
    tu: {
      type: tc('Possessive adjective','Adjetivo posesivo'),
      notes: tc('Means "your" for one familiar person and goes before a singular noun.', 'Significa "tu" para una persona cercana y va antes de un sustantivo singular.'),
      examples: [{es:'Tu libro está aquí.', en:'Your book is here.'}, {es:'Tu casa es grande.', en:'Your house is big.'}]
    },
    su: {
      type: tc('Possessive adjective','Adjetivo posesivo'),
      notes: tc('Can mean "his", "her", "their", or formal "your". Context tells you which one.', 'Puede significar "su" de él, ella, usted, ellos o ellas. El contexto indica cuál.'),
      examples: [{es:'Su coche es rojo.', en:'His/Her car is red.'}, {es:'Su familia vive aquí.', en:'Their family lives here.'}]
    },
    nuestro: {
      type: tc('Possessive adjective','Adjetivo posesivo'),
      notes: tc('Means "our" and changes to match the noun: nuestro, nuestra, nuestros, nuestras.', 'Significa "nuestro" y cambia para concordar con el sustantivo: nuestro, nuestra, nuestros, nuestras.'),
      examples: [{es:'Nuestro libro está aquí.', en:'Our book is here.'}, {es:'Nuestra casa es grande.', en:'Our house is big.'}]
    },
    vuestro: {
      type: tc('Possessive adjective','Adjetivo posesivo'),
      notes: tc('Means plural familiar "your" in Spain and changes to match the noun.', 'Significa "vuestro" en España y cambia para concordar con el sustantivo.'),
      examples: [{es:'Vuestro libro está aquí.', en:'Your book is here.'}, {es:'Vuestra casa es grande.', en:'Your house is big.'}]
    },
    mio: {
      type: tc('Possessive pronoun','Pronombre posesivo'),
      notes: tc('Means "mine". It changes form to match the thing owned.', 'Significa "mío". Cambia de forma según la cosa poseída.'),
      examples: [{es:'Este libro es mío.', en:'This book is mine.'}, {es:'La mochila es mía.', en:'The backpack is mine.'}]
    },
    tuyo: {
      type: tc('Possessive pronoun','Pronombre posesivo'),
      notes: tc('Means "yours" for one familiar person. It changes form to match the thing owned.', 'Significa "tuyo" para una persona cercana. Cambia según la cosa poseída.'),
      examples: [{es:'Este lápiz es tuyo.', en:'This pencil is yours.'}, {es:'La casa es tuya.', en:'The house is yours.'}]
    },
    suyo: {
      type: tc('Possessive pronoun','Pronombre posesivo'),
      notes: tc('Can mean "his", "hers", "theirs", or formal "yours". Context tells you which one.', 'Puede significar "suyo" de él, ella, usted, ellos o ellas. El contexto indica cuál.'),
      examples: [{es:'El coche es suyo.', en:'The car is his/hers/theirs.'}, {es:'La idea es suya.', en:'The idea is his/hers/theirs.'}]
    },
    no: {
      type: tc('Negation','Negación'),
      notes: tc('Place "no" before the verb to make a sentence negative.', 'Pon "no" antes del verbo para negar una oración.'),
      examples: [{es:'No hablo francés.', en:'I do not speak French.'}, {es:'No tengo hambre.', en:'I am not hungry.'}]
    },
    nunca: {
      type: tc('Negative adverb','Adverbio negativo'),
      notes: tc('Means "never". Spanish commonly uses double negatives.', 'Significa "nunca". En español es común usar doble negación.'),
      examples: [{es:'Nunca como carne.', en:'I never eat meat.'}, {es:'No estudio nunca los domingos.', en:'I never study on Sundays.'}]
    },
    jamas: {
      type: tc('Negative adverb','Adverbio negativo'),
      notes: tc('Means "never" or "ever" in negative contexts.', 'Significa "jamás" o "nunca" en contextos negativos.'),
      examples: [{es:'Jamás digo mentiras.', en:'I never tell lies.'}, {es:'No lo haré jamás.', en:'I will never do it.'}]
    },
    nada: {
      type: tc('Negative pronoun','Pronombre negativo'),
      notes: tc('Means "nothing" or "anything" in negative sentences.', 'Significa "nada" o "algo" en oraciones negativas.'),
      examples: [{es:'No veo nada.', en:'I do not see anything.'}, {es:'Nada es imposible.', en:'Nothing is impossible.'}]
    },
    nadie: {
      type: tc('Negative pronoun','Pronombre negativo'),
      notes: tc('Means "nobody" or "anybody" in negative sentences.', 'Significa "nadie" o "alguien" en oraciones negativas.'),
      examples: [{es:'No hay nadie aquí.', en:'There is nobody here.'}, {es:'Nadie viene hoy.', en:'Nobody is coming today.'}]
    },
    ninguno: {
      type: tc('Negative adjective or pronoun','Adjetivo o pronombre negativo'),
      notes: tc('Means "none" or "not any". Before a masculine singular noun, it becomes "ningún".', 'Significa "ninguno" o "ningún". Antes de un sustantivo masculino singular se acorta a "ningún".'),
      examples: [{es:'No tengo ningún libro.', en:'I do not have any book.'}, {es:'Ninguno es correcto.', en:'None of them is correct.'}]
    },
    algo: {
      type: tc('Indefinite pronoun','Pronombre indefinido'),
      notes: tc('Means "something" or "anything".', 'Significa "algo".'),
      examples: [{es:'Quiero algo de comer.', en:'I want something to eat.'}, {es:'¿Ves algo?', en:'Do you see anything?'}]
    },
    alguien: {
      type: tc('Indefinite pronoun','Pronombre indefinido'),
      notes: tc('Means "someone" or "somebody".', 'Significa "alguien".'),
      examples: [{es:'Alguien llama a la puerta.', en:'Someone is knocking at the door.'}, {es:'Necesito hablar con alguien.', en:'I need to talk with someone.'}]
    },
    tampoco: {
      type: tc('Negative adverb','Adverbio negativo'),
      notes: tc('Means "neither" or "not either".', 'Significa "tampoco".'),
      examples: [{es:'Yo tampoco hablo francés.', en:'I do not speak French either.'}, {es:'Ella tampoco viene.', en:'She is not coming either.'}]
    },
    siempre: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "always".', 'Significa "siempre".'),
      examples: [{es:'Siempre estudio por la noche.', en:'I always study at night.'}, {es:'Ella siempre llega temprano.', en:'She always arrives early.'}]
    },
    tambien: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "also" or "too".', 'Significa "también".'),
      examples: [{es:'Yo también estudio español.', en:'I also study Spanish.'}, {es:'Ella también viene.', en:'She is coming too.'}]
    },
    en: {
      type: tc('Preposition','Preposición'),
      notes: tc('Means "in", "on", or "at" depending on context.', 'Significa "en", "sobre" o "a" según el contexto.'),
      examples: [{es:'Estoy en casa.', en:'I am at home.'}, {es:'El libro está en la mesa.', en:'The book is on the table.'}]
    },
    hola: {
      type: tc('Greeting','Saludo'),
      notes: tc('Means "hello" or "hi". Can be used any time of day.', 'Significa "hola". Se puede usar a cualquier hora del día.'),
      examples: [{es:'¡Hola! ¿Cómo estás?', en:'Hello! How are you?'}, {es:'Hola, ¿qué tal?', en:'Hi, how is it going?'}]
    },
    adios: {
      type: tc('Farewell','Despedida'),
      notes: tc('Means "goodbye".', 'Significa "adiós".'),
      examples: [{es:'¡Adiós! Hasta luego.', en:'Goodbye! See you later.'}, {es:'Adiós, nos vemos mañana.', en:'Goodbye, see you tomorrow.'}]
    },
    gracias: {
      type: tc('Expression','Expresión'),
      notes: tc('Means "thank you".', 'Significa "gracias".'),
      examples: [{es:'Muchas gracias.', en:'Thank you very much.'}, {es:'Gracias por tu ayuda.', en:'Thanks for your help.'}]
    },
    "por favor": {
      type: tc('Expression','Expresión'),
      notes: tc('Means "please". Used in requests.', 'Significa "por favor". Se usa en peticiones.'),
      examples: [{es:'Un café, por favor.', en:'A coffee, please.'}, {es:'Ayúdame, por favor.', en:'Help me, please.'}]
    },
    "de nada": {
      type: tc('Expression','Expresión'),
      notes: tc('Means "you\'re welcome". Response to gracias.', 'Significa "de nada". Respuesta a gracias.'),
      examples: [{es:'—Gracias. —De nada.', en:'—Thanks. —You\'re welcome.'}, {es:'De nada, cuando quieras.', en:'You\'re welcome, anytime.'}]
    },
    "lo siento": {
      type: tc('Expression','Expresión'),
      notes: tc('Means "I\'m sorry".', 'Significa "lo siento".'),
      examples: [{es:'Lo siento mucho.', en:'I am very sorry.'}, {es:'Lo siento, no entiendo.', en:'I\'m sorry, I don\'t understand.'}]
    },
    aqui: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "here". Indicates location.', 'Significa "aquí". Indica ubicación.'),
      examples: [{es:'Estoy aquí.', en:'I am here.'}, {es:'Ven aquí, por favor.', en:'Come here, please.'}]
    },
    alli: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "there".', 'Significa "allí".'),
      examples: [{es:'El libro está allí.', en:'The book is there.'}, {es:'Vivo allí.', en:'I live there.'}]
    },
    donde: {
      type: tc('Question word','Palabra interrogativa'),
      notes: tc('Means "where".', 'Significa "dónde".'),
      examples: [{es:'¿Dónde vives?', en:'Where do you live?'}, {es:'¿Dónde está el baño?', en:'Where is the bathroom?'}]
    },
    como: {
      type: tc('Question word','Palabra interrogativa'),
      notes: tc('Means "how" or "like/as".', 'Significa "cómo" o "como".'),
      examples: [{es:'¿Cómo estás?', en:'How are you?'}, {es:'Como tú quieras.', en:'As you wish.'}]
    },
    que: {
      type: tc('Question word','Palabra interrogativa'),
      notes: tc('Means "what" or "that".', 'Significa "qué" o "que".'),
      examples: [{es:'¿Qué quieres?', en:'What do you want?'}, {es:'El libro que leo es bueno.', en:'The book that I read is good.'}]
    },
    quien: {
      type: tc('Question word','Palabra interrogativa'),
      notes: tc('Means "who". Plural is "quiénes".', 'Significa "quién". El plural es "quiénes".'),
      examples: [{es:'¿Quién es ella?', en:'Who is she?'}, {es:'¿Quiénes son ellos?', en:'Who are they?'}]
    },
    mucho: {
      type: tc('Adverb/Adjective','Adverbio/Adjetivo'),
      notes: tc('Means "a lot" or "much/many".', 'Significa "mucho" o "muchos".'),
      examples: [{es:'Muchas gracias.', en:'Thank you very much.'}, {es:'Tengo mucho trabajo.', en:'I have a lot of work.'}]
    },
    poco: {
      type: tc('Adverb/Adjective','Adverbio/Adjetivo'),
      notes: tc('Means "a little" or "few".', 'Significa "poco" o "pocos".'),
      examples: [{es:'Hablo un poco de español.', en:'I speak a little Spanish.'}, {es:'Tengo poco tiempo.', en:'I have little time.'}]
    },
    hoy: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "today".', 'Significa "hoy".'),
      examples: [{es:'Hoy estudio español.', en:'Today I study Spanish.'}, {es:'¿Qué haces hoy?', en:'What are you doing today?'}]
    },
    manana: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "tomorrow".', 'Significa "mañana".'),
      examples: [{es:'Mañana voy a viajar.', en:'Tomorrow I am going to travel.'}, {es:'Hasta mañana.', en:'See you tomorrow.'}]
    },
    muy: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "very". Used before adjectives and adverbs.', 'Significa "muy". Se usa antes de adjetivos y adverbios.'),
      examples: [{es:'Muy bien, gracias.', en:'Very well, thanks.'}, {es:'Ella es muy inteligente.', en:'She is very intelligent.'}]
    },
    bien: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "well" or "fine".', 'Significa "bien".'),
      examples: [{es:'Estoy bien.', en:'I am fine.'}, {es:'Hablas bien español.', en:'You speak Spanish well.'}]
    },
    mal: {
      type: tc('Adverb/Adjective','Adverbio/Adjetivo'),
      notes: tc('Means "badly" or "bad".', 'Significa "mal" o "malo".'),
      examples: [{es:'Me siento mal.', en:'I feel bad.'}, {es:'Eso está mal.', en:'That is wrong.'}]
    },
    si: {
      type: tc('Adverb','Adverbio'),
      notes: tc('Means "yes".', 'Significa "sí".'),
      examples: [{es:'Sí, quiero.', en:'Yes, I want to.'}, {es:'—¿Hablas español? —Sí.', en:'—Do you speak Spanish? —Yes.'}]
    },
    senor: {
      type: tc('Noun','Sustantivo'),
      notes: tc('Means "sir", "Mr.", or "gentleman". The feminine form is "señora".', 'Significa "señor". La forma femenina es "señora".'),
      examples: [{es:'Buenos días, señor.', en:'Good morning, sir.'}, {es:'El señor García es profesor.', en:'Mr. García is a teacher.'}, {es:'La señora López es médica.', en:'Mrs. López is a doctor.'}]
    },
    senora: {
      type: tc('Noun','Sustantivo'),
      notes: tc('Means "ma\'am", "Mrs.", or "lady". The masculine form is "señor".', 'Significa "señora". La forma masculina es "señor".'),
      examples: [{es:'Buenas tardes, señora.', en:'Good afternoon, ma\'am.'}, {es:'La señora López es médica.', en:'Mrs. López is a doctor.'}, {es:'El señor García es profesor.', en:'Mr. García is a teacher.'}]
    }
  };

  const fixedConcept = functionWords[normEs];
  if (fixedConcept) {
    info.type = fixedConcept.type;
    info.typeLabel = fixedConcept.type;
    info.notes = fixedConcept.notes;
    info.examples = fixedConcept.examples.map(e => `${e.es} (${e.en})`);
    info.bilingualExamples = fixedConcept.examples;
    return info;
  }

  if (hasMulti) {
    info.type = 'expresi\u00f3n';
    info.typeLabel = tc('Expression','Expresi\u00f3n');
    info.notes = tc(
      `This is a complete expression used as a single unit.`,
      `Esta es una expresión completa usada como una sola unidad.`
    );
    info.bilingualExamples = [{es, en}];
    info.examples = [`${es} — ${en}`];
    if (/^tener\s/i.test(es)) {
      info.type = 'expresi\u00f3n idiom\u00e1tica';
      info.typeLabel = tc('Idiomatic Expression','Expresi\u00f3n idiom\u00e1tica');
      info.notes = tc(
        `Uses "tener + noun" to express sensations and states. In English you use "to be", but in Spanish you use "tener".`,
        `Se usa "tener + sustantivo" para expresar sensaciones y estados. En inglés se usa "to be", pero en español se usa "tener".`
      );
      info.examples = [
        'Tengo hambre. (I am hungry)',
        'Tienes sed. (You are thirsty)',
        'Ella tiene fr\u00edo. (She is cold)',
        'Nosotros tenemos sue\u00f1o. (We are sleepy)',
        'Ellos tienen miedo. (They are afraid)'
      ];
      info.bilingualExamples = [
        {es:'Tengo hambre.', en:'I am hungry.'},
        {es:'Tienes sed.', en:'You are thirsty.'},
        {es:'Ella tiene fr\u00edo.', en:'She is cold.'},
        {es:'Nosotros tenemos sue\u00f1o.', en:'We are sleepy.'},
        {es:'Ellos tienen miedo.', en:'They are afraid.'}
      ];
      info.relatedForms = ['tener hambre', 'tener sed', 'tener fr\u00edo', 'tener calor', 'tener sue\u00f1o', 'tener miedo', 'tener prisa', 'tener raz\u00f3n'];
    }
    return info;
  }

  const irregularVerbExamples = {
    'ser': [{es:'Yo soy estudiante.', en:'I am a student.'}, {es:'Ella es médica.', en:'She is a doctor.'}, {es:'Nosotros somos amigos.', en:'We are friends.'}],
    'estar': [{es:'Yo estoy en casa.', en:'I am at home.'}, {es:'Ella está cansada.', en:'She is tired.'}],
    'tener': [{es:'Yo tengo un libro.', en:'I have a book.'}, {es:'Ella tiene hambre.', en:'She is hungry.'}],
    'ir': [{es:'Yo voy a la escuela.', en:'I go to school.'}, {es:'Ella va al parque.', en:'She goes to the park.'}],
    'hacer': [{es:'Yo hago la tarea.', en:'I do homework.'}, {es:'Ella hace ejercicio.', en:'She does exercise.'}],
    'poner': [{es:'Yo pongo la mesa.', en:'I set the table.'}, {es:'Ella pone música.', en:'She puts on music.'}],
    'salir': [{es:'Yo salgo temprano.', en:'I leave early.'}, {es:'Ella sale con amigos.', en:'She goes out with friends.'}],
    'venir': [{es:'Yo vengo mañana.', en:'I come tomorrow.'}, {es:'Ella viene hoy.', en:'She comes today.'}],
    'decir': [{es:'Yo digo la verdad.', en:'I tell the truth.'}, {es:'Ella dice hola.', en:'She says hello.'}],
    'poder': [{es:'Yo puedo nadar.', en:'I can swim.'}, {es:'Ella puede cantar.', en:'She can sing.'}],
    'querer': [{es:'Yo quiero agua.', en:'I want water.'}, {es:'Ella quiere estudiar.', en:'She wants to study.'}],
    'saber': [{es:'Yo sé la respuesta.', en:'I know the answer.'}, {es:'Ella sabe español.', en:'She knows Spanish.'}],
    'dar': [{es:'Yo doy un regalo.', en:'I give a gift.'}, {es:'Ella da clases.', en:'She gives classes.'}],
    'ver': [{es:'Yo veo la tele.', en:'I watch TV.'}, {es:'Ella ve una película.', en:'She watches a movie.'}],
    'oír': [{es:'Yo oigo música.', en:'I hear music.'}, {es:'Ella oye el ruido.', en:'She hears the noise.'}],
    'traer': [{es:'Yo traigo café.', en:'I bring coffee.'}, {es:'Ella trae noticias.', en:'She brings news.'}],
    'caer': [{es:'Yo caigo bien.', en:'I am likable.'}, {es:'Ella cae mal.', en:'She is unlikable.'}],
    'haber': [{es:'Hay mucho ruido.', en:'There is a lot of noise.'}, {es:'Hay dos gatos.', en:'There are two cats.'}]
  };

  if (isVerb) {
    const conjType = es.match(/(ar|er|ir)$/)[1];
    const stem = es.slice(0, -2);
    const isIrregular = /^(?:ser|estar|tener|ir|hacer|poner|salir|venir|decir|poder|querer|saber|dar|ver|oír|traer|caer|haber)/i.test(es);
    info.type = 'verbo';
    info.typeLabel = tc('Verb','Verbo');
    info.verbType = `-${conjType}`;
    info.notes = isIrregular
      ? tc('Irregular verb. Does not follow the regular conjugation pattern.', 'Verbo irregular. No sigue el patrón regular de conjugación.')
      : tc(`Regular -${conjType} verb. Follows the standard conjugation pattern.`, `Verbo regular -${conjType}. Sigue el patrón estándar de conjugación.`);

    const enStem = en.replace(/^to\s+/i, '');
    if (!isIrregular) {
      const endings = conjType === 'ar' ? ['o','as','a','amos','an'] : conjType === 'er' ? ['o','es','e','emos','en'] : ['o','es','e','imos','en'];
      const subjects = ['yo','t\u00fa','\u00e9l/ella','nosotros','ellos'];
      const subjectEn = ['I','You','He/She','We','They'];

      info.conjugations = subjects.map((s, i) => `${s} ${stem}${endings[i]}`);
      info.conjugationDetails = subjects.map((s, i) => {
        const form = `${stem}${endings[i]}`;
        const verbEn = i === 2 ? `${enStem}s` : enStem;
        return {
          form,
          subject: s,
          translation: `${subjectEn[i]} ${verbEn}`,
          examples: [
            {es:`${s === '\u00e9l/ella' ? 'Ella' : s.charAt(0).toUpperCase() + s.slice(1)} ${form} todos los d\u00edas.`, en:`${subjectEn[i]} ${verbEn} every day.`},
            {es:`${s === '\u00e9l/ella' ? '\u00c9l' : s.charAt(0).toUpperCase() + s.slice(1)} ${form} ahora.`, en:`${subjectEn[i]} ${verbEn} now.`}
          ]
        };
      });
      info.bilingualExamples = info.conjugationDetails.flatMap(d => d.examples).slice(0, 4);
      info.examples = info.conjugationDetails.map(d => `${d.subject} ${d.form}`);
    } else {
      const ive = irregularVerbExamples[normalize(es)];
      if (ive) {
        info.bilingualExamples = ive;
        info.examples = ive.map(ex => `${ex.es} (${ex.en})`);
      } else {
        info.examples = [`${es} — ${en}`];
        info.bilingualExamples = [{es, en}];
      }
    }
    return info;
  }

  // Gender-specific word (noun or adjective ending in -o/-a)
  if (endsO || endsA) {
    const feminineExceptions = new Set(['mano']);
    const masculineExceptions = new Set(['dia','mapa','problema','idioma','tema','programa','sistema','clima','planeta','sofa']);
    const isFeminine = feminineExceptions.has(normEs) || (endsA && !masculineExceptions.has(normEs));
    const root = es.slice(0, -1);
    const masc = endsO ? es : root + 'o';
    const fem = endsA ? es : root + 'a';
    const mascPl = masc + 's';
    const femPl = fem + 's';
    info.gender = isFeminine ? tc('Feminine','femenino') : tc('Masculine','masculino');

    // Only -able/-ible endings are definitely adjectives; -o/-a could be noun or adjective
    if (isAdjEnding) {
      info.type = 'adjetivo';
      info.typeLabel = tc('Adjective','Adjetivo');
      info.notes = tc(`Adjective: agrees in gender and number with the noun.`,`Adjetivo: concuerda en género y número con el sustantivo.`);
      info.relatedForms = [masc, fem, mascPl, femPl];
      info.examples = [`El ni\u00f1o es ${masc}.`, `La ni\u00f1a es ${fem}.`, `Los ni\u00f1os son ${mascPl}.`, `Las ni\u00f1as son ${femPl}.`];
      info.bilingualExamples = [
        {es:`El ni\u00f1o es ${masc}.`, en:`The boy is ${en}.`},
        {es:`La ni\u00f1a es ${fem}.`, en:`The girl is ${en}.`},
        {es:`Los ni\u00f1os son ${mascPl}.`, en:`The boys are ${en}.`}
      ];
    } else {
      setNounInfo(isFeminine);
    }
    return info;
  }

  const knownNounGenders = {
    mujer:'f', flor:'f', ciudad:'f', noche:'f', clase:'f', luz:'f', voz:'f', vez:'f', salud:'f',
    hombre:'m', papel:'m', lapiz:'m', profesor:'m', director:'m', pie:'m'
  };
  if (knownNounGenders[normEs]) return setNounInfo(knownNounGenders[normEs] === 'f');

  if (/e$/.test(es) || /[aeiou]s$/.test(es) || /[lnr]/.test(es.slice(-1))) {
    info.type = 'sustantivo';
    info.typeLabel = tc('Noun','Sustantivo');
    info.gender = tc('Common','com\u00fan');
    info.notes = tc(
      `Noun. The article can be "el" or "la" depending on the word.`,
      `Sustantivo. El artículo puede ser "el" o "la" según la palabra.`
    );
    info.examples = [`La palabra "${es}" significa "${en}".`, `Practico "${es}" en una frase.`];
    info.bilingualExamples = [
      {es:`La palabra "${es}" significa "${en}".`, en:`The word "${es}" means "${en}".`},
      {es:`Practico "${es}" en una frase.`, en:`I practice "${es}" in a sentence.`}
    ];
    return info;
  }

  info.typeLabel = tc('Vocabulary','Vocabulario');
  info.examples = [`Ejemplo: ${es} — ${en}`];
  info.bilingualExamples = [{es, en}];
  return info;
}

// ===== EXERCISE GENERATION =====
let exIdCounter = 0;
function nextExId() { return 'ex_' + (++exIdCounter); }

function genChoiceEsToEn(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  let distractors = shuffle(vocab.filter((_, i) => i !== idx)).slice(0, 3).map(w => w.en);
  if (distractors.length < 3) {
    const all = getAllUnlockedWords();
    const extra = shuffle(all.filter(w => w.es !== word.es)).slice(0, 3 - distractors.length).map(w => w.en);
    distractors = [...distractors, ...extra];
  }
  const options = shuffle([word.en, ...distractors]);
  return { id: nextExId(), type:'choice', stem:`¿Qué significa "${word.es}"?`, stemEn:`What does "${word.es}" mean?`, options, correct: options.indexOf(word.en), sourceEs: word.es, sourceEn: word.en };
}

function genChoiceEnToEs(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  let distractors = shuffle(vocab.filter((_, i) => i !== idx)).slice(0, 3).map(w => w.es);
  if (distractors.length < 3) {
    const all = getAllUnlockedWords();
    const extra = shuffle(all.filter(w => w.es !== word.es)).slice(0, 3 - distractors.length).map(w => w.es);
    distractors = [...distractors, ...extra];
  }
  const options = shuffle([word.es, ...distractors]);
  return { id: nextExId(), type:'choice', stem:`¿Cómo se dice "${word.en}" en español?`, stemEn:`How do you say "${word.en}" in Spanish?`, options, correct: options.indexOf(word.es), sourceEs: word.es, sourceEn: word.en };
}

function genTranslate(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  const reverse = Math.random() > 0.5;
  return { 
    id: nextExId(), 
    type:'translate', 
    prompt: reverse ? `Traduce al inglés:` : `Traduce al español:`, 
    promptEn: reverse ? `Translate to English:` : `Translate to Spanish:`, 
    target: reverse ? word.es : word.en, 
    answer: reverse ? word.en : word.es, 
    sourceEs: word.es, 
    sourceEn: word.en,
    reverse: reverse
  };
}

function genListen(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  return { id: nextExId(), type:'listen', prompt:`Escucha y escribe lo que oyes:`, promptEn:`Listen and type what you hear:`, answer: word.es, sourceEs: word.es, sourceEn: word.en };
}

function genComplete(items, used) {
  const pool = items.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = items.indexOf(pool[0]);
  const item = items[idx];
  const es = item.es;
  const en = item.en;
  const words = es.split(' ');
  if (words.length < 3) return null;
  const functionWords = new Set(['el','la','los','las','un','una','unos','unas','de','del','y','e','a','al','en','por','para','con','su','mi','tu','se','le','lo','la','no','que','es','son','soy','eres','está','estoy']);
  const blankCandidates = words
    .map((w, i) => ({ word: w.replace(/[.,!?;:¿¡"']/g, ''), idx: i }))
    .filter(c => !functionWords.has(c.word.toLowerCase()) && c.word.length > 1);
  if (blankCandidates.length === 0) return null;
  used.add(idx);
  const chosen = blankCandidates[Math.floor(blankCandidates.length / 2)];
  const answer = chosen.word;
  const display = words.map((w, i) => i === chosen.idx ? '___' : w).join(' ');
  return { id: nextExId(), type:'complete', prompt:`Completa la oración:`, promptEn:`Complete the sentence:`, sentence: display, answer, options: null, sourceEs: es, sourceEn: en };
}

function genMatch(vocab, used) {
  const available = [];
  for (let i = 0; i < vocab.length; i++) { if (!used.has(i)) available.push(i); }
  if (available.length < 3) return null;
  const count = Math.min(4, available.length);
  const chosen = shuffle(available).slice(0, count);
  chosen.forEach(i => used.add(i));
  const pairs = chosen.map(i => vocab[i]);
  const indices = pairs.map((_, i) => i);
  const leftShuffle = shuffle([...indices]);
  const rightShuffle = shuffle([...indices]);
  const isSentences = vocab.length > 0 && vocab[0].es.includes(' ');
  const prompt = isSentences ? 'Relaciona cada oraci\u00f3n' : 'Relaciona cada palabra con su traducci\u00f3n';
  const promptEn = isSentences ? 'Match each sentence' : 'Match each word with its translation';
  return {
    id: nextExId(), type:'match', prompt, promptEn,
    pairs,
    leftItems: leftShuffle.map(i => ({ text: pairs[i].es, pairIdx: i })),
    rightItems: rightShuffle.map(i => ({ text: pairs[i].en, pairIdx: i })),
    sourceEs: pairs[0].es, sourceEn: pairs[0].en
  };
}

function generateExercises(dayData) {
  const vocab = shuffle(getVocabWords(dayData));
  const items = getExerciseItems(dayData);

  const usedV = new Set();
  const usedI = new Set();
  const exs = [];

  const templates = shuffle([
    () => genChoiceEsToEn(vocab, usedV),
    () => genTranslate(vocab, usedV),
    () => genMatch(vocab, usedV),
    () => genChoiceEnToEs(vocab, usedV),
    () => genComplete(items.length > 0 ? items : vocab, items.length > 0 ? usedI : usedV),
    () => genListen(vocab, usedV),
    () => genChoiceEsToEn(vocab, usedV),
  ]);

  for (let i = 0; i < EXERCISES_PER_LESSON; i++) {
    let ex = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      ex = templates[i % templates.length]();
      if (ex) break;
    }
    if (!ex) {
      const w = vocab[i % vocab.length];
      if (w) ex = { id: nextExId(), type:'translate', prompt:`Traduce:`, promptEn:`Translate:`, target: w.en, answer: w.es, sourceEs: w.es, sourceEn: w.en };
    }
    if (ex) exs.push(ex);
  }

  return shuffle(exs);
}

// ===== RE-QUESTION GENERATION =====
function genRequestion(concept, lessonDay) {
  const es = concept.es;
  const en = concept.en;
  const prevType = concept.lastType || 'translate';
  const types = ['choice','choice','translate','listen','complete'].filter(t => t !== prevType);
  const newType = pick(types);

  // Guard against invalid lessonDay (e.g. 'Review' session)
  const dayData = getDayData(lessonDay);
  if (!dayData) {
    return { id: nextExId(), type:'translate', prompt:`Traduce al español:`, promptEn:`Translate:`, target: en, answer: es, sourceEs: es, sourceEn: en, isRequestion:true };
  }

  if (newType === 'choice') {
    const allVocab = getVocabWords(dayData);
    const all = allVocab.length > 4 ? allVocab : getAllPhaseVocab(getPhase(lessonDay));
    const distractors = shuffle(all.filter(w => w.es !== es)).slice(0, 3).map(w => w.es);
    if (distractors.length < 3) {
      return { id: nextExId(), type:'translate', prompt:`Traduce al español:`, promptEn:`Translate:`, target: en, answer: es, sourceEs: es, sourceEn: en, isRequestion:true };
    }
    if (Math.random() > 0.5) {
      const options = shuffle([es, ...distractors]);
      return { id: nextExId(), type:'choice', stem:`¿Qué significa "${en}"?`, stemEn:`What does "${en}" mean?`, options, correct: options.indexOf(es), sourceEs: es, sourceEn: en, isRequestion:true };
    } else {
      const engDistractors = shuffle(all.filter(w => w.es !== es)).slice(0, 3).map(w => w.en);
      const options = shuffle([en, ...engDistractors]);
      return { id: nextExId(), type:'choice', stem:`¿Qué significa "${es}"?`, stemEn:`What does "${es}" mean?`, options, correct: options.indexOf(en), sourceEs: es, sourceEn: en, isRequestion:true };
    }
  } else if (newType === 'listen') {
    return { id: nextExId(), type:'listen', prompt:`Escucha y escribe:`, promptEn:`Listen and type:`, answer: es, sourceEs: es, sourceEn: en, isRequestion:true };
  } else if (newType === 'complete') {
    const items = getExerciseItems(dayData);
    const match = items.find(i => i.es.includes(es));
    if (match) {
      const parts = match.es.split(es);
      if (parts.length === 2) return { id: nextExId(), type:'complete', prompt:`Completa:`, promptEn:`Complete:`, sentence: `${parts[0]}___${parts[1]}`, answer: es, options: null, sourceEs: es, sourceEn: en, isRequestion:true };
    }
    return { id: nextExId(), type:'translate', prompt:`Traduce al español:`, promptEn:`Translate:`, target: en, answer: es, sourceEs: es, sourceEn: en, isRequestion:true };
  }
  return { id: nextExId(), type:'translate', prompt:`Traduce al español:`, promptEn:`Translate:`, target: en, answer: es, sourceEs: es, sourceEn: en, isRequestion:true };
}

// ===== CUSTOM MODAL (replaces confirm()) =====
function showConfirmModal(title, text, confirmLabel, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <div class="modal-title">${title}</div>
    <div class="modal-text">${text}</div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modalCancel">${t('Cancel','Cancelar')}</button>
      <button class="modal-btn primary" id="modalConfirm">${confirmLabel}</button>
    </div>
  </div>`;
  olParent().appendChild(overlay);
  document.getElementById('modalCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('modalConfirm').addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function showHeartlessOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card" style="text-align:center">
    <div style="font-size:50px;margin-bottom:16px">💔</div>
    <div class="modal-title">${t('Out of Hearts!','¡Sin vidas!')}</div>
    <div class="modal-text">${t('You ran out of hearts. Wait for them to refill or come back later.','Te has quedado sin vidas. Espera a que se recarguen o vuelve más tarde.')}</div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="heartlessBtn">${t('Back to Path','Volver al camino')}</button>
    </div>
  </div>`;
  olParent().appendChild(overlay);
  document.getElementById('heartlessBtn')?.addEventListener('click', () => {
    overlay.remove();
    lesson = null;
    render();
  });
}

// ===== DISMISS FEEDBACK SHEET =====
function dismissFeedbackSheet() {
  const sheet = document.getElementById('feedbackSheet');
  if (sheet) {
    sheet.style.animation = 'sheetDown .2s ease forwards';
    setTimeout(() => sheet.remove(), 200);
  }
}

// ===== RENDER =====
function render() {
  const root = document.getElementById('root');
  if (lesson) { renderQuestion(); applyCompactMode(); return; }
  renderPath(root);
  applyCompactMode();
}

// ===== PATH VIEW =====
function renderPath(root) {
  refillHearts();
  const phases = [1,2,3,4,5];
  let html = `<div class="top-bar"><div class="window-controls">
      <div class="win-btn win-close" id="winClose">✕</div>
      <div class="win-btn win-min" id="winMin">−</div>
      <div class="win-btn win-max" id="winMax">□</div>
    </div>
    <div class="top-inner">
      <div class="stat-group">
        <div class="stat gold"><span class="stat-icon pulse-slow">🔥</span><span class="stat-num">${state.streak}</span></div>
        <div class="stat blue"><span class="stat-icon">💎</span><span class="stat-num">${state.gems}</span></div>
        <div class="stat red"><span class="hearts-display">${Array.from({length:MAX_HEARTS},(_,i)=>`<span class="heart${i<state.hearts?'':' lost'}">❤️</span>`).join('')}</span></div>
      </div>
      <span class="xp-number">${state.xp} XP</span>
      <span class="lang-toggle" id="langToggle">${state.useSpanish?'ES':'EN'}</span>
      <button class="btn-theme" id="themeBtn">${state.darkMode?'☀️':'🌙'}</button>
      <button class="btn-voice" id="voiceBtn">🔊</button>
      <button class="btn-compact" id="compactBtn" title="${t('Compact Mode','Modo Compacto')}">${state.compactMode?'🗖':'🗗'}</button>
      <button class="btn-menu" id="menuBtn">☰</button>
    </div></div>
    <div class="path-view">`;

  phases.forEach(ph => {
    const days = CURRICULUM.filter(d => d.phase === ph);
    const completed = days.filter(d => isCompleted(d.day));
    html += `<div class="section-block">
      <div class="section-header">${t('Phase','Fase')} ${ph}: ${PHASE_NAMES[ph-1]}  <span style="font-weight:400;text-transform:none;letter-spacing:0">${completed.length}/${days.length}</span></div>`;

    let foundCurrent = false;
    days.forEach(d => {
      const comp = isCompleted(d.day);
      const unlocked = isUnlocked(d.day);
      const isCurrent = !comp && unlocked && !foundCurrent && !d.checkpoint;
      if (isCurrent) foundCurrent = true;

      if (d.checkpoint) {
        const chkNum = [30,60,90,120,150].indexOf(d.day) + 1;
        html += `<div class="node-row" data-day="${d.day}">
          <div class="node-circle checkpoint-node ${comp?'completed':unlocked?'current':'locked'}">${comp?'✓':unlocked?'🏆':'🔒'}</div>
          <div class="node-info">
            <div class="node-title ${!unlocked?'locked-label':''}">${t('Checkpoint','Checkpoint')} ${chkNum}${comp?' ✓':''}</div>
            <div class="node-sub">${comp?t('Review','Repasar'):unlocked?t('Test your knowledge!','¡Pon a prueba tu conocimiento!'):t('Complete the phase to unlock','Completa la fase para desbloquear')}</div>
          </div>
        </div>`;
        return;
      }

      const circleClass = comp ? 'completed' : (isCurrent ? 'current' : (unlocked ? 'unlocked' : 'locked'));
      const labelClass = unlocked ? '' : 'locked-label';
      const circleContent = comp ? '✓' : d.day;
      const isEven = d.day % 2 === 0;

      html += `<div class="node-row ${isEven ? 'even' : ''}" data-day="${d.day}">
        <div class="node-circle ${circleClass}">${circleContent}</div>
        <div class="node-info">
          <div class="node-title ${labelClass}">${t('Day','D\u00eda')} ${d.day}: ${d.title}</div>
          <div class="node-sub">${comp?t('Review','Repasar'):unlocked?t('Available','Disponible'):t('Complete day ' + (d.day-1) + ' first','Completa el d\u00eda ' + (d.day-1) + ' primero')}</div>
        </div>
      </div>`;

      const nextDay = CURRICULUM.find(dd => dd.day === d.day + 1);
      if (nextDay && !nextDay.checkpoint && d.day % 7 !== 0) {
        const connEven = d.day % 2 === 0 ? 'even' : 'odd';
        html += `<div class="connector ${connEven} ${comp?'completed-conn':''}"></div>`;
      }
    });
    html += `</div>`;
  });

  html += `<div style="text-align:center;padding:16px 0 8px">
    <button class="reset-btn" id="resetBtn">🗑 ${t('Reset progress','Reiniciar progreso')}</button>
  </div>`;

  html += `</div>`;
  root.innerHTML = html;

  root.querySelectorAll('.node-row').forEach(el => {
    el.addEventListener('click', () => {
      const day = parseInt(el.dataset.day);
      if (!day) return;
      if (isUnlocked(day)) startLesson(day);
      else {
        const prev = getDayData(day - 1);
        if (prev) showToast(t("Complete day ","Completa el d\u00eda ") + (prev.checkpoint ? prev.day - 1 : day - 1) + t(" first"," primero"));
      }
    });
  });
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    showConfirmModal(
      t('Reset progress?','¿Reiniciar progreso?'),
      t('This will erase all your progress and cannot be undone.','Esto borrará todo tu progreso y no se puede deshacer.'),
      t('Reset','Reiniciar'),
      () => {
        localStorage.removeItem('es150duo');
        state = defaultState();
        saveState();
        render();
      }
    );
  });
  document.getElementById('langToggle')?.addEventListener('click', () => {
    const input = document.getElementById('transInput');
    const savedVal = input?.value || '';
    state.useSpanish = !state.useSpanish;
    saveState();
    if (document.querySelector('.path-view')) render();
    else if (lesson) {
      renderQuestion();
      setTimeout(() => { const inp = document.getElementById('transInput'); if (inp && savedVal) inp.value = savedVal; }, 0);
    }
  });
  document.getElementById('menuBtn')?.addEventListener('click', showSideMenu);
  document.getElementById('themeBtn')?.addEventListener('click', () => { state.darkMode = !state.darkMode; saveState(); applyTheme(); render(); });
  document.getElementById('voiceBtn')?.addEventListener('click', showVoiceSettings);
  document.getElementById('compactBtn')?.addEventListener('click', toggleCompact);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
}

// ===== COMPACT / DRAGGABLE DESKTOP MODE =====
let _compactDrag = null;
function applyCompactMode() {
  const root = document.getElementById('root');
  if (state.compactMode) {
    document.documentElement.classList.add('compact-mode');
    root.style.borderRadius = '0'; // Remove border radius in mini-mode for a cleaner edge
    root.style.boxShadow = 'none';
  } else {
    document.documentElement.classList.remove('compact-mode');
    root.style.borderRadius = '';
    root.style.boxShadow = '';
  }
}
function toggleCompact() {
  state.compactMode = !state.compactMode;
  if (!state.compactMode) state.compactPos = null;
  saveState();
  applyCompactMode();
  if (document.querySelector('.path-view')) render();
  else if (lesson) renderQuestion();
}
// ===== LESSON FLOW =====
function startLesson(day) {
  const dayData = getDayData(day);
  if (!dayData) return;
  if (dayData.checkpoint) { startCheckpoint(dayData); return; }
  if (state.hearts === 0) { showHeartlessOverlay(); return; }

  const exercises = generateExercises(dayData);
  if (exercises.length === 0) return;

  lesson = {
    dayData,
    exercises,
    currentIdx: 0,
    xpEarned: 0,
    heartsLost: 0,
    failedThisLesson: [],
    answered: false,
    phase: 'active',
    requeue: [],
    requeueIdx: 0,
    combo: 0
  };
  render();
  if (dayData.intro || dayData.grammar) {
    showMicroLesson(dayData);
  }
}

// ===== MICRO-LESSON TIP OVERLAY =====
function showMicroLesson(dayData) {
  renderQuestion();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="micro-card">
    <div class="micro-badge">${t('Before you start...','Antes de empezar...')}</div>
    <div class="micro-title">${t(dayData.title, dayData.title)}</div>
    <div class="micro-body">${dayData.intro || dayData.grammar}</div>
    <button class="micro-btn" id="microDismissBtn">${t("Let's go!","\u00a1Vamos!")}</button>
  </div>`;
  olParent().appendChild(overlay);
  document.getElementById('microDismissBtn').addEventListener('click', () => {
    playSFX('click');
    overlay.remove();
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderQuestion() {
  refillHearts();
  const root = document.getElementById('root');
  const ex = lesson.exercises[lesson.currentIdx];
  if (!ex) { finishLesson(); return; }

  const total = lesson.exercises.length;
  const done = Math.min(lesson.currentIdx, total);

  let progDots = '';
  for (let i = 0; i < total; i++) {
    const cls = i < done ? 'done' : (i === done ? 'active' : '');
    progDots += `<div class="prog-dot ${cls}"></div>`;
  }

  let html = `<div class="top-bar"><div class="window-controls">
      <div class="win-btn win-close" id="winClose">✕</div>
      <div class="win-btn win-min" id="winMin">−</div>
      <div class="win-btn win-max" id="winMax">□</div>
    </div>
    <div class="top-inner">
      <div class="stat-group">
        <div class="stat gold"><span class="stat-icon pulse-slow">🔥</span><span class="stat-num">${state.streak}</span></div>
        <div class="stat blue"><span style="font-size:15px;font-weight:700;color:#fff">+${lesson.xpEarned} XP</span></div>
        ${lesson.combo >= 3 ? `<div class="stat" style="background:var(--gold);padding:2px 8px;border-radius:12px;font-size:13px;font-weight:700;color:#1a1a2e">🔥 ×${lesson.combo}</div>` : ''}
        <div class="stat red"><span class="hearts-display">${Array.from({length:MAX_HEARTS},(_,i)=>`<span class="heart${i<state.hearts?'':' lost'}">❤️</span>`).join('')}</span></div>
      </div>
      <span class="lang-toggle" id="langToggle">${state.useSpanish?'ES':'EN'}</span>
      <button class="btn-theme" id="themeBtn">${state.darkMode?'☀️':'🌙'}</button>
      <button class="btn-voice" id="voiceBtn">🔊</button>
      <button class="btn-compact" id="compactBtn" title="${t('Compact Mode','Modo Compacto')}">${state.compactMode?'🗖':'🗗'}</button>
      <button class="btn-leave" onclick="leaveLesson()">${t('Continue learning','Continuar aprendiendo')}</button>
    </div></div>
    <div class="lesson-view">
    <div class="lesson-progress">${progDots}</div>
    ${lesson.phase === 'review' ? `<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">${t('Review Mistakes','Repasar Errores')}</div>` : ''}
    <div class="exercise-card spring-in" id="exCard">`;

  if (ex.type === 'choice') {
    html += `<div class="exercise-prompt">${t(ex.stemEn, ex.stem)}</div>
      <div class="choice-grid" id="choiceGrid">`;
    ex.options.forEach((opt, i) => {
      html += `<button class="choice-btn" data-opt="${i}">${opt}</button>`;
    });
    html += `</div>`;
  } else if (ex.type === 'translate') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <div class="exercise-target">“${ex.target}”</div>
      <div class="translate-wrap">
        <input class="translate-input" id="transInput" placeholder="${t('Write in Spanish...', 'Escribe en español...')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
      <div class="hint-wrap"><button class="btn-hint" id="hintBtn">💡 ${t('Hint','Pista')}</button></div>
      ${renderWordBank(ex)}`;
  } else if (ex.type === 'complete') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <div class="exercise-target">${ex.sentence}</div>
      <div class="translate-wrap">
        <input class="translate-input" id="transInput" placeholder="${t('Type the word...', 'Escribe la palabra...')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
      <div class="hint-wrap"><button class="btn-hint" id="hintBtn">💡 ${t('Hint','Pista')}</button></div>
      ${renderWordBank(ex)}`;
  } else if (ex.type === 'listen') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <button class="speaker-btn" id="speakerBtn">🔊</button>
      <div class="translate-wrap">
        <input class="translate-input" id="transInput" placeholder="${t('Type what you hear...', 'Escribe lo que oyes...')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
      <div class="hint-wrap"><button class="btn-hint" id="hintBtn">💡 ${t('Hint','Pista')}</button></div>
      ${renderWordBank(ex)}`;
  } else if (ex.type === 'match') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <div class="match-grid" id="matchGrid">
        <div class="match-col" id="matchLeftCol">`;
    ex.leftItems.forEach((item, i) => {
      html += `<div class="match-item match-item-left" data-pair="${item.pairIdx}">${item.text}</div>`;
    });
    html += `</div><div class="match-col" id="matchRightCol">`;
    ex.rightItems.forEach((item, i) => {
      html += `<div class="match-item match-item-right" data-pair="${item.pairIdx}">${item.text}</div>`;
    });
    html += `</div></div>
      <div class="match-status" id="matchStatus">${t('Tap a word on the left, then its translation on the right', 'Toca una palabra de la izquierda, luego su traducción de la derecha')}</div>`;
  }

  html += `</div></div>`;
  root.innerHTML = html;

  // Accent bar for text inputs
  if (ex.type === 'translate' || ex.type === 'complete' || ex.type === 'listen') {
    const accHtml = `<div class="accent-bar">${['á','é','í','ó','ú','ü','ñ'].map(c => `<button class="accent-btn" data-accent="${c}">${c}</button>`).join('')}</div>`;
    const exCard = document.getElementById('exCard');
    if (exCard) exCard.insertAdjacentHTML('beforeend', accHtml);
    document.querySelectorAll('.accent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('transInput');
        if (input) { const s = input.selectionStart || input.value.length; input.value = input.value.slice(0,s) + btn.dataset.accent + input.value.slice(input.selectionEnd || s); input.focus(); input.selectionStart = input.selectionEnd = s + 1; }
      });
    });
  }

  // Word bank chip clicks: insert word at cursor in input
  document.querySelectorAll('.word-bank-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      playSFX('click');
      const input = document.getElementById('transInput');
      if (!input) return;
      const word = chip.dataset.word + ' ';
      const s = input.selectionStart || input.value.length;
      const before = input.value.slice(0, s);
      const after = input.value.slice(input.selectionEnd || s);
      input.value = before + word + after;
      input.focus();
      const newPos = s + word.length;
      input.selectionStart = input.selectionEnd = newPos;
    });
  });

  // Bind events
  if (ex.type === 'choice') {
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', () => { playSFX('click'); checkAnswer(parseInt(btn.dataset.opt)); });
    });
  } else if (ex.type === 'translate' || ex.type === 'complete' || ex.type === 'listen') {
    const input = document.getElementById('transInput');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) checkAnswer(input.value);
    });
    input?.focus();
  } else if (ex.type === 'match') {
    const matchState = { selectedLeft: null, matched: new Set(), errors: 0 };
    const status = document.getElementById('matchStatus');
    document.querySelectorAll('.match-item-left').forEach(el => {
      el.addEventListener('click', () => {
        playSFX('click');
        const pair = el.dataset.pair;
        if (matchState.matched.has(pair)) return;
        document.querySelectorAll('.match-item-left').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        matchState.selectedLeft = pair;
      });
    });
    document.querySelectorAll('.match-item-right').forEach(el => {
      el.addEventListener('click', () => {
        playSFX('click');
        if (matchState.selectedLeft === null) return;
        const leftPair = matchState.selectedLeft;
        const rightPair = el.dataset.pair;
        if (matchState.matched.has(leftPair) || matchState.matched.has(rightPair)) return;
        if (leftPair === rightPair) {
          matchState.matched.add(leftPair);
          playSFX('matchCorrect');
          document.querySelectorAll(`.match-item-left[data-pair="${leftPair}"]`).forEach(e => {
            e.classList.remove('selected'); e.classList.add('matched');
          });
          document.querySelectorAll(`.match-item-right[data-pair="${rightPair}"]`).forEach(e => {
            e.classList.add('matched');
          });
          matchState.selectedLeft = null;
          if (matchState.matched.size === ex.pairs.length) {
            lesson.combo = (lesson.combo || 0) + 1;
            lesson.xpEarned += XP_PER_CORRECT;
            addXp(XP_PER_CORRECT);
            trackCorrect(ex);
            lesson.answered = true;
            document.querySelectorAll('.match-item-left, .match-item-right').forEach(e => e.style.pointerEvents = 'none');
            showCorrectFeedback(ex);
          }
        } else {
          matchState.errors++;
          loseHeart();
          lesson.heartsLost++;
          trackWrong(ex);
          playSFX('matchWrong');
          document.querySelectorAll(`.match-item-left[data-pair="${leftPair}"]`).forEach(e => {
            e.classList.add('wrong'); setTimeout(() => e.classList.remove('wrong'), 350);
          });
          const wrongRight = document.querySelectorAll(`.match-item-right[data-pair="${rightPair}"]`);
          wrongRight.forEach(e => { e.classList.add('wrong'); setTimeout(() => e.classList.remove('wrong'), 350); });
          matchState.selectedLeft = null;
          document.querySelectorAll('.match-item-left').forEach(e => e.classList.remove('selected'));
          const concept = ex.pairs.find(p => p.es === ex.leftItems.find(i => i.pairIdx == leftPair)?.text);
          if (concept) showToast('\u2717 ' + concept.es + ' = ' + concept.en);
        }
      });
    });
  }

  // Auto-play audio for listen type
  if (ex.type === 'listen') {
    setTimeout(() => {
      speak(ex.answer, 0.75);
    }, 400);
    document.getElementById('speakerBtn')?.addEventListener('click', () => speak(ex.answer, 0.75));
  }

  // Keyboard shortcuts
  if (window._currentKeyHandler) document.removeEventListener('keydown', window._currentKeyHandler);
  const keyHandler = (e) => {
    if (e.key === 'Enter' && lesson.answered) {
      const contBtn = document.getElementById('continueCorrectBtn') || document.getElementById('continueWrongBtn');
      if (contBtn) contBtn.click();
      return;
    }
    if (ex.type === 'choice' && !lesson.answered) {
      if (e.key >= '1' && e.key <= '4') {
        const n = parseInt(e.key);
        const btn = document.querySelector(`.choice-btn:nth-child(${n})`);
        if (btn) { btn.click(); e.preventDefault(); }
      }
    }
  };
  window._currentKeyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler);

  document.getElementById('langToggle')?.addEventListener('click', () => {
    const input = document.getElementById('transInput');
    const savedVal = input?.value || '';
    state.useSpanish = !state.useSpanish;
    saveState();
    renderQuestion();
    setTimeout(() => { const inp = document.getElementById('transInput'); if (inp && savedVal) inp.value = savedVal; }, 0);
  });
  document.getElementById('themeBtn')?.addEventListener('click', () => { state.darkMode = !state.darkMode; saveState(); applyTheme(); renderQuestion(); });
  document.getElementById('voiceBtn')?.addEventListener('click', () => { showVoiceSettings(); });
  document.getElementById('compactBtn')?.addEventListener('click', () => {
    toggleCompact();
    window.electronAPI.setWindowState(state.compactMode ? 'mini' : 'full');
  });
  document.getElementById('winClose')?.addEventListener('click', () => window.electronAPI.windowControl('close'));
  document.getElementById('winMin')?.addEventListener('click', () => window.electronAPI.windowControl('minimize'));
  document.getElementById('winMax')?.addEventListener('click', () => window.electronAPI.windowControl('maximize'));
  document.getElementById('hintBtn')?.addEventListener('click', () => {
    playSFX('click');
    const input = document.getElementById('transInput');
    if (!input) return;
    const firstChar = ex.answer[0];
    if (input.value.length === 0) {
      input.value = firstChar;
      input.focus();
    } else {
      showToast(`💡 Hint: The answer starts with "${firstChar}"`);
    }
  });
}

// ===== CHECK ANSWERS =====
function checkAnswer(userAnswer) {
  if (lesson.answered) return;
  const ex = lesson.exercises[lesson.currentIdx];
  if (!ex) return;

  let correct = false;
  if (ex.type === 'choice') {
    correct = userAnswer === ex.correct;
  } else {
    correct = normalize(userAnswer) === normalize(ex.answer);
  }

    lesson.answered = true;

  if (correct) {
    lesson.combo = (lesson.combo || 0) + 1;
    lesson.xpEarned += XP_PER_CORRECT;
    addXp(XP_PER_CORRECT);
    trackCorrect(ex);
    playSFX('correct');
    showCorrectFeedback(ex);
    const audioText = ex.answer || ex.sourceEs || '';
    if (audioText && ex.type !== 'listen') setTimeout(() => speak(audioText, 0.8), 300);
  } else {
    lesson.combo = 0;
    loseHeart();
    if (state.hearts === 0) {
      showHeartlessOverlay();
      return;
    }
    lesson.heartsLost++;
    trackWrong(ex);
    playSFX('incorrect');
    playSFX('heartLoss');
    showIncorrectFeedback(ex, userAnswer);
  }
}

// ===== BOTTOM SHEET: CORRECT FEEDBACK =====
function showCorrectFeedback(ex) {
  dismissFeedbackSheet();

  const sheet = document.createElement('div');
  sheet.className = 'feedback-sheet correct';
  sheet.id = 'feedbackSheet';
  sheet.innerHTML = `<div class="feedback-sheet-grip"></div>
    <div class="feedback-sheet-body">
      <div class="feedback-sheet-icon">✓</div>
      <div class="feedback-sheet-title">${t('Correct! +' ,'\u00a1Correcto! +')}${XP_PER_CORRECT} XP</div>
      ${lesson.combo > 1 ? `<div style="text-align:center;font-size:14px;font-weight:600;color:var(--gold);margin-top:-6px">🔥 ${lesson.combo} ${t('in a row!','¡seguidos!')}</div>` : ''}
      <div class="feedback-sheet-actions">
        <button class="feedback-sheet-btn secondary" id="explainCorrectBtn">❓ ${t('Explain','Explicar')}</button>
        <button class="feedback-sheet-btn primary" id="continueCorrectBtn">${t('Continue','Continuar')}</button>
      </div>
    </div>
    <div id="explainCorrectArea" style="display:none"></div>`;
  olParent().appendChild(sheet);

  // Mark choice buttons
  if (ex.type === 'choice') {
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === ex.correct) btn.classList.add('correct');
    });
  } else if (ex.type !== 'match') {
    const input = document.getElementById('transInput');
    if (input) { input.disabled = true; input.classList.add('correct'); }
  }

  document.getElementById('explainCorrectBtn')?.addEventListener('click', () => {
    playSFX('click');
    openExplain(ex, 'explainCorrectArea');
  });
  document.getElementById('continueCorrectBtn')?.addEventListener('click', () => {
    playSFX('click');
    playSFX('xpGain');
    dismissFeedbackSheet();
    nextQuestion();
  });
}

// ===== BOTTOM SHEET: INCORRECT FEEDBACK =====
function showIncorrectFeedback(ex, userAnswer) {
  dismissFeedbackSheet();

  const sheet = document.createElement('div');
  sheet.className = 'feedback-sheet incorrect';
  sheet.id = 'feedbackSheet';
  const correctWord = ex.answer || ex.sourceEs || '';
  const translation = ex.sourceEn || '';
  sheet.innerHTML = `<div class="feedback-sheet-grip"></div>
    <div class="feedback-sheet-body">
      <div class="feedback-sheet-icon">✗</div>
      <div class="feedback-sheet-title">${t('Correct answer:','Respuesta correcta:')}</div>
      <div class="feedback-sheet-answer">${correctWord}</div>
      ${translation ? `<div style="font-size:16px;color:inherit;opacity:.7;margin-bottom:4px;font-weight:600">${translation}</div>` : ''}
      <div class="feedback-sheet-actions">
        <button class="feedback-sheet-btn secondary" id="explainWrongBtn">❓ ${t('Explain','Explicar')}</button>
        <button class="feedback-sheet-btn primary" id="continueWrongBtn">${t('Continue','Continuar')}</button>
      </div>
    </div>
    <div id="explainWrongArea" style="display:none"></div>`;
  olParent().appendChild(sheet);

  if (ex.type === 'choice') {
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === ex.correct) btn.classList.add('correct');
      if (i === userAnswer && userAnswer !== ex.correct) btn.classList.add('incorrect');
    });
  } else {
    const input = document.getElementById('transInput');
    if (input) { input.disabled = true; input.classList.add('incorrect'); }
  }

  const esc = ex.sourceEs || ex.answer || '';

  document.getElementById('explainWrongBtn')?.addEventListener('click', () => {
    playSFX('click');
    openExplain(ex, 'explainWrongArea');
  });
  document.getElementById('continueWrongBtn')?.addEventListener('click', () => {
    playSFX('click');
    dismissFeedbackSheet();

    // Track failure and generate re-question
    const fc = state.failedConcepts.find(c => c.es === esc);
    if (fc) {
      fc.count = (fc.count || 1) + 1;
      fc.lastSeen = lesson.dayData.day;
      fc.lastType = ex.type;
    } else {
      state.failedConcepts.push({ es: esc, en: ex.sourceEn, count: 1, lastSeen: lesson.dayData.day, lastType: ex.type });
    }
    saveState();
    lesson.failedThisLesson.push(esc);

    const req = genRequestion({ es: esc, en: ex.sourceEn, lastType: ex.type }, lesson.dayData.day);
    if (req) lesson.requeue.push(req);

    nextQuestion();
  });
}

// ===== EXPLAIN MY ANSWER (Duolingo-style chat) =====
function openExplain(ex, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const wordEs = ex.sourceEs || ex.answer || '';
  const wordEn = ex.sourceEn || '';
  const info = getConceptInfo(wordEs, wordEn);
  const isVerb = info.type === 'verbo' || info.type === 'Verb';

  // ——— Word Type Icon/Color ———
  const typeMeta = {
    verb:      { icon:'📝', label: t('Verb','Verbo') },
    noun:      { icon:'📦', label: t('Noun','Sustantivo') },
    adj:       { icon:'🎨', label: t('Adjective','Adjetivo') },
    article:   { icon:'🔤', label: t('Article','Artículo') },
    adverb:    { icon:'➡️', label: t('Adverb','Adverbio') },
    prep:      { icon:'📍', label: t('Preposition','Preposición') },
    pronoun:   { icon:'👤', label: t('Pronoun','Pronombre') },
    expr:      { icon:'💬', label: t('Expression','Expresión') },
    greeting:  { icon:'👋', label: t('Greeting','Saludo') },
    farewell:  { icon:'🚶', label: t('Farewell','Despedida') },
    negation:  { icon:'🚫', label: t('Negation','Negación') },
    quest:     { icon:'❓', label: t('Question word','Palabra interrogativa') },
    other:     { icon:'📖', label: t('Vocabulary','Vocabulario') }
  };

  function getTypeMeta(typeLabel) {
    const lower = (typeLabel || '').toLowerCase();
    if (isVerb || lower.includes('verb')) return typeMeta.verb;
    if (lower.includes('noun') || lower.includes('sustantivo')) return typeMeta.noun;
    if (lower.includes('adjective') || lower.includes('adjetivo')) return typeMeta.adj;
    if (lower.includes('article') || lower.includes('artículo')) return typeMeta.article;
    if (lower.includes('adverb')) return typeMeta.adverb;
    if (lower.includes('preposition') || lower.includes('preposición')) return typeMeta.prep;
    if (lower.includes('pronoun') || lower.includes('pronombre')) return typeMeta.pronoun;
    if (lower.includes('expression') || lower.includes('expresión')) return typeMeta.expr;
    if (lower.includes('greeting') || lower.includes('saludo')) return typeMeta.greeting;
    if (lower.includes('farewell') || lower.includes('despedida')) return typeMeta.farewell;
    if (lower.includes('negation') || lower.includes('negación') || lower.includes('negative')) return typeMeta.negation;
    if (lower.includes('question') || lower.includes('interrogativa')) return typeMeta.quest;
    return typeMeta.other;
  }
  const tm = getTypeMeta(info.typeLabel);

  // ——— Word Identity Card ———
  const wordCard = `
    <div class="xp-word-card">
      <div class="xp-word-main">
        <div class="xp-word-es">${wordEs}</div>
        <div class="xp-word-en">${wordEn}</div>
        <button class="xp-word-listen" id="xpListenBtn" title="${t('Listen','Escuchar')}">🔊</button>
      </div>
      <div class="xp-word-type"><span class="xp-badge">${tm.icon} ${tm.label}</span>
        ${info.verbType ? `<span class="xp-badge xp-badge-sub">${info.verbType}</span>` : ''}
        ${info.gender ? `<span class="xp-badge xp-badge-sub">${info.gender}</span>` : ''}
      </div>
    </div>`;

  // ——— Grammar Notes ———
  const notesHtml = info.notes
    ? `<div class="xp-section"><div class="xp-section-title">📖 ${t('Notes','Notas')}</div><div class="xp-notes">${info.notes}</div></div>`
    : '';

  // ——— Related Forms ———
  const formsHtml = (info.relatedForms && info.relatedForms.length > 1)
    ? `<div class="xp-section"><div class="xp-section-title">🔗 ${t('Forms','Formas')}</div>
        <div class="xp-forms">${info.relatedForms.map(f => `<span class="xp-form-chip">${f}</span>`).join('')}</div></div>`
    : '';

  // ——— Conjugation Table for Regular Verbs ———
  let conjHtml = '';
  if (isVerb && info.conjugationDetails && info.conjugationDetails.length) {
    conjHtml = `<div class="xp-section"><div class="xp-section-title">📋 ${t('Conjugation','Conjugación')}</div>
      <div class="xp-conj-grid">`;
    info.conjugationDetails.forEach(d => {
      conjHtml += `<div class="xp-conj-row">
        <span class="xp-conj-subj">${d.subject}</span>
        <span class="xp-conj-form">${d.form}</span>
        <span class="xp-conj-en">${d.translation}</span>
      </div>`;
    });
    conjHtml += `</div></div>`;
  }

  // ——— Examples (always visible) ———
  const ansWord = (ex.answer || '___').trim();
  const bex = (info.bilingualExamples || []).filter(e => {
    if (ansWord === '___') return true;
    const esc = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return !new RegExp('\\b' + esc + '\\b', 'i').test(e.es);
  }).slice(0, 4);
  const examplesHtml = bex.length > 0
    ? `<div class="xp-section"><div class="xp-section-title">💡 ${t('Examples','Ejemplos')}</div>
        ${bex.map(e => `<div class="xp-example-row"><span class="xp-example-es">${e.es}</span><span class="xp-example-en">${e.en}</span></div>`).join('')}</div>`
    : '';

  // ——— Common Mistakes Tip (context-aware) ———
  let tipsHtml = '';
  const tipData = {
    'unos': t('Use "unos" with masculine plural nouns (unos libros). For feminine plural, use "unas".', 'Usa "unos" con sustantivos masculinos plurales (unos libros). Para femenino plural, usa "unas".'),
    'unas': t('Use "unas" with feminine plural nouns (unas casas). For masculine plural, use "unos".', 'Usa "unas" con sustantivos femeninos plurales (unas casas). Para masculino plural, usa "unos".'),
    'ser': t('Ser is for permanent traits ( Soy alto). For temporary states, use estar (Estoy cansado).', 'Ser es para características permanentes (Soy alto). Para estados temporales, usa estar (Estoy cansado).'),
    'estar': t('Estar is for temporary states and location (Estoy en casa). For permanent traits, use ser (Soy médico).', 'Estar es para estados temporales y ubicación (Estoy en casa). Para rasgos permanentes, usa ser (Soy médico).'),
    'tener': t('Tener is irregular: tengo, tienes, tiene, tenemos, tenéis, tienen.', 'Tener es irregular: tengo, tienes, tiene, tenemos, tenéis, tienen.'),
    'ir': t('Ir is very irregular: voy, vas, va, vamos, vais, van.', 'Ir es muy irregular: voy, vas, va, vamos, vais, van.'),
    'gustar': t('Gustar uses indirect object pronouns: me gusta, te gusta, le gusta, nos gusta, les gusta.', 'Gustar usa pronombres de objeto indirecto: me gusta, te gusta, le gusta, nos gusta, les gusta.'),
    'hay': t('Hay means "there is" or "there are" — it is the same for singular and plural.', 'Hay significa "there is" o "there are" — es igual para singular y plural.'),
    'no': t('Place "no" directly before the conjugated verb: No hablo inglés.', 'Coloca "no" directamente antes del verbo conjugado: No hablo inglés.'),
    'mucho': t('Mucho changes to match gender: mucho trabajo (m), mucha agua (f), muchos amigos (pl), muchas gracias (f pl).', 'Mucho cambia según el género: mucho trabajo (m), mucha agua (f), muchos amigos (pl), muchas gracias (f pl).'),
    'bueno': t('Bueno shortens to "buen" before masculine singular nouns: un buen amigo.', 'Bueno se acorta a "buen" antes de sustantivos masculinos singulares: un buen amigo.'),
    'grande': t('Grande shortens to "gran" before singular nouns: una gran idea.', 'Grande se acorta a "gran" antes de sustantivos singulares: una gran idea.'),
    'primero': t('Primero shortens to "primer" before masculine singular nouns: el primer libro.', 'Primero se acorta a "primer" antes de sustantivos masculinos singulares: el primer libro.'),
    'ninguno': t('Ninguno shortens to "ningún" before masculine singular nouns: ningún libro.', 'Ninguno se acorta a "ningún" antes de sustantivos masculinos singulares: ningún libro.'),
  };
  const tip = tipData[info.word?.toLowerCase()] || tipData[normEs];
  if (tip) {
    tipsHtml = `<div class="xp-section xp-tip"><div class="xp-section-title">⚠️ ${t('Tip','Consejo')}</div><div class="xp-notes">${tip}</div></div>`;
  }

  // Check if word has an accent difference (common spelling pitfalls)
  const accentNote = getAccentNote(wordEs);
  const accentHtml = accentNote
    ? `<div class="xp-section xp-tip"><div class="xp-section-title">✏️ ${t('Spelling','Ortografía')}</div><div class="xp-notes">${accentNote}</div></div>`
    : '';

  // ——— Render ———
  container.style.display = 'block';
  container.innerHTML = `<div class="xp-explain-wrap">
    ${wordCard}
    ${notesHtml}
    ${formsHtml}
    ${conjHtml}
    ${examplesHtml}
    ${accentHtml}
    ${tipsHtml}
    <div class="xp-actions">
      <button class="xp-btn xp-btn-primary" id="xpGotItBtn">✓ ${t('Got it','Entendido')}</button>
      <button class="xp-btn xp-btn-speak" id="xpSpeakBtn">🔊 ${t('Listen','Escuchar')}</button>
    </div>
  </div>`;

  // ——— Events ———
  document.getElementById('xpGotItBtn')?.addEventListener('click', () => {
    playSFX('click');
    container.style.display = 'none';
  });

  document.getElementById('xpSpeakBtn')?.addEventListener('click', () => speak(wordEs, 0.82));
}

// ——— Accent/Spelling Helper ———
function getAccentNote(word) {
  const accents = {
    'como': t('"Cómo" has an accent when asking a question. "Como" (no accent) means "like/as".', '"Cómo" lleva tilde en preguntas. "Como" (sin tilde) significa "like/as".'),
    'donde': t('"Dónde" has an accent when asking a question. "Donde" (no accent) means "where" in relative clauses.', '"Dónde" lleva tilde en preguntas. "Donde" (sin tilde) se usa en oraciones relativas.'),
    'que': t('"Qué" has an accent when asking a question or exclaiming. "Que" (no accent) means "that".', '"Qué" lleva tilde en preguntas o exclamaciones. "Que" (sin tilde) significa "that".'),
    'quien': t('"Quién" has an accent when asking a question. "Quien" (no accent) is used in relative clauses.', '"Quién" lleva tilde en preguntas. "Quien" (sin tilde) se usa en cláusulas relativas.'),
    'si': t('"Sí" has an accent when it means "yes" or "himself/herself". "Si" (no accent) means "if".', '"Sí" lleva tilde cuando significa "yes" o "sí mismo". "Si" (sin tilde) significa "if".'),
    'tu': t('"Tú" has an accent when it means "you". "Tu" (no accent) means "your".', '"Tú" lleva tilde cuando significa "you". "Tu" (sin tilde) significa "your".'),
    'el': t('"Él" has an accent when it means "he". "El" (no accent) means "the".', '"Él" lleva tilde cuando significa "he". "El" (sin tilde) es el artículo.'),
    'mas': t('"Más" has an accent when it means "more". "Mas" (no accent) means "but".', '"Más" lleva tilde cuando significa "more". "Mas" (sin tilde) significa "but".'),
    'se': t('"Sé" has an accent when it means "I know" (from saber). "Se" (no accent) is a reflexive pronoun.', '"Sé" lleva tilde cuando significa "I know" (de saber). "Se" (sin tilde) es un pronombre reflexivo.'),
  };
  return accents[word ? word.toLowerCase() : ''] || null;
}

// ===== NEXT QUESTION / END-OF-LESSON REVIEW =====
function nextQuestion() {
  if (!lesson) return;
  lesson.answered = false;

  lesson.currentIdx++;
  if (lesson.currentIdx >= lesson.exercises.length) {
    // All main exercises done - check for requeue items (review phase)
    if (lesson.requeue.length > 0) {
      // Move to review phase: append all requeue items after the main exercises
      while (lesson.requeue.length > 0) {
        lesson.exercises.push(lesson.requeue.shift());
      }
      lesson.phase = 'review';
      renderQuestion();
    } else {
      finishLesson();
    }
  } else {
    renderQuestion();
  }
}

function finishLesson() {
  const root = document.getElementById('root');
  const isReview = lesson.dayData.day === 'Review' || lesson.dayData.day === 'Quick';
  const isNew = !isReview && !isCompleted(lesson.dayData.day);
  
  if (isNew) {
    state.completed.push(lesson.dayData.day);
    state.gems += 5;
    addXp(XP_LESSON_BONUS);
  }
  updateStreak();
  saveState();

  if (lesson.heartsLost === 0 && lesson.xpEarned > 0) {
    state.perfectLessons = (state.perfectLessons || 0) + 1;
    if (!state.badges.includes('perfect_lesson')) { state.badges.push('perfect_lesson'); saveState(); showToast('🏆 ' + badgeLabel(ALL_BADGES.find(b => b.id === 'perfect_lesson'))); }
  }
  if (!isReview && lesson.dayData.checkpoint && isNew) {
    if (!state.badges.includes('checkpoint')) { state.badges.push('checkpoint'); saveState(); showToast('🏆 ' + badgeLabel(ALL_BADGES.find(b => b.id === 'checkpoint'))); }
  }
  checkBadges();
  updateQuestProgress();

  const esc = lesson.failedThisLesson || [];
  if (!isReview) {
    esc.forEach(es => scheduleReview(lesson.dayData.day, es));
  }

  if (!isReview && lesson.dayData.checkpoint) playSFX('checkpoint');
  else if (lesson.heartsLost === 0 && isNew) playSFX('levelUp');
  else playSFX('correct');

  const overlay = document.createElement('div');
  overlay.className = 'complete-overlay';
  overlay.innerHTML = `<div class="complete-content">
    <div class="complete-emoji">🎉</div>
    <div class="complete-title">${t('Well done!','\u00a1Bien hecho!')}</div>
    <div class="complete-day">${isReview ? (lesson.dayData.title || t('Practice Session','Sesión de Práctica')) : lesson.dayData.title}</div>
    ${esc.length > 0 ? `<div style="font-size:14px;color:var(--text2);margin-bottom:20px;font-weight:600">${t('Words to practice:','Palabras para practicar:')} ${esc.slice(0,3).join(', ')}${esc.length > 3 ? '...' : ''}</div>` : ''}
    <div class="complete-stats">
      <div class="complete-stat"><div class="complete-stat-num gold">+${lesson.xpEarned + (isNew ? XP_LESSON_BONUS : 0)}</div><div class="complete-stat-label">XP</div></div>
      <div class="complete-stat"><div class="complete-stat-num red">${lesson.heartsLost}</div><div class="complete-stat-label">${t('Mistakes','Fallos')}</div></div>
      <div class="complete-stat"><div class="complete-stat-num green">${state.streak}</div><div class="complete-stat-label">${t('Streak','Racha')} 🔥</div></div>
    </div>
    <button class="continue-btn" id="pathBtn">${t('Continue','Continuar')}</button>
  </div>`;

  olParent().appendChild(overlay);
  celebrate(2000);
  document.getElementById('pathBtn')?.addEventListener('click', () => {
    playSFX('click');
    overlay.remove();
    lesson = null;
    render();
  });
}

function leaveLesson() {
  showConfirmModal(
    t('Leave lesson?','¿Salir de la lección?'),
    t('Your progress in this lesson will be lost.','Tu progreso en esta lección se perderá.'),
    t('Leave','Salir'),
    () => {
      lesson = null;
      render();
    }
  );
}

// ===== CHECKPOINT =====
function startCheckpoint(dayData) {
  const cd = dayData.checkpointData;
  if (!cd || !cd.questions) return;

  let chkState = { answers: {}, submitted: false, dayData };

  const root = document.getElementById('root');
  root.innerHTML = `<div class="top-bar"><div class="top-inner">
    <div class="stat-group">
      <div class="stat gold"><span class="stat-icon pulse-slow">🔥</span><span class="stat-num">${state.streak}</span></div>
      <div class="stat blue"><span class="stat-icon">💎</span><span class="stat-num">${state.gems}</span></div>
    </div>
    <button style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;color:#fff" onclick="render()">✕</button>
  </div></div>
  <div class="checkpoint-view">
    <div class="chk-header">
      <div class="chk-trophy">🏆</div>
      <h2>${t('Checkpoint','Checkpoint')} #${[30,60,90,120,150].indexOf(dayData.day)+1}</h2>
      <p>${cd.intro || (t('Show what you have learned','Demuestra lo que has aprendido'))}</p>
    </div>`;

  cd.questions.forEach((q, i) => {
    root.innerHTML += `<div class="chk-question" id="chkq_${i}">
      <div class="chk-q-text">${i+1}. ${q.q}</div>
      <div class="chk-options">${q.options.map((o, j) => `<div class="chk-option" data-qi="${i}" data-oj="${j}">${o}</div>`).join('')}</div>
      <div class="chk-feedback" id="chkfb_${i}"></div>
    </div>`;
  });

  root.innerHTML += `<div id="chkSubmitArea" style="text-align:center;padding:12px 0 32px">
    <button class="continue-btn" id="chkSubmitBtn">${t('Submit answers','Enviar respuestas')}</button>
  </div>
  <div id="chkResult" style="display:none;text-align:center;padding:24px"></div>`;

  document.querySelectorAll('.chk-option').forEach(el => {
    el.addEventListener('click', () => {
      if (chkState.submitted) return;
      const qi = parseInt(el.dataset.qi);
      const oj = parseInt(el.dataset.oj);
      el.parentElement.querySelectorAll('.chk-option').forEach(o => o.classList.remove('chk-selected'));
      el.classList.add('chk-selected');
      chkState.answers[qi] = oj;
    });
  });

  document.getElementById('chkSubmitBtn').addEventListener('click', () => {
    if (chkState.submitted) return;
    chkState.submitted = true;

    let correct = 0;
    cd.questions.forEach((q, i) => {
      const fb = document.getElementById('chkfb_'+i);
      const opts = document.querySelectorAll(`#chkq_${i} .chk-option`);
      const ans = chkState.answers[i];

      opts.forEach((o, j) => {
        if (j === q.correct) o.classList.add('chk-correct');
        else if (j === ans) o.classList.add('chk-incorrect');
      });

      if (ans === q.correct) { correct++; fb.textContent = '\u2713 ' + t('Correct!','\u00a1Correcto!'); fb.className = 'chk-feedback green'; }
      else { fb.textContent = `\u2717 ${q.options[q.correct]}`; fb.className = 'chk-feedback red'; }
    });

    const pct = Math.round(correct / cd.questions.length * 100);
    const result = document.getElementById('chkResult');
    result.style.display = 'block';
    result.innerHTML = `<div class="chk-big-score">${correct}/${cd.questions.length}</div>
      <div class="chk-result-label">${pct >= 70 ? t('Excellent!','\u00a1Excelente!') : pct >= 50 ? t('Good, keep practicing','Bien, sigue practicando') : t('Keep reviewing','Sigue repasando')}</div>
      <div class="chk-result-sub">${pct >= 70 ? '+50 XP \u00b7 +10 \uD83D\uDC8E' : '+20 XP'}</div>
      <button class="continue-btn" id="chkDoneBtn" style="margin-top:16px">${t('Continue','Continuar')}</button>`;

    if (pct >= 70) {
      addXp(50);
      state.gems += 10;
    } else {
      addXp(20);
    }
    if (!isCompleted(dayData.day)) {
      state.completed.push(dayData.day);
      updateStreak();
    }
    saveState();
    document.getElementById('chkSubmitBtn').disabled = true;
    document.getElementById('chkSubmitBtn').textContent = t('Submitted','Enviado');
    document.getElementById('chkDoneBtn')?.addEventListener('click', () => { lesson = null; render(); });
  });
}

// ===== TOAST =====
function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'toast';
  olParent().appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2200);
}

// ===== SIDE MENU =====
function showSideMenu() {
  const overlay = document.createElement('div');
  overlay.className = 'correction-overlay';
  overlay.style.animation = 'none';
  generateDailyQuests();
  const dueCount = getDueReviews().length;
  const weakCount = state.failedConcepts.length;
  const items = [
    { icon:'📖', labelEn:'Flashcards', labelEs:'Tarjetas', action:'flashcards' },
    { icon:'🔁', labelEn:'Weak Words', labelEs:'Palabras Débiles', count:weakCount, action:'weak' },
    { icon:'🕒', labelEn:'Review', labelEs:'Repasar', count:dueCount, action:'review' },
    { icon:'⚡', labelEn:'Quick Practice', labelEs:'Práctica Rápida', action:'quick' },
    { icon:'📕', labelEn:'Vocabulary', labelEs:'Vocabulario', action:'vocab' },
    { icon:'📊', labelEn:'Stats', labelEs:'Estadísticas', action:'stats' },
    { icon:'🏆', labelEn:'Badges', labelEs:'Insignias', badgeCount:state.badges.length, action:'badges' },
    { icon:'🎯', labelEn:'Daily Quests', labelEs:'Misiones', action:'quests' },
    { icon:'🔊', labelEn:'Voice', labelEs:'Voz', action:'voice' },
    { icon:'💾', labelEn:'Export Progress', labelEs:'Exportar', action:'export' },
    { icon:'📂', labelEn:'Import Progress', labelEs:'Importar', action:'import' },
  ];
  overlay.innerHTML = `<div class="correction-card" style="max-width:320px">
    <div style="font-size:20px;font-weight:700;margin-bottom:16px">☰ ${t('Menu','Menú')}</div>
    ${items.map(item => `<div class="menu-item" data-action="${item.action}" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;cursor:pointer;transition:all .12s;background:transparent">
      <span style="font-size:20px">${item.icon}</span>
      <span style="flex:1;font-size:15px;font-weight:600">${t(item.labelEn, item.labelEs)}</span>
      ${item.count !== undefined ? `<span style="font-size:12px;background:var(--red-bg);color:var(--red-dark);padding:2px 8px;border-radius:10px">${item.count}</span>` : ''}
      ${item.badgeCount !== undefined ? `<span style="font-size:12px;color:var(--gold);font-weight:700">${item.badgeCount}</span>` : ''}
    </div>`).join('')}
    <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px"><button class="understand-btn" id="closeMenuBtn">${t('Close','Cerrar')}</button></div>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  olParent().appendChild(overlay);
  overlay.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => {
      overlay.remove();
      const a = el.dataset.action;
      if (a === 'flashcards') showFlashcards();
      else if (a === 'weak') showWeakWords();
      else if (a === 'review') showReviewSession();
      else if (a === 'quick') startQuickPractice();
      else if (a === 'vocab') showVocabBrowser();
      else if (a === 'stats') showStats();
      else if (a === 'badges') showBadges();
      else if (a === 'quests') showDailyQuests();
      else if (a === 'voice') showVoiceSettings();
      else if (a === 'export') exportProgress();
      else if (a === 'import') importProgress();
    });
  });
  document.getElementById('closeMenuBtn')?.addEventListener('click', () => overlay.remove());
}

// ===== FLASHCARDS =====
function showFlashcards() {
  const words = getAllUnlockedWords();
  if (words.length === 0) { showToast(t('No words yet, complete some lessons!','¡Sin palabras, completa algunas lecciones!')); return; }
  const shuffled = shuffle(words);
  let idx = 0, flipped = false;
  const root = document.getElementById('root');
  function renderFC() {
    const w = shuffled[idx] || shuffled[0];
    if (!w) return;
    const phase = getPhaseForWord(w.es);
    root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Flashcards','Tarjetas')}</div><button class="btn-close" onclick="render()">✕</button></div></div>
      <div class="flashcard-container">
        <div class="flashcard" id="fcCard">
          <div class="front" ${flipped?'style="display:none"':''}>
            <div class="word">${w.es}</div>
            <div class="hint">${t('Tap to reveal','Toca para revelar')}</div>
          </div>
          <div class="back" ${flipped?'':'style="display:none"'}>
            <div class="translation">${w.en}</div>
            <div class="extra">${phase ? `Phase ${phase} · ` : ''}${w.type || t('vocabulary','vocabulario')}</div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:8px">
          <button class="speaker-btn" id="fcSpeakBtn">🔊</button>
        </div>
        <div class="flashcard-nav">
          <button class="fc-prev" id="fcPrev">◀</button>
          <button class="fc-known" id="fcKnown">✓</button>
          <button class="fc-next" id="fcNext">▶</button>
        </div>
        <div class="flashcard-count">${idx+1} / ${shuffled.length}</div>
      </div>`;
    document.getElementById('fcCard')?.addEventListener('click', () => { flipped = !flipped; renderFC(); });
    document.getElementById('fcPrev')?.addEventListener('click', () => { if (idx > 0) { idx--; flipped = false; renderFC(); } });
    document.getElementById('fcNext')?.addEventListener('click', () => { if (idx < shuffled.length - 1) { idx++; flipped = false; renderFC(); } });
    document.getElementById('fcSpeakBtn')?.addEventListener('click', () => speak(w.es, 0.82));
    document.getElementById('fcKnown')?.addEventListener('click', () => {
      if (!state.failedConcepts.find(c => c.es === w.es)) { state.totalCorrect++; state.wordsLearned++; }
      saveState();
      if (idx < shuffled.length - 1) { idx++; flipped = false; renderFC(); } else showToast(t('All done!','¡Completado!'));
    });
    // Keyboard navigation
    const keyHandler = (e) => {
      if (e.key === 'ArrowLeft' && idx > 0) { idx--; flipped = false; renderFC(); document.removeEventListener('keydown', keyHandler); }
      else if (e.key === 'ArrowRight' && idx < shuffled.length - 1) { idx++; flipped = false; renderFC(); document.removeEventListener('keydown', keyHandler); }
      else if (e.key === ' ' || e.key === 'Enter') { flipped = !flipped; renderFC(); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);
  }
  renderFC();
}

function getPhaseForWord(es) {
  for (let p = 1; p <= 5; p++) {
    const vocab = getAllPhaseVocab(p);
    if (vocab.some(v => v.es === es)) return p;
  }
  return null;
}

// ===== WEAK WORDS =====
function showWeakWords() {
  const root = document.getElementById('root');
  const weak = state.failedConcepts;
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Weak Words','Palabras Débiles')}</div><button class="btn-close" onclick="render()">✕</button></div></div>`;
  if (weak.length === 0) {
    root.innerHTML += `<div style="text-align:center;padding:40px;color:var(--text2)">${t('No weak words! Keep it up!','¡Sin palabras débiles! ¡Sigue así!')}</div>`;
  } else {
    const list = document.createElement('div');
    list.className = 'weak-list';
    weak.forEach(w => {
      const item = document.createElement('div');
      item.className = 'weak-item';
      const es = document.createElement('span');
      es.className = 'weak-es';
      es.textContent = w.es || '';
      const en = document.createElement('span');
      en.className = 'weak-en';
      en.textContent = w.en || '';
      const count = document.createElement('span');
      count.className = 'weak-count';
      count.textContent = String(w.count || 1);
      item.appendChild(es); item.appendChild(en); item.appendChild(count);
      list.appendChild(item);
    });
    root.appendChild(list);
  }
  const back = document.createElement('div');
  back.style.cssText = 'text-align:center;padding:12px';
  const backBtn = document.createElement('button');
  backBtn.className = 'reset-btn';
  backBtn.textContent = t('Back','Volver');
  backBtn.onclick = render;
  back.appendChild(backBtn);
  root.appendChild(back);
}

function showReviewSession() {
  const due = getDueReviews();
  if (due.length === 0) {
    showToast(t('No reviews due! You are all caught up.','¡No hay repasos pendientes! Estás al día.'));
    return;
  }
  const syntheticDay = {
    day: 'Review', phase: 1, vocab: { words: due }, exercises: [], checkpoint: false
  };
  const exercises = [];
  due.forEach((word, i) => {
    let ex = null;
    const typeIdx = i % 4;
    if (typeIdx === 0) ex = genChoiceEsToEn([word], new Set());
    else if (typeIdx === 1) ex = genTranslate([word], new Set());
    else if (typeIdx === 2) ex = genChoiceEnToEs([word], new Set());
    else ex = genListen([word], new Set());
    if (ex) exercises.push(ex);
  });
  lesson = {
    dayData: syntheticDay, exercises: exercises, currentIdx: 0, answered: false,
    xpEarned: 0, heartsLost: 0, requeue: [], requeueIdx: 0, failedThisLesson: []
  };
  renderQuestion();
}

function startQuickPractice() {
  const words = getAllUnlockedWords();
  if (words.length < 2) {
    showToast(t('Complete a lesson first!','¡Completa una lección primero!'));
    return;
  }
  const picked = shuffle(words).slice(0, 5);
  const exercises = [];
  picked.forEach((word, i) => {
    let ex = null;
    const typeIdx = i % 3;
    if (typeIdx === 0) ex = genChoiceEsToEn([word], new Set());
    else if (typeIdx === 1) ex = genTranslate([word], new Set());
    else ex = genListen([word], new Set());
    if (ex) exercises.push(ex);
  });
  lesson = {
    dayData: { day: 'Quick', phase: 1, vocab: { words: picked }, exercises: [], checkpoint: false, title: t('Quick Practice','Práctica Rápida') },
    exercises, currentIdx: 0, answered: false,
    xpEarned: 0, heartsLost: 0, requeue: [], requeueIdx: 0, failedThisLesson: []
  };
  renderQuestion();
}

// ===== VOCAB BROWSER =====
function showVocabBrowser() {
  const words = getAllUnlockedWords();
  const root = document.getElementById('root');
    root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Vocabulary','Vocabulario')} <span style="font-weight:400;font-size:13px;color:rgba(255,255,255,.6)">${words.length}</span></div><button class="btn-close" onclick="render()">✕</button></div></div>
    <div style="padding:12px;max-width:480px;margin:0 auto"><input class="search-bar" id="vocabSearch" placeholder="${t('Search words...','Buscar palabras...')}"></div>
    <div class="vocab-list" id="vocabList">${words.map(w => `<div class="vocab-item vocab-entry"><span class="es">${w.es}</span><span class="en">${w.en}</span></div>`).join('')}</div>`;
  document.getElementById('vocabSearch')?.addEventListener('input', function() {
    const q = normalize(this.value);
    document.querySelectorAll('.vocab-entry').forEach(el => {
      el.style.display = normalize(el.querySelector('.es').textContent).includes(q) || normalize(el.querySelector('.en').textContent).includes(q) ? 'flex' : 'none';
    });
  });
}

// ===== STATS =====
function showStats() {
  const root = document.getElementById('root');
  const total = state.totalCorrect + state.totalWrong;
  const acc = total > 0 ? Math.round(state.totalCorrect / total * 100) : 0;
  const wordCount = getAllUnlockedWords().length;
  const lessonsDone = state.completed.filter(d => { const dd = getDayData(d); return dd && !dd.checkpoint; }).length;
  const chkDone = state.completed.filter(d => { const dd = getDayData(d); return dd && dd.checkpoint; }).length;
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Stats','Estadísticas')}</div><button class="btn-close" onclick="render()">✕</button></div></div>
    <div class="stats-grid">
      <div class="stat-card purple"><div class="stat-num-large purple">${acc}%</div><div class="stat-label">${t('Accuracy','Precisión')}</div></div>
      <div class="stat-card green"><div class="stat-num-large green">${state.streak}</div><div class="stat-label">${t('Streak','Racha')}</div></div>
      <div class="stat-card gold"><div class="stat-num-large gold">${state.xp}</div><div class="stat-label">${t('Total XP','XP Total')}</div></div>
      <div class="stat-card blue"><div class="stat-num-large blue">${state.gems}</div><div class="stat-label">${t('Gems','Gemas')}</div></div>
      <div class="stat-card"><div class="stat-num-large">${lessonsDone}</div><div class="stat-label">${t('Lessons','Lecciones')}</div></div>
      <div class="stat-card"><div class="stat-num-large">${chkDone}</div><div class="stat-label">${t('Checkpoints','Checkpoints')}</div></div>
      <div class="stat-card"><div class="stat-num-large">${wordCount}</div><div class="stat-label">${t('Words','Palabras')}</div></div>
      <div class="stat-card"><div class="stat-num-large">${state.totalCorrect}</div><div class="stat-label">${t('Correct','Correctas')}</div></div>
    </div>
    <div style="text-align:center;padding:12px"><button class="reset-btn" onclick="render()">${t('Back','Volver')}</button></div>`;
}

// ===== BADGES =====
function showBadges() {
  const root = document.getElementById('root');
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Badges','Insignias')} <span style="font-weight:400;font-size:13px;color:rgba(255,255,255,.6)">${state.badges.length}/${ALL_BADGES.length}</span></div><button class="btn-close" onclick="render()">✕</button></div></div>
    <div class="badges-grid">${ALL_BADGES.map(b => {
      const earned = state.badges.includes(b.id);
      return `<div class="badge-item ${earned?'':'locked'}"><div class="badge-icon">${b.icon}</div><div class="badge-name">${badgeLabel(b)}</div><div class="badge-desc">${badgeDesc(b)}</div></div>`;
    }).join('')}</div>
    <div style="text-align:center;padding:12px"><button class="reset-btn" onclick="render()">${t('Back','Volver')}</button></div>`;
}

// ===== DAILY QUESTS =====
function showDailyQuests() {
  generateDailyQuests();
  const root = document.getElementById('root');
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Daily Quests','Misiones Diarias')}</div><button class="btn-close" onclick="render()">✕</button></div></div>
    <div class="quests-list">${(state.dailyQuests || []).map(q => {
      const done = q.progress >= q.goal;
      return `<div class="quest-item ${done?'completed':''}"><div class="quest-icon">${q.icon}</div><div class="quest-info"><div class="quest-title">${questLabel(q)}</div><div class="quest-progress">${Math.min(q.progress, q.goal)}/${q.goal}</div></div><div class="quest-check">${done?'✓':''}</div></div>`;
    }).join('')}</div>
    <div style="text-align:center;padding:12px"><button class="reset-btn" onclick="render()">${t('Back','Volver')}</button></div>`;
}

// ===== EXPORT / IMPORT =====
function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'espanol-progress.json';
  a.click();
  showToast(t('Progress exported!','¡Progreso exportado!'));
}
function importProgress() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  olParent().appendChild(input);
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) { input.remove(); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      input.remove();
      try {
        const data = JSON.parse(ev.target.result);
        const isValid = data && typeof data === 'object' && Array.isArray(data.completed)
          && typeof data.xp === 'number' && typeof data.hearts === 'number' && typeof data.streak === 'number';
        if (isValid) {
          state = {
            ...defaultState(),
            ...data,
            xp: Math.max(0, data.xp),
            hearts: Math.min(5, Math.max(0, data.hearts)),
            streak: Math.max(0, data.streak || 0),
            gems: Math.max(0, data.gems || 0)
          };
          saveState(); render(); showToast(t('Progress imported!','¡Progreso importado!'));
        } else showToast(t('Invalid file','Archivo inválido'));
      } catch(err) { input.remove(); showToast(t('Invalid file','Archivo inválido')); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== VOICE SETTINGS =====
function showVoiceSettings() {
  const root = document.getElementById('root');
  const variant = state.spanishVariant || 'es-MX';
  const voices = getSpanishVoices();
  const best = getBestVoice();

  root.innerHTML = `<div class="top-bar"><div class="top-inner">
    <div style="font-size:15px;font-weight:700;flex:1;color:#fff">🔊 ${t('Voice Settings','Configuración de Voz')}</div>
    <button class="btn-close" onclick="render()">✕</button>
  </div></div>
  <div class="voice-page">
    <div class="vs-section">
      <div class="vs-label">${t('Spanish Variant','Variante de Español')}</div>
      <div class="vs-variant-row">
        <button class="vs-variant${variant==='es-MX'?' active':''}" data-variant="es-MX">🌎 ${t('Latin America','Latinoamérica')}</button>
        <button class="vs-variant${variant==='es-ES'?' active':''}" data-variant="es-ES">🇪🇸 ${t('Spain','España')}</button>
      </div>
      <div class="vs-hint">${t('Latin American Spanish is more widely used worldwide.','El español latinoamericano es más usado en el mundo.')}</div>
    </div>
    <div class="vs-section">
      <div class="vs-label">${t('Voice','Voz')}</div>
      ${voices.length === 0 ? `<div class="vs-empty">${t('No Spanish voices found on your device. Try Google Chrome for the best voices.','No se encontraron voces en español en tu dispositivo. Prueba Google Chrome para mejores voces.')}</div>` : ''}
      <div class="vs-list">
        ${voices.map(v => {
          const sel = state.voiceURI === v.voiceURI || (!state.voiceURI && v === best);
          return `<div class="vs-item${sel?' sel':''}" data-uri="${v.voiceURI}">
            <div class="vs-item-name">${v.name}</div>
            <div class="vs-item-lang">${v.lang}${sel ? '  ✓' : ''}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="vs-hint">${t('Google voices (Chrome) sound most natural. Tap a voice to preview and select.','Las voces de Google (Chrome) suenan más naturales. Toca una voz para previsualizar y seleccionar.')}</div>
    </div>
  </div>`;

  document.querySelectorAll('.vs-variant').forEach(btn => {
    btn.addEventListener('click', () => {
      state.spanishVariant = btn.dataset.variant;
      saveState();
      showVoiceSettings();
    });
  });

  document.querySelectorAll('.vs-item').forEach(item => {
    item.addEventListener('click', () => {
      state.voiceURI = item.dataset.uri;
      saveState();
      showVoiceSettings();
      setTimeout(() => speak('Hola, ¿cómo estás?', 0.9), 100);
    });
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initVoices();
  refillHearts();
  applyTheme();
  render();
});
