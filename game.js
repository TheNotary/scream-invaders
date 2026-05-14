import { setupAudio, getAudioContext, getVolume, detectPitch, frequencyToSolfege, initVoiceCommands, isVoiceActive, SOLFEGE_NOTES } from './sound_input.js';

// ── Constants ──
const FIELD_W = 14, FIELD_H = 18;
const INV_COLS = 8, INV_ROWS = 5;
const CONTRIB_COLORS = ['#9be9a8','#40c463','#30a14e','#216e39','#0e4429'];
const HIT_POINTS =     [1, 1, 2, 2, 3];
const POINT_VALUES =   [10, 10, 20, 30, 50];
const SHIP_Y = -FIELD_H/2 + 1.2;
const BULLET_SPEED = 0.35;
const BOMB_SPEED = 0.08;
const BEAM_SPEED = 0.45;
const VOL_QUIET = 0.08, VOL_MED = 0.22, VOL_LOUD = 0.45;
const FIRE_COOLDOWN_MS = 180;

// ── State ──
let scene, camera, renderer, clock;
let ship, shipGlow, shipTargetX = 0, shipActualX = 0;
let invaders = [], invaderGroup;
let bullets = [], bombs = [], particles = [], floatingTexts = [];
let stars = [];
let score = 0, lives = 3, wave = 1;
let gameState = 'title'; // title | playing | gameover
let invDirX = 1, invSpeed = 0.012, invMoveTimer = 0, invStepDown = false;
let bombTimer = 0, bombInterval = 2.2;
let lastFireTime = 0;
let shakeAmount = 0;
let headTrackingActive = false, micActive = false, voiceActive = false;
let voiceOverrideUntil = 0; // timestamp: ignore face tracking after voice command
let currentVolume = 0, smoothVolume = 0;
let mouseX = 0, mouseDown = false;
const keysDown = new Set();
let faceModel = null;
let videoEl;
let wasAboveThreshold = false, lastVolumeDropTime = 0;
let hitPauseFrames = 0;
let faceTrackBusy = false;
let sustainedScreamTime = 0;
let volume11Active = false;

// ── Solfège firing state ──
let firingMode = 'pitch'; // 'pitch' | 'falsetto'
let currentTargetNote = 'Do';
let lastDetectedSolfege = '';
let lastDetectedFreq = 0;
let solfegeDisplayTimer = 0;
let pitchFiringLocked = false;
let menuOpen = false;

// ── DOM refs ──
const canvas = document.getElementById('gameCanvas');
const overlayEl = document.getElementById('overlay');
const overlayPrompt = document.getElementById('overlayPrompt');
const scoreDisplay = document.getElementById('scoreDisplay');
const waveDisplay = document.getElementById('waveDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const volumeFill = document.getElementById('volumeFill');
const statusEl = document.getElementById('status');
const inputModeEl = document.getElementById('inputMode');
const crtOverlay = document.getElementById('crtOverlay');
const solfegeDisplayEl = document.getElementById('solfegeDisplay');
const pitchDisplayEl = document.getElementById('pitchDisplay');
const targetNoteEl = document.getElementById('targetNote');
const modeMenuEl = document.getElementById('modeMenu');
const modeHintEl = document.getElementById('modeHint');
const menuPitchEl = document.getElementById('menuPitch');
const menuFalsettoEl = document.getElementById('menuFalsetto');

// ── Three.js Setup ──
function initThree() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d1117, 0.018);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, -2, 16);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0d1117);

  const ambient = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 8);
  scene.add(dirLight);
  const pointLight = new THREE.PointLight(0x39d353, 0.5, 30);
  pointLight.position.set(0, -5, 8);
  scene.add(pointLight);

  clock = new THREE.Clock();
  createStarfield();
}

function createStarfield() {
  const geo = new THREE.BufferGeometry();
  const count = 600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 60;
    positions[i*3+1] = (Math.random() - 0.5) * 50;
    positions[i*3+2] = -10 - Math.random() * 40;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x8b949e, size: 0.08, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  stars.push(pts);
}

