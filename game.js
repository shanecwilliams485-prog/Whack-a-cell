import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSTHZL4NQinlMJhW5AUi-02asn9Lmid04",
  authDomain: "whack-a-cell-score-sheet.firebaseapp.com",
  projectId: "whack-a-cell-score-sheet",
  storageBucket: "whack-a-cell-score-sheet.firebasestorage.app",
  messagingSenderId: "661513148121",
  appId: "1:661513148121:web:e9873faa4f985ab6f1d0c8"
};

let firebaseReady = false;
let db = null;
let scoresCollection = null;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  scoresCollection = collection(db, 'scores');
  firebaseReady = true;
} catch (error) {
  console.warn('Firebase leaderboard unavailable. Local scores will still work.', error);
}

const board = document.getElementById('board');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const bestEl = document.getElementById('best');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const tutorialScreen = document.getElementById('tutorialScreen');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialText = document.getElementById('tutorialText');
const tutorialContinueBtn = document.getElementById('tutorialContinueBtn');
const tutorialToggle = document.getElementById('tutorialToggle');
const bonusScreen = document.getElementById('bonusScreen');
const bonusTitle = document.getElementById('bonusTitle');
const bonusTimer = document.getElementById('bonusTimer');
const bonusHelp = document.getElementById('bonusHelp');
const bonusResult = document.getElementById('bonusResult');
const bonusCanvas = document.getElementById('bonusCanvas');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const smoke = document.getElementById('smoke');
const toast = document.getElementById('toast');
const levelBanner = document.getElementById('levelBanner');
const countdown = document.getElementById('countdown');
const finalLoseText = document.getElementById('finalLoseText');
const showScoresBtn = document.getElementById('showScoresBtn');
const scoresScreen = document.getElementById('scoresScreen');
const scoresList = document.getElementById('scoresList');
const closeScoresBtn = document.getElementById('closeScoresBtn');
const nameForm = document.getElementById('nameForm');
const playerName = document.getElementById('playerName');
const finalWhackScore = document.getElementById('finalWhackScore');
const finalBonusScore = document.getElementById('finalBonusScore');
const finalTotalScore = document.getElementById('finalTotalScore');

for (let i = 0; i < 36; i++) {
  const button = document.createElement('button');
  button.className = 'hole';
  button.setAttribute('aria-label', `Cell position ${i + 1}`);
  board.appendChild(button);
}

const holes = [...document.querySelectorAll('.hole')];
const ctx = bonusCanvas.getContext('2d');

const state = {
  mode: 'idle',
  running: false,
  score: 0,
  level: 1,
  activeIndex: -1,
  popTimer: null,
  warningTimer: null,
  failTimer: null,
  countdownTimer: null,
  completedBonuses: new Set(),
  pendingTutorial: null,
  best: Number(localStorage.getItem('whackACellBest') || 0),
  bonusScore: 0,
  scoreSaved: false,
};

const bonus = {
  type: null,
  start: 0,
  raf: null,
  last: 0,
  pointerDown: new Map(),
  shieldAngle: -Math.PI / 2,
  debris: [],
  debrisSpawn: 0,
  pressures: [0, 0, 0, 0],
  tubeRates: [0.13, 0.15, 0.12, 0.16],
  musicTimer: null,
  musicStarted: 0,
  musicType: null,
  basePoints: 0,
  blocks: 0,
  swipes: 0,
  finished: false,
};

bestEl.textContent = state.best;

const SCOREBOARD_KEY = 'whackACellScoreboard';
const MAX_SCORES = 20;

function loadLocalScores() {
  try {
    const raw = localStorage.getItem(SCOREBOARD_KEY);
    const scores = raw ? JSON.parse(raw) : [];
    return Array.isArray(scores) ? scores : [];
  } catch (error) {
    return [];
  }
}

function saveLocalScores(scores) {
  localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scores.slice(0, MAX_SCORES)));
}

async function loadSharedScores() {
  if (!firebaseReady || !scoresCollection) return [];
  try {
    const q = query(scoresCollection, orderBy('score', 'desc'), limit(MAX_SCORES));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name || 'Player',
        score: Number(data.score || 0),
        bonus: Number(data.bonus || 0),
        level: Number(data.level || 1),
        date: data.date || data.createdAt?.toMillis?.() || Date.now(),
        shared: true
      };
    });
  } catch (error) {
    console.warn('Could not load shared scores. Falling back to local scores.', error);
    return [];
  }
}

