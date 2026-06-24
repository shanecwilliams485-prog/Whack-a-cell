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
const countdown = document.getElementById('countdown');
const finalLoseText = document.getElementById('finalLoseText');

const state = {
  running: false,
  score: 0,
  level: 1,
  activeIndex: -1,
  popTimer: null,
  warningTimer: null,
  failTimer: null,
  countdownTimer: null,
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

function hitBuzz() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [1200, 1900, 2600].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const vol = audioCtx.createGain();
    osc.type = i === 1 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.065);
    vol.gain.setValueAtTime(0.055 / (i + 1), now);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(vol).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  });
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

function startOriginalHeavyMusic() {
  stopOriginalHeavyMusic();
  if (!audioCtx) return;
  let step = 0;
  const riff = [82, 82, 110, 82, 123, 82, 147, 110];
  musicInterval = setInterval(() => {
    const now = audioCtx.currentTime;
    const kick = audioCtx.createOscillator();
    const kickGain = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    kickGain.gain.setValueAtTime(step % 2 === 0 ? 0.18 : 0.07, now);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    kick.connect(kickGain).connect(audioCtx.destination);
    kick.start(now); kick.stop(now + 0.13);

    beep(riff[step % riff.length], 0.12, 'sawtooth', 0.045);
    if (step % 4 === 2) beep(riff[(step + 3) % riff.length] * 2, 0.08, 'square', 0.025);
    step++;
  }, 140);
}

function stopOriginalHeavyMusic() {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = null;
}

function clearAllTimers() {
  clearTimeout(state.popTimer);
  clearTimeout(state.warningTimer);
  clearTimeout(state.failTimer);
  clearTimeout(state.countdownTimer);
}

function resetHoles() {
  holes.forEach(h => {
    h.classList.remove('active', 'warning', 'whacked', 'bursting');
    h.querySelector('.cap-pop')?.remove();
  });
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
  hitBuzz();

  const oldLevel = state.level;
  state.level = levelFromScore(state.score);
  if (state.level !== oldLevel) {
    state.superUsedThisLevel = false;
    showLevelBanner(`LEVEL UP! LEVEL ${state.level}`, 1700);
    beep(740, 0.08, 'triangle', 0.06);
    setTimeout(() => beep(980, 0.08, 'triangle', 0.06), 95);
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('whackACellBest', String(state.best));
  }
  updateHud();
  resetHoles();
  scheduleNextPop();
}

function addCapPop(hole) {
  const cap = document.createElement('span');
  cap.className = 'cap-pop';
  hole.appendChild(cap);
}

function gameOver(index) {
  if (!state.running) return;
  state.running = false;
  clearAllTimers();
  stopOriginalHeavyMusic();
  updateHud();

  const hole = holes[index];
  hole?.classList.add('active', 'warning', 'bursting');
  if (hole) addCapPop(hole);

  showLevelBanner('THERMAL RUNAWAY!', 2200);
  flameRoar();
  setTimeout(smokeRush, 350);
  setTimeout(() => smoke.classList.add('show'), 500);
  setTimeout(() => loseMelody(), 1250);
  setTimeout(() => finalLoseText.classList.add('show'), 2100);
  setTimeout(() => gameOverScreen.classList.add('show'), 3350);
}

function runCountdownThenStart() {
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
      state.running = true;
      updateHud();
      showLevelBanner('LEVEL 1', 1200);
      scheduleNextPop();
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

function startGame() {
  setupAudio();
  clearAllTimers();
  stopOriginalHeavyMusic();
  startScreen.classList.remove('show');
  gameOverScreen.classList.remove('show');
  smoke.classList.remove('show');
  finalLoseText.classList.remove('show');
  countdown.classList.remove('show', 'good-luck');
  state.running = false;
  state.score = 0;
  state.level = 1;
  state.boostUntil = 0;
  state.superUsedThisLevel = false;
  resetHoles();
  updateHud();
  runCountdownThenStart();
}

function activateSuper() {
  if (superBtn.disabled || !state.running) return;
  setupAudio();
  state.boostUntil = Date.now() + 10_000;
  state.superUsedThisLevel = true;
  updateHud();
  showToast('SUPER WHACK: 2x points for 10 seconds', 1600);
  showLevelBanner('SUPER WHACK!', 1300);
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
restartBtn.addEventListener('click', startGame);
superBtn.addEventListener('click', activateSuper);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) {
    state.running = false;
    stopOriginalHeavyMusic();
    clearAllTimers();
    showToast('Paused');
    updateHud();
  }
});
