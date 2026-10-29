import * as THREE from 'three';
import { heightAt, TEMPLE, TEMPLE_FLOOR } from './terrain.js';
import { stoneBox } from './stone.js';

// Everything here is in the temple's own space: x across the hall, z from the
// back (-) to the front door (+), and y up from the hall floor.

// How far below the hall floor the dungeon floor is.
const DEPTH = 4.5;
// The underside of the dungeon's ceiling.
const CEILING = -0.4;
// Something below this height counts as down in the dungeon, and above it as
// up in the temple. Colliders use it to tell the two apart.
export const UNDERGROUND = TEMPLE_FLOOR - 1;

// The stairs go down from the middle of the hall towards the back.
const STAIRS = { x1: -1.25, x2: 1.25, z1: -4.5, z2: 2.5 };
const STEPS = 15;
const RISE = DEPTH / STEPS;
const RUN = (STAIRS.z2 - STAIRS.z1) / STEPS;

// The open spaces of the dungeon. Walls are built around them.
const SPACES = [
  STAIRS,
  // The landing at the foot of the stairs.
  { x1: -4, x2: 4, z1: -10, z2: -4.5 },
  // Passages west and east, each turning towards the front.
  { x1: -10, x2: -4, z1: -8.5, z2: -6 },
  { x1: -10, x2: -7.5, z1: -8.5, z2: 3 },
  { x1: 4, x2: 10, z1: -8.5, z2: -6 },
  { x1: 7.5, x2: 10, z1: -8.5, z2: 3 },
  // A room at the end of each passage. The red key is hidden in the east one.
  { x1: -11.5, x2: -5.5, z1: 3, z2: 9.5 },
  { x1: 5.5, x2: 11.5, z1: 3, z2: 9.5 },
];
const BOUNDS = {
  x1: Math.min(...SPACES.map((s) => s.x1)) - 1,
  x2: Math.max(...SPACES.map((s) => s.x2)) + 1,
  z1: Math.min(...SPACES.map((s) => s.z1)) - 1,
  z2: Math.max(...SPACES.map((s) => s.z2)) + 1,
};

// Where the red key is hidden: tucked in a corner behind crates.
const KEY_SPOT = [6.4, 8.8];
// [x, z, size, turn], plus the height to sit at for a crate stacked on another.
const CRATES = [
  // Behind these is the key.
  [6.4, 7.3, 1.1, 0.1],
  [6.4, 7.3, 0.8, 0.5, 1.1],
  [7.6, 7.6, 0.9, -0.2],
  // The same kind of clutter in the other rooms, so the key could be anywhere.
  [-10.6, 8.6, 1.1, 0.2],
  [-9.4, 8.8, 0.8, -0.3],
  [-10.6, 4.1, 0.9, 0.4],
  [3.1, -9.2, 1, -0.1],
  [-3.2, -9.3, 0.8, 0.3],
];
// Torches on the walls: [x, z, which way they face].
const TORCHES = [
  [0, -9.85, 0],
  [-8.5, 9.35, Math.PI],
  [11.35, 4.5, -Math.PI / 2],
];

const cos = Math.cos(TEMPLE.angle);
const sin = Math.sin(TEMPLE.angle);
function toLocal(x, z) {
  const dx = x - TEMPLE.x;
  const dz = z - TEMPLE.z;
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}
function toWorld(x, z) {
  return [TEMPLE.x + x * cos + z * sin, TEMPLE.z - x * sin + z * cos];
}
// Things lying on the dungeon floor, in the world: med kits on the landing
// and in the west room, and the freeze ray in the west room.
const onFloor = (x, z) => {
  const [wx, wz] = toWorld(x, z);
  return { x: wx, y: TEMPLE_FLOOR - DEPTH, z: wz };
};
export const DUNGEON_PICKUPS = {
  medkits: [onFloor(-3.3, -7.6), onFloor(-6.3, 8.9)],
  freezeRay: onFloor(-8.5, 6.3),
};

const inside = (area, x, z, margin = 0) =>
  x >= area.x1 - margin && x <= area.x2 + margin && z >= area.z1 - margin && z <= area.z2 + margin;

// Whether a point in the world is over the stairwell, give or take `margin`.
export function inStairwell(x, z, margin = 0) {
  return inside(STAIRS, ...toLocal(x, z), margin);
}

// Whether something at `position` is down in the dungeon.
export function isUnderground(position) {
  if (position.y >= UNDERGROUND) return false;
  const [x, z] = toLocal(position.x, position.z);
  return SPACES.some((space) => inside(space, x, z, 1));
}

