import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { heightAt, WORLD_RADIUS } from './terrain.js';

const COUNT = 26;
// Monsters never start this close to the player's starting clearing.
const SAFE_START = 35;
const RADIUS = 0.5;

const WANDER_SPEED = 1.4;
// Faster than walking (4.5) but slower than running (8), so the minion has to run.
const CHASE_SPEED = 5.5;
const NOTICE_DISTANCE = 22;
const GIVE_UP_DISTANCE = 34;
const ATTACK_DISTANCE = 1.6;
const ATTACK_DAMAGE = 15;
const ATTACK_COOLDOWN = 1.2;

const skin = new THREE.MeshStandardMaterial({ color: 0x1c1a1f, roughness: 0.85 });
// Eyes ignore fog and lighting, so a pair of red eyes is the first thing you
// see in the dark.
const eyes = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });

const bodyGeometry = new THREE.CapsuleGeometry(0.45, 0.8, 4, 10);
const headGeometry = new THREE.SphereGeometry(0.38, 12, 10);
const eyeGeometry = new THREE.SphereGeometry(0.07, 8, 6);
const limbGeometry = new THREE.CapsuleGeometry(0.1, 0.9, 3, 6).translate(0, -0.55, 0);
const clawGeometry = new THREE.ConeGeometry(0.05, 0.25, 5).rotateX(Math.PI).translate(0, -1.15, 0);

function limb(x, y, withClaws) {
  // A pivot at the shoulder or hip so the limb swings from the top.
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  pivot.add(new THREE.Mesh(limbGeometry, skin));
  if (withClaws) {
    for (const offset of [-0.06, 0, 0.06]) {
      const claw = new THREE.Mesh(clawGeometry, skin);
      claw.position.x = offset;
      pivot.add(claw);
    }
  }
  pivot.traverse((part) => (part.castShadow = true));
  return pivot;
}

// A tall, hunched shadow creature with long clawed arms.
function buildMonster() {
  const monster = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.15;
  body.rotation.x = 0.35; // hunched forward
  monster.add(body);

  const torso = new THREE.Mesh(bodyGeometry, skin);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(headGeometry, skin);
  head.position.set(0, 0.85, 0.15);
  head.castShadow = true;
  body.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyes);
    eye.position.set(side * 0.14, 0.9, 0.48);
    body.add(eye);
  }

  const leftArm = limb(-0.55, 0.45, true);
  const rightArm = limb(0.55, 0.45, true);
  body.add(leftArm, rightArm);

  const leftLeg = limb(-0.22, 1.1, false);
  const rightLeg = limb(0.22, 1.1, false);
  monster.add(leftLeg, rightLeg);

  return { monster, leftArm, rightArm, leftLeg, rightLeg };
}

export function createMonsters(collisions) {
  const random = createRandom(666);
  const group = new THREE.Group();
  const monsters = [];

  while (monsters.length < COUNT) {
    const angle = range(random, 0, Math.PI * 2);
    const distance = range(random, SAFE_START, WORLD_RADIUS - 10);
    const position = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    collisions.pushOut(position, RADIUS);
    position.y = heightAt(position.x, position.z);

    const parts = buildMonster();
    parts.monster.position.copy(position);
    group.add(parts.monster);
    monsters.push({
      ...parts,
      chasing: false,
      heading: range(random, 0, Math.PI * 2),
      wanderTimer: 0,
      attackTimer: 0,
      stride: range(random, 0, 10),
    });
  }

  const toPlayer = new THREE.Vector3();

  function update(delta, playerPosition, health) {
    for (const m of monsters) {
      const position = m.monster.position;
      toPlayer.set(playerPosition.x - position.x, 0, playerPosition.z - position.z);
      const distance = toPlayer.length();

      if (distance < NOTICE_DISTANCE) m.chasing = true;
      else if (distance > GIVE_UP_DISTANCE) m.chasing = false;

      let speed = 0;
      if (m.chasing) {
        m.heading = Math.atan2(toPlayer.x, toPlayer.z);
        speed = distance > ATTACK_DISTANCE * 0.8 ? CHASE_SPEED : 0;
      } else {
        // Shuffle about, changing direction every few seconds.
        m.wanderTimer -= delta;
        if (m.wanderTimer <= 0) {
          m.heading += range(random, -1.5, 1.5);
          m.wanderTimer = range(random, 2, 5);
        }
        speed = WANDER_SPEED;
      }

      position.x += Math.sin(m.heading) * speed * delta;
      position.z += Math.cos(m.heading) * speed * delta;
      collisions.pushOut(position, RADIUS);
      position.y = heightAt(position.x, position.z);

      // Turn smoothly towards the way it's heading.
      const turn = Math.atan2(Math.sin(m.heading - m.monster.rotation.y), Math.cos(m.heading - m.monster.rotation.y));
      m.monster.rotation.y += turn * Math.min(1, delta * 8);

      // Swing legs and arms in time with walking speed.
      m.stride += delta * speed * 2.2;
      const swing = Math.sin(m.stride) * Math.min(1, speed / 2) * 0.7;
      m.leftLeg.rotation.x = swing;
      m.rightLeg.rotation.x = -swing;

      m.attackTimer -= delta;
      if (m.chasing && distance < ATTACK_DISTANCE) {
        if (m.attackTimer <= 0) {
          health.damage(ATTACK_DAMAGE);
          m.attackTimer = ATTACK_COOLDOWN;
        }
      }
      // Arms lunge forward right after a swipe, otherwise they dangle.
      const lunge = m.attackTimer > ATTACK_COOLDOWN - 0.3 ? -1.6 : m.chasing ? -0.6 : 0;
      m.leftArm.rotation.x = THREE.MathUtils.lerp(m.leftArm.rotation.x, lunge - swing * 0.5, Math.min(1, delta * 12));
      m.rightArm.rotation.x = THREE.MathUtils.lerp(m.rightArm.rotation.x, lunge + swing * 0.5, Math.min(1, delta * 12));
    }
  }

  return { group, update };
}