async function addSharedScore(entry) {
  if (!firebaseReady || !scoresCollection) return false;
  try {
    await addDoc(scoresCollection, {
      name: entry.name,
      score: entry.score,
      whack: entry.whack,
      bonus: entry.bonus,
      level: entry.level,
      date: entry.date,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.warn('Could not save shared score. Saved locally only.', error);
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function sortScores(scores) {
  return scores
    .filter(entry => Number.isFinite(Number(entry.score)))
    .sort((a, b) => Number(b.score) - Number(a.score) || Number(b.date || 0) - Number(a.date || 0))
    .slice(0, MAX_SCORES);
}

async function renderScores(autoScroll = false) {
  scoresList.innerHTML = '<p class="empty-scores">Loading shared best scores...</p>';
  scoresList.classList.remove('auto-scroll');

  const sharedScores = await loadSharedScores();
  const localScores = loadLocalScores();
  const scores = sortScores(sharedScores.length ? sharedScores : localScores);

  if (!scores.length) {
    scoresList.innerHTML = firebaseReady
      ? '<p class="empty-scores">No shared scores saved yet. Be the first cell whacker.</p>'
      : '<p class="empty-scores">No local scores saved yet. Firebase is unavailable on this device.</p>';
    return;
  }

  scoresList.innerHTML = scores.map((entry, index) => {
    const when = entry.date ? new Date(entry.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '';
    const bonusText = entry.bonus ? ` <small>bonus +${entry.bonus}</small>` : '';
    const source = entry.shared ? '<small>shared</small>' : '<small>local</small>';
    return `<div class="score-row"><span class="rank">#${index + 1}</span><strong>${escapeHtml(entry.name || 'Player')}</strong><span>${entry.score}${bonusText}</span><em>${when} ${source}</em></div>`;
  }).join('');

  scoresList.classList.toggle('auto-scroll', autoScroll && scores.length > 5);
}

async function showScores(autoScroll = false) {
  startScreen.classList.remove('show');
  gameOverScreen.classList.remove('show');
  tutorialScreen.classList.remove('show');
  bonusScreen.classList.remove('show');
  scoresScreen.classList.add('show');
  await renderScores(autoScroll);
}

function hideScores() {
  scoresScreen.classList.remove('show');
  bootToStartScreen();
}

function updateFinalBreakdown() {
  const whackPoints = state.score;
  const bonusPoints = state.bonusScore;
  const total = whackPoints + bonusPoints;
  if (total > state.best) {
    state.best = total;
    localStorage.setItem('whackACellBest', String(state.best));
    updateHud();
  }
  if (finalWhackScore) finalWhackScore.textContent = String(whackPoints);
  if (finalBonusScore) finalBonusScore.textContent = `+${bonusPoints}`;
  if (finalTotalScore) finalTotalScore.textContent = `${whackPoints} + ${bonusPoints} = ${total}`;
}

async function submitFinalScore(event) {
  event.preventDefault();
  if (state.scoreSaved) {
    await showScores(true);
    return;
  }

  const cleanName = (playerName?.value || 'Player').trim().slice(0, 16) || 'Player';
  const totalScore = state.score + state.bonusScore;
  const entry = { name: cleanName, score: totalScore, whack: state.score, bonus: state.bonusScore, level: state.level, date: Date.now() };

  const localScores = loadLocalScores();
  localScores.push(entry);
  saveLocalScores(sortScores(localScores));

  const saveBtn = document.getElementById('saveScoreBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  const savedOnline = await addSharedScore(entry);
  state.scoreSaved = true;

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = savedOnline ? 'Saved Online!' : 'Saved Locally';
  }

  await showScores(true);
}


let audioCtx;

function setupAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 440, length = 0.08, type = 'square', gain = 0.05) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, audioCtx.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + length);
  osc.connect(vol).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + length);
}

function hitBuzz() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Sharp electrical zap: high-voltage snap, pitch dive, and noisy crackle.
  const freqs = [3600, 2100, 1450, 720];
  freqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const vol = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = i % 2 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(freq, now + i * 0.006);
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.22), now + 0.085 + i * 0.008);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 0.75, now);
    filter.Q.value = 7;
    vol.gain.setValueAtTime(0.09 / (i + 1), now + i * 0.006);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + 0.095 + i * 0.008);
    osc.connect(filter).connect(vol).connect(audioCtx.destination);
    osc.start(now + i * 0.006);
    osc.stop(now + 0.12);
  });

  const size = Math.floor(audioCtx.sampleRate * 0.095);
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const spark = Math.random() > 0.64 ? 1 : -1;
    data[i] = spark * Math.random() * (1 - i / size);
  }
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const vol = audioCtx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 1200;
  vol.gain.setValueAtTime(0.16, now);
  vol.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  src.buffer = buffer;
  src.connect(filter).connect(vol).connect(audioCtx.destination);
  src.start(now);
}

