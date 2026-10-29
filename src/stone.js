import * as THREE from 'three';
import { createRandom, range } from './random.js';

// One stone texture tile covers this many metres.
const TILE = 2;

// Rows of old stone blocks with dark mortar and patches of moss.
export function stoneTexture() {
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

// A box whose stone texture is the same size on every face, however big
// the box is.
export function stoneBox(width, height, depth, material) {
  const mesh = new THREE.Mesh(stoneGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// The shape of a stone box, for joining many boxes into one mesh.
export function stoneGeometry(width, height, depth) {
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
  return geometry;
}
