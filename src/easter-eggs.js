import * as THREE from 'three';
import { buildCampfire, buildPot, buildRat, drawRatatouille, POT_TOP } from './camp.js';
import { buildSkeleton, buildSkull, drawDino, SKULL_SPOT } from './dino.js';
import { isUnderground, onDungeonFloor, UNDERGROUND } from './dungeon.js';
import { CAGE } from './felonius.js';
import { CAMP_CLEARING, DINO_CLEARING } from './forest.js';
import { fireMaterial } from './monsters.js';
import { heightAt, TEMPLE } from './terrain.js';

const EGG_HEIGHT = 0.8;
const EGG_RADIUS = 0.3;
// How high the bottom of an egg floats, and how far it bobs.
const FLOAT = 0.5;
const BOB = 0.15;

// A cartoon girl inspired by Sabrina Carpenter: wavy blonde hair with
// curtain bangs, big blue eyes and a pink smile. Drawn into the middle of
// the egg's texture, which wraps round the egg once.
function drawSabrina(ctx, cx, cy) {
  const blonde = '#f0c048';
  const blondeDark = '#b8862a';
  const skin = '#f4c9a8';
  const outline = '#5a3a1c';
  // Dark outlines, so the picture stands out even in torchlight.
  ctx.lineJoin = 'round';

  // Long wavy hair behind the face, falling past the shoulders.
  ctx.fillStyle = blonde;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy - 40);
  ctx.bezierCurveTo(cx - 140, cy - 190, cx + 140, cy - 190, cx + 120, cy - 40);
  for (let i = 0; i <= 4; i++) {
    const y = cy - 20 + i * 45;
    ctx.quadraticCurveTo(cx + 150 + (i % 2 ? -20 : 20), y + 22, cx + 125, y + 45);
  }
  ctx.lineTo(cx - 125, cy + 205);
  for (let i = 4; i >= 0; i--) {
    const y = cy - 20 + i * 45;
    ctx.quadraticCurveTo(cx - 150 + (i % 2 ? 20 : -20), y + 22, cx - 120, y);
  }
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.stroke();

  // The face.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 90, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Curtain bangs, parted in the middle and sweeping out to each side.
  ctx.fillStyle = blonde;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 105);
    ctx.quadraticCurveTo(cx + side * 30, cy - 60, cx + side * 95, cy - 20);
    ctx.lineTo(cx + side * 100, cy - 100);
    ctx.quadraticCurveTo(cx + side * 60, cy - 125, cx, cy - 105);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // Streaks so the hair looks wavy.
  ctx.strokeStyle = blondeDark;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (108 + i * 8), cy - 10 + i * 50);
      ctx.quadraticCurveTo(cx + side * (128 + i * 6), cy + 15 + i * 50, cx + side * (112 + i * 8), cy + 40 + i * 50);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx + side * 10, cy - 100);
    ctx.quadraticCurveTo(cx + side * 40, cy - 65, cx + side * 85, cy - 35);
    ctx.stroke();
  }

  // Big cartoon eyes with blue irises, lashes and a sparkle.
  for (const side of [-1, 1]) {
    const ex = cx + side * 38;
    const ey = cy + 5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1c28';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 4, ey - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1c28';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 24, 18, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (const lash of [0.15, 0.5, 0.85]) {
      const angle = Math.PI * (1.05 + lash * 0.9);
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(angle) * 24, ey + Math.sin(angle) * 18);
      ctx.lineTo(ex + Math.cos(angle) * 32, ey + Math.sin(angle) * 26);
      ctx.stroke();
    }
    // Soft brows.
    ctx.strokeStyle = '#8a5a26';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ex - 20, ey - 32);
    ctx.quadraticCurveTo(ex, ey - 40, ex + 20, ey - 33);
    ctx.stroke();
    // Rosy cheeks.
    ctx.fillStyle = 'rgba(235, 90, 120, 0.45)';
    ctx.beginPath();
    ctx.arc(cx + side * 55, cy + 45, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // A little nose and a big pink smile.
  ctx.strokeStyle = '#d9a88a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 42);
  ctx.quadraticCurveTo(cx, cy + 48, cx + 6, cy + 42);
  ctx.stroke();
  ctx.fillStyle = '#d63a64';
  ctx.beginPath();
  ctx.moveTo(cx - 32, cy + 62);
  ctx.quadraticCurveTo(cx, cy + 100, cx + 32, cy + 62);
  ctx.quadraticCurveTo(cx, cy + 74, cx - 32, cy + 62);
  ctx.fill();
  ctx.strokeStyle = '#8a1e3a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 66);
  ctx.quadraticCurveTo(cx, cy + 78, cx + 24, cy + 66);
  ctx.quadraticCurveTo(cx, cy + 72, cx - 24, cy + 66);
  ctx.fill();
}

