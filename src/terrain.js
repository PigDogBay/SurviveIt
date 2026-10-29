import * as THREE from 'three';
import { createRandom } from './random.js';

export const WORLD_RADIUS = 160;
const GROUND_SIZE = WORLD_RADIUS * 2 + 80;

// Where the ancient temple stands. The ground is flat within `flat` of it,
// and no trees grow within `clearing`. `angle` turns it to face the start.
export const TEMPLE = { x: 72, z: 88, flat: 16, clearing: 20, angle: Math.atan2(-72, -88) };
const TEMPLE_BLEND = 8;

function hills(x, z) {
  return (
    Math.sin(x * 0.03) * Math.cos(z * 0.025) * 2.5 +
    Math.sin(x * 0.011 + 1.3) * Math.sin(z * 0.013 + 0.7) * 4 +
    Math.sin(x * 0.09 + z * 0.07) * 0.4
  );
}

export const TEMPLE_FLOOR = hills(TEMPLE.x, TEMPLE.z);

// Gentle rolling hills, levelled off around the temple. Everything that sits
// on the ground (trees, rocks, the player) uses this so it lines up with the
// ground mesh.
export function heightAt(x, z) {
  const fromTemple = Math.hypot(x - TEMPLE.x, z - TEMPLE.z);
  if (fromTemple <= TEMPLE.flat) return TEMPLE_FLOOR;
  const height = hills(x, z);
  if (fromTemple >= TEMPLE.flat + TEMPLE_BLEND) return height;
  const t = (fromTemple - TEMPLE.flat) / TEMPLE_BLEND;
  return THREE.MathUtils.lerp(TEMPLE_FLOOR, height, t * t * (3 - 2 * t));
}

// Mottled mud-and-moss texture drawn on a canvas.
function groundTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = createRandom(7);

  ctx.fillStyle = '#2b2a1c';
  ctx.fillRect(0, 0, size, size);

  const colours = ['#3a3a22', '#24301a', '#33281a', '#1e2414', '#403a26'];
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = colours[Math.floor(random() * colours.length)];
    ctx.globalAlpha = 0.25 + random() * 0.4;
    const r = 1 + random() * 6;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GROUND_SIZE / 8, GROUND_SIZE / 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// `holes` are rectangles in the temple's own space (x1, x2, z1, z2) where the
// ground isn't drawn, such as over the stairs down to the dungeons.
export function createTerrain(holes = []) {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 200, 200);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: groundTexture(),
    roughness: 1,
    metalness: 0,
  });

  // The holes are cut out exactly, pixel by pixel, rather than by leaving
  // out whole triangles of the ground, which are 2 m across.
  if (holes.length > 0) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.holes = { value: holes.map((h) => new THREE.Vector4(h.x1, h.x2, h.z1, h.z2)) };
      shader.uniforms.templeCentre = { value: new THREE.Vector2(TEMPLE.x, TEMPLE.z) };
      shader.uniforms.templeTurn = { value: new THREE.Vector2(Math.cos(TEMPLE.angle), Math.sin(TEMPLE.angle)) };
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec2 vGround;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xz;');
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying vec2 vGround;
uniform vec4 holes[${holes.length}];
uniform vec2 templeCentre;
uniform vec2 templeTurn;
void main() {
  vec2 d = vGround - templeCentre;
  vec2 local = vec2(d.x * templeTurn.x - d.y * templeTurn.y, d.x * templeTurn.y + d.y * templeTurn.x);
  for (int i = 0; i < ${holes.length}; i++) {
    vec4 h = holes[i];
    if (local.x > h.x && local.x < h.y && local.y > h.z && local.y < h.w) discard;
  }`,
      );
    };
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
