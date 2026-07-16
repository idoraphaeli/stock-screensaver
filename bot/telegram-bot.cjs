// Telegram bot that edits the screensaver's stock list live.
//
// Runs as a standalone always-on Node process (separate from the
// screensaver, which only runs when the PC is idle). It long-polls
// Telegram — the PC reaches out to Telegram, so no public server, webhook,
// or open port is needed. It writes screens.json via the shared config
// store; the screensaver's file watcher picks up the change and updates the
// display live.
//
// Interaction is menu-driven (inline-keyboard buttons) for every choice
// except the one genuinely open field — the ticker to add — which is typed
// as text and validated against Yahoo before it's accepted.
//
// Setup: see bot/README.md. Config comes from bot/bot-config.json (or the
// TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env vars).

const fs = require('fs');
const path = require('path');
const configStore = require('../shared/config-store.cjs');
const { validateTicker } = require('./yahoo-validate.cjs');

function loadBotConfig() {
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'bot-config.json'), 'utf8'));
  } catch {
    // No file — fall back to env vars.
  }
  const token = process.env.TELEGRAM_BOT_TOKEN || fileConfig.botToken || '';
  const rawChatId = process.env.TELEGRAM_CHAT_ID || fileConfig.allowedChatId;
  const allowedChatId = rawChatId ? Number(rawChatId) : null;
  return { token, allowedChatId };
}

const { token: TOKEN, allowedChatId: ALLOWED_CHAT_ID } = loadBotConfig();

if (!TOKEN) {
  console.error(
    'No bot token. Create bot/bot-config.json from bot-config.example.json\n' +
      'and paste the token from @BotFather (see bot/README.md).'
  );
  process.exit(1);
}

// callback_data delimiter. Not ':' — some symbols contain it (BINANCE:BTCUSDT).
const SEP = '|';

async function tg(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

// Per-chat conversation state. Only step we track is "waiting for a typed
// ticker" (with the screen it will go into); everything else is stateless
// button taps.
const chatState = new Map();

function mainMenu(chatId, text = 'What would you like to do?') {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '➕ Add stock', callback_data: 'act' + SEP + 'add' },
          { text: '➖ Remove stock', callback_data: 'act' + SEP + 'remove' },
        ],
        [
          { text: '✏️ Rename / logo', callback_data: 'act' + SEP + 'rename' },
          { text: '📋 Show current', callback_data: 'act' + SEP + 'show' },
        ],
      ],
    },
  });
}

function screenButtons(prefix) {
  const screens = configStore.ensureSeeded();
  const rows = screens.map((screen) => [
    { text: screen.title, callback_data: prefix + SEP + screen.id },
  ]);
  rows.push([{ text: '« Back', callback_data: 'menu' }]);
  return rows;
}

// A symbol with its custom display label shown as "SYMBOL (label)" when one
// is set, so `Show current` and the rename picker reveal the overrides.
function symbolWithLabel(screen, symbol) {
  const custom = screen.labels && screen.labels[symbol] && screen.labels[symbol].label;
  return custom ? `${symbol} (${custom})` : symbol;
}

function showCurrent(chatId) {
  const screens = configStore.ensureSeeded();
  const lines = screens.map((screen) => {
    const list = screen.symbols.map((symbol) => symbolWithLabel(screen, symbol)).join(', ');
    return `*${screen.title}*: ${list || '(empty)'}`;
  });
  return tg('sendMessage', {
    chat_id: chatId,
    text: '📋 Current stocks:\n\n' + lines.join('\n'),
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '« Menu', callback_data: 'menu' }]] },
  });
}

// The add/rename customization wizard collects three optional typed fields in
// sequence — label → subtitle → logo — each skippable with /skip. State lives
// in chatState as { step, screenId, symbol, mode: 'add' | 'rename', meta,
// current }. `current` holds the existing override (rename only) so prompts
// can show what's set now.
const WIZARD_STEPS = ['awaiting_label', 'awaiting_name', 'awaiting_logo'];

const STEP_PROMPTS = {
  awaiting_label: {
    field: 'label',
    ask: 'Send a *display label* — the big ticker text shown on screen (e.g. `TA125`).',
  },
  awaiting_name: {
    field: 'name',
    ask: 'Send a *subtitle* — the small name under the ticker (e.g. `Tel Aviv 125`).',
  },
  awaiting_logo: {
    field: 'logo',
    ask: 'Send a *website* for the logo (e.g. `tase.co.il`). It becomes the row icon.',
  },
};