// Couch Potato Pete, an original cartoon: a lumpy brown potato with green
// sprouts on top, big googly eyes and a huge buck-toothed grin. Drawn at
// (cx, cy), `size` times as big as on an egg. `look` moves his eyes left or
// right, and `chew` opens and shuts his mouth.
function drawPete(ctx, cx, cy, size = 1, look = 0, chew = 1) {
  const s = size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Sprouts first, so the potato covers their stalks.
  ctx.fillStyle = '#4caf3a';
  ctx.strokeStyle = '#1f5a18';
  ctx.lineWidth = 5 * s;
  for (const [angle, length] of [[-0.5, 70], [0.15, 85], [0.7, 60]]) {
    ctx.save();
    ctx.translate(cx + angle * 40 * s, cy - 105 * s);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -length * 0.5 * s, 16 * s, length * 0.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // A lumpy potato body.
  ctx.fillStyle = '#b07a44';
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 95 * s, cy);
  ctx.bezierCurveTo(cx - 105 * s, cy - 110 * s, cx + 80 * s, cy - 135 * s, cx + 100 * s, cy - 20 * s);
  ctx.bezierCurveTo(cx + 115 * s, cy + 90 * s, cx + 40 * s, cy + 130 * s, cx - 20 * s, cy + 120 * s);
  ctx.bezierCurveTo(cx - 90 * s, cy + 110 * s, cx - 88 * s, cy + 60 * s, cx - 95 * s, cy);
  ctx.fill();
  ctx.stroke();
  // Potato spots.
  ctx.fillStyle = '#7a4e26';
  for (const [x, y, r] of [[-60, -50, 7], [65, 40, 8], [-40, 85, 6], [55, -70, 5], [-75, 30, 5]]) {
    ctx.beginPath();
    ctx.ellipse(cx + x * s, cy + y * s, r * s, r * 0.7 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Big googly eyes.
  for (const side of [-1, 1]) {
    const ex = cx + side * 36 * s;
    const ey = cy - 30 * s;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 28 * s, 32 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c1c20';
    ctx.beginPath();
    ctx.arc(ex + (8 + look * 8) * s, ey + 6 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + (12 + look * 8) * s, ey + 1 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // A huge grin with two buck teeth.
  const open = 0.4 + 0.6 * chew;
  ctx.fillStyle = '#6a1a24';
  ctx.strokeStyle = '#2a1a0c';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 55 * s, cy + 25 * s);
  ctx.quadraticCurveTo(cx, cy + (25 + 70 * open) * s, cx + 55 * s, cy + 25 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8607a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + (25 + 45 * open) * s, 22 * s, 12 * s * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 3 * s;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(cx + (side < 0 ? -17 : 1) * s, cy + 25 * s, 16 * s, 20 * s);
    ctx.fill();
    ctx.stroke();
  }
}

// Pete's face on an egg.
function drawPeteEgg(ctx, cx, cy) {
  drawPete(ctx, cx, cy + 20, 1);
}

// "The Couch Potato Pete Show", playing on the TV: a bouncing title card,
// then Pete flopped on his orange couch, clicking his remote while popcorn
// flies into his mouth. `time` is in seconds and the show loops.
function drawShow(ctx, width, height, time) {
  const t = time % 8;
  if (t < 2.2) {
    ctx.fillStyle = '#2a4ad0';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffd84a';
    ctx.strokeStyle = '#1b1b40';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    ['COUCH', 'POTATO', 'PETE'].forEach((word, i) => {
      const bounce = Math.abs(Math.sin(t * 6 + i)) * 4;
      ctx.strokeText(word, width / 2, 26 + i * 24 - bounce);
      ctx.fillText(word, width / 2, 26 + i * 24 - bounce);
    });
    return;
  }
  // The living room: a purple wall, a brown floor and an orange couch.
  ctx.fillStyle = '#6a4a9a';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(0, height * 0.75, width, height * 0.25);
  ctx.fillStyle = '#e07a2a';
  ctx.fillRect(10, 52, width - 20, 30);
  ctx.fillRect(14, 34, width - 28, 22);
  // Pete bobs on the couch, chewing and glancing about.
  const bob = Math.sin(t * 4) * 2;
  drawPete(ctx, width / 2, 46 + bob, 0.22, Math.sin(t * 1.3), (Math.sin(t * 9) + 1) / 2);
  // His remote, with a red button that flashes when he clicks it.
  ctx.fillStyle = '#1c1c20';
  ctx.fillRect(width / 2 + 22, 54 + bob, 6, 14);
  ctx.fillStyle = Math.sin(t * 5) > 0.6 ? '#ff4040' : '#802020';
  ctx.fillRect(width / 2 + 23.5, 56 + bob, 3, 3);
  // Popcorn arcing up and into his mouth.
  ctx.fillStyle = '#fff6d0';
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.9 + i / 3) % 1;
    const x = width / 2 - 40 + p * 40;
    const y = 30 - Math.sin(p * Math.PI) * 22 + p * 20;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A cute green alien, our own design: a wide head, big black eyes with a
// shine, a little smile and two antennae with balls on top.
function drawAlien(ctx, cx, cy) {
  const green = '#3a9a2a';
  const outline = '#14400e';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Antennae.
  ctx.strokeStyle = outline;
  ctx.lineWidth = 7;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 35, cy - 80);
    ctx.quadraticCurveTo(cx + side * 55, cy - 140, cx + side * 85, cy - 165);
    ctx.stroke();
    ctx.fillStyle = '#f2e04a';
    ctx.beginPath();
    ctx.arc(cx + side * 88, cy - 168, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.lineWidth = 7;
  }
  // A wide head, narrowing to a pointed chin.
  ctx.fillStyle = green;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 115, cy - 10);
  ctx.bezierCurveTo(cx - 120, cy - 130, cx + 120, cy - 130, cx + 115, cy - 10);
  ctx.bezierCurveTo(cx + 105, cy + 70, cx + 40, cy + 130, cx, cy + 135);
  ctx.bezierCurveTo(cx - 40, cy + 130, cx - 105, cy + 70, cx - 115, cy - 10);
  ctx.fill();
  ctx.stroke();
  // Big black almond eyes, each with a shine.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 50, cy + 5);
    ctx.rotate(side * 0.45);
    ctx.fillStyle = '#0c0c14';
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-side * 12, -8, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // A little smile.
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy + 75);
  ctx.quadraticCurveTo(cx, cy + 92, cx + 22, cy + 75);
  ctx.stroke();
}

