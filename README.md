# Hungry Hole: Eat Everything

Original grow-by-eating arena game. Mechanics only were inspired by the
2D grow-by-eating arena genre — no art, code, names, characters, or assets
were copied from any existing game. You play **Gulp**, a little hungry
crater loose in the park; the rival craters **Nibbler**, **Chomper** and
**Gobbler** are original characters too. All art is drawn procedurally on
canvas; all music and sound effects are synthesised with WebAudio (no
copyrighted music, no external assets, no network needed).

## Game

- **Name:** Hungry Hole: Eat Everything
- **Format:** single self-contained `index.html` — plain HTML5 + vanilla JS
  + Canvas, no engine, no external assets, no network needed.
- **Play:** steer Gulp around a top-down park arena. Swallow anything
  smaller than your hole — pebbles, mushrooms, flowers, cones, crates,
  benches, trees, cars, buses, houses and the round waddling Wobbler
  townsfolk. Eating grows you, which unlocks bigger snacks. Rival craters
  eat too: a bigger rival that touches you costs a life and shrinks you,
  but outgrow one and you can eat *it* for +300 points.
- **Rounds:** 20. Maps grow (900 → 1800 px worlds), targets rise
  (280 → 1800 points), timers tighten (99s → 80s), rivals get bigger,
  faster and more numerous (1 → 3, the third joining at round 13). Reach the round target score before
  the timer ends to advance.
- **Rules:** 3 lives. Timer running out loses a life and retries the round
  (score resets to what you entered the round with). A bigger rival's touch
  loses a life and shrinks Gulp (keeping 70% of its size, 4s invulnerability
  after a hit, and the rival backs off for a few seconds). Eating a rival: +300 and it slinks back later, smaller.
  Eating quickly builds a combo (up to ×5 score). Win screen after round
  20; game-over screen with retry.
- **Extras:** start menu with how-to-play and an animated Gulp demo,
  HUD (round / score / lives / timer bar / target-progress bar), pause
  (button or P/Esc), mute (button or M), synthesised WebAudio SFX (gulp,
  chomp, hurt, clear/win/lose jingles) + an original looping pentatonic
  melody, combo toasts, edge arrows pointing to off-screen snacks,
  touch + mouse + WASD/arrow-key steering, portrait-friendly, works on
  desktop too. Best score is kept in `localStorage`.
- **Test hook:** `window.__hungryGame()` returns screen/level/score/lives/
  target/progress/player size/nearest edible & rival screen positions —
  state only, used by the automated test.

## Architecture notes

- Simulation runs on a fixed 30 Hz `setInterval`, decoupled from
  rendering (`requestAnimationFrame`). This is deliberate: headless /
  software-GPU environments can present at ~1 fps, but the game must
  still run in real time. On a normal device both run at full speed.
- The park background (lawn checker, winding path, speckles, border) is
  baked once per round into an offscreen canvas, so each frame is a
  single `drawImage` blit. Canvas backing store is capped at DPR 1 for
  the same reason (software rendering stays fast; the art is vector-drawn
  so it stays crisp).
- Rival AI: wander toward the nearest snack smaller than them (eating and
  growing), chase Gulp when bigger and close, flee when Gulp is bigger.

## How to run

Open `index.html` directly in a browser, or serve the folder:

```bash
cd ~/workspace/playables-inspired/hungry-hole
python3 -m http.server 8932
# open http://127.0.0.1:8932/index.html
```

## Test results — 12/12 passed (real mouse clicks, keys and steering, headless Chromium)

Run with: `NODE_PATH=~/workspace/tools/pw-shot/node_modules node test.js file:///.../index.html ./test-shots`
(or `./run-test.sh`, which retries once if the headless browser itself dies
mid-run — this VM runs several Chrome sessions in parallel and the test
browser was OOM-killed twice during development.)
(Test script: `test.js`; screenshots: `test-shots/`; green run:
`/tmp/fulltest-attempt1.log`, attempt 1.)

Real-input headless-Chromium test: real clicks for start/pause/resume/
mute/play-again/retry, real mouse moves for the eating check, real arrow
keys for the 20-round playthrough and the rival-hit game-over path.

| Check | Result |
|---|---|
| Loads, menu screen, no errors | PASS |
| Start → playing, level 1, 3 lives, target 280, 1 rival, 45 objects | PASS |
| Pause button → pause screen; Resume → playing | PASS |
| Mute toggles on, then back off | PASS |
| Mouse steering eats a snack: eaten 2, score 45, hole grew 16 → 18 | PASS |
| Full playthrough (real keyboard steering) → WIN after 20 rounds | PASS — win screen, score 23,675, 190 things eaten, best combo ×10, 2 lives left, 561s wall |
| Play again → resets to level 1, score 0, 3 lives | PASS |
| Rival hits → game over screen, lives 0 | PASS |
| Retry from game over → playing level 1 | PASS |
| No page/console errors | PASS |

Screenshots visually verified: menu (title, Gulp demo hole, how-to-play),
level 1 (park lawn, path, cones/mushrooms/crates, Gulp hole), level 10
(cars, Wobblers, bench, lamp), level 20 (houses, bus, Wobblers, score
21,795), win screen (final score 23,675, 190 eaten, best combo ×10),
game-over screen (score 125, reached round 1, best 23,675, Nibbler
visible).

Notes from testing:
- Headless Chrome on this VM needs the existing
  `--hatch-webgl-allowed-domains-file` launch flag (see `test.js`); the
  test uses a `file://` URL because localhost navigation is blocked by
  Chrome's local-network checks. The game itself needs no network.
- Headless SwiftShader presents canvas at ~1 fps and a `mouse.move`
  forces a ~0.5s software composite per step, so the long playthrough
  steers with real arrow-key input (the game supports both); the eating
  check still uses real mouse moves. This is a test-environment quirk,
  not a game defect — on a real device the game runs at full frame rate.

## Status

Build only. **Not submitted to any portal** (GamePix / GameDistribution /
GameMonetize or any other). Portal builds would need each portal's SDK,
thumbnails, and descriptions added later.