// The height of the ground under something at (x, z) whose feet are at `y`:
// the stairs, the dungeon floor if it's down in the dungeon, or else the
// usual ground from `heightAt`.
export function groundAt(x, y, z) {
  const [lx, lz] = toLocal(x, z);
  if (inside(STAIRS, lx, lz)) {
    // A smooth slope through the middle of each step.
    const slope = -((STAIRS.z2 - lz) / RUN) * RISE - RISE / 2;
    return TEMPLE_FLOOR + THREE.MathUtils.clamp(slope, -DEPTH, 0);
  }
  if (y < UNDERGROUND && SPACES.some((space) => inside(space, lx, lz, 1))) return TEMPLE_FLOOR - DEPTH;
  return heightAt(x, z);
}

// A flat slab covering `area` with a hole cut out for the stairs.
export function slabAroundStairs(area, y, thickness, material, add) {
  const pieces = [
    [area.x1, STAIRS.x1, area.z1, area.z2],
    [STAIRS.x2, area.x2, area.z1, area.z2],
    [STAIRS.x1, STAIRS.x2, STAIRS.z2, area.z2],
    [STAIRS.x1, STAIRS.x2, area.z1, STAIRS.z1],
  ];
  for (const [x1, x2, z1, z2] of pieces) {
    if (x2 <= x1 || z2 <= z1) continue;
    add(stoneBox(x2 - x1, thickness, z2 - z1, material), (x1 + x2) / 2, y, (z1 + z2) / 2);
  }
}

// Planks with a dark frame, for the crates.
function crateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#4a3018';
  for (let y = 15; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 58, 58);
  ctx.beginPath();
  ctx.moveTo(6, 58);
  ctx.lineTo(58, 6);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The dungeon under the temple: stairs down from the hall to a landing, then
