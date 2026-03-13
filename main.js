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

/* ─────────────────────────────────────────────
   CARDS — edit these to add your websites
   url:        the website URL to preview
   screenshot: direct image URL  OR  leave as ''
               to auto-generate from the URL
   title:      shown bottom-left of card
   pos3d:      [x, y, z] position in space
────────────────────────────────────────────── */
const CARDS = [
  {
    pos3d: [-160, 0, -300],
    title: 'Alpha Airsoft',
    url:   'https://spacestudiosinc.github.io/Alpha_Airsoft/',
    screenshot: ''
  },
  {
    pos3d: [160, 0, -300],
    title: 'Hamusuta',
    url:   'https://spacestudiosinc.github.io/HAMUSUTA/',
    screenshot: ''
  },
   {
    pos3d: [0, 0, 0],
    title: 'All That',
    url:   'https://spacestudiosinc.github.io/ALLTHAT/',
    screenshot: ''
  },
  
];

/* Screenshot service — generates a preview image from any URL */
function screenshotUrl(siteUrl) {
  const encoded = encodeURIComponent(siteUrl);
  // Uses WordPress mshots — free, no key needed
  return `https://s.wordpress.com/mshots/v1/${encoded}?w=520&h=310`;
}

/* ── Build cards + menu ──────────────────────── */
const layer     = document.getElementById('cards-layer');
const menu      = document.getElementById('menu');
const hamburger = document.getElementById('hamburger');

const cardObjects = CARDS.map((c, i) => {
  const imgSrc = c.screenshot || screenshotUrl(c.url);

  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-collapsed">
      <span class="card-dot"></span>
      <span class="card-pill-title">${c.title}</span>
    </div>
    <div class="card-expanded">
      <div class="card-screenshot">
        <img src="${imgSrc}" alt="${c.title}" loading="lazy"/>
      </div>
      <div class="card-bar">
        <div class="card-bar-title">${c.title}</div>
        <a class="card-bar-link" href="${c.url}" target="_blank" rel="noopener">Visit ↗</a>
      </div>
    </div>
  `;
  // Whole card is clickable — opens the site
  el.addEventListener('click', (e) => {
    // Don't double-fire if they clicked the Visit link directly
    if (e.target.classList.contains('card-bar-link')) return;
    window.open(c.url, '_blank', 'noopener');
  });

  layer.appendChild(el);

  const item = document.createElement('div');
  item.className = 'menu-item';
  item.textContent = c.title;
  item.addEventListener('click', () => { flyToCard(i); closeMenu(); });
  menu.appendChild(item);

  return { el, anchor: new THREE.Vector3(...c.pos3d) };
});

/* ── Hamburger ───────────────────────────────── */
function closeMenu() {
  hamburger.classList.remove('open');
  menu.classList.remove('open');
}
hamburger.addEventListener('click', e => {
  e.stopPropagation();
  hamburger.classList.toggle('open');
  menu.classList.toggle('open');
});
document.addEventListener('click', () => closeMenu());
menu.addEventListener('click', e => e.stopPropagation());

/* ── Fly to card ─────────────────────────────── */
function flyToCard(i) {
  const a = cardObjects[i].anchor;
  targetYaw   = -Math.atan2(a.x, -a.z);
  targetPitch = -Math.atan2(a.y, Math.sqrt(a.x * a.x + a.z * a.z));
}

/* ── Mouse → camera (free, position-based, limited) ── */
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

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ── Project 3D → 2D ─────────────────────────── */
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const screenPos = new THREE.Vector3();

function projectCard(anchor) {
  screenPos.copy(anchor);
  screenPos.project(camera);
  return {
    x: ( screenPos.x * 0.5 + 0.5) * innerWidth,
    y: (-screenPos.y * 0.5 + 0.5) * innerHeight,
    behind: screenPos.z > 1
  };
}

/* ── Animate ─────────────────────────────────── */
(function animate() {
  requestAnimationFrame(animate);
  currentYaw   += (targetYaw   - currentYaw)   * 0.05;
  currentPitch += (targetPitch - currentPitch) * 0.05;
  euler.set(currentPitch, currentYaw, 0);
  camera.quaternion.setFromEuler(euler);
  renderer.render(scene, camera);

  cardObjects.forEach(({ el, anchor }) => {
    const { x, y, behind } = projectCard(anchor);
    if (behind) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    } else {
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.opacity = '1';
      el.style.pointerEvents = 'all';
    }
  });
})();
