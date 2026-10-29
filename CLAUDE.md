# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: start the Vite dev server at http://localhost:5173, which reloads when files change.
- `npm run build`: production build into `dist/`. A warning about chunks over 500 kB comes from Three.js and is expected.
- There are no tests or linter yet.

## Architecture

The game is plain JavaScript (ES modules) using Three.js, served by Vite.

- `src/main.js` sets up the renderer, scene, lighting, the title/pause menu and the game loop. The night look comes from fog plus a moon light that follows the camera, so shadows only cover the area around the player. The player's torch is a spotlight attached to the camera on the left, away from the weapon held on the right, because a light right next to the weapon washes it out to white. F turns the torch on and off.
- `src/terrain.js` holds `heightAt(x, z)`, the source of truth for ground height outside the dungeons (see `groundAt` in `src/dungeon.js`). It is flat within `TEMPLE.flat` of the temple, at `TEMPLE_FLOOR`. The ground mesh, tree and rock placement, fireflies and the player's feet all use it, so anything new that sits on the ground must use it too. `WORLD_RADIUS` is the size of the playable area. `TEMPLE.angle` is the temple's turn. `createTerrain(holes)` leaves exact holes in the ground over the stairwells, cut in the ground's shader. The holes are rectangles in the temple's own space.
- `src/forest.js` places trees and rocks using seeded randomness (`src/random.js`), so the layout is the same on every load. It uses one `InstancedMesh` per kind of object so thousands of trees stay fast. It returns circle `colliders` that the player can't walk through. Trees are denser beyond `WORLD_RADIUS` so the edge of the map looks like more forest. No trees grow within `TEMPLE.clearing` of the temple. Its random numbers are still drawn there, so the rest of the forest keeps its layout. Tree and rock colliders have `above` set a little below their ground, so they don't block the dungeons underneath them. Anything that calls `pushOut` must give its position a real height.
- `src/health.js` holds the minion's health and keeps the HUD bar in sync. Anything that hurts the player (monsters, later) should call `health.damage()`. Reaching 0 calls `onDeath`, which in `main.js` shows the game-over screen; "Try again" reloads the page. In `npm run dev` only, pressing K deals 20 damage so med kits can be tested before monsters exist.
- `src/medkits.js` places seeded med kits (two near the start, plus any `hidden` spots it's given, such as the dungeon's) and heals 35 on walk-over, but only when the player isn't at full health. Its `update` takes `showMessage` from `main.js` for on-screen pickup text. Future pickups (weapons, keys) can follow the same pattern.
- `src/ammo.js` places 20 seeded ammo boxes, one near the start, the same way as med kits. Walking into one calls `weapons.refill()`, which tops up every weapon the minion has by that weapon's `ammo.box`, up to its `ammo.max`. The box is only used up if something needed ammo.
- `src/collision.js` buckets the forest colliders into a grid. Its `pushOut(position, radius)` is what stops anything that moves (the player, monsters) from going through trees or leaving the map. `rayDistance` finds the first tree or rock along a shot, so shots can't pass through trees. `remove` takes colliders out, for example when a door opens. A collider with `above` only blocks things at or above that height, and one with `below` only blocks things under it. That way the temple's walls don't block the dungeon underneath and the other way round. `monstersOnly` colliders only stop monsters, which pass `true` as `pushOut`'s third argument.
- `src/monsters.js` holds the shadow creatures. Each one is built from simple shapes with a pivot at each limb so the arms and legs can swing. A monster wanders until the player comes within `NOTICE_DISTANCE`, then chases and calls `health.damage()` on a cooldown. Chase speed is a little below the player's walking speed, because Henry asked for slower monsters. Monsters only update while the pointer is locked, so pausing freezes them. Each has 6 health. `raycast` finds the monster a shot hits and `hurt` knocks it back and stuns it. At 0 health it falls over, sinks into the ground and is removed. `freeze` turns a monster to ice so it can't move or attack. `alert` makes monsters near a loud noise chase for `ALERT_TIME`, even past `GIVE_UP_DISTANCE`. `near` lists the living monsters within a radius. Monsters roar when they start chasing, growl now and then within `GROWL_DISTANCE`, and play a ripping sound when they hit. Sounds are quieter the further off the monster is, and short gaps between roars, and between growls, stop a crowd from making a din. Ambush monsters don't roar, because the scare has its own screech.
- `src/weapons.js` holds the weapons in a `WEAPONS` list, in number-key order: the blunderbuss, the fart gun, the freeze ray, the flamethrower and the sword. Each one lies glowing somewhere in the woods, except the freeze ray and the fart gun, which are in the dungeons; the blunderbuss is just ahead of the start. The glow ignores fog so it can be seen from afar. Walking over a weapon picks it up and equips it. 1 to 5 or the mouse wheel switch weapons, and the bar at the bottom of the screen (`#weapons`) shows the ones you have. The held weapon sits in the bottom-right of the view as a child of the camera.
  - Every weapon except the sword has `ammo`: how many shots it comes with, the most it can carry, and how much an ammo box adds. The bar shows each weapon's ammo. With none left, firing just clicks.
  - Blunderbuss: 9 scattered pellets, each doing 1 damage, up to 30 m and blocked by trees. Its bang calls `monsters.alert` within 50 m.
  - Fart gun: leaves a gas cloud for 4 s that does 1 damage every 0.5 s to monsters inside it.
  - Freeze ray: a beam that freezes one monster for 5 s and does no damage.
  - Flamethrower: keeps spraying while the button is held. Every monster within 7 m in a narrow spray takes 1 damage every 0.3 s. Trees block it. The flames are short-lived sprites.
  - Sword: a swing that does 3 damage to every monster within 2.6 m in a wide arc in front. It has its own slash animation instead of recoil.
