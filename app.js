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
    totalCorrect:0, totalWrong:0, wordsLearned:0,
    badges:[],
    dailyQuests:null, lastQuestDate:'',
    dailyActivity:{},
    dueReview:{}
  };
}
function t(en, es) { return state.useSpanish ? (es || en) : en; }
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('es150duo'));
    if (s && 'completed' in s) return s;
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
  if (state.hearts < MAX_HEARTS && state.lastHeartRefill === null) state.lastHeartRefill = now();
  if (state.hearts === 0) state.lastHeartRefill = now();
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
  if (word && !state.failedConcepts.find(c => c.es === word)) {
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
    if (b.id === 'checkpoint') earn = true;
    if (b.id === 'phase_5') earn = state.completed.some(d => { const dd = getDayData(d); return dd && dd.phase >= 5; });
    if (b.id === 'gems_100' && state.gems >= 100) earn = true;
    if (earn) { state.badges.push(b.id); saveState(); showToast('🏆 ' + badgeLabel(b)); }
  });
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
  { id:'q_no_mistakes', icon:'💪', nameEn:'Complete a lesson perfectly', nameEs:'Lección perfecta', done:() => 0 },
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
  const due = [];
  Object.keys(state.dueReview).forEach(day => {
    if (state.dueReview[day].length === 0) return;
    const words = state.dueReview[day];
    words.forEach(es => {
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
function speak(text, rate) {
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise(resolve => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = rate || 0.82;
    u.onend = resolve;
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

// ===== CONCEPT INFO BUILDER =====
function getConceptInfo(es, en) {
  const isVerb = /(?:ar|er|ir)$/i.test(es) && es.length > 2;
  const endsO = /o$/.test(es);
  const endsA = /a$/.test(es);
  const isAdjEnding = /able$/.test(es) || /ible$/.test(es) || /[ae]s$/.test(es);
  const hasMulti = es.includes(' ');

  const tc = (e, s) => t(e, s);

  let info = { word: es, translation: en, type: 'vocabulary', typeLabel: tc('Vocabulary','Vocabulario'), gender: null, notes: '', examples: [], bilingualExamples: [], conjugations: [], conjugationDetails: [], verbType: null, relatedForms: [] };

  if (hasMulti) {
    info.type = 'expresi\u00f3n';
    info.typeLabel = tc('Expression','Expresi\u00f3n');
    info.notes = tc(
      `This is a complete expression used as a single unit.`,
      `Esta es una expresión completa usada como una sola unidad.`
    );
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

    const endings = conjType === 'ar' ? ['o','as','a','amos','an'] : conjType === 'er' ? ['o','es','e','emos','en'] : ['o','es','e','imos','en'];
    const subjects = ['yo','t\u00fa','\u00e9l/ella','nosotros','ellos'];
    const subjectEn = ['I','You','He/She','We','They'];
    const enStem = en.replace(/^to\s+/i, '');

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
    return info;
  }

  // Gender-specific word (noun or adjective ending in -o/-a)
  if (endsO || endsA) {
    const root = es.slice(0, -1);
    const masc = endsO ? es : root + 'o';
    const fem = endsA ? es : root + 'a';
    const mascPl = masc + 's';
    const femPl = fem + 's';
    info.gender = endsO ? tc('Masculine','masculino') : tc('Feminine','femenino');

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
      info.type = 'sustantivo';
      info.typeLabel = tc(endsO ? 'Noun (masculine)' : 'Noun (feminine)', endsO ? 'Sustantivo (masculino)' : 'Sustantivo (femenino)');
      info.notes = tc(
        `${endsO ? 'Masculine' : 'Feminine'} noun. The article is "${endsO ? 'el' : 'la'}" in singular, "${endsO ? 'los' : 'las'}" in plural.`,
        `Sustantivo ${endsO ? 'masculino' : 'femenino'}. El artículo es "${endsO ? 'el' : 'la'}" en singular, "${endsO ? 'los' : 'las'}" en plural.`
      );
      info.relatedForms = [es, es + 's'];
      info.examples = [`${endsO ? 'El' : 'La'} ${es} es bonito${endsO ? '' : 'a'}.`, `${endsO ? 'Los' : 'Las'} ${es}s son nuevos${endsO ? '' : 'as'}.`];
      info.bilingualExamples = [
        {es:`${endsO ? 'El' : 'La'} ${es} es bonito${endsO ? '' : 'a'}.`, en:`The ${en} is nice.`},
        {es:`${endsO ? 'Los' : 'Las'} ${es}s son nuevos${endsO ? '' : 'as'}.`, en:`The ${en}s are new.`}
      ];
    }
    return info;
  }

  if (/e$/.test(es) || /[aeiou]s$/.test(es) || /[lnr]/.test(es.slice(-1))) {
    info.type = 'sustantivo';
    info.typeLabel = tc('Noun','Sustantivo');
    info.gender = tc('Common','com\u00fan');
    info.notes = tc(
      `Noun. The article can be "el" or "la" depending on the word.`,
      `Sustantivo. El artículo puede ser "el" o "la" según la palabra.`
    );
    info.examples = [`El ${es} es interesante.`, `Me gusta el ${es}.`];
    info.bilingualExamples = [
      {es:`El ${es} es interesante.`, en:`The ${en} is interesting.`},
      {es:`Me gusta el ${es}.`, en:`I like the ${en}.`}
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
  const distractors = shuffle(vocab.filter((_, i) => i !== idx)).slice(0, 3).map(w => w.en);
  const options = shuffle([word.en, ...distractors]);
  return { id: nextExId(), type:'choice', stem:`¿Qué significa "${word.es}"?`, stemEn:`What does "${word.es}" mean?`, options, correct: options.indexOf(word.en), sourceEs: word.es, sourceEn: word.en };
}

function genChoiceEnToEs(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  const distractors = shuffle(vocab.filter((_, i) => i !== idx)).slice(0, 3).map(w => w.es);
  const options = shuffle([word.es, ...distractors]);
  return { id: nextExId(), type:'choice', stem:`¿Cómo se dice "${word.en}" en español?`, stemEn:`How do you say "${word.en}" in Spanish?`, options, correct: options.indexOf(word.es), sourceEs: word.es, sourceEn: word.en };
}

function genTranslate(vocab, used) {
  const pool = vocab.filter((_, i) => !used.has(i));
  if (pool.length < 1) return null;
  const idx = vocab.indexOf(pool[0]);
  used.add(idx);
  const word = vocab[idx];
  return { id: nextExId(), type:'translate', prompt:`Traduce al español:`, promptEn:`Translate to Spanish:`, target: word.en, answer: word.es, sourceEs: word.es, sourceEn: word.en };
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
  used.add(idx);
  const blankIdx = Math.floor(words.length / 2);
  const answer = words[blankIdx].replace(/[.,!?;:]/g, '');
  const display = words.map((w, i) => i === blankIdx ? '___' : w).join(' ');
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

  if (newType === 'choice') {
    const allVocab = getVocabWords(getDayData(lessonDay));
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
    const dayData = getDayData(lessonDay);
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
  document.body.appendChild(overlay);
  document.getElementById('modalCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('modalConfirm').addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
  if (lesson) { renderQuestion(); return; }
  renderPath(root);
}

// ===== PATH VIEW =====
function renderPath(root) {
  refillHearts();
  const phases = [1,2,3,4,5];
  let html = `<div class="top-bar"><div class="top-inner">
    <div class="stat-group">
      <div class="stat gold"><span class="stat-icon">🔥</span><span class="stat-num">${state.streak}</span></div>
      <div class="stat blue"><span class="stat-icon">💎</span><span class="stat-num">${state.gems}</span></div>
      <div class="stat red"><span class="hearts-display">${Array.from({length:MAX_HEARTS},(_,i)=>`<span class="heart${i<state.hearts?'':' lost'}">❤️</span>`).join('')}</span></div>
    </div>
    <span class="xp-number">${state.xp} XP</span>
    <span class="lang-toggle" id="langToggle">${state.useSpanish?'ES':'EN'}</span>
    <button class="btn-theme" id="themeBtn">${state.darkMode?'☀️':'🌙'}</button>
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
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
}

// ===== LESSON FLOW =====
function startLesson(day) {
  const dayData = getDayData(day);
  if (!dayData) return;
  if (dayData.checkpoint) { startCheckpoint(dayData); return; }

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
    requeueIdx: 0
  };
  render();
  renderQuestion();
}

function renderQuestion() {
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

  let html = `<div class="top-bar"><div class="top-inner">
    <div class="stat-group">
      <div class="stat gold"><span class="stat-icon">🔥</span><span class="stat-num">${state.streak}</span></div>
      <div class="stat blue"><span style="font-size:15px;font-weight:700;color:#fff">+${lesson.xpEarned} XP</span></div>
      <div class="stat red"><span class="hearts-display">${Array.from({length:MAX_HEARTS},(_,i)=>`<span class="heart${i<state.hearts?'':' lost'}">❤️</span>`).join('')}</span></div>
    </div>
    <span class="lang-toggle" id="langToggle">${state.useSpanish?'ES':'EN'}</span>
    <button class="btn-theme" id="themeBtn">${state.darkMode?'☀️':'🌙'}</button>
    <button class="btn-leave" onclick="leaveLesson()">✕</button>
  </div></div>
  <div class="lesson-view">
    <div class="lesson-progress">${progDots}</div>
    ${lesson.phase === 'review' ? `<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">${t('Review Mistakes','Repasar Errores')}</div>` : ''}
    <div class="exercise-card" id="exCard">`;

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
      </div>`;
  } else if (ex.type === 'complete') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <div class="exercise-target">${ex.sentence}</div>
      <div class="translate-wrap">
        <input class="translate-input" id="transInput" placeholder="${t('Type the word...', 'Escribe la palabra...')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>`;
  } else if (ex.type === 'listen') {
    html += `<div class="exercise-prompt">${t(ex.promptEn, ex.prompt)}</div>
      <button class="speaker-btn" id="speakerBtn">🔊</button>
      <div class="translate-wrap">
        <input class="translate-input" id="transInput" placeholder="${t('Type what you hear...', 'Escribe lo que oyes...')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>`;
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
            lesson.xpEarned += XP_PER_CORRECT;
            addXp(XP_PER_CORRECT);
            lesson.answered = true;
            document.querySelectorAll('.match-item-left, .match-item-right').forEach(e => e.style.pointerEvents = 'none');
            showCorrectFeedback(ex);
          }
        } else {
          matchState.errors++;
          loseHeart();
          lesson.heartsLost++;
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
  const keyHandler = (e) => {
    if (ex.type === 'choice' && !lesson.answered) {
      const n = parseInt(e.key);
      if (n >= 1 && n <= 4) { const btn = document.querySelector(`.choice-btn:nth-child(${n})`); if (btn) btn.click(); }
    }
  };
  document.addEventListener('keydown', keyHandler);
  setTimeout(() => document.removeEventListener('keydown', keyHandler), 5000);

  document.getElementById('langToggle')?.addEventListener('click', () => {
    const input = document.getElementById('transInput');
    const savedVal = input?.value || '';
    state.useSpanish = !state.useSpanish;
    saveState();
    renderQuestion();
    setTimeout(() => { const inp = document.getElementById('transInput'); if (inp && savedVal) inp.value = savedVal; }, 0);
  });
  document.getElementById('themeBtn')?.addEventListener('click', () => { state.darkMode = !state.darkMode; saveState(); applyTheme(); renderQuestion(); });
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
    lesson.xpEarned += XP_PER_CORRECT;
    addXp(XP_PER_CORRECT);
    trackCorrect(ex);
    playSFX('correct');
    showCorrectFeedback(ex);
    const audioText = ex.answer || ex.sourceEs || '';
    if (audioText && ex.type !== 'listen') setTimeout(() => speak(audioText, 0.8), 300);
  } else {
    loseHeart();
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
      <div class="feedback-sheet-actions">
        <button class="feedback-sheet-btn secondary" id="explainCorrectBtn">❓ ${t('Explain','Explicar')}</button>
        <button class="feedback-sheet-btn primary" id="continueCorrectBtn">${t('Continue','Continuar')}</button>
      </div>
    </div>
    <div id="explainCorrectArea" style="display:none"></div>`;
  document.body.appendChild(sheet);

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
  document.body.appendChild(sheet);

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

  // Build explanation
  let explanation = '';
  if (isVerb) {
    explanation = `"<b>${wordEs}</b>" means "<b>${wordEn}</b>" in Spanish. It is a ${info.verbType} ${info.typeLabel.toLowerCase()}. ${info.notes}`;
  } else if (info.gender) {
    explanation = `"<b>${wordEs}</b>" means "<b>${wordEn}</b>" in Spanish. It is a ${info.gender} ${info.typeLabel.toLowerCase()}. ${info.notes || ''}`;
  } else {
    explanation = `"<b>${wordEs}</b>" means "<b>${wordEn}</b>" in Spanish. ${info.notes ? info.notes : 'It is a ' + info.typeLabel.toLowerCase() + '.'}`;
  }

  // Build conjugation table HTML for verbs
  let conjHtml = '';
  if (isVerb && info.conjugationDetails && info.conjugationDetails.length) {
    conjHtml = `<div class="conj-section">
      <div class="conj-header">${t('Conjugations','Conjugaciones')}</div>`;
    info.conjugationDetails.forEach(d => {
      conjHtml += `<div class="conj-row">
        <div class="conj-row-header">
          <span class="conj-subject">${d.subject}</span>
          <span class="conj-form">${d.form}</span>
          <span class="conj-en">— ${d.translation}</span>
        </div>`;
      d.examples.forEach(ex => {
        conjHtml += `<div class="conj-example">
          <div class="conj-example-es">${ex.es}</div>
          <div class="conj-example-en">${ex.en}</div>
        </div>`;
      });
      conjHtml += `</div>`;
    });
    conjHtml += `</div>`;
  }

  // Bilingual examples list
  const bex = (info.bilingualExamples || []).filter(e => !e.es.includes(ex.answer || '___')).slice(0, 4);
  const hasBex = bex.length > 0;

  container.style.display = 'block';
  container.innerHTML = `<div class="feedback-sheet-chat" id="explainChat">
    <div class="chat-message duo-message">
      <div class="chat-avatar">🦉</div>
      <div class="chat-bubble">${explanation}</div>
    </div>
    ${conjHtml}
    <div class="chat-actions" id="explainActions">
      ${hasBex ? `<button class="chat-btn secondary" id="exampleBtn">${t('Show me an example','Muéstrame un ejemplo')}</button>` : ''}
      <button class="chat-btn primary" id="gotItBtn">${t('Got it','Entendido')}</button>
    </div>
    <div id="examplesArea" style="display:none"></div>
  </div>`;

  document.getElementById('gotItBtn')?.addEventListener('click', () => {
    playSFX('click');
    container.style.display = 'none';
  });

  document.getElementById('exampleBtn')?.addEventListener('click', () => {
    playSFX('click');
    const examplesArea = document.getElementById('examplesArea');
    if (!examplesArea) return;

    const examplesHtml = bex.map(e => `<div class="example-line-bil">
      <span class="example-es">${e.es}</span>
      <span class="example-en">${e.en}</span>
    </div>`).join('');

    examplesArea.style.display = 'block';
    examplesArea.innerHTML = `<div class="chat-message duo-message" style="margin-top:12px">
      <div class="chat-avatar">🦉</div>
      <div class="chat-bubble">${t('Here are some examples:','Aquí tienes algunos ejemplos:')}${examplesHtml}</div>
    </div>`;

    const actions = document.getElementById('explainActions');
    if (actions) {
      const btn = document.getElementById('exampleBtn');
      if (btn) btn.disabled = true;
    }
  });
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
  const isNew = !isCompleted(lesson.dayData.day);
  if (isNew) {
    state.completed.push(lesson.dayData.day);
    updateStreak();
    state.gems += 5;
    addXp(XP_LESSON_BONUS);
    saveState();
  }

  if (lesson.heartsLost === 0 && lesson.xpEarned > 0 && isNew) {
    if (!state.badges.includes('perfect_lesson')) { state.badges.push('perfect_lesson'); saveState(); showToast('🏆 ' + badgeLabel(ALL_BADGES.find(b => b.id === 'perfect_lesson'))); }
  }
  if (lesson.dayData.checkpoint) {
    if (!state.badges.includes('checkpoint')) { state.badges.push('checkpoint'); saveState(); showToast('🏆 ' + badgeLabel(ALL_BADGES.find(b => b.id === 'checkpoint'))); }
  }
  checkBadges();
  updateQuestProgress();

  const esc = lesson.failedThisLesson || [];
  esc.forEach(es => scheduleReview(lesson.dayData.day, es));

  if (lesson.dayData.checkpoint) playSFX('checkpoint');
  else if (lesson.heartsLost === 0 && isNew) playSFX('levelUp');
  else playSFX('correct');

  const overlay = document.createElement('div');
  overlay.className = 'complete-overlay';
  overlay.innerHTML = `<div class="complete-content">
    <div class="complete-emoji">🎉</div>
    <div class="complete-title">${t('Well done!','\u00a1Bien hecho!')}</div>
    <div class="complete-day">${lesson.dayData.title}</div>
    ${esc.length > 0 ? `<div style="font-size:14px;color:var(--text2);margin-bottom:20px;font-weight:600">${t('Words to practice:','Palabras para practicar:')} ${esc.slice(0,3).join(', ')}${esc.length > 3 ? '...' : ''}</div>` : ''}
    <div class="complete-stats">
      <div class="complete-stat"><div class="complete-stat-num gold">+${lesson.xpEarned + XP_LESSON_BONUS}</div><div class="complete-stat-label">XP</div></div>
      <div class="complete-stat"><div class="complete-stat-num red">${lesson.heartsLost}</div><div class="complete-stat-label">${t('Mistakes','Fallos')}</div></div>
      <div class="complete-stat"><div class="complete-stat-num green">${state.streak}</div><div class="complete-stat-label">${t('Streak','Racha')} 🔥</div></div>
    </div>
    <button class="continue-btn" id="pathBtn">${t('Continue','Continuar')}</button>
  </div>`;

  document.body.appendChild(overlay);
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
      <div class="stat gold"><span class="stat-icon">🔥</span><span class="stat-num">${state.streak}</span></div>
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
  document.body.appendChild(el);
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
    { icon:'📕', labelEn:'Vocabulary', labelEs:'Vocabulario', action:'vocab' },
    { icon:'📊', labelEn:'Stats', labelEs:'Estadísticas', action:'stats' },
    { icon:'🏆', labelEn:'Badges', labelEs:'Insignias', badgeCount:state.badges.length, action:'badges' },
    { icon:'🎯', labelEn:'Daily Quests', labelEs:'Misiones', action:'quests' },
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
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => {
      overlay.remove();
      const a = el.dataset.action;
      if (a === 'flashcards') showFlashcards();
      else if (a === 'weak') showWeakWords();
      else if (a === 'vocab') showVocabBrowser();
      else if (a === 'stats') showStats();
      else if (a === 'badges') showBadges();
      else if (a === 'quests') showDailyQuests();
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
    root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Flashcards','Tarjetas')}</div><button class="btn-leave" onclick="render()">✕</button></div></div>
      <div class="flashcard-container">
        <div class="flashcard" id="fcCard">
          <div class="front" ${flipped?'style="display:none"':''}>
            <div class="word">${w.es}</div>
            <div class="hint">${t('Tap to reveal','Toca para revelar')}</div>
          </div>
          <div class="back" ${flipped?'':'style="display:none"'}>
            <div class="translation">${w.en}</div>
            <div class="extra">${t('Type','Tipo')}: ${w.type || t('vocabulary','vocabulario')}</div>
          </div>
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
    document.getElementById('fcKnown')?.addEventListener('click', () => {
      if (!state.failedConcepts.find(c => c.es === w.es)) { state.totalCorrect++; state.wordsLearned++; }
      saveState();
      if (idx < shuffled.length - 1) { idx++; flipped = false; renderFC(); } else showToast(t('All done!','¡Completado!'));
    });
  }
  renderFC();
}

// ===== WEAK WORDS =====
function showWeakWords() {
  const root = document.getElementById('root');
  const weak = state.failedConcepts;
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Weak Words','Palabras Débiles')}</div><button class="btn-leave" onclick="render()">✕</button></div></div>
    ${weak.length === 0 ? `<div style="text-align:center;padding:40px;color:var(--text2)">${t('No weak words! Keep it up!','¡Sin palabras débiles! ¡Sigue así!')}</div>` : `<div class="weak-list">${weak.map(w => `<div class="weak-item"><span class="weak-es">${w.es}</span><span class="weak-en">${w.en}</span><span class="weak-count">${w.count||1}</span></div>`).join('')}</div>`}
    <div style="text-align:center;padding:12px"><button class="reset-btn" onclick="render()">${t('Back','Volver')}</button></div>`;
}

// ===== VOCAB BROWSER =====
function showVocabBrowser() {
  const words = getAllUnlockedWords();
  const root = document.getElementById('root');
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Vocabulary','Vocabulario')} <span style="font-weight:400;font-size:13px;color:rgba(255,255,255,.6)">${words.length}</span></div><button class="btn-leave" onclick="render()">✕</button></div></div>
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
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Stats','Estadísticas')}</div><button class="btn-leave" onclick="render()">✕</button></div></div>
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
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Badges','Insignias')} <span style="font-weight:400;font-size:13px;color:rgba(255,255,255,.6)">${state.badges.length}/${ALL_BADGES.length}</span></div><button class="btn-leave" onclick="render()">✕</button></div></div>
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
  root.innerHTML = `<div class="top-bar"><div class="top-inner"><div style="font-size:15px;font-weight:700;flex:1;color:#fff">${t('Daily Quests','Misiones Diarias')}</div><button class="btn-leave" onclick="render()">✕</button></div></div>
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
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data && 'completed' in data) { state = data; saveState(); render(); showToast(t('Progress imported!','¡Progreso importado!')); }
        else showToast(t('Invalid file','Archivo inválido'));
      } catch(err) { showToast(t('Invalid file','Archivo inválido')); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  refillHearts();
  applyTheme();
  render();
});
