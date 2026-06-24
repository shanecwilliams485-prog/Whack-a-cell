const holes = [...document.querySelectorAll('.hole')];
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const bestEl = document.getElementById('best');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const smoke = document.getElementById('smoke');
const toast = document.getElementById('toast');
const superBtn = document.getElementById('superBtn');
const superSub = document.getElementById('superSub');
const levelBanner = document.getElementById('levelBanner');

const state = {
  running: false,
  score: 0,
  level: 1,
  activeIndex: -1,
  popTimer: null,
  warningTimer: null,
  failTimer: null,
  boostUntil: 0,
  superUsedThisLevel: false,
  best: Number(localStorage.getItem('whackACellBest') || 0),
};

bestEl.textContent = state.best;

let audioCtx;
let musicInterval;

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

function noiseBlast(seconds = 0.9) {
  if (!audioCtx) return;
  const size = audioCtx.sampleRate * seconds;
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const vol = audioCtx.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  vol.gain.value = 0.14;
  src.buffer = buffer;
  src.connect(filter).connect(vol).connect(audioCtx.destination);
  src.start();
}

function startOriginalHeavyMusic() {
  stopOriginalHeavyMusic();
  if (!audioCtx) return;
  let step = 0;
  const riff = [82, 82, 110, 82, 123, 82, 147, 110];
  musicInterval = setInterval(() => {
    const now = audioCtx.currentTime;
    // kick-ish thump
    const kick = audioCtx.createOscillator();
    const kickGain = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    kickGain.gain.setValueAtTime(step % 2 === 0 ? 0.18 : 0.07, now);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    kick.connect(kickGain).connect(audioCtx.destination);
    kick.start(now); kick.stop(now + 0.13);

    // distorted low guitar-like buzz
    beep(riff[step % riff.length], 0.12, 'sawtooth', 0.045);
    if (step % 4 === 2) beep(riff[(step + 3) % riff.length] * 2, 0.08, 'square', 0.025);
    step++;
  }, 140);
}

function stopOriginalHeavyMusic() {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = null;
}

function resetHoles() {
  holes.forEach(h => h.classList.remove('active', 'warning', 'whacked'));
  state.activeIndex = -1;
}

function popDelay() {
  return Math.max(380, 930 - state.level * 72);
}

function visibleTime() {
  return Math.max(520, 1500 - state.level * 105);
}

function updateHud() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  bestEl.textContent = state.best;
  const unlocked = state.level >= 5;
  const boosting = Date.now() < state.boostUntil;
  superBtn.disabled = !unlocked || boosting || state.superUsedThisLevel || !state.running;
  superBtn.classList.toggle('live', unlocked && !state.superUsedThisLevel && !boosting && state.running);
  superBtn.classList.toggle('boosting', boosting);
  superSub.textContent = boosting ? '2x points active!' : unlocked ? (state.superUsedThisLevel ? 'Used this level' : 'Ready!') : 'Unlocks at Level 5';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1300);
}

function showLevelBanner(message) {
  levelBanner.textContent = message;
  levelBanner.classList.add('show');
  setTimeout(() => levelBanner.classList.remove('show'), 1500);
}

function nextPop() {
  if (!state.running) return;
  resetHoles();
  const index = Math.floor(Math.random() * holes.length);
  state.activeIndex = index;
  const hole = holes[index];
  hole.classList.add('active');
  beep(230 + state.level * 24, 0.06, 'triangle', 0.035);

  const time = visibleTime();
  state.warningTimer = setTimeout(() => hole.classList.add('warning'), time * 0.62);
  state.failTimer = setTimeout(() => gameOver(index), time);
}

function scheduleNextPop() {
  clearTimeout(state.popTimer);
  state.popTimer = setTimeout(nextPop, popDelay());
}

function levelFromScore(score) {
  return Math.min(12, Math.floor(score / 8) + 1);
}

function whack(index) {
  if (!state.running || index !== state.activeIndex) return;
  clearTimeout(state.warningTimer);
  clearTimeout(state.failTimer);
  const multiplier = Date.now() < state.boostUntil ? 2 : 1;
  state.score += multiplier;
  holes[index].classList.add('whacked');
  beep(multiplier === 2 ? 880 : 620, 0.07, 'square', multiplier === 2 ? 0.075 : 0.05);

  const oldLevel = state.level;
  state.level = levelFromScore(state.score);
  if (state.level !== oldLevel) {
    state.superUsedThisLevel = false;
    showLevelBanner(`LEVEL ${state.level}`);
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('whackACellBest', String(state.best));
  }
  updateHud();
  resetHoles();
  scheduleNextPop();
}

function gameOver(index) {
  if (!state.running) return;
  state.running = false;
  clearTimeout(state.popTimer);
  clearTimeout(state.warningTimer);
  clearTimeout(state.failTimer);
  stopOriginalHeavyMusic();
  holes[index]?.classList.add('warning');
  smoke.classList.add('show');
  noiseBlast(1.1);
  updateHud();
  setTimeout(() => gameOverScreen.classList.add('show'), 650);
}

function startGame() {
  setupAudio();
  startScreen.classList.remove('show');
  gameOverScreen.classList.remove('show');
  smoke.classList.remove('show');
  state.running = true;
  state.score = 0;
  state.level = 1;
  state.boostUntil = 0;
  state.superUsedThisLevel = false;
  resetHoles();
  updateHud();
  showLevelBanner('LEVEL 1');
  scheduleNextPop();
}

function activateSuper() {
  if (superBtn.disabled || !state.running) return;
  setupAudio();
  state.boostUntil = Date.now() + 10_000;
  state.superUsedThisLevel = true;
  updateHud();
  showToast('SUPER WHACK: 2x points for 10 seconds');
  startOriginalHeavyMusic();
  const timer = setInterval(() => {
    if (!state.running || Date.now() >= state.boostUntil) {
      clearInterval(timer);
      stopOriginalHeavyMusic();
      updateHud();
    }
  }, 250);
}

holes.forEach((hole, index) => {
  hole.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setupAudio();
    whack(index);
  }, { passive: false });
});

startBtn.addEventListener('click', startGame);
testVoiceBtn?.addEventListener('click', () => {
  setupAudio();
  speakPoliticianParody('Voice test online, folks. The cells are not ready for this.');
});
restartBtn.addEventListener('click', startGame);
superBtn.addEventListener('click', activateSuper);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) {
    state.running = false;
    stopOriginalHeavyMusic();
    clearTimeout(state.popTimer);
    clearTimeout(state.warningTimer);
    clearTimeout(state.failTimer);
    showToast('Paused');
  }
});
