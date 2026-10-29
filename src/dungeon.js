import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, TEMPLE, TEMPLE_FLOOR } from './terrain.js';
import { stoneBox, stoneGeometry } from './stone.js';

// Everything here is in the temple's own space: x across the hall (- is the
// red and blue chambers' side), z from the back (-) to the front door (+),
// and y up from the hall floor.

// How far below the hall floor the dungeons' floors are.
const DEPTH = 4.5;
// The underside of the dungeons' ceilings.
const CEILING = -0.4;
// Something below this height counts as down in a dungeon, and above it as
// up in the temple or the woods. Colliders use it to tell the two apart.
export const UNDERGROUND = TEMPLE_FLOOR - 1;
const STEPS = 15;
const RISE = DEPTH / STEPS;

// Each flight of stairs goes down from its `top` edge to the opposite one.
// `opening` is the part open to the room above; the rest is a tunnel.
const STAIRS = [
  // From the middle of the hall towards the back, down to the first dungeon.
  { x1: -1.25, x2: 1.25, z1: -4.5, z2: 2.5, top: 'z2', opening: { x1: -1.25, x2: 1.25, z1: -4.5, z2: 2.5 } },
  // From the blue chamber, out under its back wall, down to the second dungeon.
  { x1: -15, x2: -7.5, z1: -5.25, z2: -2.75, top: 'x2', opening: { x1: -12, x2: -7.5, z1: -5.25, z2: -2.75 } },
];
export const OPENINGS = STAIRS.map((stairs) => stairs.opening);

// The open spaces of the dungeons. Walls are built around them.
const SPACES = [
  ...STAIRS,
  // The first dungeon, under the temple: a landing at the foot of the stairs,
  // then passages west and east, each turning towards the front and ending in
  // a room. The red key is hidden in the east room.
  { x1: -4, x2: 4, z1: -10, z2: -4.5 },
  { x1: -6.5, x2: -4, z1: -8.5, z2: 3 },
  { x1: 4, x2: 10, z1: -8.5, z2: -6 },
  { x1: 7.5, x2: 10, z1: -8.5, z2: 3 },
  { x1: -11.5, x2: -5.5, z1: 3, z2: 9.5 },
  { x1: 5.5, x2: 11.5, z1: 3, z2: 9.5 },
  // The second dungeon, under the woods west of the temple: a room at the
  // foot of the stairs, a passage north to the fart gun's room, and a passage
  // west and south to the room where the green key is hidden.
  { x1: -21, x2: -15, z1: -7, z2: -1 },
  { x1: -20, x2: -17.5, z1: -1, z2: 8 },
  { x1: -24, x2: -16, z1: 8, z2: 14 },
  { x1: -27, x2: -21, z1: -5.5, z2: -3 },
  { x1: -27, x2: -24.5, z1: -15, z2: -3 },
  { x1: -29, x2: -22, z1: -21, z2: -15 },
];

// Where keys are hidden: tucked in corners behind crates.
const KEY_SPOTS = { red: [6.4, 8.8], green: [-28.4, -20.4] };
// [x, z, size, turn], plus the height to sit at for a crate stacked on another.
const CRATES = [
  // Hiding the red key.
  [6.4, 7.3, 1.1, 0.1],
  [6.4, 7.3, 0.8, 0.5, 1.1],
  [7.6, 7.6, 0.9, -0.2],
  // Hiding the green key.
  [-28.3, -18.9, 1, 0.2],
  [-28.3, -18.9, 0.7, -0.3, 1],
  [-26.6, -19.3, 0.9, 0.1],
  // The same kind of clutter in the other rooms, so a key could be anywhere.
  [-10.6, 8.6, 1.1, 0.2],
  [-9.4, 8.8, 0.8, -0.3],
  [-10.6, 4.1, 0.9, 0.4],
  [3.1, -9.2, 1, -0.1],
  [-3.2, -9.3, 0.8, 0.3],
  [-23.2, 13.2, 1, 0.3],
  [-22.1, 13.3, 0.8, -0.2],
  [-20.3, -6.2, 0.9, 0.2],
];
// Torches on the walls: [x, z, which way they face].
const TORCHES = [
  [0, -9.85, 0],
  [-8.5, 9.35, Math.PI],
  [11.35, 4.5, -Math.PI / 2],
  [-20.85, -4, Math.PI / 2],
  [-20, 13.85, Math.PI],
  [-25.5, -20.85, 0],
];
// Only the torches nearest the minion light up the walls, so there are never
// more lights than this however many torches there are. Each extra light
// makes everything slower to draw.
const TORCH_LIGHTS = 3;

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
// A spot on a dungeon floor, in the world.
export const onDungeonFloor = (x, z) => {
  const [wx, wz] = toWorld(x, z);
  return { x: wx, y: TEMPLE_FLOOR - DEPTH, z: wz };
};

