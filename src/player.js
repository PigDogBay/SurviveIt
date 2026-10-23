import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { heightAt, WORLD_RADIUS } from './terrain.js';

// Minions are short, so the camera sits low.
const EYE_HEIGHT = 1.25;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8;
const JUMP_SPEED = 6;
const GRAVITY = 18;

export function createPlayer(camera, domElement, colliders) {
  const controls = new PointerLockControls(camera, domElement);
  const keys = new Set();
  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let verticalSpeed = 0;
  let onGround = true;
  let bobTime = 0;
  let groundY = heightAt(0, 0);

  camera.position.set(0, groundY + EYE_HEIGHT, 0);

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'Space' && onGround && controls.isLocked) {
      verticalSpeed = JUMP_SPEED;
      onGround = false;
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  // Stop moving if the window loses focus while a key is held.
  window.addEventListener('blur', () => keys.clear());

  function pushOutOfColliders(position) {
    for (const { x, z, radius } of colliders) {
      const dx = position.x - x;
      const dz = position.z - z;
      const minDistance = radius + PLAYER_RADIUS;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < minDistance * minDistance && distanceSq > 1e-6) {
        const distance = Math.sqrt(distanceSq);
        position.x = x + (dx / distance) * minDistance;
        position.z = z + (dz / distance) * minDistance;
      }
    }

    const distanceFromCentre = Math.hypot(position.x, position.z);
    const limit = WORLD_RADIUS - 2;
    if (distanceFromCentre > limit) {
      position.x *= limit / distanceFromCentre;
      position.z *= limit / distanceFromCentre;
    }
  }

  function update(delta) {
    if (!controls.isLocked) return;

    const input = new THREE.Vector2(
      Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
      Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    );
    if (input.lengthSq() > 1) input.normalize();

    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up);

    const target = new THREE.Vector3()
      .addScaledVector(forward, input.y * speed)
      .addScaledVector(right, input.x * speed);
    // Ease towards the target speed so starting and stopping feel smooth.
    velocity.lerp(target, 1 - Math.exp(-12 * delta));

    const position = camera.position;
    position.x += velocity.x * delta;
    position.z += velocity.z * delta;
    pushOutOfColliders(position);

    groundY = heightAt(position.x, position.z);
    verticalSpeed -= GRAVITY * delta;
    let feetY = position.y - EYE_HEIGHT - bobOffset() + verticalSpeed * delta;
    if (feetY <= groundY) {
      feetY = groundY;
      verticalSpeed = 0;
      onGround = true;
    }

    const moving = onGround && velocity.lengthSq() > 0.5;
    bobTime = moving ? bobTime + delta * (running ? 14 : 10) : 0;
    position.y = feetY + EYE_HEIGHT + bobOffset();
  }

  function bobOffset() {
    return Math.sin(bobTime) * 0.04;
  }

  return { controls, update };
}