function makeNoise(seconds, gainValue, filterType = 'lowpass', frequency = 900) {
  if (!audioCtx) return null;
  const size = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size * 0.65);
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const vol = audioCtx.createGain();
  filter.type = filterType;
  filter.frequency.value = frequency;
  vol.gain.setValueAtTime(gainValue, audioCtx.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + seconds);
  src.buffer = buffer;
  src.connect(filter).connect(vol).connect(audioCtx.destination);
  src.start();
  return src;
}

function flameRoar() {
  if (!audioCtx) return;
  makeNoise(1.45, 0.22, 'lowpass', 760);
  beep(70, 0.7, 'sawtooth', 0.05);
  setTimeout(() => beep(95, 0.42, 'sawtooth', 0.04), 160);
}

function smokeRush() {
  if (!audioCtx) return;
  makeNoise(2.4, 0.18, 'bandpass', 360);
  setTimeout(() => makeNoise(1.6, 0.11, 'lowpass', 210), 450);
}

function loseMelody() {
  if (!audioCtx) return;
  const notes = [392, 370, 349, 330, 311, 294, 262];
  notes.forEach((note, index) => {
    setTimeout(() => beep(note, index === notes.length - 1 ? 0.38 : 0.16, 'triangle', 0.075), index * 150);
  });
  setTimeout(() => beep(131, 0.55, 'sawtooth', 0.045), notes.length * 150 + 80);
}

function bonusPing() {
  beep(780, 0.06, 'triangle', 0.055);
  setTimeout(() => beep(1040, 0.06, 'triangle', 0.045), 70);
}

function playBonusBeat(type, elapsed = 0) {
  if (!audioCtx) return;
  const intensity = Math.min(1, elapsed / 15);
  const now = audioCtx.currentTime;

  makeNoise(0.09, 0.06 + intensity * 0.045, 'highpass', type === 'shield' ? 900 : 620);
  beep(type === 'shield' ? 82 : 62, 0.08, 'sawtooth', 0.065 + intensity * 0.025);

  const notes = type === 'shield' ? [330, 392, 466, 554] : [220, 247, 294, 330];
  const note = notes[Math.floor((elapsed * 8) % notes.length)];
  setTimeout(() => beep(note + intensity * 80, 0.055, 'square', 0.035), 45);
  if (intensity > 0.45) setTimeout(() => beep(note * 1.5, 0.04, 'sawtooth', 0.028), 88);
  if (intensity > 0.72) setTimeout(() => makeNoise(0.045, 0.045, 'bandpass', 1500), 105);
}

function startBonusMusic(type) {
  stopBonusMusic();
  if (!audioCtx) return;
  bonus.musicType = type;
  bonus.musicStarted = performance.now();

  const tick = () => {
    if (state.mode !== 'bonus' || bonus.musicType !== type) {
      stopBonusMusic();
      return;
    }
    const elapsed = (performance.now() - bonus.musicStarted) / 1000;
    playBonusBeat(type, elapsed);
    const next = Math.max(90, 360 - elapsed * 17);
    bonus.musicTimer = setTimeout(tick, next);
  };
  tick();
}

