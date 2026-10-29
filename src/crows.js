import * as THREE from 'three';
import { isUnderground } from './dungeon.js';
import { heightAt, TEMPLE, TEMPLE_FLOOR } from './terrain.js';

const COUNT = 20;
// They circle the temple this far out and this high up.
const ORBIT_RADIUS = [12, 28];
const ORBIT_HEIGHT = [8, 16];
const ORBIT_SPEED = [0.35, 0.7];
// They only go after the minion or Felonius within this distance of the
// temple, a few at a time, each resting a while between dives.
const HUNT_DISTANCE = 60;
const MAX_DIVING = 3;
const REST_TIME = [5, 11];
const DIVE_SPEED = 13;
const DIVE_GIVE_UP = 5;
const RETURN_SPEED = 10;
const HIT_DISTANCE = 0.9;
const MINION_DAMAGE = 8;
const FELONIUS_DAMAGE = 8;
// Shots hit a crow anywhere within this of its middle.
const HIT_RADIUS = 0.6;
const HEARING_DISTANCE = 50;

const between = ([min, max]) => min + Math.random() * (max - min);

// A crow: a small black bird with flapping wings, a grey beak and red eyes
// that show up in the dark. Faces +z.
const feathers = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.7 });
const beakMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5 });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
function buildCrow() {
  const crow = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), feathers);
  body.scale.set(1, 0.9, 1.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), feathers);
  head.position.set(0, 0.06, 0.28);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6).rotateX(Math.PI / 2), beakMaterial);
  beak.position.set(0, 0.04, 0.42);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), feathers);
  tail.position.set(0, 0.02, -0.36);
  crow.add(body, head, beak, tail);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeMaterial);
    eye.position.set(side * 0.06, 0.09, 0.34);
    crow.add(eye);
  }
  const wings = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.1, 0.05, 0.02);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.24), feathers);
    wing.position.x = side * 0.25;
    shoulder.add(wing);
    crow.add(shoulder);
    return shoulder;
  });
  crow.traverse((part) => (part.castShadow = true));
  // A bit bigger than life, so they're easier to spot and hit at night.
  crow.scale.setScalar(1.5);
  return { crow, wings };
}

