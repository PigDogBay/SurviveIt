import * as THREE from 'three';

// Old, pale bone. It isn't lit from inside, but is pale enough to show up
// in torchlight.
const bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, emissive: 0x1a1810, roughness: 0.8 });
const hollow = new THREE.MeshBasicMaterial({ color: 0x1a140c });

// Where the skull sits on the skeleton, in the skeleton's own space.
export const SKULL_SPOT = new THREE.Vector3(4.65, 4.05, 0);

// A T-Rex skull: a long head with a lower jaw, deep eye holes and rows of
// pointed teeth. Its snout points along +x.
export function buildSkull() {
  const skull = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.5), bone);
  head.position.set(0.55, 0.1, 0);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.55), bone);
  brow.position.set(0.1, 0.4, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), bone);
  snout.position.set(1.35, 0.05, 0);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.42), bone);
  jaw.position.set(0.7, -0.35, 0);
  jaw.rotation.z = -0.12;
  skull.add(head, brow, snout, jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), hollow);
    eye.position.set(0.2, 0.28, side * 0.28);
    eye.rotation.y = side < 0 ? Math.PI : 0;
    const nostril = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), hollow);
    nostril.position.set(1.45, 0.15, side * 0.205);
    nostril.rotation.y = side < 0 ? Math.PI : 0;
    skull.add(eye, nostril);
    // Teeth along the top and bottom jaws.
    for (let i = 0; i < 6; i++) {
      const x = 0.4 + i * 0.2;
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5).rotateX(Math.PI), bone);
      top.position.set(x, -0.22, side * 0.2);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), bone);
      bottom.position.set(x + 0.08, -0.22 - i * 0.017, side * 0.18);
      skull.add(top, bottom);
    }
  }
  skull.traverse((part) => (part.castShadow = true));
  return skull;
}

// A headless T-Rex skeleton standing on its back legs: a long spine from the
// tip of its tail to its neck, ribs, a big pelvis, huge legs with clawed
// feet and tiny arms. Its head end points along +x, with its feet at y = 0.
export function buildSkeleton() {
  const skeleton = new THREE.Group();
  const add = (geometry, x, y, z, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, bone);
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    skeleton.add(mesh);
    return mesh;
  };

  // The spine follows this curve from the tail tip, up over the hips, to the neck.
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.2, 1.1, 0),
    new THREE.Vector3(-3.6, 1.9, 0),
    new THREE.Vector3(-1.8, 2.7, 0),
    new THREE.Vector3(0, 3.05, 0),
    new THREE.Vector3(1.6, 3.15, 0),
    new THREE.Vector3(2.9, 3.25, 0),
    new THREE.Vector3(3.7, 3.6, 0),
    new THREE.Vector3(4.3, 3.95, 0),
  ]);
  const count = 30;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const point = spine.getPoint(t);
    const tangent = spine.getTangent(t);
    // Bigger round the hips and chest, small at the tail tip.
    const size = 0.12 + 0.2 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.75);
    const tilt = Math.atan2(tangent.y, tangent.x);
    add(new THREE.BoxGeometry(size * 1.1, size, size), point.x, point.y, point.z, [0, 0, tilt]);
    // A spine sticking up from each one along the back.
    if (t > 0.15 && t < 0.85) add(new THREE.BoxGeometry(0.05, size * 1.6, 0.05), point.x, point.y + size, point.z, [0, 0, tilt - 0.2]);
  }

  // Ribs: curved bones hanging down each side of the chest from the spine,
  // longest in the middle.
  for (let i = 0; i < 8; i++) {
    const x = 0.6 + i * 0.3;
    const depth = 1.1 - Math.abs(i - 3) * 0.12;
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.15, side * 0.35),
        new THREE.Vector3(0, -depth * 0.6, side * 0.5),
        new THREE.Vector3(-0.1, -depth, side * 0.3),
      ]);
      add(new THREE.TubeGeometry(curve, 10, 0.035, 5), x, 3.05, 0);
    }
  }

  // The pelvis, and a pair of huge legs: thigh, shin, then a clawed foot.
  add(new THREE.BoxGeometry(1.2, 0.5, 0.9), 0, 2.75, 0);
  for (const side of [-1, 1]) {
    const z = side * 0.45;
    add(new THREE.CylinderGeometry(0.16, 0.12, 1.6, 8), 0.35, 2.05, z, [0, 0, 0.45]);
    add(new THREE.CylinderGeometry(0.11, 0.09, 1.5, 8), 0.3, 0.85, z, [0, 0, -0.35]);
    for (const spread of [-0.35, 0, 0.35]) {
      add(new THREE.ConeGeometry(0.06, 0.55, 6), 0.55 + Math.cos(spread) * 0.2, 0.1, z + Math.sin(spread) * 0.25, [0, -spread, -Math.PI / 2]);
    }
    // Tiny arms with two fingers.
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.5, 6), 2.95, 2.65, side * 0.35, [0, 0, 0.7]);
    for (const finger of [-0.04, 0.04]) add(new THREE.ConeGeometry(0.02, 0.15, 5), 3.2, 2.42, side * 0.35 + finger, [0, 0, Math.PI]);
  }
  return skeleton;
}