function stopBonusMusic() {
  if (bonus.musicTimer) clearTimeout(bonus.musicTimer);
  bonus.musicTimer = null;
  bonus.musicType = null;
}

function clearAllTimers() {
  clearTimeout(state.popTimer);
  clearTimeout(state.warningTimer);
  clearTimeout(state.failTimer);
  clearTimeout(state.countdownTimer);
  stopBonusMusic();
}

function resetHoles() {
  holes.forEach(h => {
    h.classList.remove('active', 'warning', 'whacked', 'bursting');
    h.querySelector('.cap-pop')?.remove();
  });
  state.activeIndex = -1;
}

function popDelay() {
  return Math.max(280, 760 - state.level * 48);
}

function visibleTime() {
  return Math.max(420, 1320 - state.level * 72);
}

function updateHud() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  bestEl.textContent = state.best;
}

function showToast(message, duration = 1300) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function showLevelBanner(message, duration = 1500) {
  levelBanner.textContent = message;
  levelBanner.classList.add('show');
  setTimeout(() => levelBanner.classList.remove('show'), duration);
}

function nextPop() {
  if (!state.running || state.mode !== 'whack') return;
  resetHoles();
  const index = Math.floor(Math.random() * holes.length);
  state.activeIndex = index;
  const hole = holes[index];
  hole.classList.add('active');
  beep(230 + state.level * 18, 0.045, 'triangle', 0.03);

  const time = visibleTime();
  state.warningTimer = setTimeout(() => hole.classList.add('warning'), time * 0.62);
  state.failTimer = setTimeout(() => gameOver(index), time);
}

function scheduleNextPop() {
  clearTimeout(state.popTimer);
  state.popTimer = setTimeout(nextPop, popDelay());
}

function levelFromScore(score) {
  return Math.min(20, Math.floor(score / 8) + 1);
}

function whack(index) {
  if (!state.running || state.mode !== 'whack' || index !== state.activeIndex) return;
  clearTimeout(state.warningTimer);
  clearTimeout(state.failTimer);
  state.score += 1;
  holes[index].classList.add('whacked');
  hitBuzz();

  const oldLevel = state.level;
  state.level = levelFromScore(state.score);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('whackACellBest', String(state.best));
  }

  updateHud();
  resetHoles();

  if (state.level !== oldLevel) {
    showLevelBanner(`LEVEL UP! LEVEL ${state.level}`, 1700);
    beep(740, 0.08, 'triangle', 0.06);
    setTimeout(() => beep(980, 0.08, 'triangle', 0.06), 95);

    if (state.level === 5 && !state.completedBonuses.has(5)) {
      state.completedBonuses.add(5);
      requestBonusRound('shield');
      return;
    }
    if (state.level === 10 && !state.completedBonuses.has(10)) {
      state.completedBonuses.add(10);
      requestBonusRound('pressure');
      return;
    }
  }

  scheduleNextPop();
}

function addCapPop(hole) {
  const cap = document.createElement('span');
  cap.className = 'cap-pop';
  hole.appendChild(cap);
}

function gameOver(index = null, message = 'YOU LOSE PAL') {
  if (state.mode === 'gameover') return;
  state.running = false;
  state.mode = 'gameover';
  clearAllTimers();
  stopBonusLoop();
  bonusScreen.classList.remove('show');
  updateHud();

  if (index !== null && holes[index]) {
    const hole = holes[index];
    hole.classList.add('active', 'warning', 'bursting');
    addCapPop(hole);
  }

  showLevelBanner('THERMAL RUNAWAY!', 2200);
  flameRoar();
  setTimeout(smokeRush, 350);
  setTimeout(() => smoke.classList.add('show'), 500);
  setTimeout(() => loseMelody(), 1250);
  setTimeout(() => {
    finalLoseText.textContent = message;
    finalLoseText.classList.add('show');
  }, 2100);
  setTimeout(() => {
    updateFinalBreakdown();
    if (playerName) playerName.value = '';
    gameOverScreen.classList.add('show');
    setTimeout(() => playerName?.focus(), 250);
  }, 3350);
}

function showTutorial(title, text, onContinue) {
  clearAllTimers();
  state.pendingTutorial = onContinue;
  tutorialTitle.textContent = title;
  tutorialText.textContent = text;
  tutorialScreen.classList.add('show');
}

