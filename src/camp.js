import * as THREE from 'three';
import { fireMaterial } from './monsters.js';

// How high the top of the pot is above the ground.
export const POT_TOP = 1.05;

// A campfire: crossed logs in a ring of stones, with flames dancing on top
// and a warm glow. `flames` are the sprites to flicker.
export function buildCampfire() {
  const fire = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.9 });
  const charred = new THREE.MeshStandardMaterial({ color: 0x1c1410, emissive: 0x3a1004, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 7).rotateZ(Math.PI / 2), i % 2 ? wood : charred);
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.1 + (i % 2) * 0.08;
    fire.add(log);
  }
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13), stone);
    rock.position.set(Math.cos(angle) * 0.62, 0.08, Math.sin(angle) * 0.62);
    rock.rotation.set(angle, angle * 2, 0);
    fire.add(rock);
  }
  const flames = [];
  for (const [x, z, size] of [[0, 0, 1], [0.15, 0.1, 0.7], [-0.15, -0.08, 0.75], [0.05, -0.15, 0.6]]) {
    const flame = new THREE.Sprite(fireMaterial);
    flame.position.set(x, 0.35 * size + 0.15, z);
    flame.userData.size = size;
    fire.add(flame);
    flames.push(flame);
  }
  // A soft orange glow round the fire, so the camp shows up in the dark.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,150,60,0.6)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(4, 4, 1);
  halo.position.y = 0.6;
  fire.add(halo);
  fire.traverse((part) => (part.castShadow = !part.isSprite));
  return { fire, flames };
}

// An iron cooking pot hanging from a tripod of sticks over the fire, with
// stew in it. `stew` is the surface, to bubble when cooking.
export function buildPot() {
  const pot = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, emissive: 0x0c0a08, metalness: 0.3, roughness: 0.6 });
  const stick = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
  // A round-bellied pot, open at the top with a lip.
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    profile.push(new THREE.Vector2(0.05 + Math.sin(t * Math.PI * 0.85) * 0.42, t * 0.55));
  }
  profile.push(new THREE.Vector2(0.27, 0.57), new THREE.Vector2(0.24, 0.55));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide }));
  body.position.y = POT_TOP - 0.57;
  const stew = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a3a1c, emissive: 0x2a0a04, roughness: 0.5 }));
  stew.position.y = POT_TOP - 0.1;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 20, Math.PI), iron);
  handle.position.y = POT_TOP;
  pot.add(body, stew, handle);
  // The tripod: three sticks meeting above the pot, and a chain down to it.
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.1, 6), stick);
    leg.position.set(Math.cos(angle) * 0.45, 0.95, Math.sin(angle) * 0.45);
    leg.rotation.set(Math.sin(angle) * -0.42, 0, Math.cos(angle) * 0.42);
    pot.add(leg);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.65, 4), iron);
  chain.position.y = POT_TOP + 0.6;
  pot.add(chain);
  pot.traverse((part) => (part.castShadow = true));
  return { pot, stew };
}

// A dead rat on its back: a grey body, feet in the air, X's for eyes and a
// long pink tail. Lies along x, nose at +x.
export function buildRat() {
  const rat = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x6a6460, roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a8, roughness: 0.7 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1c1c20 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), fur);
  body.scale.set(1.7, 0.85, 1);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 10).rotateZ(-Math.PI / 2), fur);
  head.position.set(0.32, 0.02, 0);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), pink);
  nose.position.set(0.44, 0.02, 0);
  rat.add(body, head, nose);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), pink);
    ear.position.set(0.25, 0.09, side * 0.07);
    ear.rotation.x = -Math.PI / 2;
    rat.add(ear);
    // X's for eyes.
    for (const tilt of [-0.7, 0.7]) {
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), dark);
      stroke.position.set(0.3, 0.075, side * 0.045);
      stroke.rotation.y = tilt;
      rat.add(stroke);
    }
    // Feet sticking up in the air.
    for (const x of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5), pink);
      leg.position.set(x, 0.15, side * 0.07);
      rat.add(leg);
    }
  }
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, 0, 0),
        new THREE.Vector3(-0.4, -0.02, 0.1),
        new THREE.Vector3(-0.55, -0.03, -0.05),
        new THREE.Vector3(-0.7, -0.03, 0.08),
      ]),
      16,
      0.012,
      5,
    ),
    pink,
  );
  rat.add(tail);
  rat.traverse((part) => (part.castShadow = true));
  rat.scale.setScalar(1.5);
  return rat;
}

// A steaming bowl of ratatouille for the egg: slices of tomato, courgette
// and aubergine in a red stew, with steam curling up.
export function drawRatatouille(ctx, cx, cy) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Steam.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 8;
  for (const x of [-60, 0, 60]) {
    ctx.beginPath();
    ctx.moveTo(cx + x, cy - 30);
    ctx.bezierCurveTo(cx + x - 25, cy - 70, cx + x + 25, cy - 100, cx + x, cy - 140);
    ctx.stroke();
  }
  // The stew, and the slices sitting on top of it.
  ctx.fillStyle = '#b8321e';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 150, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  const slices = [
    [-110, -5, '#e0402a', '#f07a5a'],
    [-70, 8, '#4a9a2a', '#d8f0a0'],
    [-30, -8, '#5a2a6a', '#e8d8c0'],
    [10, 6, '#e0402a', '#f07a5a'],
    [50, -6, '#4a9a2a', '#d8f0a0'],
    [90, 6, '#5a2a6a', '#e8d8c0'],
    [120, -6, '#e0402a', '#f07a5a'],
  ];
  for (const [x, y, rim, middle] of slices) {
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(cx + x, cy + y, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = middle;
    ctx.beginPath();
    ctx.ellipse(cx + x, cy + y, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The bowl.
  ctx.fillStyle = '#f4f0e8';
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 165, cy + 5);
  ctx.quadraticCurveTo(cx - 150, cy + 150, cx, cy + 155);
  ctx.quadraticCurveTo(cx + 150, cy + 150, cx + 165, cy + 5);
  ctx.quadraticCurveTo(cx, cy + 40, cx - 165, cy + 5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#3a6ad0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 140, cy + 70);
  ctx.quadraticCurveTo(cx, cy + 100, cx + 140, cy + 70);
  ctx.stroke();
}
