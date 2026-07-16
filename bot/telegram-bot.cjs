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
        [{ text: '📋 Show current', callback_data: 'act' + SEP + 'show' }],
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

function showCurrent(chatId) {
  const screens = configStore.ensureSeeded();
  const lines = screens.map((screen) => `*${screen.title}*: ${screen.symbols.join(', ') || '(empty)'}`);
  return tg('sendMessage', {
    chat_id: chatId,
    text: '📋 Current stocks:\n\n' + lines.join('\n'),
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '« Menu', callback_data: 'menu' }]] },
  });
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
            { text: '❌ Cancel', callback_data: 'menu' },
          ],
        ],
      },
    });
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