function continueTutorial() {
  setupAudio();
  const next = state.pendingTutorial;
  state.pendingTutorial = null;
  tutorialScreen.classList.remove('show');
  if (typeof next === 'function') next();
}

function runCountdownThenStart(callback = beginWhackMode) {
  const items = ['3', '2', '1', 'GOOD LUCK'];
  let i = 0;
  countdown.classList.remove('good-luck');
  countdown.textContent = items[i];
  countdown.classList.add('show');
  beep(520, 0.08, 'triangle', 0.065);

  const tick = () => {
    i++;
    if (i >= items.length) {
      countdown.classList.remove('show', 'good-luck');
      callback();
      return;
    }
    countdown.classList.remove('show');
    void countdown.offsetWidth;
    countdown.textContent = items[i];
    countdown.classList.toggle('good-luck', items[i] === 'GOOD LUCK');
    countdown.classList.add('show');
    beep(items[i] === 'GOOD LUCK' ? 760 : 520, items[i] === 'GOOD LUCK' ? 0.15 : 0.08, 'triangle', 0.065);
    state.countdownTimer = setTimeout(tick, items[i] === 'GOOD LUCK' ? 800 : 650);
  };

  state.countdownTimer = setTimeout(tick, 650);
}

function beginWhackMode() {
  state.running = true;
  state.mode = 'whack';
  updateHud();
  showLevelBanner(`LEVEL ${state.level}`, 1200);
  scheduleNextPop();
}

function startGame() {
  setupAudio();
  clearAllTimers();
  stopBonusLoop();
  startScreen.classList.remove('show');
  gameOverScreen.classList.remove('show');
  scoresScreen?.classList.remove('show');
  bonusScreen.classList.remove('show');
  if (bonusResult) bonusResult.classList.remove('show');
  tutorialScreen.classList.remove('show');
  smoke.classList.remove('show');
  finalLoseText.classList.remove('show');
  countdown.classList.remove('show', 'good-luck');
  state.running = false;
  state.mode = 'countdown';
  state.score = 0;
  state.level = 1;
  state.completedBonuses = new Set();
  state.bonusScore = 0;
  state.scoreSaved = false;
  resetHoles();
  updateHud();
  const begin = () => runCountdownThenStart(beginWhackMode);
  if (tutorialToggle?.checked) {
    showTutorial('QUICK TUITION', 'Tap the battery cells as soon as they pop up. If a cell shakes too long, it bursts into flame and smoke. Reach level 5 and 10 to unlock bonus rounds.', begin);
  } else {
    begin();
  }
}

function requestBonusRound(type) {
  const title = type === 'shield' ? 'LEVEL 5 BONUS: MAGNETIC DEFLECTOR' : 'LEVEL 10 BONUS: PRESSURE RELEASE';
  const text = type === 'shield'
    ? 'Protect the glowing centre core. Drag your finger around the circle to move the curved magnetic shield. Block the incoming spikes for 15 seconds. Near the end, the spikes curve and overlap.'
    : 'Four battery tubes are filling with pressure. Swipe DOWN on a tube to dump it back to zero. Last 15 seconds. Near the end, use more than one finger because the tubes rise fast.';

  if (tutorialToggle?.checked) {
    showTutorial(title, text, () => launchBonusRound(type));
  } else {
    launchBonusRound(type);
  }
}

