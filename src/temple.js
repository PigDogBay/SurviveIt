import * as THREE from 'three';
import { TEMPLE, TEMPLE_FLOOR } from './terrain.js';
import { keyInfo } from './keys.js';
import { stoneBox, stoneTexture } from './stone.js';
import { buildDungeon, slabAroundStairs, UNDERGROUND } from './dungeon.js';

// The hall, in metres. The front, with the door, faces the player's start.
const WIDTH = 14;
const DEPTH = 18;
const WALL_HEIGHT = 6;
const WALL = 1;
const DOOR_WIDTH = 3.2;
const DOOR_HEIGHT = 4;
// How close the minion must be to try the door.
const DOOR_REACH = 3.5;
// How close the minion must be to press a switch.
const SWITCH_REACH = 1.1;
const DOOR_OPEN_TIME = 2.5;

// Hidden chambers, two on each side of the hall, each opened by its own key.
// `side` is -1 for the left wall and 1 for the right; `z` is where along it.
// A chamber that `reveals` a key has a switch on its back wall, in that key's
// colour; touching it makes the key appear in the woods. The blue chamber
// has the stairs down to the second dungeon instead of a gem, and a chamber
// that `holds` a key has that key on its stand instead of a gem.
const CHAMBERS = [
  { key: 'red', side: -1, z: 4, reveals: 'blue' },
  { key: 'blue', side: -1, z: -4, stairs: true },
  { key: 'green', side: 1, z: 4, reveals: 'purple' },
  { key: 'purple', side: 1, z: -4, holds: 'cage' },
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

// The ancient temple: a mossy stone hall with pillars at the front and a
// stepped roof, and four hidden chambers built onto its sides. Each door is
// sealed until the minion brings the key that fits it.
export function createTemple({ keys, sounds, showMessage }) {
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xc8c0a8, roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ map: stone.map, color: 0x6e6858, roughness: 0.95 });
  const keyhole = new THREE.MeshBasicMaterial({ color: 0x050403 });

  const group = new THREE.Group();
  group.position.set(TEMPLE.x, TEMPLE_FLOOR, TEMPLE.z);
  group.rotation.y = TEMPLE.angle;
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
      list.push({ x: point.x, z: point.z, radius: WALL_RADIUS, above: UNDERGROUND });
    }
  }
  function post(x, z, radius) {
    const point = toWorld(x, z);
    colliders.push({ x: point.x, z: point.z, radius, above: UNDERGROUND });
  }

  const halfWidth = WIDTH / 2;
  const halfDepth = DEPTH / 2;
  const wallX = halfWidth - WALL / 2;
  const wallZ = halfDepth - WALL / 2;
  const doorEdge = DOOR_WIDTH / 2;

  // Walls, sunk a little into the ground, but not as far as the dungeon's ceiling. The front wall has the main
  // doorway and each side wall has two doorways into the chambers.
  const sink = 0.3;
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

  // Stone floors inside and under the porch, just above the ground. The
  // hall floor has a hole for the stairs down to the dungeon.
  slabAroundStairs({ x1: -halfWidth + WALL, x2: halfWidth - WALL, z1: -halfDepth + WALL, z2: halfDepth - WALL }, 0, 0.1, darkStone, add);
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

  // A big round button on a stone plate, on a wall facing `facing` along x
  // (1 or -1). It glows in the colour of the key it brings out.
  const switches = [];
  function wallSwitch(x, z, facing, reveals) {
    const colour = keyInfo(reveals).colour;
    const plate = new THREE.Group();
    plate.add(stoneBox(0.9, 0.9, 0.1, darkStone));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 32), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.5 }));
    ring.position.z = 0.07;
    const glow = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.5, roughness: 0.3 });
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 28).rotateX(Math.PI / 2), glow);
    button.position.z = 0.1;
    plate.add(ring, button);
    plate.rotation.y = (facing * Math.PI) / 2;
    add(plate, x + facing * 0.05, 1.3, z);
    switches.push({ button, glow, reveals, position: toWorld(x, z), pressed: false });
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
    const floorX = middleX - (side * WALL) / 2;
    const floor = { x1: floorX - (CHAMBER_WIDTH - WALL) / 2, x2: floorX + (CHAMBER_WIDTH - WALL) / 2, z1: z - halfChamber + WALL, z2: z + halfChamber - WALL };
    slabAroundStairs(floor, 0, 0.1, darkStone, add);
    add(stoneBox(CHAMBER_WIDTH + 1, 0.8, CHAMBER_DEPTH + 1, stone), middleX, CHAMBER_HEIGHT + 0.4, z);

    if (!chamber.stairs) {
      add(stoneBox(0.8, 1, 0.8, stone), floorX, 0.5, z);
      post(floorX, z, 0.55);
      if (chamber.holds) {
        // The key floats just above the stand, where a gem would be.
        const spot = toWorld(floorX, z);
        keys.place(chamber.holds, { x: spot.x, y: TEMPLE_FLOOR + 0.75, z: spot.z });
      } else {
        const gem = add(new THREE.Mesh(gemGeometry, new THREE.MeshBasicMaterial({ color: colour })), floorX, 1.45, z);
        gems.push(gem);
      }
    }

    if (chamber.reveals) wallSwitch(side * (halfWidth + CHAMBER_WIDTH - WALL), z, -side, chamber.reveals);
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

  // The dungeons underneath, with the red and green keys hidden in them.
  const dungeon = buildDungeon({ add, stone, darkStone, flameMaterial });
  colliders.push(...dungeon.colliders);
  flames.push(...dungeon.flames);
  lights.push(...dungeon.lights);
  keys.place('red', dungeon.keySpots.red);
  keys.place('green', dungeon.keySpots.green);

  function update(delta, time, playerPosition, collisions) {
    dungeon.update(playerPosition);
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

    for (const s of switches) {
      if (s.pressed) continue;
      // Pulses gently until it's pressed, to catch the eye.
      s.glow.emissiveIntensity = 0.5 + Math.sin(time * 3) * 0.3;
      const distance = Math.hypot(playerPosition.x - s.position.x, playerPosition.z - s.position.z);
      // Out of reach from the dungeon underneath.
      if (distance > SWITCH_REACH || playerPosition.y < UNDERGROUND) continue;
      s.pressed = true;
      s.button.position.z = 0.04;
      s.glow.emissiveIntensity = 1.6;
      keys.reveal(s.reveals);
      sounds.click();
      sounds.chime();
      const name = keyInfo(s.reveals).name.toLowerCase();
      showMessage(`Click! The ${name} has appeared somewhere in the forest`);
    }

    for (const d of doors) {
      if (d.state === 'opening') {
        // The door grinds down into the ground.
        d.opening = Math.min(1, d.opening + delta / DOOR_OPEN_TIME);
        d.slab.position.y = d.height / 2 - (d.height + 0.1) * d.opening * d.opening;
        if (d.opening === 1) d.state = 'open';
        continue;
      }
      if (d.state !== 'locked') continue;

      // Doors are up in the temple, out of reach from the dungeon below.
      const distance = Math.hypot(playerPosition.x - d.position.x, playerPosition.z - d.position.z);
      if (distance > DOOR_REACH || playerPosition.y < UNDERGROUND) continue;
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

  // Med kits in the back corners of the hall, and one in the purple chamber
  // for the fight with Chookie.
  const medkitSpots = [toWorld(-5.2, -7.3), toWorld(5.2, -7.3), toWorld(11.3, -6)];

  // How far the minion has got, for Gru's guidance.
  const doorFor = (keyId) => doors.find((d) => d.keyId === keyId);
  const switchFor = (id) => switches.find((s) => s.reveals === id);
  return {
    group,
    colliders,
    outline,
    update,
    medkitSpots,
    doorOpen: (keyId) => doorFor(keyId).state !== 'locked',
    doorAt: (keyId) => doorFor(keyId).position,
    switchPressed: (id) => switchFor(id).pressed,
    switchAt: (id) => switchFor(id).position,
  };
}