// An original cartoon dinosaur for the egg: a chunky little green T-Rex in
// side view, with a big grin, a big eye, orange spikes and tiny arms.
export function drawDino(ctx, cx, cy) {
  const green = '#5cc04a';
  const belly = '#d8f0a0';
  const outline = '#1f5a18';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  // Orange spikes along the back.
  ctx.fillStyle = '#f08a3a';
  for (let i = 0; i < 6; i++) {
    const x = cx - 150 + i * 42;
    const y = cy - 30 - Math.sin((i / 5) * Math.PI) * 50;
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 12);
    ctx.lineTo(x, y - 24);
    ctx.lineTo(x + 18, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Legs, then a body that sweeps back into a tail.
  ctx.fillStyle = green;
  for (const x of [cx - 50, cx + 20]) {
    ctx.beginPath();
    ctx.roundRect(x, cy + 40, 44, 100, 14);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 230, cy + 20);
  ctx.quadraticCurveTo(cx - 150, cy - 30, cx - 70, cy - 40);
  ctx.quadraticCurveTo(cx + 40, cy - 70, cx + 80, cy - 10);
  ctx.quadraticCurveTo(cx + 90, cy + 80, cx - 10, cy + 85);
  ctx.quadraticCurveTo(cx - 110, cy + 85, cx - 230, cy + 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy + 40, 55, 32, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // A big head on top, with a wide grin and a big eye.
  ctx.fillStyle = green;
  ctx.beginPath();
  ctx.roundRect(cx + 30, cy - 150, 170, 110, 50);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 95, cy - 112, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c1c20';
  ctx.beginPath();
  ctx.arc(cx + 102, cy - 110, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 106, cy - 115, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 95, cy - 72);
  ctx.quadraticCurveTo(cx + 150, cy - 50, cx + 190, cy - 78);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const x of [cx + 120, cx + 145, cx + 168]) {
    ctx.beginPath();
    ctx.moveTo(x - 7, cy - 68 + (x - cx - 120) * -0.1);
    ctx.lineTo(x, cy - 56 + (x - cx - 120) * -0.1);
    ctx.lineTo(x + 7, cy - 68 + (x - cx - 120) * -0.1);
    ctx.fill();
  }
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(cx + 182, cy - 120, 5, 0, Math.PI * 2);
  ctx.fill();
  // Tiny arms.
  ctx.lineWidth = 12;
  ctx.strokeStyle = green;
  ctx.beginPath();
  ctx.moveTo(cx + 60, cy + 5);
  ctx.lineTo(cx + 95, cy + 20);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.moveTo(cx + 60, cy - 2);
  ctx.lineTo(cx + 97, cy + 12);
  ctx.moveTo(cx + 58, cy + 12);
  ctx.lineTo(cx + 95, cy + 28);
  ctx.stroke();
}
