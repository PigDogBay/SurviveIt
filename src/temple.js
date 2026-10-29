import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { TEMPLE, TEMPLE_FLOOR } from './terrain.js';

// The hall, in metres. The front, with the door, faces the player's start.
const WIDTH = 14;
const DEPTH = 18;
const WALL_HEIGHT = 6;
const WALL = 1;
const DOOR_WIDTH = 3.2;
const DOOR_HEIGHT = 4;
// How close the minion must be to try the door.
const DOOR_REACH = 3.5;
const DOOR_OPEN_TIME = 2.5;
// Walls are rows of overlapping circles, so the same collision code that
// stops the minion walking through trees stops them walking through walls.
const WALL_RADIUS = 0.55;
const WALL_STEP = 0.5;
// One stone texture tile covers this many metres.
const TILE = 2;

// Rows of old stone blocks with dark mortar and patches of moss.
function stoneTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = createRandom(77);
  ctx.fillStyle = '#1c1a16';
  ctx.fillRect(0, 0, size, size);

  const rows = 4;
  const blockHeight = size / rows;
  for (let row = 0; row < rows; row++) {
    const blockWidth = size / 2;
    const offset = row % 2 ? blockWidth / 2 : 0;
    for (let x = -offset; x < size; x += blockWidth) {
      const shade = Math.floor(range(random, 88, 128));
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 18})`;
      ctx.fillRect(x + 3, row * blockHeight + 3, blockWidth - 6, blockHeight - 6);
      // Chips and stains so the blocks look worn.
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(0,0,0,${range(random, 0.05, 0.2)})`;
        ctx.fillRect(x + range(random, 3, blockWidth - 8), row * blockHeight + range(random, 3, blockHeight - 8), range(random, 2, 8), range(random, 2, 6));
      }
    }
  }

  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${Math.floor(range(random, 40, 70))},${Math.floor(range(random, 80, 110))},30,${range(random, 0.25, 0.6)})`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, range(random, 3, 14), 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 36, 0, 32, 36, 30);
  glow.addColorStop(0, 'rgba(255,240,180,1)');
  glow.addColorStop(0.35, 'rgba(255,150,40,0.8)');
  glow.addColorStop(1, 'rgba(200,50,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// A box whose stone texture is the same size on every face, however big
// the box is.
function stoneBox(width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  // Faces are +x, -x, +y, -y, +z, -z, with 4 corners each.
  const faces = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  faces.forEach(([u, v], face) => {
    for (let corner = 0; corner < 4; corner++) {
      const i = face * 4 + corner;
      uv.setXY(i, (uv.getX(i) * u) / TILE, (uv.getY(i) * v) / TILE);
    }
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// The ancient temple: a mossy stone hall with pillars at the front and a
// stepped roof. Its door is sealed until the minion brings the temple key.
export function createTemple({ keys, sounds, showMessage }) {
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xc8c0a8, roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ map: stone.map, color: 0x6e6858, roughness: 0.95 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf0c050, emissive: 0x7a5010, metalness: 0.4, roughness: 0.3 });
  const keyhole = new THREE.MeshBasicMaterial({ color: 0x050403 });

  const group = new THREE.Group();
  group.position.set(TEMPLE.x, TEMPLE_FLOOR, TEMPLE.z);
  group.rotation.y = Math.atan2(-TEMPLE.x, -TEMPLE.z);

  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const halfWidth = WIDTH / 2;
  const halfDepth = DEPTH / 2;
  const wallX = halfWidth - WALL / 2;
  const wallZ = halfDepth - WALL / 2;
  const doorEdge = DOOR_WIDTH / 2;

  // Walls, sunk a little into the ground. The front wall has a doorway.
  const sink = 0.5;
  const wallY = (WALL_HEIGHT - sink) / 2;
  const fullHeight = WALL_HEIGHT + sink;
  add(stoneBox(WALL, fullHeight, DEPTH, stone), -wallX, wallY, 0);
  add(stoneBox(WALL, fullHeight, DEPTH, stone), wallX, wallY, 0);
  add(stoneBox(WIDTH - 2 * WALL, fullHeight, WALL, stone), 0, wallY, -wallZ);
  const sideWidth = halfWidth - doorEdge;
  add(stoneBox(sideWidth, fullHeight, WALL, stone), -(doorEdge + sideWidth / 2), wallY, wallZ);
  add(stoneBox(sideWidth, fullHeight, WALL, stone), doorEdge + sideWidth / 2, wallY, wallZ);
  add(stoneBox(DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, WALL, stone), 0, (WALL_HEIGHT + DOOR_HEIGHT) / 2, wallZ);

  // Stone floors inside and under the porch, just above the ground.
  const floor = stoneBox(WIDTH - 2 * WALL, 0.1, DEPTH - 2 * WALL, darkStone);
  add(floor, 0, 0, 0);
  const porchDepth = 4.5;
  add(stoneBox(WIDTH + 2, 0.1, porchDepth, darkStone), 0, 0, halfDepth + porchDepth / 2);

  // A stepped roof, with a porch roof held up by four pillars.
  add(stoneBox(WIDTH + 2, 1, DEPTH + 2, stone), 0, WALL_HEIGHT + 0.5, 0);
  add(stoneBox(WIDTH - 2, 1.2, DEPTH - 4, stone), 0, WALL_HEIGHT + 1.6, 0);
  add(stoneBox(WIDTH - 6, 1.2, DEPTH - 9, stone), 0, WALL_HEIGHT + 2.8, 0);
  add(stoneBox(WIDTH + 2, 0.8, porchDepth, stone), 0, WALL_HEIGHT + 0.4, halfDepth + porchDepth / 2);

  const pillarZ = halfDepth + porchDepth - 1;
  const pillarXs = [-6, -3.2, 3.2, 6];
  const pillarGeometry = new THREE.CylinderGeometry(0.42, 0.48, WALL_HEIGHT - 0.6, 12);
  for (const x of pillarXs) {
    const pillar = add(new THREE.Mesh(pillarGeometry, stone), x, WALL_HEIGHT / 2, pillarZ);
    pillar.castShadow = pillar.receiveShadow = true;
    add(stoneBox(1.2, 0.3, 1.2, stone), x, 0.15, pillarZ);
    add(stoneBox(1.2, 0.3, 1.2, stone), x, WALL_HEIGHT - 0.15, pillarZ);
  }

  // The sealed door: a stone slab with a golden ring around a keyhole.
  const door = new THREE.Group();
  door.add(stoneBox(DOOR_WIDTH, DOOR_HEIGHT, 0.5, darkStone));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 32), gold);
  ring.position.set(0, 0.2, 0.26);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), keyhole);
  hole.position.set(0, 0.28, 0.27);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.25), keyhole);
  slot.position.set(0, 0.13, 0.27);
  door.add(ring, hole, slot);
  add(door, 0, DOOR_HEIGHT / 2, wallZ);

  // Fire bowls either side of the door, and one inside. Their glow ignores
  // fog, so the temple can be spotted through the trees.
  const flameMap = flameTexture();
  const beaconMaterial = new THREE.SpriteMaterial({ map: flameMap, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const flameMaterial = new THREE.SpriteMaterial({ map: flameMap, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [];
  function brazier(x, z, beacon) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 10), stone), x, 0.45, z).castShadow = true;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.3, 14), darkStone), x, 1.05, z).castShadow = true;
    for (let i = 0; i < 3; i++) {
      const flame = add(new THREE.Sprite(flameMaterial), x + (i - 1) * 0.12, 1.45, z);
      flames.push({ flame, phase: i * 2.1 + x });
    }
    if (beacon) add(new THREE.Sprite(beaconMaterial), x, 1.5, z).scale.set(5, 5, 1);
  }
  const brazierZ = halfDepth + 1.4;
  brazier(-2.2, brazierZ, true);
  brazier(2.2, brazierZ, true);
  brazier(0, -halfDepth + 2.5, false);

  const lights = [
    { light: add(new THREE.PointLight(0xff8a3a, 16, 18, 1.5), 0, 2, brazierZ), brightness: 16 },
    { light: add(new THREE.PointLight(0xff8a3a, 12, 16, 1.5), 0, 2.2, -halfDepth + 2.5), brightness: 12 },
  ];

  // Colliders, worked out in the temple's own space then moved into the world.
  group.updateMatrixWorld();
  const toWorld = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(group.matrixWorld);
  const colliders = [];
  const doorColliders = [];
  function wall(x1, z1, x2, z2, list = colliders) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.round(length / WALL_STEP));
    for (let i = 0; i <= steps; i++) {
      const point = toWorld(THREE.MathUtils.lerp(x1, x2, i / steps), THREE.MathUtils.lerp(z1, z2, i / steps));
      list.push({ x: point.x, z: point.z, radius: WALL_RADIUS });
    }
  }
  const doorGap = doorEdge + WALL_RADIUS;
  wall(-wallX, -wallZ, -wallX, wallZ);
  wall(wallX, -wallZ, wallX, wallZ);
  wall(-wallX, -wallZ, wallX, -wallZ);
  wall(-wallX, wallZ, -doorGap, wallZ);
  wall(doorGap, wallZ, wallX, wallZ);
  wall(-doorEdge, wallZ, doorEdge, wallZ, doorColliders);
  for (const x of pillarXs) {
    const point = toWorld(x, pillarZ);
    colliders.push({ x: point.x, z: point.z, radius: 0.6 });
  }
  for (const x of [-2.2, 2.2]) {
    const point = toWorld(x, brazierZ);
    colliders.push({ x: point.x, z: point.z, radius: 0.45 });
  }
  const point = toWorld(0, -halfDepth + 2.5);
  colliders.push({ x: point.x, z: point.z, radius: 0.45 });
  colliders.push(...doorColliders);

  const doorPosition = toWorld(0, wallZ);
  let state = 'locked';
  let opening = 0;

  function update(delta, time, playerPosition, collisions) {
    for (const { flame, phase } of flames) {
      const flicker = 0.85 + Math.sin(time * 9 + phase) * 0.1 + Math.sin(time * 23 + phase * 2) * 0.05;
      flame.scale.set(0.7 * flicker, 0.9 * flicker, 1);
    }
    for (const { light, brightness } of lights) {
      light.intensity = brightness * (0.9 + Math.sin(time * 11) * 0.06 + Math.sin(time * 27) * 0.04);
    }

    if (state === 'opening') {
      // The door grinds down into the ground.
      opening = Math.min(1, opening + delta / DOOR_OPEN_TIME);
      door.position.y = DOOR_HEIGHT / 2 - (DOOR_HEIGHT + 0.1) * opening * opening;
      door.position.x = Math.sin(time * 40) * 0.015 * (1 - opening);
      if (opening === 1) state = 'open';
      return;
    }
    if (state !== 'locked') return;

    const distance = Math.hypot(playerPosition.x - doorPosition.x, playerPosition.z - doorPosition.z);
    if (distance > DOOR_REACH) return;
    if (!keys.has('temple')) {
      showMessage('The temple is locked. Find the key!');
      return;
    }
    keys.use('temple');
    collisions.remove(doorColliders);
    sounds.rumble(DOOR_OPEN_TIME + 0.3);
    showMessage('The key fits! The temple door is opening');
    state = 'opening';
  }

  // The hall's footprint, for the map. `angle` is its turn about the y axis.
  const outline = { x: TEMPLE.x, z: TEMPLE.z, angle: group.rotation.y, width: WIDTH, depth: DEPTH };

  return { group, colliders, outline, update };
}
