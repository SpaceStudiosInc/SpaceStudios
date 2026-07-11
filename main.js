/* ── Background music — Web Audio API for gapless, seamless looping ── */
let audioCtx   = null;
let bgmGain    = null;
let bgmBuffer  = null;
let bgmSource  = null;
let bgmStarted = false;

function playMusic() {
  if (!audioCtx || !bgmBuffer || bgmStarted) return;
  bgmSource = audioCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true; // sample-accurate loop, no gap at the seam
  bgmSource.connect(bgmGain);
  bgmSource.start(0);
  bgmStarted = true;
}

async function initMusic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.4;
  bgmGain.connect(audioCtx.destination);

  const res = await fetch('BGMusic.wav');
  const arrayBuffer = await res.arrayBuffer();
  bgmBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  if (audioCtx.state === 'running') playMusic();
}
initMusic().catch(() => {
  // Decoding/fetch failed — nothing to do, music just won't play
});

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

/* ── Scene ───────────────────────────────────── */
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);

/* ── Stars ───────────────────────────────────── */
const geo = new THREE.BufferGeometry();
const COUNT = 20000;
const pos = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT * 3; i++) pos[i] = (Math.random() - 0.5) * 4000;
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x888888, size: 0.6, sizeAttenuation: true })));

/* ── Moon — far background ──────────────────── */
const moonLoader = new THREE.TextureLoader();
let moonMesh = null;
moonLoader.load('moon.png', (moonTex) => {
  moonTex.colorSpace = THREE.SRGBColorSpace ?? moonTex.colorSpace;
  const moonSize = 1100;
  const moonMat = new THREE.SpriteMaterial({
    map: moonTex,
    transparent: true,
    depthWrite: false
  });
  moonMesh = new THREE.Sprite(moonMat);
  moonMesh.scale.set(moonSize, moonSize, 1);
  moonMesh.position.set(-2000, 500, -3000);
  moonMesh.renderOrder = 0; // draw first, farthest back
  scene.add(moonMesh);
});

/* ── Title text — billboards to camera, click to change color ── */
let titleSprite  = null;
let titleCtx     = null;
let titleTexture = null;
const TITLE_W = 1024, TITLE_H = 940;
const TITLE_COLORS = [
  'rgba(255,255,255,0.95)', // white (default)
  'rgba(255,70,70,0.95)',   // red
  'rgba(80,170,255,0.95)',  // blue
  'rgba(255,210,60,0.95)',  // gold
];
let titleColorIndex = 0;

function drawTitleText(color) {
  const lines = ['INVADE', 'THE', 'MOON'];
  titleCtx.clearRect(0, 0, TITLE_W, TITLE_H);
  titleCtx.textAlign = 'center';
  titleCtx.textBaseline = 'middle';

  const fontSize = 150;
  const lineHeight = fontSize * 1.05;
  const titleBlockHeight = lineHeight * lines.length;
  const startY = 40 + titleBlockHeight / 2;

  titleCtx.font = `${fontSize}px "M23", sans-serif`;
  lines.forEach((line, i) => {
    const y = startY - titleBlockHeight / 2 + lineHeight / 2 + i * lineHeight;

    // soft glow
    titleCtx.shadowColor = 'rgba(255,255,255,0.35)';
    titleCtx.shadowBlur = 30;
    titleCtx.fillStyle = color;
    titleCtx.fillText(line, TITLE_W / 2, y);

    // crisp pass on top
    titleCtx.shadowBlur = 0;
    titleCtx.fillStyle = color;
    titleCtx.fillText(line, TITLE_W / 2, y);
  });

  // "COMING SOON" below the title
  const subFontSize = 56;
  const subY = startY + titleBlockHeight / 2 + 90;
  titleCtx.font = `${subFontSize}px "M23", sans-serif`;

  titleCtx.shadowColor = 'rgba(255,255,255,0.25)';
  titleCtx.shadowBlur = 18;
  titleCtx.fillStyle = 'rgba(200,200,200,0.85)';
  titleCtx.fillText('COMING SOON', TITLE_W / 2, subY);

  titleCtx.shadowBlur = 0;
  titleCtx.fillStyle = 'rgba(220,220,220,0.9)';
  titleCtx.fillText('COMING SOON', TITLE_W / 2, subY);

  titleTexture.needsUpdate = true;
}

function makeTitleSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = TITLE_W;
  canvas.height = TITLE_H;
  titleCtx = canvas.getContext('2d');

  titleTexture = new THREE.CanvasTexture(canvas);
  titleTexture.minFilter = THREE.LinearFilter;

  drawTitleText(TITLE_COLORS[titleColorIndex]);

  const material = new THREE.SpriteMaterial({ map: titleTexture, transparent: true, depthWrite: false });
  titleSprite = new THREE.Sprite(material);

  const aspect = TITLE_W / TITLE_H;
  const spriteHeight = 500;
  titleSprite.scale.set(spriteHeight * aspect, spriteHeight, 1);
  titleSprite.position.set(0, 10, -400);
  titleSprite.renderOrder = 2; // draw last, always on top of ship and moon

  scene.add(titleSprite);
}

if (document.fonts && document.fonts.load) {
  const font = new FontFace('M23', 'url(m23.TTF)');
  font.load().then((loaded) => {
    document.fonts.add(loaded);
    makeTitleSprite();
  }).catch(() => {
    // Fall back to a system font if the custom font fails to load
    makeTitleSprite();
  });
} else {
  makeTitleSprite();
}

