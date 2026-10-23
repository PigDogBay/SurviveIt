# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: start the Vite dev server at http://localhost:5173, which reloads when files change.
- `npm run build`: production build into `dist/`. A warning about chunks over 500 kB comes from Three.js and is expected.
- There are no tests or linter yet.

## Architecture

The game is plain JavaScript (ES modules) using Three.js, served by Vite.

- `src/main.js` sets up the renderer, scene, lighting, the title/pause menu and the game loop. The night look comes from fog plus a moon light that follows the camera, so shadows only cover the area around the player. The player's torch is a spotlight attached to the camera; F turns it on and off.
- `src/terrain.js` holds `heightAt(x, z)`, the one source of truth for ground height. The ground mesh, tree and rock placement, fireflies and the player's feet all use it, so anything new that sits on the ground must use it too. `WORLD_RADIUS` is the size of the playable area.
- `src/forest.js` places trees and rocks using seeded randomness (`src/random.js`), so the layout is the same on every load. It uses one `InstancedMesh` per kind of object so thousands of trees stay fast. It returns circle `colliders` that the player can't walk through. Trees are denser beyond `WORLD_RADIUS` so the edge of the map looks like more forest.
- `src/health.js` holds the minion's health and keeps the HUD bar in sync. Anything that hurts the player (monsters, later) should call `health.damage()`. Reaching 0 calls `onDeath`, which in `main.js` shows the game-over screen; "Try again" reloads the page. In `npm run dev` only, pressing K deals 20 damage so med kits can be tested before monsters exist.
- `src/medkits.js` places seeded med kits (two near the start) and heals 35 on walk-over, but only when the player isn't at full health. Its `update` takes `showMessage` from `main.js` for on-screen pickup text. Future pickups (weapons, keys) can follow the same pattern.
- `src/collision.js` buckets the forest colliders into a grid. Its `pushOut(position, radius)` is what stops anything that moves (the player, monsters) from going through trees or leaving the map.
- `src/monsters.js` holds the shadow creatures. Each one is built from simple shapes with a pivot at each limb so the arms and legs can swing. A monster wanders until the player comes within `NOTICE_DISTANCE`, then chases and calls `health.damage()` on a cooldown. Chase speed sits between the player's walk and run speeds on purpose, so the player has to run to escape. Monsters only update while the pointer is locked, so pausing freezes them.
- `src/player.js` handles first-person movement: pointer lock, WASD, running, jumping, gravity, collisions and staying inside the map. The camera sits low at 1.25 m because the player is a minion.

To check visuals without a person playing, use headless Chrome's `--screenshot` with `--use-angle=swiftshader --enable-unsafe-swiftshader`. The menu covers the view until a click locks the pointer, so hide `#menu` in a temporary copy of the page first.

## What we're building

**Survive It**: a game designed by Henry Bailey (age 9). `description.txt` is the source of truth for the design. Treat it as the client's brief: keep to what it asks for and don't add or drop features without checking with the user.

- **Premise:** The player is one of Gru's minions. They search haunted woods full of monsters for an ancient temple, then free Gru's trapped son Felonius from a cage inside it.
- **Characters:**
  - Minion: the player.
  - Gru: gives the mission and guidance.
  - Felonius: Gru's son, who must be rescued.
  - Roro: an evil bird who guards the cage and is the final boss.
- **Graphics:** 3D first person with a realistic look.
- **Platform:** runs in a web browser with mouse and keyboard controls.
- **Mechanics:**
  - The player has a health bar that monsters can drain. Med kits refill it.
  - Collect minion-style weapons to kill the monsters.
- **Key progression (the core game loop):**
  1. Find 1 key in the woods to unlock the temple.
  2. Find 4 more keys to unlock the temple's hidden chambers.
  3. Find 1 final key to unlock the cage. Roro guards it.

## Character art (`characters.pdf`)

`characters.pdf` is one page of Henry's hand-drawn characters. Use it as the visual reference for character models and colours:
- A yellow minion with one eye, grey goggles, blue overalls and a round pocket logo.
- Brown birds with pink necks and legs. One drawing has blue and pink markings and looks stacked or multi-headed, so it's probably Roro.
- Two pencil figures that aren't coloured in: a tall figure with a long nose and a striped scarf (probably Gru), and a smiling figure with glasses, a cat-ear hood and a backpack.

The drawings aren't labelled, so the matches above are guesses. Check with the user before treating them as final.
