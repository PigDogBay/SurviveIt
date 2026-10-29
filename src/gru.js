import * as THREE from 'three';
import { isUnderground, STAIRWAYS } from './dungeon.js';
import { TEMPLE, TEMPLE_FLOOR } from './terrain.js';

// The arrow hides once the minion is this close to where it points.
const ARRIVED = 3;

// Gru gives the mission and tells the minion what to do next, in a speech
// bubble with an arrow pointing the way. What he says comes from how far the
// minion has got, so it's always the next step, whatever order things happen.
export function createGru({ camera, keys, weapons, temple, felonius, roro, sounds }) {
  const panel = document.getElementById('gru');
  const text = document.getElementById('gru-text');
  const arrow = document.getElementById('gru-arrow');
  const distanceText = document.getElementById('gru-distance');
  const templeHall = { x: TEMPLE.x, y: TEMPLE_FLOOR, z: TEMPLE.z };

  // The next step: what Gru says, and where it is.
  function nextStep() {
    const freed = felonius.status();
    if (freed === 'safe') return null;
    if (freed !== 'caged') return ['Bring Felonius back to the temple, quick! He will follow you.', templeHall];
    if (keys.found('cage')) {
      if (roro.awake()) return ['Defeat Roro! Hit it while it is dizzy after a dive.', roro.where()];
      if (roro.guarding()) return ['Take the cage key to Felonius, near where you started. Watch out for Roro!', felonius.door];
      return ['You beat Roro! Now open the cage and free my boy!', felonius.door];
    }
    if (temple.doorOpen('purple')) return ['The cage key is in the purple chamber. Grab it!', keys.where('cage')];
    if (keys.found('purple')) return ['Open the purple chamber in the temple with the purple key.', temple.doorAt('purple')];
    if (temple.switchPressed('purple')) return ['The purple key has appeared in the forest. Go and get it!', keys.where('purple')];
    if (temple.doorOpen('green')) return ['Press the purple switch in the green chamber.', temple.switchAt('purple')];
    if (keys.found('green')) return ['Open the green chamber in the temple with the green key.', temple.doorAt('green')];
    if (temple.doorOpen('blue')) return ['Go down the stairs in the blue chamber. The green key is hidden in the dungeon.', keys.where('green')];
    if (keys.found('blue')) return ['Open the blue chamber in the temple with the blue key.', temple.doorAt('blue')];
    if (temple.switchPressed('blue')) return ['The blue key has appeared in the forest. Go and get it!', keys.where('blue')];
    if (temple.doorOpen('red')) return ['Press the blue switch in the red chamber.', temple.switchAt('blue')];
    if (keys.found('red')) return ['Open the red chamber in the temple with the red key.', temple.doorAt('red')];
    if (temple.doorOpen('temple')) return ['Go down the stairs in the temple. The red key is hidden in the dungeon.', keys.where('red')];
    if (keys.found('temple')) return ['Take the key to the temple and unlock the door.', temple.doorAt('temple')];
    if (!weapons.hasAny()) return ['Minion! Roro has locked my son Felonius in a cage. Grab that blunderbuss!', weapons.where('Blunderbuss')];
    return ['Find the temple key. It is somewhere in the woods.', keys.where('temple')];
  }

  // Between the woods and a dungeon, the way goes by the stairs: down the
  // ones nearest where it's going, or up the ones nearest the minion.
  function wayTo(target, playerPosition) {
    const targetBelow = isUnderground(target);
    const playerBelow = isUnderground(playerPosition);
    if (targetBelow === playerBelow) return target;
    const from = playerBelow ? playerPosition : target;
    const nearest = STAIRWAYS.reduce((a, b) =>
      Math.hypot(a.top.x - from.x, a.top.z - from.z) < Math.hypot(b.top.x - from.x, b.top.z - from.z) ? a : b,
    );
    return playerBelow ? nearest.bottom : nearest.top;
  }

  let said = null;
  let newTimeout;
  const forward = new THREE.Vector3();

  function update(playerPosition) {
    const step = nextStep();
    if (!step) {
      panel.classList.add('hidden');
      return;
    }
    const [words, target] = step;
    if (words !== said) {
      // A new instruction: Gru pipes up.
      said = words;
      text.textContent = words;
      panel.classList.remove('hidden');
      panel.classList.add('new');
      clearTimeout(newTimeout);
      newTimeout = setTimeout(() => panel.classList.remove('new'), 1500);
      sounds.gru();
    }

    // Point the arrow the way to go, as seen from where the minion is looking.
    const goal = wayTo(target, playerPosition);
    const dx = goal.x - playerPosition.x;
    const dz = goal.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    camera.getWorldDirection(forward);
    const ahead = dx * forward.x + dz * forward.z;
    const right = dx * -forward.z + dz * forward.x;
    arrow.style.transform = `rotate(${Math.atan2(right, ahead)}rad)`;
    arrow.style.visibility = distance > ARRIVED ? 'visible' : 'hidden';
    distanceText.textContent = distance > ARRIVED ? `${Math.round(distance)} m` : 'Here!';
  }

  return { update };
}