function launchBonusRound(type) {
  clearAllTimers();
  resetHoles();
  state.running = false;
  state.mode = 'bonus';
  bonus.type = type;
  bonus.start = performance.now();
  bonus.last = bonus.start;
  bonus.debris = [];
  bonus.debrisSpawn = 0;
  bonus.shieldAngle = -Math.PI / 2;
  bonus.pressures = [0.15, 0.05, 0.1, 0.0];
  bonus.tubeRates = [0.13, 0.15, 0.12, 0.16];
  bonus.basePoints = 0;
  bonus.blocks = 0;
  bonus.swipes = 0;
  bonus.finished = false;
  if (bonusResult) { bonusResult.classList.remove('show'); bonusResult.textContent = ''; }

  bonusTitle.textContent = type === 'shield' ? 'LEVEL 5 BONUS: MAGNETIC DEFLECTOR' : 'LEVEL 10 BONUS: PRESSURE RELEASE';
  bonusHelp.textContent = type === 'shield'
    ? 'Drag around the core to move the curved shield. Block spikes for 15 seconds. Bonus points are doubled and banked until the final score screen.'
    : 'Swipe down on each tube to dump pressure to zero. Bonus points are doubled and banked until the final score screen.';
  bonusScreen.classList.add('show');
  resizeCanvas();
  showLevelBanner(type === 'shield' ? 'BONUS ROUND!' : 'BONUS ROUND 2!', 1500);
  bonusPing();
  startBonusMusic(type);
  bonus.raf = requestAnimationFrame(bonusLoop);
}

function stopBonusLoop() {
  if (bonus.raf) cancelAnimationFrame(bonus.raf);
  bonus.raf = null;
}

function finishBonus(success = true, reason = '') {
  if (bonus.finished) return;
  bonus.finished = true;
  stopBonusLoop();
  stopBonusMusic();

  const survivalSeconds = Math.max(0, Math.min(15, (performance.now() - bonus.start) / 1000));
  const survivalPoints = 0;
  const completionPoints = success ? 5 : 0;
  const base = Math.max(0, Math.floor(bonus.basePoints + survivalPoints + completionPoints));
  const award = base * 2;

  state.bonusScore += award;
  updateHud();

  const title = success ? 'BONUS COMPLETE!' : 'BONUS FAILED — GAME CONTINUES';
  const details = `${title}  Bonus ${base} × 2 = +${award} banked for the final score`; 
  if (bonusResult) {
    bonusResult.textContent = details;
    bonusResult.classList.add('show');
  }
  bonusHelp.textContent = reason || details;
  showLevelBanner(success ? `BONUS BANKED! +${award}` : `PARTIAL BONUS BANKED! +${award}`, 1800);

  if (success) {
    beep(840, 0.08, 'triangle', 0.06);
    setTimeout(() => beep(1120, 0.11, 'triangle', 0.06), 100);
  } else {
    flameRoar();
    setTimeout(() => beep(220, 0.16, 'sawtooth', 0.055), 140);
  }

  setTimeout(() => {
    bonusScreen.classList.remove('show');
    if (bonusResult) bonusResult.classList.remove('show');
    beginWhackMode();
  }, 1700);
}

function completeBonus() {
  finishBonus(true);
}

function failBonus(reason = 'Bonus failed, but the main game continues.') {
  finishBonus(false, reason);
}

function resizeCanvas() {
  const rect = bonusCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  bonusCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  bonusCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function bonusLoop(now) {
  const dt = Math.min(0.04, (now - bonus.last) / 1000 || 0.016);
  bonus.last = now;
  const elapsed = (now - bonus.start) / 1000;
  const remain = Math.max(0, 15 - elapsed);
  bonusTimer.textContent = `${remain.toFixed(1)}s · banked bonus ${Math.floor(bonus.basePoints)} ×2`;

  if (bonus.type === 'shield') updateShieldBonus(dt, elapsed);
  if (bonus.type === 'pressure') updatePressureBonus(dt, elapsed);
  if (bonus.finished) return;

  if (remain <= 0) {
    completeBonus();
    return;
  }

  bonus.raf = requestAnimationFrame(bonusLoop);
}

function clearCanvas() {
  const rect = bonusCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  return rect;
}

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function spawnDebris(rect, elapsed) {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = Math.random() * rect.width; y = -16; }
  if (edge === 1) { x = rect.width + 16; y = Math.random() * rect.height; }
  if (edge === 2) { x = Math.random() * rect.width; y = rect.height + 16; }
  if (edge === 3) { x = -16; y = Math.random() * rect.height; }
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const dx = cx - x;
  const dy = cy - y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = bonus.type === 'shield'
    ? 95 + elapsed * 12 + Math.random() * 30
    : 135 + elapsed * 14 + Math.random() * 40;
  bonus.debris.push({
    x, y,
    vx: dx / len * speed,
    vy: dy / len * speed,
    curve: (Math.random() - 0.5) * (elapsed > 9 ? 120 : elapsed > 5 ? 50 : 18),
    r: 6 + Math.random() * 4,
    colorShift: Math.random(),
  });
}