/* ── Ship flyby — drifts across the background every ~1 min ── */
const shipLoader = new THREE.TextureLoader();
let shipSprite   = null;
let shipActive   = false;
let shipStart    = new THREE.Vector3();
let shipEnd      = new THREE.Vector3();
let shipStartTime = 0;

const SHIP_FLIGHT_DURATION = 20000;  // ms, time to cross the screen
const SHIP_INTERVAL_MIN    = 45000;  // ms, shortest gap between flybys
const SHIP_INTERVAL_MAX    = 75000;  // ms, longest gap between flybys
let nextShipTime = performance.now() + 4000; // first flyby ~4s after load

shipLoader.load('Ship1.png', (shipTex) => {
  shipTex.colorSpace = THREE.SRGBColorSpace ?? shipTex.colorSpace;
  shipTex.magFilter = THREE.NearestFilter;
  shipTex.minFilter = THREE.NearestFilter;

  const shipMat = new THREE.SpriteMaterial({
    map: shipTex,
    transparent: true,
    depthWrite: false
  });
  shipSprite = new THREE.Sprite(shipMat);
  shipSprite.scale.set(80, 80, 1);
  shipSprite.renderOrder = 1; // draw after the moon, before the title
  shipSprite.visible = false;
  scene.add(shipSprite);
});

function launchShip() {
  if (!shipSprite) return;

  const fromLeft = Math.random() < 0.5;
  const y  = (Math.random() - 0.5) * 500 + 150;
  const z  = -1600 - Math.random() * 900;
  const yDrift = (Math.random() - 0.5) * 250;

  shipStart.set(fromLeft ? -2400 : 2400, y, z);
  shipEnd.set(fromLeft ? 2400 : -2400, y + yDrift, z);

  shipSprite.position.copy(shipStart);
  // Point the nose along the direction of travel (art points "up" by default,
  // plus 180° since the art's "front" faces the opposite way)
  shipSprite.material.rotation =
    Math.atan2(shipEnd.y - shipStart.y, shipEnd.x - shipStart.x) + Math.PI / 2 + Math.PI;

  shipSprite.visible = true;
  shipActive = true;
  shipStartTime = performance.now();
}

function updateShip(now) {
  if (!shipSprite) return;

  if (!shipActive && now >= nextShipTime) {
    launchShip();
  }

  if (shipActive) {
    const t = Math.min(1, (now - shipStartTime) / SHIP_FLIGHT_DURATION);
    shipSprite.position.lerpVectors(shipStart, shipEnd, t);

    if (t >= 1) {
      shipActive = false;
      shipSprite.visible = false;
      nextShipTime = now + SHIP_INTERVAL_MIN + Math.random() * (SHIP_INTERVAL_MAX - SHIP_INTERVAL_MIN);
    }
  }
}


const MAX_YAW   = Math.PI * 0.30;
const MAX_PITCH = Math.PI * 0.22;

let targetYaw = 0, targetPitch = 0;
let currentYaw = 0, currentPitch = 0;

document.addEventListener('mousemove', e => {
  targetYaw   = ((e.clientX / innerWidth)  - 0.5) * -MAX_YAW   * 2;
  targetPitch = ((e.clientY / innerHeight) - 0.5) * -MAX_PITCH * 2;
});
document.addEventListener('mouseleave', () => {
  targetYaw   = currentYaw;
  targetPitch = currentPitch;
});

/* ── Touch → camera (drag to look) ───────────── */
const TOUCH_SENSITIVITY = 0.003;
const TAP_THRESHOLD_PX  = 8;
const TAP_THRESHOLD_MS  = 200;

let touchStartX = 0, touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;

document.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStartX    = t.clientX;
  touchStartY    = t.clientY;
  touchStartTime = Date.now();
  isDragging     = false;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (!isDragging && (Math.abs(dx) > TAP_THRESHOLD_PX || Math.abs(dy) > TAP_THRESHOLD_PX)) {
    isDragging = true;
  }

  if (isDragging) {
    targetYaw   = Math.max(-MAX_YAW,   Math.min(MAX_YAW,   currentYaw   - dx * TOUCH_SENSITIVITY));
    targetPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, currentPitch - dy * TOUCH_SENSITIVITY));
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }
}, { passive: true });

document.addEventListener('touchend', () => {
  isDragging = false;
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ── Click the title to cycle its color ──────── */
const raycaster = new THREE.Raycaster();
const clickNDC = new THREE.Vector2();

window.addEventListener('click', (e) => {
  if (!titleSprite) return;
  clickNDC.x = (e.clientX / innerWidth) * 2 - 1;
  clickNDC.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(clickNDC, camera);
  const hits = raycaster.intersectObject(titleSprite);
  if (hits.length > 0) {
    titleColorIndex = (titleColorIndex + 1) % TITLE_COLORS.length;
    drawTitleText(TITLE_COLORS[titleColorIndex]);
  }
});

/* ── Animate ─────────────────────────────────── */
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

(function animate() {
  requestAnimationFrame(animate);

  if (isDragging) {
    currentYaw   = targetYaw;
    currentPitch = targetPitch;
  } else {
    currentYaw   += (targetYaw   - currentYaw)   * 0.05;
    currentPitch += (targetPitch - currentPitch) * 0.05;
  }

  euler.set(currentPitch, currentYaw, 0);
  camera.quaternion.setFromEuler(euler);
  renderer.render(scene, camera);

  updateShip(performance.now());
})();