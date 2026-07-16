// Exercises the bot's core logic without Telegram: config-store mutations
// and Yahoo ticker validation. The Telegram transport itself needs a real
// token + your account, so that part is verified by actually messaging the
// bot; this covers the parts that can fail silently.
//
// Run: node bot/test-bot-logic.cjs
// It uses a throwaway config dir so it won't touch your real screens.json.

const os = require('os');
const path = require('path');
const fs = require('fs');

// Redirect the config store to a temp dir before requiring it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screensaver-test-'));
process.env.LOCALAPPDATA = tmpDir;

const configStore = require('../shared/config-store.cjs');
const { validateTicker } = require('./yahoo-validate.cjs');

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

async function run() {
  // Seeding
  const seeded = configStore.ensureSeeded();
  check('seeds 3 default screens', seeded.length === 3);
  check('config file created', fs.existsSync(configStore.configPath()));

  // Add
  const add = configStore.addSymbol('portfolio', 'AAPL');
  check('addSymbol reports ok', add.ok === true);
  check('AAPL now in portfolio', configStore.readScreens().find((s) => s.id === 'portfolio').symbols.includes('AAPL'));

  // Duplicate add rejected
  const dup = configStore.addSymbol('portfolio', 'AAPL');
  check('duplicate add rejected', dup.ok === false && /already/.test(dup.error));

  // Remove
  const rm = configStore.removeSymbol('portfolio', 'AAPL');
  check('removeSymbol reports ok', rm.ok === true);
  check('AAPL removed from portfolio', !configStore.readScreens().find((s) => s.id === 'portfolio').symbols.includes('AAPL'));

  // Remove missing rejected
  const rmMissing = configStore.removeSymbol('portfolio', 'ZZZZ');
  check('removing missing symbol rejected', rmMissing.ok === false);

  // Unknown screen rejected
  const badScreen = configStore.addSymbol('nope', 'AAPL');
  check('unknown screen rejected', badScreen.ok === false);

  // Symbol containing the separator's tricky chars round-trips
  const crypto = configStore.addSymbol('indices', 'BINANCE:BTCUSDT');
  check('colon-containing symbol add rejected as duplicate (already seeded)', crypto.ok === false);

  // Yahoo validation — real ticker
  const good = await validateTicker('aapl');
  check('validateTicker accepts AAPL', good.ok === true && good.symbol === 'AAPL' && !!good.name);

  // Yahoo validation — nonsense ticker
  const bad = await validateTicker('ZZZZQQ');
  check('validateTicker rejects nonsense', bad.ok === false);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