// Brown speckles all over, then the dinosaur.
function drawDinoEgg(ctx, cx, cy) {
  ctx.fillStyle = 'rgba(138, 90, 42, 0.45)';
  for (let i = 0; i < 160; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 440, 3 + Math.random() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  drawDino(ctx, cx, cy + 20);
}

// Every easter egg: its name (for the list at the end), where it is (in the
// temple's own space, z towards the front door, on a dungeon floor if
// `underground`), its colours, and the picture on it. The picture faces
// `look` (a direction in the temple's space), or else away from the temple.
// An egg that `appears` isn't there until something brings it out. One that
// is `dropped` has no spot: it falls from wherever `drop` is told.
const EGGS = [
  { name: 'Sabrina Carpenter egg', spot: [0, -12.5], colour: '#7cbce6', band: '#e86aa4', draw: drawSabrina },
  // Pops up beside the TV in the first dungeon's west room once the VHS tape
  // from the couch is played, so the show can still be seen.
  {
    name: 'Couch Potato Pete egg',
    spot: [-9.9, 5.1],
    underground: true,
    look: [1, -0.3],
    appears: true,
    colour: '#4c9a3a',
    band: '#e07a2a',
    draw: drawPeteEgg,
  },
  // Dropped by the UFO when it's shot.
  { name: 'Alien egg', dropped: true, appears: true, colour: '#7ae05a', band: '#3a1f6a', draw: drawAlien },
  // Laid by the T-Rex skeleton once its skull is put back. Speckled like a
  // real egg, with a cartoon dinosaur on the front.
  { name: 'Dino egg', dropped: true, appears: true, colour: '#f3e8c8', band: '#8a5a2a', draw: drawDinoEgg },
  // Rises out of the cooking pot once the dead rat has been cooked in it.
  { name: 'Ratatouille egg', dropped: true, appears: true, colour: '#f4dc8a', band: '#c83a2a', draw: drawRatatouille },
];

// The T-Rex skeleton stands in a clearing near the east edge of the map; its
// skull lies on the ground far away near the west edge.
const SKULL_LIES = { x: -142, z: -20 };
// The dead rat lies near Felonius's cage; the campfire and pot are in a
// clearing towards the north. Cooking takes a few seconds.
const RAT_LIES = { x: CAGE.x + 3, z: CAGE.z + 2.5 };
const POT_REACH = 2.2;
const COOK_TIME = 4;
// How close to the skeleton's neck the minion must bring the skull.
const SKELETON_REACH = 5;

// The couch is near the start, with the VHS tape floating over it. The TV is
// in the first dungeon's west room, against the wall, on a little table.
const COUCH = { x: 1.5, z: 4.5 };
const TV_SPOT = [-11.05, 6.5];
const TV_REACH = 1.8;
const RISE_TIME = 0.8;
// How close the minion must get to pick an egg up.
const PICKUP_DISTANCE = 1.2;

// A pastel egg with a zigzag band round the bottom and a picture on the front.
// The texture wraps round the egg once, with its middle on the front.
function eggTexture({ colour, band, draw }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, x % 64 ? 445 : 470);
  ctx.lineTo(1024, 500);
  ctx.lineTo(0, 500);
  ctx.fill();
  draw(ctx, 512, 210);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// An egg shape: rounder at the bottom, pointier at the top, standing on y = 0.
function eggGeometry() {
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const angle = t * Math.PI;
    // Squeezing the top half makes it an egg rather than a ball.
    const radius = Math.sin(angle) * EGG_RADIUS * (1 - 0.18 * t);
    points.push(new THREE.Vector2(Math.max(radius, 0.0001), (1 - Math.cos(angle)) / 2 * EGG_HEIGHT));
  }
  return new THREE.LatheGeometry(points, 48);
}