// ── Ship (Arwing-inspired fighter) ──
function createShip() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xd0d8e0, shininess: 100, specular: 0x666666 });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0x58a6ff, shininess: 120, emissive: 0x58a6ff, emissiveIntensity: 0.15 });
  const engineMat = new THREE.MeshPhongMaterial({ color: 0x39d353, shininess: 80, emissive: 0x39d353, emissiveIntensity: 0.3 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x21262d, shininess: 40 });

  // Main fuselage - sleek tapered body
  const fuselageGeo = new THREE.CylinderGeometry(0.18, 0.35, 2.2, 6);
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.rotation.z = 0; // points up (Y+)
  group.add(fuselage);

  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.18, 0.8, 6);
  const nose = new THREE.Mesh(noseGeo, accentMat);
  nose.position.set(0, 1.5, 0);
  group.add(nose);

  // Cockpit canopy
  const canopyGeo = new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const canopyMat = new THREE.MeshPhongMaterial({ color: 0x58a6ff, shininess: 200, transparent: true, opacity: 0.7, emissive: 0x58a6ff, emissiveIntensity: 0.2 });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.6, 0.2);
  canopy.scale.set(1, 1.5, 1);
  group.add(canopy);

  // Swept wings (left)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-2.2, -0.4);
  wingShape.lineTo(-1.8, -0.6);
  wingShape.lineTo(-0.3, -0.15);
  wingShape.lineTo(0, -0.1);
  wingShape.closePath();
  const wingExtrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 };
  const lwGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  const lw = new THREE.Mesh(lwGeo, bodyMat);
  lw.position.set(-0.15, -0.1, -0.04);
  group.add(lw);

  // Swept wings (right - mirror)
  const rwShape = new THREE.Shape();
  rwShape.moveTo(0, 0);
  rwShape.lineTo(2.2, -0.4);
  rwShape.lineTo(1.8, -0.6);
  rwShape.lineTo(0.3, -0.15);
  rwShape.lineTo(0, -0.1);
  rwShape.closePath();
  const rwGeo = new THREE.ExtrudeGeometry(rwShape, wingExtrudeSettings);
  const rw = new THREE.Mesh(rwGeo, bodyMat);
  rw.position.set(0.15, -0.1, -0.04);
  group.add(rw);

  // Wing accent stripes (left)
  const stripeGeo = new THREE.BoxGeometry(1.4, 0.06, 0.12);
  const lStripe = new THREE.Mesh(stripeGeo, accentMat);
  lStripe.position.set(-1.0, -0.25, 0);
  lStripe.rotation.z = 0.18;
  group.add(lStripe);
  // Wing accent stripes (right)
  const rStripe = new THREE.Mesh(stripeGeo, accentMat);
  rStripe.position.set(1.0, -0.25, 0);
  rStripe.rotation.z = -0.18;
  group.add(rStripe);

  // Wing-tip cannons (left)
  const cannonGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6);
  const lCannon = new THREE.Mesh(cannonGeo, darkMat);
  lCannon.position.set(-2.0, -0.15, 0);
  group.add(lCannon);
  // Wing-tip cannons (right)
  const rCannon = new THREE.Mesh(cannonGeo, darkMat);
  rCannon.position.set(2.0, -0.15, 0);
  group.add(rCannon);

  // Wing-tip cannon glow
  const tipGlowGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const tipGlowMat = new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.6 });
  const lTip = new THREE.Mesh(tipGlowGeo, tipGlowMat);
  lTip.position.set(-2.0, 0.12, 0);
  group.add(lTip);
  const rTip = new THREE.Mesh(tipGlowGeo, tipGlowMat.clone());
  rTip.position.set(2.0, 0.12, 0);
  group.add(rTip);

  // Engine nacelles (left)
  const engineGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.7, 6);
  const lEngine = new THREE.Mesh(engineGeo, darkMat);
  lEngine.position.set(-0.6, -0.7, 0);
  group.add(lEngine);
  // Engine nacelles (right)
  const rEngine = new THREE.Mesh(engineGeo, darkMat);
  rEngine.position.set(0.6, -0.7, 0);
  group.add(rEngine);

  // Engine exhaust glow (left)
  const exhaustGeo = new THREE.SphereGeometry(0.11, 8, 8);
  const exhaustMatL = new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.8 });
  const lExhaust = new THREE.Mesh(exhaustGeo, exhaustMatL);
  lExhaust.position.set(-0.6, -1.1, 0);
  lExhaust.scale.set(1, 1.5, 1);
  group.add(lExhaust);
  // Engine exhaust glow (right)
  const exhaustMatR = new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.8 });
  const rExhaust = new THREE.Mesh(exhaustGeo, exhaustMatR);
  rExhaust.position.set(0.6, -1.1, 0);
  rExhaust.scale.set(1, 1.5, 1);
  group.add(rExhaust);

  // Central engine exhaust
  const cExhaustMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.6 });
  const cExhaust = new THREE.Mesh(exhaustGeo, cExhaustMat);
  cExhaust.position.set(0, -1.3, 0);
  cExhaust.scale.set(0.8, 2, 0.8);
  group.add(cExhaust);

  // Vertical stabilizer (tail fin)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, 0.7);
  finShape.lineTo(-0.15, 0.5);
  finShape.lineTo(-0.08, 0);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, accentMat);
  fin.position.set(0, -0.8, 0.15);
  fin.rotation.y = -Math.PI / 2;
  group.add(fin);

  // Glow sphere (volume reactive)
  const glowGeo = new THREE.SphereGeometry(1.2, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  shipGlow = new THREE.Mesh(glowGeo, glowMat);
  group.add(shipGlow);

  // Store exhaust refs for animation
  group.userData = { lExhaust, rExhaust, cExhaust, lTip, rTip, exhaustMatL, exhaustMatR, cExhaustMat };

  group.scale.set(0.55, 0.55, 0.55);
  group.position.set(0, SHIP_Y, 0);
  scene.add(group);
  ship = group;
}

