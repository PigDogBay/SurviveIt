import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom, range } from './random.js';
import { heightAt, TEMPLE, WORLD_RADIUS } from './terrain.js';

const SPAWN_CLEARING = 9;
const CELL = 4.5;
// Trees and rocks only get in the way of things no more than this far below
// the ground, so the dungeons can run underneath them.
const ROOTS = 1.5;

function pineFoliageGeometry() {
  const layers = [
    { radius: 2.6, height: 4.5, y: 3.6 },
    { radius: 2.0, height: 3.8, y: 5.6 },
    { radius: 1.3, height: 3.2, y: 7.6 },
  ].map(({ radius, height, y }) => new THREE.ConeGeometry(radius, height, 9).translate(0, y, 0));
  return mergeGeometries(layers);
}

function deadTreeGeometry() {
  const parts = [new THREE.CylinderGeometry(0.12, 0.3, 7, 7).translate(0, 3.5, 0)];
  const branches = [
    { y: 3.2, angle: 0.0, tilt: 0.9, length: 2.6 },
    { y: 4.3, angle: 2.2, tilt: 0.8, length: 2.2 },
    { y: 5.2, angle: 4.1, tilt: 0.7, length: 1.8 },
    { y: 6.0, angle: 1.1, tilt: 0.6, length: 1.3 },
  ];
  for (const { y, angle, tilt, length } of branches) {
    const branch = new THREE.CylinderGeometry(0.03, 0.09, length, 5);
    branch.translate(0, length / 2, 0);
    branch.rotateZ(-tilt);
    branch.rotateY(angle);
    branch.translate(0, y, 0);
    parts.push(branch);
  }
  return mergeGeometries(parts);
}

function rockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    // Faces don't share vertices, so base the wobble on where the vertex is;
    // otherwise neighbouring faces pull apart and the rock looks shattered.
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const wobble = 0.95 + Math.sin(x * 5.1 + y * 3.7) * 0.12 + Math.cos(z * 4.3 - x * 2.9) * 0.1;
    position.setXYZ(i, x * wobble, y * wobble * 0.6, z * wobble);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function instanced(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Plants trees and rocks over the whole map, leaving clearings where the
// player starts and around the temple. Returns the meshes plus circular colliders for the player.
export function createForest() {
  const random = createRandom(2024);
  const pines = [];
  const deadTrees = [];
  const rocks = [];
  const colliders = [];

  const extent = WORLD_RADIUS + 30;
  for (let gx = -extent; gx < extent; gx += CELL) {
    for (let gz = -extent; gz < extent; gz += CELL) {
      const x = gx + range(random, 0, CELL);
      const z = gz + range(random, 0, CELL);
      const distance = Math.hypot(x, z);
      if (distance < SPAWN_CLEARING || distance > extent) continue;

      // Thicker woods past the edge of the map so it feels endless.
      const outside = distance > WORLD_RADIUS;
      // The random numbers are still drawn inside the temple clearing, so the
      // rest of the forest keeps its layout.
      const cleared = Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < TEMPLE.clearing;
      const roll = random();
      if (roll < (outside ? 0.85 : 0.5)) {
        const scale = range(random, 0.8, 1.7);
        const tree = { x, z, scale, rotation: range(random, 0, Math.PI * 2) };
        const kind = random() < 0.82 ? pines : deadTrees;
        if (cleared) continue;
        kind.push(tree);
        colliders.push({ x, z, radius: 0.35 * scale + 0.3, above: heightAt(x, z) - ROOTS });
      } else if (roll < 0.6 && !outside) {
        const scale = range(random, 0.3, 1.4);
        const rock = { x, z, scale, rotation: range(random, 0, Math.PI * 2) };
        if (cleared) continue;
        rocks.push(rock);
        if (scale > 0.6) colliders.push({ x, z, radius: scale * 0.95, above: heightAt(x, z) - ROOTS });
      }
    }
  }

  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const colour = new THREE.Color();

  function place(mesh, items, index, sink, squash = 1) {
    const { x, z, scale, rotation } = items[index];
    quaternion.setFromAxisAngle(up, rotation);
    matrix.compose(
      new THREE.Vector3(x, heightAt(x, z) - sink, z),
      quaternion,
      new THREE.Vector3(scale, scale * squash, scale),
    );
    mesh.setMatrixAt(index, matrix);
  }

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 });
  const trunks = instanced(new THREE.CylinderGeometry(0.18, 0.32, 3.5, 7).translate(0, 1.75, 0), trunkMaterial, pines.length);
  const foliage = instanced(
    pineFoliageGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    pines.length,
  );
  pines.forEach((_, i) => {
    place(trunks, pines, i, 0.2);
    place(foliage, pines, i, 0.2);
    colour.setHSL(range(random, 0.27, 0.36), range(random, 0.25, 0.45), range(random, 0.09, 0.16));
    foliage.setColorAt(i, colour);
  });

  const dead = instanced(
    deadTreeGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 }),
    deadTrees.length,
  );
  deadTrees.forEach((_, i) => place(dead, deadTrees, i, 0.2));

  const rockMesh = instanced(
    rockGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
    rocks.length,
  );
  rocks.forEach((_, i) => {
    place(rockMesh, rocks, i, 0.15);
    colour.setHSL(0.1, 0.05, range(random, 0.18, 0.3));
    rockMesh.setColorAt(i, colour);
  });

  group.add(trunks, foliage, dead, rockMesh);
  return { group, colliders };
}

// Drifting fireflies to make the woods feel alive (and a bit spooky).
export function createFireflies(count = 260) {
  const random = createRandom(99);
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const angle = range(random, 0, Math.PI * 2);
    const distance = range(random, 5, WORLD_RADIUS);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    seeds.push({ x, z, y: range(random, 0.5, 3), phase: range(random, 0, 100) });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,200,1)');
  glow.addColorStop(0.3, 'rgba(210,255,120,0.6)');
  glow.addColorStop(1, 'rgba(210,255,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.35,
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;

  function update(time) {
    seeds.forEach((seed, i) => {
      const t = time * 0.4 + seed.phase;
      positions[i * 3] = seed.x + Math.sin(t * 0.7) * 1.5;
      positions[i * 3 + 1] = heightAt(seed.x, seed.z) + seed.y + Math.sin(t * 1.3) * 0.4;
      positions[i * 3 + 2] = seed.z + Math.cos(t * 0.5) * 1.5;
    });
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}