// An orange and brown plaid, like an old 80s couch.
function plaidTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a4e22';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(230, 150, 60, 0.6)';
  for (const at of [8, 40]) {
    ctx.fillRect(at, 0, 12, 64);
    ctx.fillRect(0, at, 64, 12);
  }
  ctx.fillStyle = 'rgba(60, 30, 10, 0.5)';
  for (const at of [26, 58]) {
    ctx.fillRect(at, 0, 3, 64);
    ctx.fillRect(0, at, 64, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A plaid couch with two seat cushions, arms and little wooden legs. Its
// front faces +z.
function buildCouch() {
  const fabric = new THREE.MeshStandardMaterial({ map: plaidTexture(), roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.7 });
  const couch = new THREE.Group();
  const box = (w, h, d, x, y, z, material = fabric) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    couch.add(mesh);
  };
  box(2, 0.4, 0.9, 0, 0.3, 0);
  for (const side of [-1, 1]) {
    box(0.95, 0.18, 0.72, side * 0.49, 0.59, 0.06);
    box(0.22, 0.6, 0.9, side * 1.0, 0.55, 0);
    for (const end of [-1, 1]) box(0.08, 0.1, 0.08, side * 0.9, 0.05, end * 0.35, wood);
  }
  box(2, 0.7, 0.25, 0, 0.8, -0.33);
  return couch;
}

// A black VHS tape with a white label and two little reel windows.
function buildTape() {
  const tape = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.025), plastic);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.035), new THREE.MeshStandardMaterial({ color: 0xf2f0e8 }));
  label.position.set(0, 0.025, 0.0135);
  tape.add(body, label);
  for (const x of [-0.045, 0.045]) {
    const reel = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), new THREE.MeshStandardMaterial({ color: 0x55555c }));
    reel.position.set(x, -0.015, 0.0135);
    tape.add(reel);
  }
  tape.scale.setScalar(2);
  tape.traverse((part) => (part.castShadow = true));
  return tape;
}