// passages to two rooms, with crates, torches on the walls and the red key
// hidden in a corner. `add` places a mesh in the temple's space.
export function buildDungeon({ add, stone, darkStone, flameMaterial }) {
  const colliders = [];
  const flames = [];
  const lights = [];

  // Mark the open spaces on a fine grid, then find how far every other cell
  // is from them. Cells up to 1 m away become wall.
  const CELL = 0.25;
  const WALL_CELLS = 4;
  const columns = Math.round((BOUNDS.x2 - BOUNDS.x1) / CELL);
  const rows = Math.round((BOUNDS.z2 - BOUNDS.z1) / CELL);
  const cellX = (i) => BOUNDS.x1 + (i + 0.5) * CELL;
  const cellZ = (j) => BOUNDS.z1 + (j + 0.5) * CELL;
  const distance = new Int32Array(columns * rows).fill(-1);
  let edge = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      if (SPACES.some((space) => inside(space, cellX(i), cellZ(j)))) {
        distance[j * columns + i] = 0;
        edge.push([i, j]);
      }
    }
  }
  for (let step = 1; step <= WALL_CELLS; step++) {
    const next = [];
    for (const [i, j] of edge) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const [ni, nj] = [i + di, j + dj];
          if (ni < 0 || nj < 0 || ni >= columns || nj >= rows || distance[nj * columns + ni] !== -1) continue;
          distance[nj * columns + ni] = step;
          next.push([ni, nj]);
        }
      }
    }
    edge = next;
  }

  // Join wall cells into as few boxes as possible: runs along each row,
  // stretched over the following rows while the run stays the same.
  const wallHeight = DEPTH - 0.05;
  const wallY = -DEPTH + wallHeight / 2;
  const open = new Map();
  function finish(run, start, end) {
    const [i1, i2] = run.split(',').map(Number);
    const width = (i2 - i1 + 1) * CELL;
    const depth = (end - start + 1) * CELL;
    add(stoneBox(width, wallHeight, depth, stone), BOUNDS.x1 + (i1 + i2 + 1) * CELL / 2, wallY, BOUNDS.z1 + (start + end + 1) * CELL / 2);
  }
  for (let j = 0; j <= rows; j++) {
    const runs = new Set();
    for (let i = 0; j < rows && i < columns; i++) {
      const d = distance[j * columns + i];
      if (d < 1) continue;
      let end = i;
      while (end + 1 < columns && distance[j * columns + end + 1] >= 1) end++;
      runs.add(`${i},${end}`);
      i = end;
    }
    for (const [run, start] of open) {
      if (!runs.has(run)) {
        finish(run, start, j - 1);
        open.delete(run);
      }
    }
    for (const run of runs) if (!open.has(run)) open.set(run, j);
  }

  // Colliders sit just inside the walls, every other cell along them.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      if (distance[j * columns + i] !== 2 || (i + j) % 2) continue;
      const [x, z] = toWorld(cellX(i), cellZ(j));
      colliders.push({ x, z, radius: 0.45, below: UNDERGROUND });
    }
  }

  // The floor, and a ceiling with a hole for the stairs.
  const floorArea = BOUNDS;
  add(stoneBox(floorArea.x2 - floorArea.x1, 0.1, floorArea.z2 - floorArea.z1, darkStone), (floorArea.x1 + floorArea.x2) / 2, -DEPTH - 0.05, (floorArea.z1 + floorArea.z2) / 2);
  slabAroundStairs(BOUNDS, (CEILING - 0.05) / 2, -0.05 - CEILING, darkStone, add);

  // Solid stone steps.
  const stairWidth = STAIRS.x2 - STAIRS.x1;
  for (let i = 0; i < STEPS - 1; i++) {
    const top = -(i + 1) * RISE;
    add(stoneBox(stairWidth, top + DEPTH, RUN, stone), (STAIRS.x1 + STAIRS.x2) / 2, (top - DEPTH) / 2, STAIRS.z2 - (i + 0.5) * RUN);
  }

  // A low wall around the stairwell up in the hall, open at the front end.
  const railHeight = 0.9;
  const railX = STAIRS.x2 + 0.25;
  const railBackZ = STAIRS.z1 - 0.25;
  for (const side of [-1, 1]) {
    add(stoneBox(0.5, railHeight, STAIRS.z2 - railBackZ, stone), side * railX, railHeight / 2, (STAIRS.z2 + railBackZ) / 2);
  }
  add(stoneBox(2 * railX + 0.5, railHeight, 0.5, stone), 0, railHeight / 2, railBackZ);
  function rail(x1, z1, x2, z2, extra) {
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.4);
    for (let i = 0; i <= steps; i++) {
      const [x, z] = toWorld(THREE.MathUtils.lerp(x1, x2, i / steps), THREE.MathUtils.lerp(z1, z2, i / steps));
      colliders.push({ x, z, radius: 0.4, ...extra });
    }
  }
  for (const side of [-1, 1]) rail(side * railX, railBackZ, side * railX, STAIRS.z2, { above: UNDERGROUND });
  rail(-railX, railBackZ, railX, railBackZ, { above: UNDERGROUND });
  // An invisible line across the top of the stairs keeps monsters out.
  rail(STAIRS.x1, STAIRS.z2 + 0.6, STAIRS.x2, STAIRS.z2 + 0.6, { above: UNDERGROUND, monstersOnly: true });

  // Crates. Only the bottom ones need colliders.
  const wood = new THREE.MeshStandardMaterial({ map: crateTexture(), emissive: 0x140c04, roughness: 0.85 });
  for (const [x, z, size, turn, sitAt = 0] of CRATES) {
    const crate = add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wood), x, -DEPTH + sitAt + size / 2, z);
    crate.rotation.y = turn;
    crate.castShadow = crate.receiveShadow = true;
    if (sitAt === 0) {
      const [wx, wz] = toWorld(x, z);
      colliders.push({ x: wx, z: wz, radius: size * 0.6, below: UNDERGROUND });
    }
  }

  // Torches: an iron bracket with a flickering flame and a warm light.
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 });
  for (const [x, z, facing] of TORCHES) {
    const torch = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.35), iron);
    bracket.position.set(0, 0, 0.15);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x4a3018 }));
    handle.position.set(0, 0.15, 0.3);
    handle.rotation.x = 0.3;
    torch.add(bracket, handle);
    torch.rotation.y = facing;
    add(torch, x, -DEPTH + 2.4, z);
    const front = new THREE.Vector3(0, 0, 0.38).applyAxisAngle(THREE.Object3D.DEFAULT_UP, facing);
    for (let i = 0; i < 2; i++) {
      const flame = add(new THREE.Sprite(flameMaterial), x + front.x, -DEPTH + 2.75 + i * 0.08, z + front.z);
      flames.push({ flame, phase: i * 2.7 + x });
    }
    const light = add(new THREE.PointLight(0xff7a2a, 7, 11, 1.6), x + front.x * 2, -DEPTH + 2.6, z + front.z * 2);
    lights.push({ light, brightness: 7 });
  }

  return { colliders, flames, lights, keySpot: onFloor(...KEY_SPOT) };
}