- `src/weapon-models.js` builds each weapon from simple shapes, pointing along -z. Materials aren't very metallic and glow faintly, because shiny metal turns black in the dark woods.
- `src/keys.js` holds the `KEYS` list. It has the plain gold temple key and 4 chamber keys (red, blue, green and purple), each with a gem in its colour. Each key lies glowing in its colour in the woods; `clearSpot` nudges it out of trees. A key with no `spot` is placed by whatever hides it with `keys.place`, and stays off the map; the red and green keys are placed this way in the dungeons. A `waiting` key (the blue and purple keys) isn't in the woods or on the map until `keys.reveal(id)` is called. Walking into a key picks it up, and carried keys are listed in `#keys` under the health bar. Doors check `keys.has(id)` and call `keys.use(id)`, and `keyInfo(id)` gives a key's name and colour. The cage key belongs in this list too.
- `src/temple.js` builds the temple out of stone boxes at `TEMPLE` in a clearing, with its front door facing the start. Fire bowls by the front door glow through the fog so the temple can be found. 4 hidden chambers (`CHAMBERS`) are small rooms built onto the outside of the side walls, two per side. The red, green and purple chambers each have a glowing gem on a stand as a placeholder; the blue chamber has the stairs down to the second dungeon instead. A chamber with `reveals` has a pulsing switch on its back wall in that key's colour; touching it calls `keys.reveal`. The red chamber's blue switch makes the blue key appear in the woods, and the green chamber's purple switch does the same for the purple key. Chamber and hall floors use `slabAroundStairs` so they have holes over the stairs. Every door comes from `door()`, a stone slab with a ring in its key's colour. A door stays locked until the minion reaches it carrying the matching key; then it sinks into the ground and its colliders are removed. Walls are rows of overlapping circle colliders, added to `forest.colliders` before the collision grid is built. `outline` gives the rooms and doors for the map.
- `src/dungeon.js` holds the two dungeons. Both floors are 4.5 m below the hall floor.
  - First dungeon: stairs go down from the middle of the hall to a landing under the temple. Passages lead to two rooms, and the red key is hidden behind crates in the east room. There are med kits on the landing and in the west room, and the freeze ray is in the west room.
  - Second dungeon: stairs go down from the blue chamber, west under its back wall, to a dungeon under the woods. It has a room at the foot of the stairs, the fart gun's room to the north, and a room to the south-west with the green key hidden behind crates.
  - `STAIRS` lists each flight with its `top` edge and its `opening`, the part open to the room above; the rest is a tunnel under the ground. Each opening has a low railing and an invisible monster line. The layout is a list of open rectangles (`SPACES`) in the temple's own space. `buildDungeon` marks them on a fine grid and builds walls, floors, ceilings and colliders around them as merged meshes, so changing the layout only means changing the lists. `DUNGEON_PICKUPS` and `KEY_SPOTS` say where things lie. Things in the dungeons stay off the map.
  - Torches have flames, but only the `TORCH_LIGHTS` nearest ones have a real light, which moves to them, so adding torches doesn't slow the game down. `groundAt(x, feetY, z)` is the ground height that knows about the stairs and the dungeon floor; the player uses it instead of `heightAt`. Anything below `UNDERGROUND` counts as down in a dungeon. Monsters don't go down there yet: they can't cross the monster lines, `isUnderground` makes them lose track of the minion, and there are no jump scares underground. Doors, switches and pickups only react to the minion on the same level.
- `src/stone.js` has the stone texture, `stoneBox` and `stoneGeometry` (for joining boxes into one mesh), which the temple and the dungeons share.
- `src/scares.js` holds the jump scares. It calls `monsters.ambush`, which makes a monster appear 2.6 m in front of the minion, facing them with its arms up, and gives one swipe's wait before it can hit. A scare also plays a screech, flashes `#flash.scare` and briefly tips and zooms the view. In the woods (not near the start or the temple), ambushes come at random times, so the player can't learn them. There is also one scare the first time the minion steps into the temple hall.
- `src/minimap.js` draws the round map in the top-right of the whole woods, with north (-z) at the top. Trees and rocks are drawn once from the colliders. A fog layer starts solid and clears within `REVEAL_RADIUS` of wherever the minion goes; it resets on reload. Monsters, med kits, weapons and keys come from each module's `markers()`, and the temple, its chambers and its coloured doors come from `temple.outline`. All of them are drawn under the fog, so they only show in explored areas. A new pickup should provide `markers()` and be drawn here.
- `src/sounds.js` makes every sound with Web Audio, so there are no sound files. It is created once in `main.js` and passed to whatever needs sounds.
- `src/player.js` handles first-person movement: pointer lock, WASD, running (Shift turns it on and off), jumping, gravity, collisions and staying inside the map. The camera sits low at 1.25 m because the player is a minion.

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