// An old box TV with rabbit-ear aerials, on a little wooden table. Its
// screen faces +z. `screen` is the canvas drawn on the screen.
function buildTV(screen) {
  const tv = new THREE.Group();
  const casing = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.55), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }));
  table.position.y = 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.5), casing);
  body.position.y = 0.775;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), new THREE.MeshBasicMaterial({ map: screen }));
  glass.position.set(-0.05, 0.79, 0.251);
  tv.add(table, body, glass);
  for (const y of [0.88, 0.74]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12).rotateX(Math.PI / 2), dark);
    knob.position.set(0.26, y, 0.26);
    tv.add(knob);
  }
  for (const side of [-1, 1]) {
    const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 6), dark);
    aerial.position.set(side * 0.1, 1.27, 0);
    aerial.rotation.z = -side * 0.45;
    tv.add(aerial);
  }
  tv.traverse((part) => (part.castShadow = part.receiveShadow = true));
  return tv;
}

// In the temple's own space: from a spot to the world, and the turn about y
// that points something facing +z along a direction.
const cos = Math.cos(TEMPLE.angle);
const sin = Math.sin(TEMPLE.angle);
const templeToWorld = (x, z) => [TEMPLE.x + x * cos + z * sin, TEMPLE.z - x * sin + z * cos];
const templeTurn = ([dx, dz]) => TEMPLE.angle + Math.atan2(dx, dz);