// The crows that come once Felonius is free: they circle the temple, and
// now and then swoop down at the minion or Felonius. Every weapon can bring
// one down. They offer the same calls as the monsters, so `combineTargets`
// lets the weapons hit them.
export function createCrows({ felonius, sounds }) {
  const group = new THREE.Group();
  const crows = [];
  let started = false;

  // Sends the flock circling round the temple.
  function start() {
    if (started) return;
    started = true;
    for (let i = 0; i < COUNT; i++) {
      const { crow, wings } = buildCrow();
      const c = {
        crow,
        // What the weapons read a target's position from.
        monster: crow,
        wings,
        state: 'circling',
        angle: Math.random() * Math.PI * 2,
        radius: between(ORBIT_RADIUS),
        height: between(ORBIT_HEIGHT),
        speed: between(ORBIT_SPEED) * (i % 2 ? 1 : -1),
        rest: between(REST_TIME),
        target: null,
        diving: 0,
        fall: 0,
        flap: Math.random() * 10,
      };
      crow.position.copy(orbitPoint(c));
      group.add(crow);
      crows.push(c);
    }
  }

  function orbitPoint(c) {
    return new THREE.Vector3(TEMPLE.x + Math.cos(c.angle) * c.radius, TEMPLE_FLOOR + c.height, TEMPLE.z + Math.sin(c.angle) * c.radius);
  }

  // Flies a crow towards a point, facing the way it's going. True once it's there.
  const step = new THREE.Vector3();
  function flyTowards(c, point, speed, delta) {
    step.subVectors(point, c.crow.position);
    const distance = step.length();
    if (distance > 0.01) {
      c.crow.position.addScaledVector(step, Math.min(1, (speed * delta) / distance));
      c.crow.lookAt(point);
    }
    return distance < 0.5;
  }

  // The minion and Felonius, wherever they're out in the open near the temple.
  function prey(playerPosition) {
    const near = (p) => Math.hypot(p.x - TEMPLE.x, p.z - TEMPLE.z) < HUNT_DISTANCE && !isUnderground(p);
    const list = [];
    if (near(playerPosition)) list.push('minion');
    const status = felonius.status();
    const boy = felonius.where();
    if ((status === 'leaving' || status === 'following') && near(new THREE.Vector3(boy.x, boy.y + 1.25, boy.z))) list.push('felonius');
    return list;
  }

  const aim = new THREE.Vector3();
  function aimAt(target, playerPosition) {
    if (target === 'minion') return aim.set(playerPosition.x, playerPosition.y - 0.3, playerPosition.z);
    const boy = felonius.where();
    return aim.set(boy.x, boy.y + 0.8, boy.z);
  }

  function update(delta, time, playerPosition, health) {
    if (!started) return;
    const targets = prey(playerPosition);
    let diving = crows.filter((c) => c.state === 'diving').length;

    for (let i = crows.length - 1; i >= 0; i--) {
      const c = crows[i];
      const { crow } = c;

      if (c.state === 'falling') {
        // Shot down: tumbles to the ground and is gone.
        c.fall += 12 * delta;
        crow.position.y -= c.fall * delta;
        crow.rotation.x += delta * 8;
        crow.rotation.z += delta * 5;
        if (crow.position.y < heightAt(crow.position.x, crow.position.z)) {
          group.remove(crow);
          crows.splice(i, 1);
        }
        continue;
      }

      // Flap: fast while diving, slower while gliding round.
      c.flap += delta * (c.state === 'diving' ? 22 : 12);
      const lift = Math.sin(c.flap) * 0.7;
      c.wings[0].rotation.z = lift;
      c.wings[1].rotation.z = -lift;

      c.angle += c.speed * delta * (1 / Math.max(1, c.radius / 15));
      if (c.state === 'circling') {
        flyTowards(c, orbitPoint(c), 9, delta);
        c.rest -= delta;
        if (c.rest <= 0 && diving < MAX_DIVING && targets.length > 0) {
          c.state = 'diving';
          c.target = targets[Math.floor(Math.random() * targets.length)];
          c.diving = 0;
          diving++;
          const toPlayer = crow.position.distanceTo(playerPosition);
          sounds.crow(Math.max(0, 1 - toPlayer / HEARING_DISTANCE));
        }
      } else if (c.state === 'diving') {
        // Homes in on its target, until it hits or gives up.
        c.diving += delta;
        const still = targets.includes(c.target);
        const point = aimAt(c.target, playerPosition);
        flyTowards(c, point, DIVE_SPEED, delta);
        if (still && crow.position.distanceTo(point) < HIT_DISTANCE) {
          if (c.target === 'minion') health.damage(MINION_DAMAGE);
          else felonius.hurt(FELONIUS_DAMAGE);
          c.state = 'returning';
        } else if (!still || c.diving > DIVE_GIVE_UP) {
          c.state = 'returning';
        }
      } else if (c.state === 'returning') {
        if (flyTowards(c, orbitPoint(c), RETURN_SPEED, delta)) {
          c.state = 'circling';
          c.rest = between(REST_TIME);
        }
      }
    }
  }

  const alive = () => crows.filter((c) => c.state !== 'falling');
  const toCrow = new THREE.Vector3();

  // The nearest crow a ray hits, treating each as a small ball.
  function raycast(origin, direction, maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;
    for (const c of alive()) {
      toCrow.subVectors(c.crow.position, origin);
      const along = toCrow.dot(direction);
      if (along < 0 || along >= nearestDistance) continue;
      const miss = toCrow.lengthSq() - along * along;
      if (miss > HIT_RADIUS * HIT_RADIUS) continue;
      nearest = c;
      nearestDistance = along;
    }
    return nearest && { target: nearest, distance: nearestDistance };
  }

  // Any hit brings a crow down.
  function knockDown(target) {
    if (target.state === 'falling') return false;
    target.state = 'falling';
    target.fall = 0;
    return true;
  }

  return {
    group,
    start,
    update,
    raycast,
    hurt: (target) => knockDown(target),
    near: (point, radius) => alive().filter((c) => c.crow.position.distanceTo(point) < radius + HIT_RADIUS),
    alert() {},
    // Frozen or set alight, a crow drops out of the sky.
    freeze: (target) => knockDown(target),
    ignite: (target) => knockDown(target),
    // Takis in its eyes: it gives up and flies back to circle for a while.
    blind(target, seconds) {
      if (target.state === 'falling') return;
      target.state = 'returning';
      target.rest = seconds;
    },
    owns: (target) => crows.includes(target),
    markers: () => alive().map((c) => ({ x: c.crow.position.x, z: c.crow.position.z })),
  };
}