// ── Invaders ──
function createInvaderMesh(row) {
  const color = new THREE.Color(CONTRIB_COLORS[row]);
  const size = 0.9;
  const group = new THREE.Group();
  // main body: rounded box via box + small spheres
  const bodyGeo = new THREE.BoxGeometry(size, size, size * 0.5, 1, 1, 1);
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 40 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);
  // eyes
  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0d1117 });
  const le = new THREE.Mesh(eyeGeo, eyeMat);
  le.position.set(-0.18, 0.1, 0.26);
  group.add(le);
  const re = new THREE.Mesh(eyeGeo, eyeMat);
  re.position.set(0.18, 0.1, 0.26);
  group.add(re);
  // little antennae on top rows
  if (row >= 3) {
    const antGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35);
    const antMat = new THREE.MeshPhongMaterial({ color });
    const la = new THREE.Mesh(antGeo, antMat);
    la.position.set(-0.2, 0.6, 0);
    group.add(la);
    const ra = new THREE.Mesh(antGeo, antMat);
    ra.position.set(0.2, 0.6, 0);
    group.add(ra);
  }
  return group;
}

function spawnInvaders() {
  if (invaderGroup) scene.remove(invaderGroup);
  invaders = [];
  invaderGroup = new THREE.Group();
  const spacingX = 1.4, spacingY = 1.3;
  const offsetX = -(INV_COLS - 1) * spacingX / 2;
  const offsetY = FIELD_H/2 - 3;

  for (let r = 0; r < INV_ROWS; r++) {
    for (let c = 0; c < INV_COLS; c++) {
      const mesh = createInvaderMesh(r);
      const x = offsetX + c * spacingX;
      const y = offsetY - r * spacingY;
      mesh.position.set(x, y, 0);
      invaderGroup.add(mesh);
      invaders.push({
        mesh,
        row: r,
        col: c,
        hp: HIT_POINTS[r],
        maxHp: HIT_POINTS[r],
        alive: true,
        baseX: x,
        baseY: y
      });
    }
  }
  scene.add(invaderGroup);
  invDirX = 1;
  invSpeed = 0.012 + (wave - 1) * 0.003;
  invMoveTimer = 0;
  invStepDown = false;
  bombInterval = Math.max(0.6, 2.2 - (wave - 1) * 0.25);
  bombTimer = 0;
}

// ── Bullets & Bombs ──
function createBullet(x, y, wide) {
  const w = wide ? 2.5 : 0.15;
  const h = wide ? 1.5 : 0.5;
  const geo = new THREE.BoxGeometry(w, h, 0.15);
  const intensity = wide ? 2 : 1;
  const mat = new THREE.MeshBasicMaterial({
    color: wide ? 0xb87aff : 0x39d353,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  return { mesh, wide, speed: wide ? BEAM_SPEED : BULLET_SPEED };
}

function createBomb(x, y) {
  const geo = new THREE.OctahedronGeometry(0.18, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf85149 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  return { mesh };
}

// ── Particles ──
function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    scene.add(mesh);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.05 + Math.random() * 0.15;
    particles.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * 0.1,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02
    });
  }
}

function spawnFloatingText(x, y, text) {
  const cnv = document.createElement('canvas');
  cnv.width = 256; cnv.height = 64;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#39d353';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(cnv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 0.5, 1);
  sprite.position.set(x, y, 0.5);
  scene.add(sprite);
  floatingTexts.push({ sprite, life: 1.0 });
}

// ── Shooting ──
function fireWeapon(volume) {
  const now = performance.now();
  if (now - lastFireTime < FIRE_COOLDOWN_MS) return;
  lastFireTime = now;

  const sx = ship.position.x;
  const sy = ship.position.y + 0.5;

  if (volume >= VOL_LOUD) {
    bullets.push(createBullet(sx, sy, true));
    shakeAmount = 0.5;
    spawnExplosion(sx, sy, 0xb87aff, 12);
    sfxBeam();
  } else if (volume >= VOL_MED) {
    bullets.push(createBullet(sx - 0.4, sy, false));
    bullets.push(createBullet(sx, sy, false));
    bullets.push(createBullet(sx + 0.4, sy, false));
    shakeAmount = 0.1;
    sfxTriple();
  } else {
    bullets.push(createBullet(sx, sy, false));
    sfxShot();
  }
}

