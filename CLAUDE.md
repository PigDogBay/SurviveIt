# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: start the Vite dev server at http://localhost:5173, which reloads when files change.
- `npm run build`: production build into `dist/`. A warning about chunks over 500 kB comes from Three.js and is expected.
- There are no tests or linter yet.

## Architecture

The game is plain JavaScript (ES modules) using Three.js, served by Vite.

- `src/main.js` sets up the renderer, scene, lighting, the title/pause menu and the game loop. The night look comes from fog plus a moon light that follows the camera, so shadows only cover the area around the player. The player's torch is a spotlight attached to the camera on the left, away from the weapon held on the right, because a light right next to the weapon washes it out to white. F turns the torch on and off.
- `src/terrain.js` holds `heightAt(x, z)`, the one source of truth for ground height. It is flat within `TEMPLE.flat` of the temple, at `TEMPLE_FLOOR`. The ground mesh, tree and rock placement, fireflies and the player's feet all use it, so anything new that sits on the ground must use it too. `WORLD_RADIUS` is the size of the playable area.
- `src/forest.js` places trees and rocks using seeded randomness (`src/random.js`), so the layout is the same on every load. It uses one `InstancedMesh` per kind of object so thousands of trees stay fast. It returns circle `colliders` that the player can't walk through. Trees are denser beyond `WORLD_RADIUS` so the edge of the map looks like more forest. No trees grow within `TEMPLE.clearing` of the temple. Its random numbers are still drawn there, so the rest of the forest keeps its layout.
- `src/health.js` holds the minion's health and keeps the HUD bar in sync. Anything that hurts the player (monsters, later) should call `health.damage()`. Reaching 0 calls `onDeath`, which in `main.js` shows the game-over screen; "Try again" reloads the page. In `npm run dev` only, pressing K deals 20 damage so med kits can be tested before monsters exist.
- `src/medkits.js` places seeded med kits (two near the start) and heals 35 on walk-over, but only when the player isn't at full health. Its `update` takes `showMessage` from `main.js` for on-screen pickup text. Future pickups (weapons, keys) can follow the same pattern.
- `src/collision.js` buckets the forest colliders into a grid. Its `pushOut(position, radius)` is what stops anything that moves (the player, monsters) from going through trees or leaving the map. `rayDistance` finds the first tree or rock along a shot, so shots can't pass through trees. `remove` takes colliders out, for example when a door opens.
- `src/monsters.js` holds the shadow creatures. Each one is built from simple shapes with a pivot at each limb so the arms and legs can swing. A monster wanders until the player comes within `NOTICE_DISTANCE`, then chases and calls `health.damage()` on a cooldown. Chase speed is a little below the player's walking speed, because Henry asked for slower monsters. Monsters only update while the pointer is locked, so pausing freezes them. Each has 6 health. `raycast` finds the monster a shot hits and `hurt` knocks it back and stuns it. At 0 health it falls over, sinks into the ground and is removed. `freeze` turns a monster to ice so it can't move or attack. `alert` makes monsters near a loud noise chase for `ALERT_TIME`, even past `GIVE_UP_DISTANCE`. `near` lists the living monsters within a radius.
- `src/weapons.js` holds the weapons in a `WEAPONS` list, in number-key order: the blunderbuss, the fart gun, the freeze ray, the flamethrower and the sword. Each one lies glowing somewhere in the woods; the blunderbuss is just ahead of the start. The glow ignores fog so it can be seen from afar. Walking over a weapon picks it up and equips it. 1 to 5 or the mouse wheel switch weapons, and the bar at the bottom of the screen (`#weapons`) shows the ones you have. The held weapon sits in the bottom-right of the view as a child of the camera.
  - Blunderbuss: 9 scattered pellets, each doing 1 damage, up to 30 m and blocked by trees. Its bang calls `monsters.alert` within 50 m.
  - Fart gun: leaves a gas cloud for 4 s that does 1 damage every 0.5 s to monsters inside it.
  - Freeze ray: a beam that freezes one monster for 5 s and does no damage.
  - Flamethrower: keeps spraying while the button is held. Every monster within 7 m in a narrow spray takes 1 damage every 0.3 s. Trees block it. The flames are short-lived sprites.
  - Sword: a swing that does 3 damage to every monster within 2.6 m in a wide arc in front. It has its own slash animation instead of recoil.
- `src/weapon-models.js` builds each weapon from simple shapes, pointing along -z. Materials aren't very metallic and glow faintly, because shiny metal turns black in the dark woods.
- `src/keys.js` holds the `KEYS` list. It has the plain gold temple key and 4 chamber keys (red, blue, green and purple), each with a gem in its colour. Each key lies glowing in its colour in the woods; `clearSpot` nudges it out of trees. Walking into a key picks it up, and carried keys are listed in `#keys` under the health bar. Doors check `keys.has(id)` and call `keys.use(id)`, and `keyInfo(id)` gives a key's name and colour. The cage key belongs in this list too.
- `src/temple.js` builds the temple out of stone boxes at `TEMPLE` in a clearing, with its front door facing the start. Fire bowls by the front door glow through the fog so the temple can be found. 4 hidden chambers (`CHAMBERS`) are small rooms built onto the outside of the side walls, two per side. Each has a glowing gem on a stand as a placeholder. Every door comes from `door()`, a stone slab with a ring in its key's colour. A door stays locked until the minion reaches it carrying the matching key; then it sinks into the ground and its colliders are removed. Walls are rows of overlapping circle colliders, added to `forest.colliders` before the collision grid is built. `outline` gives the rooms and doors for the map.
- `src/scares.js` holds the jump scares. It calls `monsters.ambush`, which makes a monster appear 2.6 m in front of the minion, facing them with its arms up, and gives one swipe's wait before it can hit. A scare also plays a screech, flashes `#flash.scare` and briefly tips and zooms the view. In the woods (not near the start or the temple), ambushes come at random times, so the player can't learn them. There is also one scare the first time the minion steps into the temple hall.
- `src/minimap.js` draws the round map in the top-right of the whole woods, with north (-z) at the top. Trees and rocks are drawn once from the colliders. A fog layer starts solid and clears within `REVEAL_RADIUS` of wherever the minion goes; it resets on reload. Monsters, med kits, weapons and keys come from each module's `markers()`, and the temple, its chambers and its coloured doors come from `temple.outline`. All of them are drawn under the fog, so they only show in explored areas. A new pickup should provide `markers()` and be drawn here.
- `src/sounds.js` makes every sound with Web Audio, so there are no sound files. It is created once in `main.js` and passed to whatever needs sounds.
- `src/player.js` handles first-person movement: pointer lock, WASD, running, jumping, gravity, collisions and staying inside the map. The camera sits low at 1.25 m because the player is a minion.

To check visuals without a person playing, use headless Chrome's `--screenshot` with `--use-angle=swiftshader --enable-unsafe-swiftshader`. The menu covers the view until a click locks the pointer, so hide `#menu` in a temporary copy of the page first. In headless mode the frame time can run backwards, so timers like reloads won't behave normally; set them directly in the temporary copy.

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