function askStep(chatId, state) {
  const prompt = STEP_PROMPTS[state.step];
  const currentValue = state.current && state.current[prompt.field];
  const currentLine = currentValue ? `\nCurrent: \`${currentValue}\`` : '';
  return tg('sendMessage', {
    chat_id: chatId,
    text: `${prompt.ask}${currentLine}\n\nOr send /skip to ${currentValue ? 'keep it' : 'leave it as default'}.`,
    parse_mode: 'Markdown',
  });
}

function finalizeWizard(chatId, state) {
  const result =
    state.mode === 'rename'
      ? configStore.setLabel(state.screenId, state.symbol, state.meta)
      : configStore.addSymbol(state.screenId, state.symbol, state.meta);
  const verb = state.mode === 'rename' ? 'Updated' : 'Added';
  return mainMenu(chatId, result.ok ? `${verb} ${state.symbol} ✓` : `⚠️ ${result.error}`);
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const parts = query.data.split(SEP);
  // Symbols may contain the separator's forbidden chars but never the
  // separator itself, so the symbol is always the final segment.
  await tg('answerCallbackQuery', { callback_query_id: query.id });

  if (query.data === 'menu') {
    chatState.delete(chatId);
    return mainMenu(chatId);
  }

  if (parts[0] === 'act') {
    const action = parts[1];
    if (action === 'show') return showCurrent(chatId);
    if (action === 'add') {
      return tg('sendMessage', {
        chat_id: chatId,
        text: 'Add to which screen?',
        reply_markup: { inline_keyboard: screenButtons('add') },
      });
    }
    if (action === 'remove') {
      return tg('sendMessage', {
        chat_id: chatId,
        text: 'Remove from which screen?',
        reply_markup: { inline_keyboard: screenButtons('rmscr') },
      });
    }
    if (action === 'rename') {
      return tg('sendMessage', {
        chat_id: chatId,
        text: 'Rename / set logo in which screen?',
        reply_markup: { inline_keyboard: screenButtons('rnscr') },
      });
    }
  }

  // Chose a screen to add into → wait for the typed ticker.
  if (parts[0] === 'add') {
    const screenId = parts[1];
    chatState.set(chatId, { step: 'awaiting_ticker', screenId });
    return tg('sendMessage', {
      chat_id: chatId,
      text: 'Send me a ticker to add (e.g. `AAPL`, `MSFT`, `RMLI.TA`).',
      parse_mode: 'Markdown',
    });
  }

  // Chose a screen to remove from → list its symbols as buttons.
  if (parts[0] === 'rmscr') {
    const screenId = parts[1];
    const screen = configStore.ensureSeeded().find((s) => s.id === screenId);
    if (!screen || screen.symbols.length === 0) {
      return tg('sendMessage', { chat_id: chatId, text: 'That screen has no stocks.' });
    }
    const rows = screen.symbols.map((symbol) => [
      { text: symbol, callback_data: 'rm' + SEP + screenId + SEP + symbol },
    ]);
    rows.push([{ text: '« Back', callback_data: 'menu' }]);
    return tg('sendMessage', {
      chat_id: chatId,
      text: `Tap a stock to remove from *${screen.title}*:`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: rows },
    });
  }

  // Chose a screen to rename in → list its symbols (with any current label).
  if (parts[0] === 'rnscr') {
    const screenId = parts[1];
    const screen = configStore.ensureSeeded().find((s) => s.id === screenId);
    if (!screen || screen.symbols.length === 0) {
      return tg('sendMessage', { chat_id: chatId, text: 'That screen has no stocks.' });
    }
    const rows = screen.symbols.map((symbol) => [
      { text: symbolWithLabel(screen, symbol), callback_data: 'rn' + SEP + screenId + SEP + symbol },
    ]);
    rows.push([{ text: '« Back', callback_data: 'menu' }]);
    return tg('sendMessage', {
      chat_id: chatId,
      text: `Tap a stock to rename / set its logo in *${screen.title}*:`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: rows },
    });
  }

  // Chose a symbol to rename → start the customization wizard (rename mode).
  if (parts[0] === 'rn') {
    const screenId = parts[1];
    const symbol = parts.slice(2).join(SEP);
    chatState.set(chatId, {
      step: 'awaiting_label',
      screenId,
      symbol,
      mode: 'rename',
      meta: {},
      current: configStore.getLabel(screenId, symbol),
    });
    return askStep(chatId, chatState.get(chatId));
  }

  // Chose to customize a to-be-added symbol → start the wizard (add mode).
  if (parts[0] === 'custom') {
    const screenId = parts[1];
    const symbol = parts.slice(2).join(SEP);
    chatState.set(chatId, { step: 'awaiting_label', screenId, symbol, mode: 'add', meta: {} });
    return askStep(chatId, chatState.get(chatId));
  }

  // Confirmed removal.
  if (parts[0] === 'rm') {
    const screenId = parts[1];
    const symbol = parts.slice(2).join(SEP);
    const result = configStore.removeSymbol(screenId, symbol);
    return mainMenu(chatId, result.ok ? `Removed ${symbol} ✓` : `⚠️ ${result.error}`);
  }

  // Confirmed add (after Yahoo validation).
  if (parts[0] === 'confirm') {
    const screenId = parts[1];
    const symbol = parts.slice(2).join(SEP);
    chatState.delete(chatId);
    const result = configStore.addSymbol(screenId, symbol);
    return mainMenu(chatId, result.ok ? `Added ${symbol} ✓` : `⚠️ ${result.error}`);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  if (text === '/start' || text === '/manage') {
    chatState.delete(chatId);
    return mainMenu(chatId, 'Stock screensaver control. What would you like to do?');
  }

  const state = chatState.get(chatId);
  if (state?.step === 'awaiting_ticker') {
    const check = await validateTicker(text);
    if (!check.ok) {
      return tg('sendMessage', {
        chat_id: chatId,
        text: `Couldn't find "${text}" on Yahoo. Try another ticker, or /manage to cancel.`,
      });
    }
    return tg('sendMessage', {
      chat_id: chatId,
      text: `Found *${check.name}* (${check.symbol}). Add it?`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `✅ Add ${check.symbol}`, callback_data: 'confirm' + SEP + state.screenId + SEP + check.symbol },
            { text: '✏️ Customize', callback_data: 'custom' + SEP + state.screenId + SEP + check.symbol },
          ],
          [{ text: '❌ Cancel', callback_data: 'menu' }],
        ],
      },
    });
  }

  // In the customization wizard (add or rename): each step takes one typed
  // value or /skip, then advances; the last step commits the change.
  if (state && WIZARD_STEPS.includes(state.step)) {
    const skip = text === '/skip' || text === '-';
    const { field } = STEP_PROMPTS[state.step];
    if (!skip) state.meta[field] = text;

    const nextStep = WIZARD_STEPS[WIZARD_STEPS.indexOf(state.step) + 1];
    if (nextStep) {
      state.step = nextStep;
      return askStep(chatId, state);
    }
    chatState.delete(chatId);
    return finalizeWizard(chatId, state);
  }

  // Anything else: nudge toward the menu.
  return mainMenu(chatId, 'Use the buttons below to manage your stocks.');
}

