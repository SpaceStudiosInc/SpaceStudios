/* ── Background music — Web Audio API, gapless loop ── */
let audioCtx   = null;
let bgmGain    = null;
let bgmBuffer  = null;
let bgmSource  = null;
let bgmStarted = false;

function playMusic() {
  if (!audioCtx || !bgmBuffer || bgmStarted) return;
  bgmSource = audioCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;
  bgmSource.connect(bgmGain);
  bgmSource.start(0);
  bgmStarted = true;
}

async function initMusic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.4;
  bgmGain.connect(audioCtx.destination);

  const res = await fetch('');
  const arrayBuffer = await res.arrayBuffer();
  bgmBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  if (audioCtx.state === 'running') play();
}
initMusic().catch(() => {});

function unlockMusic() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  playMusic();
  window.removeEventListener('pointerdown', unlockMusic);
  window.removeEventListener('keydown', unlockMusic);
  window.removeEventListener('touchstart', unlockMusic);
}
window.addEventListener('pointerdown', unlockMusic);
window.addEventListener('keydown', unlockMusic);
window.addEventListener('touchstart', unlockMusic);

/* ── Starfield — flying through space, forever ── */
const starCanvas = document.getElementById('starfield');
const starCtx    = starCanvas.getContext('2d');

const STAR_COUNT = 500;
const STAR_SPEED = 0.35; // higher = faster warp
let stars = [];
let cx = 0, cy = 0;

function resizeStarfield() {
  starCanvas.width  = window.innerWidth;
  starCanvas.height = window.innerHeight;
  cx = starCanvas.width / 2;
  cy = starCanvas.height / 2;
}

function spawnStar() {
  // start near center with a small random offset, at a random depth
  return {
    x: (Math.random() - 0.5) * 40,
    y: (Math.random() - 0.5) * 40,
    z: Math.random() * cx + 1, // depth: larger = farther away
  };
}

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = spawnStar();
    s.z = Math.random() * cx; // scatter initial depth so it doesn't all "spawn" at once
    stars.push(s);
  }
}

function stepStarfield() {
  starCtx.fillStyle = '#000';
  starCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.fillStyle = '#fff';

  for (const s of stars) {
    s.z -= STAR_SPEED * (s.z / cx + 0.1) * 6; // faster as it gets closer, like real warp

    if (s.z <= 1) {
      Object.assign(s, spawnStar());
      continue;
    }

    const scale = cx / s.z;
    const px = cx + s.x * scale;
    const py = cy + s.y * scale;

    if (px < 0 || px > starCanvas.width || py < 0 || py > starCanvas.height) {
      Object.assign(s, spawnStar());
      continue;
    }

    const size = Math.max(0.5, (1 - s.z / cx) * 2.5);
    const alpha = Math.min(1, (1 - s.z / cx) * 1.3);
    starCtx.globalAlpha = alpha;
    starCtx.fillRect(px, py, size, size);
  }
  starCtx.globalAlpha = 1;

  requestAnimationFrame(stepStarfield);
}

resizeStarfield();
initStars();
requestAnimationFrame(stepStarfield);
window.addEventListener('resize', () => {
  resizeStarfield();
  initStars();
});

/* ── In-page game viewer — no new tab, stays on Space Studios ── */
const viewer      = document.getElementById('viewer');
const viewerFrame = document.getElementById('viewerFrame');
const viewerTitle = document.getElementById('viewerTitle');
const viewerBack  = document.getElementById('viewerBack');

function openGame(src, title) {
  viewerTitle.textContent = title;
  viewerFrame.src = src;
  document.body.classList.add('viewing');
}

function closeGame() {
  document.body.classList.remove('viewing');
  viewerFrame.src = 'about:blank'; // stop game audio/loop when backing out
}

document.querySelectorAll('.game-card').forEach((card) => {
  card.addEventListener('click', () => {
    openGame(card.dataset.src, card.dataset.title);
  });
});

viewerBack.addEventListener('click', closeGame);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('viewing')) closeGame();
});