function fireSolfegeShot() {
  const now = performance.now();
  if (now - lastFireTime < FIRE_COOLDOWN_MS) return;
  lastFireTime = now;

  const sx = ship.position.x;
  const sy = ship.position.y + 0.5;
  bullets.push(createBullet(sx, sy, false));
  sfxShot();
}

// ── Camera / Mic Setup ──
const voiceCallbacks = {
  onMoveLeft() {
    shipTargetX = Math.max(-FIELD_W/2 + 0.8, shipTargetX - 3);
    voiceOverrideUntil = performance.now() + 500;
  },
  onMoveRight() {
    shipTargetX = Math.min(FIELD_W/2 - 0.8, shipTargetX + 3);
    voiceOverrideUntil = performance.now() + 500;
  },
  onSolfegeDetected(canonical) {
    if (firingMode === 'falsetto' && gameState === 'playing') {
      fireSolfegeShot();
      lastDetectedSolfege = canonical;
      lastDetectedFreq = 0;
      solfegeDisplayTimer = 1.5;
    }
  },
  onVoiceStatusChange(active) {
    voiceActive = active;
  },
  onFallbackToPitch() {
    firingMode = 'pitch';
    updateModeMenu();
    updateInputModeLabel();
    statusEl.textContent = 'Speech unavailable (network) — using Pitch mode';
  }
};

async function setupCamera() {
  videoEl = document.getElementById('webcamFeed');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: true
    });
    videoEl.srcObject = stream;
    setupAudio(stream);
    loadSfxBuffers();
    await loadFaceModel();
    headTrackingActive = true;
    micActive = true;
    statusEl.textContent = 'Camera + mic active';
    initVoiceCommands(voiceCallbacks);
    updateInputModeLabel();
  } catch(e) {
    console.warn('Camera+mic failed, trying mic only:', e);
    document.getElementById('webcamFeed').style.display = 'none';
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setupAudio(audioStream);
      loadSfxBuffers();
      micActive = true;
      statusEl.textContent = 'Mic active (no camera)';
      initVoiceCommands(voiceCallbacks);
    } catch(e2) {
      console.warn('Mic also failed:', e2);
      statusEl.textContent = 'Mouse + click mode';
    }
    updateInputModeLabel();
  }
}

const sfxBuffers = {};
const SFX_FILES = {
  playerShot: 'assets/player-shot.wav',
  playerTriple: 'assets/player-triple.wav',
  playerBeam: 'assets/player-beam.wav',
  enemyShot: 'assets/enemy-shot.wav',
  explosion: 'assets/explosion.wav',
  shipExplosion: 'assets/ship-explosion.wav'
};

function loadSfxBuffers() {
  const ctx = getAudioContext();
  if (!ctx) return;
  Object.entries(SFX_FILES).forEach(([key, url]) => {
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { sfxBuffers[key] = decoded; })
      .catch(e => console.warn('SFX load failed:', key, e));
  });
}

function playSfx(buffer, volume) {
  const ctx = getAudioContext();
  if (!ctx || !buffer) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buffer;
  gain.gain.value = volume || 0.4;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

function playTone(freq, duration, type, volume) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playSweep(startFreq, endFreq, duration, type, volume) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function sfxShot() { playSfx(sfxBuffers.playerShot, 0.5); }
function sfxTriple() { playSfx(sfxBuffers.playerTriple, 0.5); }
function sfxBeam() { playSfx(sfxBuffers.playerBeam, 0.6); }
function sfxInvaderDeath() { playSfx(sfxBuffers.explosion, 0.5); }
function sfxShipHit() { playSfx(sfxBuffers.shipExplosion, 0.7); }
function sfxEnemyShot() { playSfx(sfxBuffers.enemyShot, 0.35); }
function sfxWaveClear() {
  playTone(523, 0.1, 'square', 0.08);
  setTimeout(() => playTone(659, 0.1, 'square', 0.08), 100);
  setTimeout(() => playTone(784, 0.1, 'square', 0.08), 200);
  setTimeout(() => playTone(1047, 0.15, 'square', 0.1), 300);
}
function sfxMarch() { playTone(80, 0.03, 'square', 0.06); }

// ── Reference C Drone ──
let droneOscillators = [];
let droneGain = null;
let droneActive = false;

function startDrone() {
  const ctx = getAudioContext();
  if (!ctx || droneActive) return;
  droneActive = true;

  droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, ctx.currentTime);
  droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);
  droneGain.connect(ctx.destination);

  // C3 fundamental (130.81 Hz)
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(130.81, ctx.currentTime);
  g1.gain.value = 1.0;
  osc1.connect(g1);
  g1.connect(droneGain);
  osc1.start();

  // C4 octave (261.63 Hz)
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(261.63, ctx.currentTime);
  g2.gain.value = 0.3;
  osc2.connect(g2);
  g2.connect(droneGain);
  osc2.start();

  // G3 perfect fifth (196.00 Hz)
  const osc3 = ctx.createOscillator();
  const g3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(196.00, ctx.currentTime);
  g3.gain.value = 0.15;
  osc3.connect(g3);
  g3.connect(droneGain);
  osc3.start();

  droneOscillators = [osc1, osc2, osc3];
}

