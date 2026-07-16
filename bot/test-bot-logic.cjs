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

  // Add with a display override (label + subtitle + logo domain)
  const addMeta = configStore.addSymbol('portfolio', '^TA125.TA', {
    label: 'TA125',
    name: 'Tel Aviv 125',
    logo: 'https://www.tase.co.il/en/market',
  });
  check('addSymbol with meta reports ok', addMeta.ok === true);
  const withMeta = configStore.getLabel('portfolio', '^TA125.TA');
  check('label stored', withMeta.label === 'TA125');
  check('name stored', withMeta.name === 'Tel Aviv 125');
  check('logo domain normalized (protocol/path stripped)', withMeta.logo === 'tase.co.il');

  // setLabel merges — only the given field changes, others are kept
  const relabel = configStore.setLabel('portfolio', '^TA125.TA', { label: 'TA-125' });
  check('setLabel reports ok', relabel.ok === true);
  const merged = configStore.getLabel('portfolio', '^TA125.TA');
  check('setLabel updated label', merged.label === 'TA-125');
  check('setLabel kept untouched name', merged.name === 'Tel Aviv 125');

  // Blank fields are dropped, not persisted as empty strings
  const addBlank = configStore.addSymbol('tech', 'IBM', { label: '  ', name: '' });
  check('addSymbol with blank meta ok', addBlank.ok === true);
  const blank = configStore.getLabel('tech', 'IBM');
  check('blank meta not persisted', Object.keys(blank).length === 0);

  // setLabel on a symbol not in the screen is rejected
  const relabelMissing = configStore.setLabel('portfolio', 'ZZZZ', { label: 'X' });
  check('setLabel on missing symbol rejected', relabelMissing.ok === false);

  // Removing a symbol drops its orphaned override
  configStore.removeSymbol('portfolio', '^TA125.TA');
  check('override cleared on removal', Object.keys(configStore.getLabel('portfolio', '^TA125.TA')).length === 0);

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