// Easter eggs hidden around the woods and the temple. They don't glow, so
// they're found by exploring with the torch, and they aren't on the map. Each
// floats a little off the ground, bobbing up and down. Walking into one
// collects it and tells `onCollect`. One of them comes out of the TV in the
// dungeon, once the minion brings it the VHS tape from the couch.
export function createEasterEggs({ onCollect, sounds, showMessage, trees = [] }) {
  const group = new THREE.Group();
  const colliders = [];
  const geometry = eggGeometry();
  const eggs = EGGS.map((egg, i) => {
    const [lx, lz] = egg.spot ?? [0, 0];
    const ground = egg.underground ? onDungeonFloor(lx, lz) : null;
    const [x, z] = ground ? [ground.x, ground.z] : templeToWorld(lx, lz);
    const floor = ground ? ground.y : heightAt(x, z);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: eggTexture(egg), roughness: 0.85 }));
    mesh.castShadow = true;
    // The texture's middle is at the back of the lathe, so turn it round.
    mesh.rotation.y = templeTurn(egg.look ?? [lx, lz]) + Math.PI;
    mesh.position.set(x, floor + FLOAT, z);
    let collider = null;
    if (!egg.appears) {
      group.add(mesh);
      collider = { x, z, radius: EGG_RADIUS + 0.05, above: floor - 1.5 };
      colliders.push(collider);
    }
    return { name: egg.name, mesh, collider, floor, phase: i * 1.7, collected: false, waiting: Boolean(egg.appears), appeared: 0, falling: false, fallSpeed: 0 };
  });

  // Drops a `dropped` egg from `from` (in the world): it falls to the ground
  // below, with its picture turned towards `facing`.
  function drop(name, from, facing) {
    const egg = eggs.find((e) => e.name === name);
    egg.waiting = false;
    egg.falling = true;
    egg.fallSpeed = 0;
    egg.floor = heightAt(from.x, from.z);
    egg.mesh.position.copy(from);
    egg.mesh.rotation.y = Math.atan2(facing.x - from.x, facing.z - from.z) + Math.PI;
    group.add(egg.mesh);
  }
  let lastTime = null;

  // The couch, with the VHS tape floating over the seat.
  const couch = buildCouch();
  const couchFloor = heightAt(COUCH.x, COUCH.z);
  couch.position.set(COUCH.x, couchFloor, COUCH.z);
  couch.rotation.y = Math.atan2(-COUCH.x, -COUCH.z);
  group.add(couch);
  for (const along of [-0.7, 0, 0.7]) {
    const x = COUCH.x + Math.cos(couch.rotation.y) * along;
    const z = COUCH.z - Math.sin(couch.rotation.y) * along;
    colliders.push({ x, z, radius: 0.5, above: couchFloor - 1.5 });
  }
  const tape = buildTape();
  tape.position.set(COUCH.x, couchFloor + 1.1, COUCH.z);
  group.add(tape);
  let tapeState = 'on couch';

  // The TV, showing static until the tape is played.
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 128;
  screenCanvas.height = 96;
  const screenCtx = screenCanvas.getContext('2d');
  const screen = new THREE.CanvasTexture(screenCanvas);
  screen.colorSpace = THREE.SRGBColorSpace;
  const tv = buildTV(screen);
  const tvSpot = onDungeonFloor(...TV_SPOT);
  tv.position.set(tvSpot.x, tvSpot.y, tvSpot.z);
  tv.rotation.y = templeTurn([1, 0]);
  group.add(tv);
  colliders.push({ x: tvSpot.x, z: tvSpot.z, radius: 0.45, below: UNDERGROUND });
  let lastStatic = -1;
  let toldAboutTV = false;

  function drawStatic() {
    const image = screenCtx.createImageData(128, 96);
    for (let i = 0; i < image.data.length; i += 4) {
      const grey = Math.random() * 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = grey;
      image.data[i + 3] = 255;
    }
    screenCtx.putImageData(image, 0, 0);
    screen.needsUpdate = true;
  }

  drawStatic();
  let showStarted = 0;
  let lastShowFrame = -1;

  // The headless skeleton, facing in towards the middle of the map.
  const skeleton = buildSkeleton();
  const dinoFloor = heightAt(DINO_CLEARING.x, DINO_CLEARING.z);
  skeleton.position.set(DINO_CLEARING.x, dinoFloor, DINO_CLEARING.z);
  // Turns its head end (+x) towards the middle.
  skeleton.rotation.y = Math.atan2(DINO_CLEARING.z, -DINO_CLEARING.x);
  group.add(skeleton);
  skeleton.updateMatrixWorld();
  // Its feet and the low end of its tail get in the way; the rest is high
  // enough to walk under.
  for (const [x, z, radius] of [[0.5, -0.45, 0.5], [0.5, 0.45, 0.5], [-3.6, 0, 0.5], [-4.6, 0, 0.45]]) {
    const point = skeleton.localToWorld(new THREE.Vector3(x, 0, z));
    colliders.push({ x: point.x, z: point.z, radius, above: dinoFloor - 1.5 });
  }
  const neck = skeleton.localToWorld(SKULL_SPOT.clone());

  // Moves a spot out of any tree or rock, spiralling outwards until it's clear.
  function clearOf({ x, z }) {
    for (let step = 0; step < 80; step++) {
      const px = x + Math.cos(step * 2.4) * step * 0.3;
      const pz = z + Math.sin(step * 2.4) * step * 0.3;
      if (trees.every((c) => Math.hypot(px - c.x, pz - c.z) > c.radius + 1.5)) return [px, pz];
    }
    return [x, z];
  }

  // The skull, lying on its side out in the woods, nudged clear of trees.
  const skull = buildSkull();
  const [skullX, skullZ] = clearOf(SKULL_LIES);
  const skullFloor = heightAt(skullX, skullZ);
  skull.position.set(skullX, skullFloor + 0.3, skullZ);
  skull.rotation.set(Math.PI / 2 - 0.2, 0.7, 0.1);
  group.add(skull);
  let skullState = 'lying';
  let toldAboutSkeleton = false;

  // The campfire with the pot hanging over it, steaming.
  const campFloor = heightAt(CAMP_CLEARING.x, CAMP_CLEARING.z);
  const { fire, flames } = buildCampfire();
  const { pot, stew } = buildPot();
  for (const part of [fire, pot]) {
    part.position.set(CAMP_CLEARING.x, campFloor, CAMP_CLEARING.z);
    group.add(part);
  }
  colliders.push({ x: CAMP_CLEARING.x, z: CAMP_CLEARING.z, radius: 0.7, above: campFloor - 1.5 });
  const steamMaterial = new THREE.SpriteMaterial({ map: fireMaterial.map, color: 0xd8d8e0, depthWrite: false, transparent: true, opacity: 0.4 });
  const steam = [0, 1, 2].map((i) => {
    const puff = new THREE.Sprite(steamMaterial);
    puff.userData.phase = i / 3;
    group.add(puff);
    return puff;
  });

  // The dead rat, near the cage, nudged clear of trees.
  const rat = buildRat();
  const [ratX, ratZ] = clearOf(RAT_LIES);
  const ratFloor = heightAt(ratX, ratZ);
  rat.position.set(ratX, ratFloor + 0.12, ratZ);
  rat.rotation.y = 0.8;
  group.add(rat);
  let ratState = 'lying';
  let cookStarted = 0;
  let lastBubble = 0;
  let toldAboutPot = false;

  // What the minion is carrying, shown under the keys.
  const items = document.getElementById('items');
  const carrying = new Set();
  function renderItems() {
    items.innerHTML = [...carrying].map((item) => `<span class="key">${item}</span>`).join('');
  }

  // Brings out an egg that `appears`, rising from the ground at (x, z).
  function bringOut(name, x, z, floor, time, facing) {
    const egg = eggs.find((e) => e.name === name);
    egg.waiting = false;
    egg.appeared = time;
    egg.floor = floor;
    egg.mesh.position.set(x, floor - EGG_HEIGHT, z);
    if (facing) egg.mesh.rotation.y = Math.atan2(facing.x - x, facing.z - z) + Math.PI;
    group.add(egg.mesh);
  }

  function update(time, playerPosition, collisions) {
    const delta = lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    const feet = playerPosition.y - 1.25;
    // Inside a dungeon, not just low down: the ground out east is lower than
    // the temple floor.
    const underground = isUnderground(playerPosition);

    if (tapeState === 'on couch') {
      tape.position.y = couchFloor + 1.1 + Math.sin(time * 1.5) * BOB;
      tape.rotation.y = time * 1.2;
      const near = Math.abs(feet - couchFloor) < 2 && Math.hypot(playerPosition.x - COUCH.x, playerPosition.z - COUCH.z) < 1.5;
      if (near) {
        tapeState = 'carried';
        group.remove(tape);
        carrying.add('📼 VHS tape');
        renderItems();
        sounds.chime();
        showMessage("You found a VHS tape! Maybe there's a TV somewhere...");
      }
    }

    // Walking up to the TV with the tape plays it, and an egg pops out.
    const atTV = underground && Math.hypot(playerPosition.x - tvSpot.x, playerPosition.z - tvSpot.z) < TV_REACH;
    if (tapeState === 'played' && Math.abs(time - lastShowFrame) > 1 / 12) {
      // The show plays at a cartoon-ish 12 frames a second.
      drawShow(screenCtx, 128, 96, time - showStarted);
      screen.needsUpdate = true;
      lastShowFrame = time;
    }
    if (tapeState !== 'played') {
      // A new frame of static every so often.
      if (Math.abs(time - lastStatic) > 0.08) {
        drawStatic();
        lastStatic = time;
      }
      if (atTV && tapeState === 'carried') {
        tapeState = 'played';
        carrying.delete('📼 VHS tape');
        renderItems();
        showStarted = time;
        sounds.click();
        sounds.pop();
        showMessage("You put the VHS tape in the TV... It's The Couch Potato Pete Show!");
        const egg = eggs.find((e) => e.name === 'Couch Potato Pete egg');
        bringOut(egg.name, egg.mesh.position.x, egg.mesh.position.z, egg.floor, time);
      } else if (atTV && !toldAboutTV) {
        toldAboutTV = true;
        showMessage('An old TV, showing static. It needs something to play...');
      }
    }

    // The campfire flickers, and the pot steams: much more while it cooks.
    const cooking = ratState === 'cooking';
    flames.forEach((flame, i) => {
      const flicker = 0.8 + Math.sin(time * 11 + i * 2) * 0.15 + Math.random() * 0.1;
      flame.scale.set(0.7 * flame.userData.size * flicker, 1.1 * flame.userData.size * flicker, 1);
    });
    steam.forEach((puff) => {
      const rise = (time * (cooking ? 0.9 : 0.35) + puff.userData.phase) % 1;
      puff.position.set(CAMP_CLEARING.x + Math.sin(rise * 6) * 0.1, campFloor + POT_TOP + rise * (cooking ? 1.6 : 1), CAMP_CLEARING.z);
      puff.scale.setScalar((0.4 + rise * 0.9) * (cooking ? 1.5 : 1));
    });
    steamMaterial.opacity = cooking ? 0.6 : 0.3;
    stew.position.y = POT_TOP - 0.1 + (cooking ? Math.sin(time * 25) * 0.015 : 0);

    // The rat: pick it up, then put it in the pot to cook.
    if (ratState === 'lying') {
      const near = Math.abs(feet - ratFloor) < 2 && Math.hypot(playerPosition.x - ratX, playerPosition.z - ratZ) < 1.4;
      if (near) {
        ratState = 'carried';
        group.remove(rat);
        carrying.add('🐀 Dead rat');
        renderItems();
        sounds.chime();
        showMessage('Eww, a dead rat! Maybe someone could cook it...');
      }
    }
    const atPot = !underground && Math.hypot(playerPosition.x - CAMP_CLEARING.x, playerPosition.z - CAMP_CLEARING.z) < POT_REACH;
    if (atPot && ratState === 'carried') {
      ratState = 'cooking';
      cookStarted = time;
      carrying.delete('🐀 Dead rat');
      renderItems();
      sounds.pop();
      showMessage('Hmmm tasty rat!');
    } else if (atPot && ratState === 'lying' && !toldAboutPot) {
      toldAboutPot = true;
      showMessage('A cooking pot over a campfire. It needs something tasty in it...');
    }
    if (cooking) {
      if (time - lastBubble > 0.35) {
        sounds.bubble();
        lastBubble = time;
      }
      if (time - cookStarted > COOK_TIME) {
        ratState = 'cooked';
        sounds.chime();
        showMessage("The rat is cooked... and it's made the Ratatouille egg!");
        // The egg rises up out of the pot and floats above it.
        bringOut('Ratatouille egg', CAMP_CLEARING.x, CAMP_CLEARING.z, campFloor + POT_TOP - 0.2, time, playerPosition);
      }
    }

    // The skull: pick it up, then bring it to the skeleton, which lays an egg.
    if (skullState === 'lying') {
      const near = Math.abs(feet - skullFloor) < 2 && Math.hypot(playerPosition.x - skullX, playerPosition.z - skullZ) < 1.6;
      if (near) {
        skullState = 'carried';
        group.remove(skull);
        carrying.add('🦴 T-Rex skull');
        renderItems();
        sounds.chime();
        showMessage('You found a huge T-Rex skull! I wonder where it belongs...');
      }
    }
    const atSkeleton = !underground && Math.hypot(playerPosition.x - neck.x, playerPosition.z - neck.z) < SKELETON_REACH;
    if (atSkeleton && skullState === 'carried') {
      skullState = 'returned';
      carrying.delete('🦴 T-Rex skull');
      renderItems();
      // The skull goes back on its neck, snout first.
      skull.position.copy(SKULL_SPOT);
      skull.rotation.set(0, 0, -0.15);
      skeleton.add(skull);
      sounds.roar(1);
      sounds.chime();
      showMessage('The skull fits! The T-Rex... laid an egg?!');
      const nest = skeleton.localToWorld(new THREE.Vector3(-1.2, 0, 1.4));
      bringOut('Dino egg', nest.x, nest.z, heightAt(nest.x, nest.z), time, playerPosition);
    } else if (atSkeleton && skullState === 'lying' && !toldAboutSkeleton) {
      toldAboutSkeleton = true;
      showMessage("A T-Rex skeleton... but where's its skull?");
    }

    for (const egg of eggs) {
      if (egg.collected || egg.waiting) continue;
      const { mesh, floor, phase } = egg;
      // A dropped egg falls to the ground first, then floats like the rest.
      if (egg.falling) {
        egg.fallSpeed += 12 * delta;
        mesh.position.y -= egg.fallSpeed * delta;
        mesh.rotation.y += delta * 4;
        if (mesh.position.y > floor + FLOAT) continue;
        egg.falling = false;
        egg.phase = -time * 1.5;
      }
      // An egg that's just appeared rises up out of the floor first.
      const rise = egg.appeared ? Math.min(1, (time - egg.appeared) / RISE_TIME) : 1;
      mesh.position.y = floor - EGG_HEIGHT * (1 - rise) + (FLOAT + Math.sin(time * 1.5 + phase) * BOB) * rise;
      if (rise < 1) continue;
      // Only on the same level, so an egg can't be reached from a dungeon underneath.
      const near =
        Math.abs(feet - floor) < 2 &&
        Math.hypot(playerPosition.x - mesh.position.x, playerPosition.z - mesh.position.z) < PICKUP_DISTANCE;
      if (!near) continue;
      egg.collected = true;
      group.remove(mesh);
      if (egg.collider) collisions.remove([egg.collider]);
      onCollect(egg.name);
    }
  }

  return {
    group,
    colliders,
    update,
    // The names of the eggs collected so far, and how many there are.
    drop,
    found: () => eggs.filter((egg) => egg.collected).map((egg) => egg.name),
    total: eggs.length,
  };
}