function stopDrone() {
  if (!droneActive || !droneGain) return;
  droneActive = false;
  const fadeEnd = getAudioContext().currentTime + 1;
  droneGain.gain.linearRampToValueAtTime(0, fadeEnd);
  const oscs = droneOscillators;
  const gain = droneGain;
  droneOscillators = [];
  droneGain = null;
  setTimeout(() => {
    oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch(e) {} });
    try { gain.disconnect(); } catch(e) {}
  }, 1100);
}

async function loadFaceModel() {
  statusEl.textContent = 'Loading face model...';
  faceModel = await blazeface.load();
  statusEl.textContent = 'Face model loaded';
}

function updateInputModeLabel() {
  const parts = [];
  if (headTrackingActive) parts.push('Head');
  if (voiceActive) parts.push('Voice');
  if (!headTrackingActive && !voiceActive) parts.push('Mouse');
  if (micActive) {
    parts.push(firingMode === 'pitch' ? 'Pitch' : 'Falsetto');
    parts.push('Solfège');
  } else {
    parts.push('Click');
  }
  inputModeEl.textContent = parts.join(' + ');
}

function updateModeMenu() {
  const pitchOn = firingMode === 'pitch';
  menuPitchEl.innerHTML = '<span class="key">[1]</span> Pitch Detection <span class="' + (pitchOn ? 'on' : 'off') + '">' + (pitchOn ? 'ON' : 'OFF') + '</span>';
  if (voiceActive) {
    menuFalsettoEl.innerHTML = '<span class="key">[2]</span> Falsetto (Speech) <span class="' + (!pitchOn ? 'on' : 'off') + '">' + (!pitchOn ? 'ON' : 'OFF') + '</span>';
  } else {
    menuFalsettoEl.innerHTML = '<span class="key">[2]</span> Falsetto (Speech) <span class="off">N/A</span>';
  }
}

// ── Face tracking loop ──
let faceTrackFrame = 0;
async function trackFace() {
  if (!headTrackingActive || !faceModel || !videoEl || videoEl.readyState < 2) return;
  if (faceTrackBusy) return;
  if (performance.now() < voiceOverrideUntil) return;
  faceTrackFrame++;
  if (faceTrackFrame % 3 !== 0) return;
  faceTrackBusy = true;
  try {
    const predictions = await faceModel.estimateFaces(videoEl, false);
    if (predictions.length > 0) {
      const face = predictions[0];
      const centerX = (face.topLeft[0] + face.bottomRight[0]) / 2;
      const vidW = videoEl.videoWidth || 320;
      // Map middle 1/3 of webcam to full ship range for responsive small head movements
      const third = vidW / 3;
      const norm = 1 - Math.max(0, Math.min(1, (centerX - third) / third));
      shipTargetX = (norm - 0.5) * FIELD_W * 0.9;
    }
  } catch(e) { /* ignore transient errors */ }
  finally { faceTrackBusy = false; }
}

// ── Game Logic ──
function resetGame() {
  // clear bullets, bombs, particles, texts
  bullets.forEach(b => scene.remove(b.mesh));
  bombs.forEach(b => scene.remove(b.mesh));
  particles.forEach(p => scene.remove(p.mesh));
  floatingTexts.forEach(f => scene.remove(f.sprite));
  bullets = []; bombs = []; particles = []; floatingTexts = [];
  score = 0; lives = 3; wave = 1;
  shipTargetX = 0; shipActualX = 0;
  if (ship) ship.position.x = 0;
  menuOpen = false;
  modeMenuEl.style.display = 'none';
  modeHintEl.style.opacity = '1';
  spawnInvaders();
  updateHUD();
}

function nextWave() {
  wave++;
  bullets.forEach(b => scene.remove(b.mesh));
  bombs.forEach(b => scene.remove(b.mesh));
  bullets = []; bombs = [];
  spawnInvaders();
  updateHUD();
  spawnFloatingText(0, 0, 'WAVE ' + wave);

}

