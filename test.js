// Real-click / real-input test for Hungry Hole: Eat Everything.
// Usage: NODE_PATH=~/workspace/tools/pw-shot/node_modules node test.js file:///.../index.html ./test-shots
// Steering: real mouse moves for the eat check; real keyboard (arrow keys)
// for the long playthrough — mouse.move in this headless SwiftShader build
// forces a ~0.5s software composite per step, keyboard input does not.
const { chromium } = require('playwright-core');
const fs = require('fs');
const [url, outdir] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--single-process', '--js-flags=--max-old-space-size=256', '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/tools/pw-shot/webgl-policy.txt', '--hatch-webgl-allowed-domains-sha256=dc8a0e5eec744f6590a4c1889139c00568ffedc3eced6d0a1a5127e35f9ccd16'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const state = () => page.evaluate(() => window.__hungryGame ? window.__hungryGame() : null);
  let canvasBox = null;
  const box = async () => { if (!canvasBox) canvasBox = await page.locator('#game').boundingBox(); return canvasBox; };
  // mouse steering (real pointer input) toward the nearest edible
  const steerMouse = async (s) => {
    const b = await box();
    const x = b.x + s.nearestEdible.x / 480 * b.width;
    const y = b.y + s.nearestEdible.y / 720 * b.height;
    await page.mouse.move(x, y, { steps: 1 });
  };
  // keyboard steering (real key input): 8-way, toward target / away from bigger rivals
  const held = new Set();
  async function steerKeys(dx, dy) {
    const want = new Set();
    if (dx < -0.3) want.add('ArrowLeft');
    if (dx > 0.3) want.add('ArrowRight');
    if (dy < -0.3) want.add('ArrowUp');
    if (dy > 0.3) want.add('ArrowDown');
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  }
  async function releaseKeys() { for (const k of [...held]) await page.keyboard.up(k); held.clear(); }
  async function steerTowardSnack(s) {
    const px = s.playerScreen.x, py = s.playerScreen.y;
    const big = (s.rivals || []).filter(r => r.bigger);
    // flee the closest bigger rival, drifting toward mid-map so rivals
    // can't corner the player against a wall; while invulnerable after a
    // hit, always run — never dive back toward snacks
    let bd = 1e9, br = null;
    for (const r of big) { const d = Math.hypot(r.x - px, r.y - py); if (d < bd) { bd = d; br = r; } }
    if (br && (bd < 110 || s.invuln)) {
      let fx = -(br.x - px) / bd, fy = -(br.y - py) / bd;
      const cx = (s.world / 2 - s.playerWorld.x) / (s.world / 2);
      const cy = (s.world / 2 - s.playerWorld.y) / (s.world / 2);
      const cl = Math.hypot(cx, cy) || 1;
      fx += (cx / cl) * 0.7; fy += (cy / cl) * 0.7;
      const fl = Math.hypot(fx, fy) || 1;
      await steerKeys(fx / fl, fy / fl);
      return;
    }
    // eat a smaller rival when one is near (+300), if no big rival guards it
    if (s.rivalEdible) {
      const dx = s.rivalEdible.x - px, dy = s.rivalEdible.y - py;
      const dd = Math.hypot(dx, dy);
      let guarded = false;
      for (const r of big) if (Math.hypot(s.rivalEdible.x - r.x, s.rivalEdible.y - r.y) < 80) guarded = true;
      if (dd < 300 && !guarded) { await steerKeys(dx / dd, dy / dd); return; }
    }
    // best snack by value, skipping snacks a bigger rival is camping on
    const cands = (s.edibles && s.edibles.length ? s.edibles : [s.bestTarget || s.nearestEdible]);
    let best = cands[0], bv = -1e9;
    for (const c of cands) {
      const d = Math.hypot(c.x - px, c.y - py);
      let guarded = false;
      for (const r of big) if (Math.hypot(c.x - r.x, c.y - r.y) < 60) guarded = true;
      const v = (c.pts || 10) / (d + 40) - (guarded ? 0.5 : 0);
      if (v > bv) { bv = v; best = c; }
    }
    const tx = best.x - px, ty = best.y - py;
    const l = Math.hypot(tx, ty) || 1;
    await steerKeys(tx / l, ty / l);
  }

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  let s = await state();
  check('loads, hook present, menu screen', s && s.screen === 'menu', JSON.stringify(s));
  await page.screenshot({ path: outdir + '/01-menu.png' });

  // Start game (real click)
  await page.click('#btn-start');
  await page.waitForTimeout(400);
  s = await state();
  check('start -> playing, level 1, 3 lives, target 280, 1 rival, 45 objects', s && s.screen === 'playing' && s.level === 1 && s.lives === 3 && s.target === 280 && s.rivalCount === 1 && s.objCount === 45, JSON.stringify(s));
  await page.screenshot({ path: outdir + '/02-level1.png' });

  // Pause / resume + mute first, right after start while the rival is
  // still far away: a bigger rival hunts an idle player, so these checks
  // must not run after the mouse is left parked near it.
  await page.click('#btn-pause');
  await page.waitForTimeout(200);
  s = await state();
  check('pause button -> pause screen', s.screen === 'pause', JSON.stringify(s));
  await page.click('#btn-resume');
  await page.waitForTimeout(200);
  s = await state();
  check('resume -> playing', s.screen === 'playing', JSON.stringify(s));

  // Mute toggle (real clicks)
  await page.click('#btn-mute');
  s = await state();
  check('mute toggles on', s.muted === true, JSON.stringify(s));
  await page.click('#btn-mute');
  s = await state();
  check('mute toggles back off', s.muted === false, JSON.stringify(s));

  // Mouse steering eats a snack (real pointer input)
  let ate = false;
  for (let i = 0; i < 90; i++) {
    s = await state();
    if (!s || s.screen !== 'playing') break;
    await steerMouse(s);
    await page.waitForTimeout(120);
    s = await state();
    if (s && s.eaten >= 1 && s.score > 0) { ate = true; break; }
  }
  check('mouse steering eats a snack: eaten>=1, score>0, hole grew', ate && s.playerR > 16, JSON.stringify(s));
  await page.screenshot({ path: outdir + '/03-eating.png' });

  // Play through to win with keyboard steering (real key input)
  let won = false, guard = 0, maxLevel = 1, lastLevel = 1, levelTimes = {};
  const playStart = Date.now();
  while (guard++ < 4000) {
    s = await state();
    if (!s) break;
    if (s.screen === 'win') { won = true; break; }
    if (s.screen === 'over') break;
    if (s.screen === 'clear' || s.screen === 'timeup') { await releaseKeys(); await page.waitForTimeout(300); continue; }
    if (s.screen === 'playing') {
      if (s.level !== lastLevel) { levelTimes[lastLevel] = ((Date.now() - playStart) / 1000).toFixed(0) + 's'; lastLevel = s.level; }
      maxLevel = Math.max(maxLevel, s.level);
      if (s.level === 5 && !levelTimes.shot5) { levelTimes.shot5 = 1; await page.screenshot({ path: outdir + '/04-level5.png' }); }
      if (s.level === 10 && !levelTimes.shot10) { levelTimes.shot10 = 1; await page.screenshot({ path: outdir + '/05-level10.png' }); }
      if (s.level === 20 && !levelTimes.shot20) { levelTimes.shot20 = 1; await page.screenshot({ path: outdir + '/06-level20.png' }); }
      await steerTowardSnack(s);
    }
    await page.waitForTimeout(150);
  }
  await releaseKeys();
  s = await state();
  check('full playthrough reaches WIN after 20 rounds (real keyboard steering)', won && s.screen === 'win' && s.level === 21, JSON.stringify(s) + ' maxLevel=' + maxLevel + ' levelTimes=' + JSON.stringify(levelTimes) + ' wall=' + ((Date.now() - playStart) / 1000).toFixed(0) + 's');
  await page.screenshot({ path: outdir + '/07-final.png' });

  // After the playthrough: if we won, Play Again must reset; if the run
  // ended on game-over, Retry must restart a fresh game instead.
  if (won) {
    await page.click('#btn-again-win');
    await page.waitForTimeout(400);
    s = await state();
    check('play again resets to level 1, score 0, 3 lives', s.screen === 'playing' && s.level === 1 && s.score === 0 && s.lives === 3, JSON.stringify(s));
  } else {
    check('play again resets to level 1, score 0, 3 lives', false, 'playthrough ended on ' + s.screen + ' (level ' + s.level + '), no win to replay from');
    if (s.screen === 'over') {
      await page.click('#btn-again-over');
      await page.waitForTimeout(400);
      s = await state();
      check('retry from game over (after failed run) -> playing level 1', s.screen === 'playing' && s.level === 1, JSON.stringify(s));
    } else {
      check('retry from game over (after failed run) -> playing level 1', false, 'not on game-over screen (screen=' + s.screen + ')');
    }
  }

  // Game over path: charge the bigger rival with real keys until 3 hits land.
  // If the player outgrows the rival, stand still — a bigger rival hunts the player.
  let over = false, restarts = 0;
  const overStart = Date.now();
  while (Date.now() - overStart < 180000 && !over) {
    s = await state();
    if (!s) break;
    if (s.screen === 'over') { over = true; break; }
    if (s.screen === 'clear' || s.screen === 'timeup') { await releaseKeys(); await page.waitForTimeout(300); continue; }
    if (s.screen !== 'playing') { await page.waitForTimeout(300); continue; }
    if (s.nearestRival && s.nearestRival.bigger) {
      const px = s.playerScreen.x, py = s.playerScreen.y;
      const dx = s.nearestRival.x - px, dy = s.nearestRival.y - py;
      const l = Math.hypot(dx, dy) || 1;
      await steerKeys(dx / l, dy / l);
    } else {
      // player outgrew the rival: stop eating, let the timer/rival sort it out
      await releaseKeys();
      await page.waitForTimeout(500);
      s = await state();
      if (s && s.screen === 'playing' && s.nearestRival && !s.nearestRival.bigger && s.lives === 3 && Date.now() - overStart > 60000 && restarts < 1) {
        restarts++;
        await page.click('#btn-pause'); await page.waitForTimeout(200);
        await page.click('#btn-quit'); await page.waitForTimeout(200);
        await page.click('#btn-start'); await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(250);
  }
  await releaseKeys();
  s = await state();
  check('rival hits -> game over screen, lives 0', over && s.screen === 'over' && s.lives === 0, JSON.stringify(s));
  await page.screenshot({ path: outdir + '/08-gameover.png' });

  // Retry from game over (real click)
  await page.click('#btn-again-over');
  await page.waitForTimeout(400);
  s = await state();
  check('retry from game over -> playing level 1', s.screen === 'playing' && s.level === 1, JSON.stringify(s));

  check('no page/console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