// The top and bottom of each flight of stairs, in the world, for showing the
// way up or down.
export const STAIRWAYS = STAIRS.map((stairs) => {
  const middle = stairs.top === 'z2' ? (stairs.x1 + stairs.x2) / 2 : (stairs.z1 + stairs.z2) / 2;
  const [top, bottom] = stairs.top === 'z2' ? [[middle, stairs.z2], [middle, stairs.z1]] : [[stairs.x2, middle], [stairs.x1, middle]];
  const at = ([x, z]) => {
    const [wx, wz] = toWorld(x, z);
    return { x: wx, z: wz };
  };
  return { top: at(top), bottom: at(bottom) };
});

// Things lying on the dungeon floors: in the first dungeon, med kits on the
// landing and in the west room, and the freeze ray in the west room; in the
// second, a med kit at the foot of the stairs and the fart gun.
export const DUNGEON_PICKUPS = {
  medkits: [onDungeonFloor(-3.3, -7.6), onDungeonFloor(-6.3, 8.9), onDungeonFloor(-15.8, -1.6)],
  freezeRay: onDungeonFloor(-8.5, 6.3),
  fartGun: onDungeonFloor(-20, 11.5),
};

const inside = (area, x, z, margin = 0) =>
  x >= area.x1 - margin && x <= area.x2 + margin && z >= area.z1 - margin && z <= area.z2 + margin;

// Whether something at `position` is down in a dungeon.
export function isUnderground(position) {
  if (position.y >= UNDERGROUND) return false;
  const [x, z] = toLocal(position.x, position.z);
  return SPACES.some((space) => inside(space, x, z, 1));
}

// How far down the stairs are at (x, z): a smooth slope through the middle
// of each step.
function stairsHeight(stairs, x, z) {
  const along = stairs.top === 'z2' ? stairs.z2 - z : stairs.x2 - x;
  const length = stairs.top === 'z2' ? stairs.z2 - stairs.z1 : stairs.x2 - stairs.x1;
  const slope = -(along / (length / STEPS)) * RISE - RISE / 2;
  return THREE.MathUtils.clamp(slope, -DEPTH, 0);
}

// The height of the ground under something at (x, z) whose feet are at `y`:
// the stairs, a dungeon floor if it's down in a dungeon, or else the usual
// ground from `heightAt`.
export function groundAt(x, y, z) {
  const [lx, lz] = toLocal(x, z);
  const stairs = STAIRS.find((area) => inside(area, lx, lz));
  // The tunnel part of a flight of stairs is under the ground, so only
  // count it from underneath.
  if (stairs && (inside(stairs.opening, lx, lz) || y < UNDERGROUND)) return TEMPLE_FLOOR + stairsHeight(stairs, lx, lz);
  if (y < UNDERGROUND && SPACES.some((space) => inside(space, lx, lz, 1))) return TEMPLE_FLOOR - DEPTH;
  return heightAt(x, z);
}