function updateHUD() {
  scoreDisplay.textContent = score;
  waveDisplay.textContent = wave;
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += '<div class="life-icon' + (i >= lives ? ' lost' : '') + '"></div>';
  }
  livesDisplay.innerHTML = html;
}

function hitShip() {
  lives--;
  spawnExplosion(ship.position.x, ship.position.y, 0xf85149, 20);
  sfxShipHit();
  shakeAmount = 0.4;
  updateHUD();
  if (lives <= 0) {
    gameState = 'gameover';
    stopDrone();
    showOverlay('gameover');
  }
}

function showOverlay(mode) {
  menuOpen = false;
  modeMenuEl.style.display = 'none';
  modeHintEl.style.opacity = '0';
  overlayEl.classList.remove('hidden');
  const h1 = overlayEl.querySelector('h1');
  const sub = overlayEl.querySelector('.subtitle');
  const goScore = overlayEl.querySelector('.game-over-score');
  const goWave = overlayEl.querySelector('.game-over-wave');

  // Remove old game over elements
  if (goScore) goScore.remove();
  if (goWave) goWave.remove();

  if (mode === 'title') {
    h1.innerHTML = '<span>Scream</span> Invaders 3D';
    sub.innerHTML = 'Sing Do Re Mi Fa Sol La Ti to shoot. Move your head, arrow keys, or say LEFT / RIGHT. Press M for menu.<br><span style="font-size:9px;color:#6e7681;margin-top:8px;display:inline-block">🎧 Headphones recommended</span>';
    overlayPrompt.textContent = 'Tap or press SPACE to start';
  } else {
    h1.innerHTML = 'GAME OVER';
    sub.textContent = '';
    const sd = document.createElement('div');
    sd.className = 'game-over-score';
    sd.textContent = 'Score: ' + score;
    const wd = document.createElement('div');
    wd.className = 'game-over-wave';
    wd.textContent = 'Wave ' + wave;
    overlayPrompt.parentNode.insertBefore(sd, overlayPrompt);
    overlayPrompt.parentNode.insertBefore(wd, overlayPrompt);
    overlayPrompt.textContent = 'Tap or press SPACE to restart';
  }
}

// ── Input ──
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (gameState === 'title' || gameState === 'gameover') {
      gameState = 'playing';
      overlayEl.classList.add('hidden');
      resetGame();
      startDrone();
    }
  }
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();
    keysDown.add(e.code);
  }
  if (e.code === 'KeyM' && gameState === 'playing') {
    menuOpen = !menuOpen;
    modeMenuEl.style.display = menuOpen ? 'block' : 'none';
    modeHintEl.style.opacity = menuOpen ? '0' : '1';
  }
  if (e.code === 'Escape' && menuOpen) {
    menuOpen = false;
    modeMenuEl.style.display = 'none';
    modeHintEl.style.opacity = '1';
  }
  if (menuOpen && (e.code === 'Digit1' || e.code === 'Numpad1')) {
    firingMode = 'pitch';
    pitchFiringLocked = false;
    updateModeMenu();
    updateInputModeLabel();
  }
  if (menuOpen && (e.code === 'Digit2' || e.code === 'Numpad2') && voiceActive) {
    firingMode = 'falsetto';
    pitchFiringLocked = false;
    updateModeMenu();
    updateInputModeLabel();
  }
});

// Tap to start/restart (mobile)
function handleStartTap(e) {
  if (gameState === 'title' || gameState === 'gameover') {
    e.preventDefault();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    gameState = 'playing';
    overlayEl.classList.add('hidden');
    resetGame();
    startDrone();
  }
}
overlayEl.addEventListener('click', handleStartTap);
overlayEl.addEventListener('touchend', handleStartTap);

document.addEventListener('keyup', e => {
  keysDown.delete(e.code);
});

document.addEventListener('mousemove', e => {
  if (!headTrackingActive) {
    mouseX = ((e.clientX / window.innerWidth) - 0.5) * FIELD_W * 0.9;
  }
});