function updateShieldBonus(dt, elapsed) {
  const rect = clearCanvas();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const coreR = Math.min(rect.width, rect.height) * 0.075;
  const shieldR = Math.min(rect.width, rect.height) * 0.235;
  const spawnRate = Math.max(0.18, 1.15 - elapsed * 0.065);

  bonus.debrisSpawn -= dt;
  while (bonus.debrisSpawn <= 0) {
    spawnDebris(rect, elapsed);
    if (elapsed > 11 && Math.random() < 0.5) spawnDebris(rect, elapsed);
    if (elapsed > 13 && Math.random() < 0.35) spawnDebris(rect, elapsed);
    bonus.debrisSpawn += spawnRate;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, coreR * 1.6);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, '#67e8f9');
  grad.addColorStop(1, '#2563eb');
  ctx.fillStyle = grad;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, shieldR, bonus.shieldAngle - 0.66, bonus.shieldAngle + 0.66);
  ctx.stroke();
  ctx.restore();

  for (let i = bonus.debris.length - 1; i >= 0; i--) {
    const d = bonus.debris[i];
    const ox = d.x - cx;
    const oy = d.y - cy;
    const len = Math.hypot(ox, oy) || 1;
    d.vx += (-oy / len) * d.curve * dt;
    d.vy += (ox / len) * d.curve * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    const dist = Math.hypot(d.x - cx, d.y - cy);
    const angle = Math.atan2(d.y - cy, d.x - cx);
    const shieldHit = dist < shieldR + 18 && dist > shieldR - 28 && Math.abs(angleDiff(angle, bonus.shieldAngle)) < 0.74;
    if (shieldHit) {
      bonus.debris.splice(i, 1);
      bonus.blocks += 1;
      bonus.basePoints += 1;
      hitBuzz();
      continue;
    }
    if (dist < coreR + d.r) {
      failBonus('Core hit! Partial bonus points added. Back to Whack-a-Cell...');
      return;
    }

    ctx.fillStyle = d.colorShift > 0.5 ? '#fb7185' : '#f97316';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function updatePressureBonus(dt, elapsed) {
  const rect = clearCanvas();
  const margin = 18;
  const gap = 12;
  const tubeW = (rect.width - margin * 2 - gap * 3) / 4;
  const tubeH = rect.height * 0.72;
  const top = rect.height * 0.15;
  const accel = 1 + elapsed * 0.16;

  for (let i = 0; i < 4; i++) {
    bonus.pressures[i] += bonus.tubeRates[i] * accel * dt;
    if (elapsed > 9) bonus.pressures[i] += Math.sin(elapsed * 6 + i) * 0.018 * dt;
    if (bonus.pressures[i] >= 1) {
      failBonus('A tube ruptured! Partial bonus points added. Back to Whack-a-Cell...');
      return;
    }
  }

  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    const x = margin + i * (tubeW + gap);
    const pressure = Math.max(0, Math.min(1, bonus.pressures[i]));
    const fillH = tubeH * pressure;

    ctx.strokeStyle = 'rgba(226,232,240,0.72)';
    ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    roundRect(ctx, x, top, tubeW, tubeH, 18, true, true);

    const fillGrad = ctx.createLinearGradient(0, top + tubeH, 0, top);
    fillGrad.addColorStop(0, '#22c55e');
    fillGrad.addColorStop(0.55, '#facc15');
    fillGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = fillGrad;
    roundRect(ctx, x + 6, top + tubeH - fillH + 6, tubeW - 12, Math.max(0, fillH - 12), 12, true, false);

    ctx.fillStyle = pressure > 0.75 ? '#fecaca' : '#e0f2fe';
    ctx.fillText(`TUBE ${i + 1}`, x + tubeW / 2, top + tubeH + 25);

    if (pressure > 0.82) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 3, top - 3, tubeW + 6, tubeH + 6);
    }
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function canvasPoint(event) {
  const rect = bonusCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect };
}

