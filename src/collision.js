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

  // How far along a ray (direction must be normalised) until it hits a tree or
  // rock, or Infinity if nothing is in the way within `maxDistance`.
  function rayDistance(origin, direction, maxDistance) {
    const checked = new Set();
    let nearest = Infinity;
    for (let travelled = 0; travelled <= maxDistance + CELL; travelled += CELL / 2) {
      const cx = Math.floor((origin.x + direction.x * travelled) / CELL);
      const cz = Math.floor((origin.z + direction.z * travelled) / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          for (const collider of cells.get(key(cx + ox, cz + oz)) ?? []) {
            if (checked.has(collider)) continue;
            checked.add(collider);
            nearest = Math.min(nearest, rayCircle(origin, direction, collider.x, collider.z, collider.radius));
          }
        }
      }
    }
    return nearest <= maxDistance ? nearest : Infinity;
  }

  return { pushOut, rayDistance };
}

// Distance along a ray to where it enters an upright circle (seen from above),
// or Infinity if it misses. `direction` must be normalised.
export function rayCircle(origin, direction, x, z, radius) {
  const a = direction.x * direction.x + direction.z * direction.z;
  if (a < 1e-8) return Infinity;
  const fx = origin.x - x;
  const fz = origin.z - z;
  const b = 2 * (fx * direction.x + fz * direction.z);
  const c = fx * fx + fz * fz - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 ? t : Infinity;
}
