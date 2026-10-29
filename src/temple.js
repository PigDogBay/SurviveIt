import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { TEMPLE, TEMPLE_FLOOR } from './terrain.js';
import { keyInfo } from './keys.js';

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

// Hidden chambers, two on each side of the hall, each opened by its own key.
// `side` is -1 for the left wall and 1 for the right; `z` is where along it.
const CHAMBERS = [
  { key: 'red', side: -1, z: 4 },
  { key: 'blue', side: -1, z: -4 },
  { key: 'green', side: 1, z: 4 },
  { key: 'purple', side: 1, z: -4 },
];
const CHAMBER_WIDTH = 6;
const CHAMBER_DEPTH = 7;
const CHAMBER_HEIGHT = 4.5;
const CHAMBER_DOOR_WIDTH = 2.4;
const CHAMBER_DOOR_HEIGHT = 3;
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
// stepped roof, and four hidden chambers built onto its sides. Each door is
// sealed until the minion brings the key that fits it.
export function createTemple({ keys, sounds, showMessage }) {
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xc8c0a8, roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ map: stone.map, color: 0x6e6858, roughness: 0.95 });
  const keyhole = new THREE.MeshBasicMaterial({ color: 0x050403 });

  const group = new THREE.Group();
  group.position.set(TEMPLE.x, TEMPLE_FLOOR, TEMPLE.z);
  group.rotation.y = Math.atan2(-TEMPLE.x, -TEMPLE.z);
  group.updateMatrixWorld();
  // Everything is laid out in the temple's own space, then moved into the world.
  const toWorld = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(group.matrixWorld);

  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const colliders = [];
  function wall(x1, z1, x2, z2, list = colliders) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.round(length / WALL_STEP));
    for (let i = 0; i <= steps; i++) {
      const point = toWorld(THREE.MathUtils.lerp(x1, x2, i / steps), THREE.MathUtils.lerp(z1, z2, i / steps));
      list.push({ x: point.x, z: point.z, radius: WALL_RADIUS });
    }
  }
  function post(x, z, radius) {
    const point = toWorld(x, z);
    colliders.push({ x: point.x, z: point.z, radius });
  }

  const halfWidth = WIDTH / 2;
  const halfDepth = DEPTH / 2;
  const wallX = halfWidth - WALL / 2;
  const wallZ = halfDepth - WALL / 2;
  const doorEdge = DOOR_WIDTH / 2;

  // Walls, sunk a little into the ground. The front wall has the main
  // doorway and each side wall has two doorways into the chambers.
  const sink = 0.5;
  const wallY = (WALL_HEIGHT - sink) / 2;
  const fullHeight = WALL_HEIGHT + sink;
  add(stoneBox(WIDTH - 2 * WALL, fullHeight, WALL, stone), 0, wallY, -wallZ);
  wall(-wallX, -wallZ, wallX, -wallZ);
  const sideWidth = halfWidth - doorEdge;
  add(stoneBox(sideWidth, fullHeight, WALL, stone), -(doorEdge + sideWidth / 2), wallY, wallZ);
  add(stoneBox(sideWidth, fullHeight, WALL, stone), doorEdge + sideWidth / 2, wallY, wallZ);
  add(stoneBox(DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, WALL, stone), 0, (WALL_HEIGHT + DOOR_HEIGHT) / 2, wallZ);
  wall(-wallX, wallZ, -(doorEdge + WALL_RADIUS), wallZ);
  wall(doorEdge + WALL_RADIUS, wallZ, wallX, wallZ);

  const chamberDoorZs = [...new Set(CHAMBERS.map((c) => c.z))].sort((a, b) => a - b);
  const chamberDoorEdge = CHAMBER_DOOR_WIDTH / 2;
  for (const side of [-1, 1]) {
    const x = side * wallX;
    // The solid stretches between the doorways.
    const edges = [-halfDepth, ...chamberDoorZs.flatMap((z) => [z - chamberDoorEdge, z + chamberDoorEdge]), halfDepth];
    for (let i = 0; i < edges.length; i += 2) {
      const [from, to] = [edges[i], edges[i + 1]];
      add(stoneBox(WALL, fullHeight, to - from, stone), x, wallY, (from + to) / 2);
      const inset = (edge) => (Math.abs(edge) === halfDepth ? 0 : WALL_RADIUS);
      wall(x, from + inset(from), x, to - inset(to));
    }
    for (const z of chamberDoorZs) {
      add(stoneBox(WALL, WALL_HEIGHT - CHAMBER_DOOR_HEIGHT, CHAMBER_DOOR_WIDTH, stone), x, (WALL_HEIGHT + CHAMBER_DOOR_HEIGHT) / 2, z);
    }
  }

  // Stone floors inside and under the porch, just above the ground.
  add(stoneBox(WIDTH - 2 * WALL, 0.1, DEPTH - 2 * WALL, darkStone), 0, 0, 0);
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
    post(x, pillarZ, 0.6);
  }

  // The chambers: small stone rooms against the outside of the side walls,
  // each with a glowing gem on a stand in the middle.
  const gems = [];
  const gemGeometry = new THREE.OctahedronGeometry(0.28);
  const chamberFull = CHAMBER_HEIGHT + sink;
  const chamberWallY = (CHAMBER_HEIGHT - sink) / 2;
  const halfChamber = CHAMBER_DEPTH / 2;
  for (const chamber of CHAMBERS) {
    const { side, z } = chamber;
    const colour = keyInfo(chamber.key).colour;
    const outerX = side * (halfWidth + CHAMBER_WIDTH - WALL / 2);
    const middleX = side * (halfWidth + CHAMBER_WIDTH / 2);
    add(stoneBox(WALL, chamberFull, CHAMBER_DEPTH, stone), outerX, chamberWallY, z);
    wall(outerX, z - halfChamber, outerX, z + halfChamber);
    for (const end of [-1, 1]) {
      const endZ = z + end * (halfChamber - WALL / 2);
      add(stoneBox(CHAMBER_WIDTH, chamberFull, WALL, stone), middleX, chamberWallY, endZ);
      wall(side * halfWidth, endZ, outerX, endZ);
    }
    add(stoneBox(CHAMBER_WIDTH - WALL, 0.1, CHAMBER_DEPTH - 2 * WALL, darkStone), middleX - (side * WALL) / 2, 0, z);
    add(stoneBox(CHAMBER_WIDTH + 1, 0.8, CHAMBER_DEPTH + 1, stone), middleX, CHAMBER_HEIGHT + 0.4, z);

    const standX = middleX - (side * WALL) / 2;
    add(stoneBox(0.8, 1, 0.8, stone), standX, 0.5, z);
    post(standX, z, 0.55);
    const gem = add(new THREE.Mesh(gemGeometry, new THREE.MeshBasicMaterial({ color: colour })), standX, 1.45, z);
    gems.push(gem);
  }

  // Sealed doors: stone slabs with a coloured ring around a keyhole. They
  // face `turn` (a turn about y; 0 faces the front of the temple).
  const doors = [];
  function door({ x, z, turn, width, height, keyId, locked, opened }) {
    const ring = new THREE.MeshStandardMaterial({ color: keyInfo(keyId).colour, emissive: keyInfo(keyId).colour, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.3 });
    const slab = new THREE.Group();
    slab.add(stoneBox(width, height, 0.5, darkStone));
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 32), ring);
    ringMesh.position.set(0, 0.2, 0.26);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), keyhole);
    hole.position.set(0, 0.28, 0.27);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.25), keyhole);
    slot.position.set(0, 0.13, 0.27);
    slab.add(ringMesh, hole, slot);
    slab.rotation.y = turn;
    add(slab, x, height / 2, z);

    // Colliders across the doorway, along the slab's width.
    const along = new THREE.Vector2(Math.cos(turn), -Math.sin(turn)).multiplyScalar(width / 2);
    const doorColliders = [];
    wall(x - along.x, z - along.y, x + along.x, z + along.y, doorColliders);
    colliders.push(...doorColliders);
    doors.push({ slab, height, keyId, locked, opened, colliders: doorColliders, position: toWorld(x, z), state: 'locked', opening: 0 });
  }

  door({
    x: 0,
    z: wallZ,
    turn: 0,
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
    keyId: 'temple',
    locked: 'The temple is locked. Find the key!',
    opened: 'The key fits! The temple door is opening',
  });
  for (const { key, side, z } of CHAMBERS) {
    const name = keyInfo(key).name.toLowerCase();
    door({
      x: side * wallX,
      z,
      // Face into the hall.
      turn: (-side * Math.PI) / 2,
      width: CHAMBER_DOOR_WIDTH,
      height: CHAMBER_DOOR_HEIGHT,
      keyId: key,
      locked: `This chamber is sealed. It needs the ${name}`,
      opened: `The ${name} fits! A hidden chamber opens`,
    });
  }

  // Fire bowls either side of the front door, and one inside. Their glow
  // ignores fog, so the temple can be spotted through the trees.
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
    post(x, z, 0.45);
  }
  const brazierZ = halfDepth + 1.4;
  brazier(-2.2, brazierZ, true);
  brazier(2.2, brazierZ, true);
  brazier(0, -halfDepth + 2.5, false);

  const lights = [
    { light: add(new THREE.PointLight(0xff8a3a, 16, 18, 1.5), 0, 2, brazierZ), brightness: 16 },
    { light: add(new THREE.PointLight(0xff8a3a, 12, 16, 1.5), 0, 2.2, -halfDepth + 2.5), brightness: 12 },
  ];

  function update(delta, time, playerPosition, collisions) {
    for (const { flame, phase } of flames) {
      const flicker = 0.85 + Math.sin(time * 9 + phase) * 0.1 + Math.sin(time * 23 + phase * 2) * 0.05;
      flame.scale.set(0.7 * flicker, 0.9 * flicker, 1);
    }
    for (const { light, brightness } of lights) {
      light.intensity = brightness * (0.9 + Math.sin(time * 11) * 0.06 + Math.sin(time * 27) * 0.04);
    }
    gems.forEach((gem, i) => {
      gem.rotation.y = time * 1.2 + i;
      gem.position.y = 1.45 + Math.sin(time * 2 + i) * 0.06;
    });

    for (const d of doors) {
      if (d.state === 'opening') {
        // The door grinds down into the ground.
        d.opening = Math.min(1, d.opening + delta / DOOR_OPEN_TIME);
        d.slab.position.y = d.height / 2 - (d.height + 0.1) * d.opening * d.opening;
        if (d.opening === 1) d.state = 'open';
        continue;
      }
      if (d.state !== 'locked') continue;

      const distance = Math.hypot(playerPosition.x - d.position.x, playerPosition.z - d.position.z);
      if (distance > DOOR_REACH) continue;
      if (!keys.has(d.keyId)) {
        showMessage(d.locked);
        continue;
      }
      keys.use(d.keyId);
      collisions.remove(d.colliders);
      sounds.rumble(DOOR_OPEN_TIME + 0.3);
      showMessage(d.opened);
      d.state = 'opening';
    }
  }

  // The temple's footprint for the map, in its own space. `angle` is its
  // turn about the y axis.
  const hex = (colour) => `#${colour.toString(16).padStart(6, '0')}`;
  const outline = {
    x: TEMPLE.x,
    z: TEMPLE.z,
    angle: group.rotation.y,
    rooms: [
      { x: 0, z: 0, width: WIDTH, depth: DEPTH },
      ...CHAMBERS.map(({ side, z }) => ({ x: side * (halfWidth + CHAMBER_WIDTH / 2), z, width: CHAMBER_WIDTH, depth: CHAMBER_DEPTH })),
    ],
    doors: [
      { x: 0, z: halfDepth, colour: hex(keyInfo('temple').colour) },
      ...CHAMBERS.map(({ key, side, z }) => ({ x: side * halfWidth, z, colour: hex(keyInfo(key).colour) })),
    ],
  };

  return { group, colliders, outline, update };
}