function handleBonusPointerDown(event) {
  if (state.mode !== 'bonus') return;
  event.preventDefault();
  setupAudio();
  const p = canvasPoint(event);
  bonus.pointerDown.set(event.pointerId, { x: p.x, y: p.y, t: performance.now() });
  if (bonus.type === 'shield') updateShieldFromPoint(p.x, p.y, p.rect);
}

function handleBonusPointerMove(event) {
  if (state.mode !== 'bonus') return;
  event.preventDefault();
  const p = canvasPoint(event);
  if (bonus.type === 'shield') updateShieldFromPoint(p.x, p.y, p.rect);
}

function handleBonusPointerUp(event) {
  if (state.mode !== 'bonus') return;
  event.preventDefault();
  const start = bonus.pointerDown.get(event.pointerId);
  bonus.pointerDown.delete(event.pointerId);
  if (bonus.type !== 'pressure' || !start) return;
  const p = canvasPoint(event);
  const dy = p.y - start.y;
  const dx = Math.abs(p.x - start.x);
  if (dy < 34 || dx > 90) return;

  const margin = 18;
  const gap = 12;
  const tubeW = (p.rect.width - margin * 2 - gap * 3) / 4;
  const index = Math.floor((start.x - margin) / (tubeW + gap));
  const localX = (start.x - margin) - index * (tubeW + gap);
  if (index >= 0 && index < 4 && localX >= -8 && localX <= tubeW + 8) {
    bonus.pressures[index] = 0;
    bonus.swipes += 1;
    bonus.basePoints += 1;
    hitBuzz();
  }
}

function updateShieldFromPoint(x, y, rect) {
  bonus.shieldAngle = Math.atan2(y - rect.height / 2, x - rect.width / 2);
}


function bootToStartScreen() {
  clearAllTimers();
  stopBonusLoop();
  state.running = false;
  state.mode = 'idle';
  state.score = 0;
  state.level = 1;
  state.activeIndex = -1;
  state.bonusScore = 0;
  state.scoreSaved = false;
  bonus.finished = false;
  bonus.type = null;
  bonus.debris = [];
  bonus.pointerDown.clear();

  resetHoles();
  updateHud();

  startScreen.classList.add('show');
  tutorialScreen.classList.remove('show');
  gameOverScreen.classList.remove('show');
  scoresScreen?.classList.remove('show');
  bonusScreen.classList.remove('show');
  bonusScreen.style.display = '';
  smoke.classList.remove('show');
  finalLoseText.classList.remove('show');
  countdown.classList.remove('show', 'good-luck');
  levelBanner.classList.remove('show');
  toast.classList.remove('show');
  if (bonusResult) {
    bonusResult.classList.remove('show');
    bonusResult.textContent = '';
  }
  bonusTitle.textContent = 'Bonus Round';
  bonusTimer.textContent = '15.0s';
  bonusHelp.textContent = '';
}

holes.forEach((hole, index) => {
  hole.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setupAudio();
    whack(index);
  }, { passive: false });
});

bonusCanvas.addEventListener('pointerdown', handleBonusPointerDown, { passive: false });
bonusCanvas.addEventListener('pointermove', handleBonusPointerMove, { passive: false });
bonusCanvas.addEventListener('pointerup', handleBonusPointerUp, { passive: false });
bonusCanvas.addEventListener('pointercancel', handleBonusPointerUp, { passive: false });
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', startGame);
restartBtn?.addEventListener('click', startGame);
showScoresBtn?.addEventListener('click', () => showScores(false));
closeScoresBtn?.addEventListener('click', hideScores);
nameForm?.addEventListener('submit', submitFinalScore);
scoresScreen?.addEventListener('pointerdown', (event) => {
  if (event.target === closeScoresBtn) return;
  if (scoresScreen.classList.contains('show')) hideScores();
});
tutorialContinueBtn.addEventListener('click', continueTutorial);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state.mode === 'whack' || state.mode === 'bonus')) {
    state.running = false;
    state.mode = 'paused';
    clearAllTimers();
    stopBonusLoop();
    showToast('Paused — tap Try Again to restart');
    updateHud();
  }
});


// Always force a clean start screen on first load/reload, including iPhone Safari cached sessions.
bootToStartScreen();