// A flat slab covering `area`, with holes where stairs come up through it.
export function slabAroundStairs(area, y, thickness, material, add) {
  const holes = OPENINGS.filter((h) => h.x1 < area.x2 && h.x2 > area.x1 && h.z1 < area.z2 && h.z2 > area.z1);
  const clip = (v, a, b) => Math.min(Math.max(v, a), b);
  const xs = [...new Set([area.x1, area.x2, ...holes.flatMap((h) => [clip(h.x1, area.x1, area.x2), clip(h.x2, area.x1, area.x2)])])].sort((a, b) => a - b);
  const zs = [...new Set([area.z1, area.z2, ...holes.flatMap((h) => [clip(h.z1, area.z1, area.z2), clip(h.z2, area.z1, area.z2)])])].sort((a, b) => a - b);
  // Strips across x, each split along z around the holes.
  for (let i = 0; i + 1 < xs.length; i++) {
    const [x1, x2] = [xs[i], xs[i + 1]];
    let from = null;
    for (let j = 0; j <= zs.length - 1; j++) {
      const solid = j + 1 < zs.length && !holes.some((h) => inside(h, (x1 + x2) / 2, (zs[j] + zs[j + 1]) / 2));
      if (solid && from === null) from = zs[j];
      if (!solid && from !== null) {
        add(stoneBox(x2 - x1, thickness, zs[j] - from, material), (x1 + x2) / 2, y, (from + zs[j]) / 2);
        from = null;
      }
    }
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

// The dungeons: stairs down from the hall and from the blue chamber, each to
// rooms joined by passages, with crates, torches on the walls and a key
// hidden in a corner. `add` places a mesh in the temple's space.
export function buildDungeon({ add, stone, darkStone, flameMaterial }) {
  const colliders = [];
  const flames = [];

  // Mark the open spaces on a fine grid, then find how far every other cell
  // is from them. Cells up to 1 m away become wall.
  const CELL = 0.25;
  const WALL_CELLS = 4;
  const bounds = {
    x1: Math.min(...SPACES.map((s) => s.x1)) - 1,
    x2: Math.max(...SPACES.map((s) => s.x2)) + 1,
    z1: Math.min(...SPACES.map((s) => s.z1)) - 1,
    z2: Math.max(...SPACES.map((s) => s.z2)) + 1,
  };
  const columns = Math.round((bounds.x2 - bounds.x1) / CELL);
  const rows = Math.round((bounds.z2 - bounds.z1) / CELL);
  const cellX = (i) => bounds.x1 + (i + 0.5) * CELL;
  const cellZ = (j) => bounds.z1 + (j + 0.5) * CELL;
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

  // Joins the cells where `wanted(i, j)` is true into as few boxes as
  // possible: runs along each row, stretched over the following rows while
  // the run stays the same. All the boxes become one mesh.
  function boxes(wanted, y, height, material) {
    const geometries = [];
    const open = new Map();
    function finish(run, start, end) {
      const [i1, i2] = run.split(',').map(Number);
      const geometry = stoneGeometry((i2 - i1 + 1) * CELL, height, (end - start + 1) * CELL);
      geometry.translate(bounds.x1 + ((i1 + i2 + 1) * CELL) / 2, y, bounds.z1 + ((start + end + 1) * CELL) / 2);
      geometries.push(geometry);
    }
    for (let j = 0; j <= rows; j++) {
      const runs = new Set();
      for (let i = 0; j < rows && i < columns; i++) {
        if (!wanted(i, j)) continue;
        let end = i;
        while (end + 1 < columns && wanted(end + 1, j)) end++;
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
    const mesh = add(new THREE.Mesh(mergeGeometries(geometries), material), 0, 0, 0);
    mesh.castShadow = mesh.receiveShadow = true;
  }

  const near = (i, j) => distance[j * columns + i] >= 0;
  const isWall = (i, j) => distance[j * columns + i] >= 1;
  const underOpening = (i, j) => OPENINGS.some((opening) => inside(opening, cellX(i), cellZ(j)));
  const wallHeight = DEPTH - 0.05;
  boxes(isWall, -DEPTH + wallHeight / 2, wallHeight, stone);
  boxes(near, -DEPTH - 0.05, 0.1, darkStone);
  boxes((i, j) => near(i, j) && !underOpening(i, j), (CEILING - 0.05) / 2, -0.05 - CEILING, darkStone);

  // Colliders sit just inside the walls, every other cell along them.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      if (distance[j * columns + i] !== 2 || (i + j) % 2) continue;
      const [x, z] = toWorld(cellX(i), cellZ(j));
      colliders.push({ x, z, radius: 0.45, below: UNDERGROUND });
    }
  }

  function rail(x1, z1, x2, z2, extra) {
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.4);
    for (let i = 0; i <= steps; i++) {
      const [x, z] = toWorld(THREE.MathUtils.lerp(x1, x2, i / steps), THREE.MathUtils.lerp(z1, z2, i / steps));
      colliders.push({ x, z, radius: 0.4, ...extra });
    }
  }

  // Solid stone steps, and a low wall around each opening up above, open at
  // the top of the stairs. The second stairs' opening is against the blue
  // chamber's back wall, so that end needs no wall.
  const railHeight = 0.9;
  for (const stairs of STAIRS) {
    const alongZ = stairs.top === 'z2';
    const length = alongZ ? stairs.z2 - stairs.z1 : stairs.x2 - stairs.x1;
    const width = alongZ ? stairs.x2 - stairs.x1 : stairs.z2 - stairs.z1;
    const run = length / STEPS;
    for (let i = 0; i < STEPS - 1; i++) {
      const top = -(i + 1) * RISE;
      const middle = (alongZ ? stairs.z2 : stairs.x2) - (i + 0.5) * run;
      const centre = alongZ ? (stairs.x1 + stairs.x2) / 2 : (stairs.z1 + stairs.z2) / 2;
      const step = alongZ ? stoneBox(width, top + DEPTH, run, stone) : stoneBox(run, top + DEPTH, width, stone);
      add(step, alongZ ? centre : middle, (top - DEPTH) / 2, alongZ ? middle : centre);
    }

    const { opening } = stairs;
    if (alongZ) {
      const railX = opening.x2 + 0.25;
      const backZ = opening.z1 - 0.25;
      for (const side of [-1, 1]) {
        add(stoneBox(0.5, railHeight, opening.z2 - backZ, stone), side * railX, railHeight / 2, (opening.z2 + backZ) / 2);
        rail(side * railX, backZ, side * railX, opening.z2, { above: UNDERGROUND });
      }
      add(stoneBox(2 * railX + 0.5, railHeight, 0.5, stone), 0, railHeight / 2, backZ);
      rail(-railX, backZ, railX, backZ, { above: UNDERGROUND });
      // An invisible line across the top of the stairs keeps monsters out.
      rail(opening.x1, opening.z2 + 0.6, opening.x2, opening.z2 + 0.6, { above: UNDERGROUND, monstersOnly: true });
    } else {
      for (const z of [opening.z1 - 0.25, opening.z2 + 0.25]) {
        add(stoneBox(opening.x2 - opening.x1, railHeight, 0.5, stone), (opening.x1 + opening.x2) / 2, railHeight / 2, z);
        rail(opening.x1, z, opening.x2, z, { above: UNDERGROUND });
      }
      rail(opening.x2 + 0.6, opening.z1, opening.x2 + 0.6, opening.z2, { above: UNDERGROUND, monstersOnly: true });
    }
  }

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

  // Torches: an iron bracket with a flickering flame. A few warm lights move
  // to whichever torches are nearest the minion.
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 });
  const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3018 });
  const lightSpots = [];
  for (const [x, z, facing] of TORCHES) {
    const torch = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.35), iron);
    bracket.position.set(0, 0, 0.15);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.5, 8), handleMaterial);
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
    lightSpots.push(new THREE.Vector3(x + front.x * 2, -DEPTH + 2.6, z + front.z * 2));
  }
  const lights = [];
  for (let i = 0; i < TORCH_LIGHTS; i++) {
    lights.push({ light: add(new THREE.PointLight(0xff7a2a, 7, 11, 1.6), 0, -DEPTH, 0), brightness: 7 });
  }

  // Moves the torch lights to the torches nearest the minion.
  function update(playerPosition) {
    const [px, pz] = toLocal(playerPosition.x, playerPosition.z);
    const nearest = [...lightSpots].sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    lights.forEach(({ light }, i) => light.position.copy(nearest[i]));
  }

  const keySpots = Object.fromEntries(Object.entries(KEY_SPOTS).map(([id, spot]) => [id, onDungeonFloor(...spot)]));
  return { colliders, flames, lights, keySpots, update };
}
