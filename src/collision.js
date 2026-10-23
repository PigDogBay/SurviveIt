import { WORLD_RADIUS } from './terrain.js';

const CELL = 6;

// Buckets the tree and rock colliders into a grid so anything moving (the
// player, monsters) only checks the few colliders near it.
export function createCollisionGrid(colliders) {
  const cells = new Map();
  const key = (cx, cz) => `${cx},${cz}`;

  for (const collider of colliders) {
    const { x, z, radius } = collider;
    for (let cx = Math.floor((x - radius) / CELL); cx <= Math.floor((x + radius) / CELL); cx++) {
      for (let cz = Math.floor((z - radius) / CELL); cz <= Math.floor((z + radius) / CELL); cz++) {
        const k = key(cx, cz);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(collider);
      }
    }
  }

  // Moves `position` so a circle of `radius` around it isn't inside any
  // collider, and keeps it inside the map.
  function pushOut(position, radius) {
    const cx = Math.floor(position.x / CELL);
    const cz = Math.floor(position.z / CELL);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        for (const { x, z, radius: r } of cells.get(key(cx + ox, cz + oz)) ?? []) {
          const dx = position.x - x;
          const dz = position.z - z;
          const minDistance = r + radius;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq < minDistance * minDistance && distanceSq > 1e-6) {
            const distance = Math.sqrt(distanceSq);
            position.x = x + (dx / distance) * minDistance;
            position.z = z + (dz / distance) * minDistance;
          }
        }
      }
    }

    const distanceFromCentre = Math.hypot(position.x, position.z);
    const limit = WORLD_RADIUS - 2;
    if (distanceFromCentre > limit) {
      position.x *= limit / distanceFromCentre;
      position.z *= limit / distanceFromCentre;
    }
  }

  return { pushOut };
}
