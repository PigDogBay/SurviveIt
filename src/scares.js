import * as THREE from 'three';
import { TEMPLE } from './terrain.js';

// Seconds until the first ambush in the woods, then between ambushes. The
// times are random each game, so the player can't learn when they come.
const FIRST_AMBUSH = [40, 70];
const BETWEEN_AMBUSHES = [50, 100];
// No ambushes this close to the start.
const SAFE_START = 20;
// How close in front of the player a monster leaps out.
const AMBUSH_DISTANCE = 2.6;
// Within this of the temple's centre counts as inside the hall.
const TEMPLE_HALL = 7;
const SHAKE_TIME = 0.5;
// How far the view lurches in (field of view, in degrees) when scared.
const ZOOM = 8;

// Jump scares: a monster suddenly leaps out right in front of the minion
// with a screech, a red flash and a jolt of the view. It happens now and
// then in the woods, and once on first stepping into the temple.
export function createScares({ camera, monsters, sounds }) {
  const flash = document.getElementById('flash');
  const randomBetween = ([min, max]) => min + Math.random() * (max - min);
  let untilAmbush = randomBetween(FIRST_AMBUSH);
  let templeScareDone = false;
  let shake = 0;
  const normalFov = camera.fov;
  const towards = new THREE.Vector3();
  const look = new THREE.Euler(0, 0, 0, 'YXZ');

  function scare(playerPosition) {
    monsters.ambush(playerPosition.x + towards.x * AMBUSH_DISTANCE, playerPosition.z + towards.z * AMBUSH_DISTANCE, playerPosition);
    sounds.screech();
    flash.className = '';
    // Restart the animation even if it's already playing.
    void flash.offsetWidth;
    flash.className = 'scare';
    shake = SHAKE_TIME;
  }

  // Tips the view about the way the camera faces, leaving where it looks alone.
  function roll(angle) {
    look.setFromQuaternion(camera.quaternion);
    look.z = angle;
    camera.quaternion.setFromEuler(look);
  }

  function update(delta, playerPosition) {
    const fromStart = Math.hypot(playerPosition.x, playerPosition.z);
    const fromTemple = Math.hypot(playerPosition.x - TEMPLE.x, playerPosition.z - TEMPLE.z);

    if (!templeScareDone && fromTemple < TEMPLE_HALL) {
      // Leap out from the middle of the hall, so it's never inside a wall.
      templeScareDone = true;
      towards.set(TEMPLE.x - playerPosition.x, 0, TEMPLE.z - playerPosition.z).normalize();
      scare(playerPosition);
    } else if (fromStart > SAFE_START && fromTemple > TEMPLE.clearing) {
      untilAmbush -= delta;
      if (untilAmbush <= 0) {
        untilAmbush = randomBetween(BETWEEN_AMBUSHES);
        camera.getWorldDirection(towards).setY(0).normalize();
        scare(playerPosition);
      }
    }

    if (shake > 0) {
      shake = Math.max(0, shake - delta);
      const strength = shake / SHAKE_TIME;
      roll((Math.random() - 0.5) * 0.1 * strength);
      camera.fov = normalFov - ZOOM * strength;
      camera.updateProjectionMatrix();
    }
  }

  return { update };
}