document.addEventListener('mousedown', () => { mouseDown = true; });
document.addEventListener('mouseup', () => { mouseDown = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Update loop ──
function update(dt) {
  // Always update volume meter
  currentVolume = getVolume();
  smoothVolume += (currentVolume - smoothVolume) * 0.2;
  volumeFill.style.height = (smoothVolume * 100) + '%';

  if (gameState === 'playing' && hitPauseFrames > 0) {
    hitPauseFrames--;
  } else if (gameState === 'playing') {

  // ─ Ship movement ─
  if (!headTrackingActive && !voiceActive) shipTargetX = mouseX;
  if (keysDown.has('ArrowLeft')) shipTargetX -= 0.6;
  if (keysDown.has('ArrowRight')) shipTargetX += 0.6;
  shipTargetX = Math.max(-FIELD_W/2 + 0.8, Math.min(FIELD_W/2 - 0.8, shipTargetX));
  const lerpSpeed = (keysDown.has('ArrowLeft') || keysDown.has('ArrowRight')) ? 0.35 : 0.12;
  shipActualX += (shipTargetX - shipActualX) * lerpSpeed;
  shipActualX = Math.max(-FIELD_W/2 + 0.8, Math.min(FIELD_W/2 - 0.8, shipActualX));
  ship.position.x = shipActualX;

  // ship glow from volume
  shipGlow.material.opacity = smoothVolume * 0.6;

  // head-coupled parallax
  camera.position.x = shipActualX * 0.08;

  // ─ Solfège / scream shooting ─
  if (micActive && firingMode === 'pitch') {
    const pitchHz = detectPitch();
    if (pitchHz) {
      const match = frequencyToSolfege(pitchHz);
      if (match && !pitchFiringLocked) {
        fireSolfegeShot();
        lastDetectedSolfege = match.solfege;
        lastDetectedFreq = Math.round(pitchHz);
        solfegeDisplayTimer = 1.5;
        pitchFiringLocked = true;
        // Cycle target to a different random note
        let next;
        do { next = SOLFEGE_NOTES[Math.floor(Math.random() * SOLFEGE_NOTES.length)]; }
        while (next === currentTargetNote && SOLFEGE_NOTES.length > 1);
        currentTargetNote = next;
      }
      if (!match) pitchFiringLocked = false;
    } else {
      pitchFiringLocked = false;
    }
  } else if (micActive && firingMode === 'falsetto') {
    // Falsetto-mode firing handled in speech recognition callback
  } else if (mouseDown) {
    fireWeapon(VOL_QUIET);
  }

  // ─ Invader movement ─
  invMoveTimer += dt;
  const aliveCount = invaders.filter(i => i.alive).length;
  const speedMult = 1 + (40 - aliveCount) * 0.025;
  const moveInterval = Math.max(0.01, 0.06 / speedMult);

  if (invMoveTimer >= moveInterval) {
    invMoveTimer = 0;

    if (invStepDown) {
      invaderGroup.position.y -= 0.3;
      invStepDown = false;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const wy = inv.mesh.position.y + invaderGroup.position.y;
        if (wy <= SHIP_Y + 1) {
          gameState = 'gameover';
          stopDrone();
          showOverlay('gameover');
          return;
        }
      }
    } else {
      invaderGroup.position.x += invSpeed * invDirX * speedMult;
      let needReverse = false;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const wx = inv.mesh.position.x + invaderGroup.position.x;
        if (wx > FIELD_W/2 - 0.6 || wx < -FIELD_W/2 + 0.6) {
          needReverse = true;
          break;
        }
      }
      if (needReverse) {
        invDirX *= -1;
        invStepDown = true;
      }
    }
  }

  // invader wobble
  for (const inv of invaders) {
    if (!inv.alive) continue;
    inv.mesh.rotation.z = Math.sin(performance.now() * 0.003 + inv.col) * 0.08;
  }

  // ─ Bullets ─
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.y += b.speed;
    if (b.mesh.position.y > FIELD_H/2 + 2) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }
    let hitAny = false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      const ix = inv.mesh.position.x + invaderGroup.position.x;
      const iy = inv.mesh.position.y + invaderGroup.position.y;
      const bx = b.mesh.position.x;
      const by = b.mesh.position.y;
      const hitDist = b.wide ? 1.8 : 0.55;
      if (Math.abs(bx - ix) < hitDist && Math.abs(by - iy) < 0.7) {
        inv.hp--;
        if (inv.hp <= 0) {
          inv.alive = false;
          inv.mesh.visible = false;
          const pts = POINT_VALUES[inv.row] * (b.wide ? 2 : 1);
          score += pts;
          spawnExplosion(ix, iy, new THREE.Color(CONTRIB_COLORS[inv.row]).getHex(), 15);
          sfxInvaderDeath();
          const label = pts >= 50 ? 'MERGED! +' + pts : 'APPROVED +' + pts;
          spawnFloatingText(ix, iy, label);

          hitPauseFrames = 3;
          updateHUD();
        } else {
          inv.mesh.children[0].material.emissive.set(0xffffff);
          setTimeout(() => {
            if (inv.mesh.children[0]) inv.mesh.children[0].material.emissive.set(0x000000);
          }, 80);
        }
        if (!b.wide) hitAny = true;
      }
    }
    if (hitAny) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  if (invaders.every(inv => !inv.alive)) {
    nextWave();
  }

  // ─ Bombs ─
  bombTimer += dt;
  if (bombTimer >= bombInterval) {
    bombTimer = 0;
    const aliveInvaders = invaders.filter(i => i.alive);
    if (aliveInvaders.length > 0) {
      const cols = {};
      for (const inv of aliveInvaders) {
        if (!cols[inv.col] || inv.row > cols[inv.col].row) cols[inv.col] = inv;
      }
      const bottoms = Object.values(cols);
      const shooter = bottoms[Math.floor(Math.random() * bottoms.length)];
      const bx = shooter.mesh.position.x + invaderGroup.position.x;
      const by = shooter.mesh.position.y + invaderGroup.position.y;
      bombs.push(createBomb(bx, by - 0.5));
      sfxEnemyShot();
    }
  }

  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.mesh.position.y -= BOMB_SPEED;
    b.mesh.rotation.x += 0.05;
    b.mesh.rotation.z += 0.03;
    if (b.mesh.position.y < -FIELD_H/2 - 2) {
      scene.remove(b.mesh);
      bombs.splice(i, 1);
      continue;
    }
    if (Math.abs(b.mesh.position.x - ship.position.x) < 0.7 &&
        Math.abs(b.mesh.position.y - ship.position.y) < 0.5) {
      scene.remove(b.mesh);
      bombs.splice(i, 1);
      hitShip();
      if (gameState !== 'playing') return;
    }
  }

  } // end gameplay block

  // ─ Solfège HUD display ─
  if (solfegeDisplayTimer > 0) {
    solfegeDisplayTimer -= dt;
    const opacity = Math.max(0, Math.min(1, solfegeDisplayTimer / 0.3));
    solfegeDisplayEl.textContent = lastDetectedSolfege;
    solfegeDisplayEl.style.opacity = opacity;
    pitchDisplayEl.textContent = lastDetectedFreq > 0 ? lastDetectedFreq + ' Hz' : '';
    pitchDisplayEl.style.opacity = opacity;
  } else {
    solfegeDisplayEl.style.opacity = 0;
    pitchDisplayEl.style.opacity = 0;
  }
  if (gameState === 'playing' && firingMode === 'pitch') {
    targetNoteEl.textContent = 'Sing: ' + currentTargetNote;
    targetNoteEl.style.opacity = 1;
  } else {
    targetNoteEl.style.opacity = 0;
  }

  // ─ Particles ─
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.life -= p.decay;
    p.mesh.material.opacity = Math.max(0, p.life);
    p.mesh.scale.setScalar(p.life);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // ─ Floating texts ─
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.sprite.position.y += 0.03;
    f.life -= 0.012;
    f.sprite.material.opacity = Math.max(0, f.life);
    if (f.life <= 0) {
      scene.remove(f.sprite);
      floatingTexts.splice(i, 1);
    }
  }

  // ─ Stars drift ─
  for (const s of stars) {
    const pos = s.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y -= 0.01;
      if (y < -25) y = 25;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  // ─ Volume 11 easter egg ─
  if (smoothVolume >= VOL_LOUD * 1.2) {
    sustainedScreamTime += dt;
  } else {
    sustainedScreamTime *= 0.85;
  }
  if (sustainedScreamTime > 5 && !volume11Active) {
    volume11Active = true;
    const msg = document.createElement('div');
    msg.id = 'vol11msg';
    msg.textContent = 'are you ok?';
    msg.style.cssText = 'position:fixed;bottom:12px;right:14px;color:#8b949e;font-size:11px;font-family:monospace;opacity:0;transition:opacity 2s;z-index:999;pointer-events:none';
    document.body.appendChild(msg);
    requestAnimationFrame(() => msg.style.opacity = '1');
    setTimeout(() => { msg.style.opacity = '0'; setTimeout(() => { msg.remove(); volume11Active = false; }, 2000); }, 6000);
  }
  if (sustainedScreamTime > 3) {
    shakeAmount = Math.max(shakeAmount, Math.min(sustainedScreamTime * 0.4, 3.0));
    crtOverlay.style.opacity = Math.min(0.15 + sustainedScreamTime * 0.08, 0.7);
  } else {
    crtOverlay.style.opacity = '';
  }

  // ─ Shake decay ─
  shakeAmount *= 0.9;
}

// ── Render ──
function render() {
  const sx = (Math.random() - 0.5) * shakeAmount * 2;
  const sy = (Math.random() - 0.5) * shakeAmount * 2;
  camera.position.x += sx;
  camera.position.y += sy;
  renderer.render(scene, camera);
  camera.position.x -= sx;
  camera.position.y -= sy;
}

// ── Main Loop ──
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  trackFace();
  update(dt);
  render();
}

// ── Init ──
async function init() {
  initThree();
  createShip();
  spawnInvaders();
  updateHUD();
  showOverlay('title');
  gameLoop();
  await setupCamera();
}

init();