// Only serve the owner. Until allowedChatId is configured, reply with the
// sender's id so they can lock the bot to themselves (see README).
function authorize(chatId, fromId) {
  if (ALLOWED_CHAT_ID === null) {
    tg('sendMessage', {
      chat_id: chatId,
      text:
        `Setup: your chat id is \`${fromId}\`.\n` +
        'Put it in bot/bot-config.json as "allowedChatId" and restart the bot to lock it to you.',
      parse_mode: 'Markdown',
    });
    return false;
  }
  return fromId === ALLOWED_CHAT_ID;
}

async function handleUpdate(update) {
  if (update.message) {
    const from = update.message.from?.id;
    if (!authorize(update.message.chat.id, from)) return;
    return handleMessage(update.message);
  }
  if (update.callback_query) {
    const from = update.callback_query.from?.id;
    if (!authorize(update.callback_query.message.chat.id, from)) return;
    return handleCallback(update.callback_query);
  }
}

async function main() {
  const me = await tg('getMe', {});
  if (!me.ok) {
    console.error('Telegram rejected the token. Check bot/bot-config.json.');
    process.exit(1);
  }
  console.log(`Bot @${me.result.username} running.` + (ALLOWED_CHAT_ID ? '' : ' (setup mode — message it to get your chat id)'));
  console.log(`Config file: ${configStore.configPath()}`);

  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await tg('getUpdates', { offset, timeout: 30 });
      if (res.ok) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (error) {
            console.error('handleUpdate failed:', error.message);
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (error) {
      console.error('poll error:', error.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
