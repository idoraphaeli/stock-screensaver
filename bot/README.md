# Telegram control bot

Add and remove stocks from the screensaver by messaging a Telegram bot.
Everything runs locally on your PC — no server, no cloud, no cost. The bot
long-polls Telegram (the PC reaches out, so no open ports or webhook), and
writes the stock list to `%LOCALAPPDATA%\StockScreensaver\screens.json`. The
screensaver watches that file and updates live while it's running.

## One-time setup

1. **Create a bot.** In Telegram, message [@BotFather](https://t.me/BotFather),
   send `/newbot`, follow the prompts, and copy the token it gives you.
2. **Add the token.** Copy `bot-config.example.json` to `bot-config.json` and
   paste the token into `botToken`.
3. **Find your chat id.** Start the bot (`npm run bot`), open Telegram, and
   send your bot any message. It replies with your chat id.
4. **Lock it to you.** Put that number into `bot-config.json` as
   `allowedChatId`, then restart the bot. Now only you can control it.

## Using it

Message the bot `/manage` (or `/start`). It shows buttons:

- **➕ Add stock** → pick a screen → type a ticker (e.g. `AAPL`, `MSFT`,
  `RMLI.TA`). The bot checks it against Yahoo and asks you to confirm.
- **➖ Remove stock** → pick a screen → tap the stock to remove.
- **📋 Show current** → lists what's on each screen.

Changes take effect immediately if the screensaver is running; otherwise
they apply the next time it starts.

## Keeping it running

The bot only receives messages while it's running. For always-on use, have
it start at logon:

```
powershell -ExecutionPolicy Bypass -File scripts\install-bot.ps1
```

This registers a hidden logon task. Remove it with
`schtasks /delete /tn StockScreensaverBot /f`.

Notes:
- Tickers use Yahoo Finance symbols: US tickers are plain (`AAPL`), Tel Aviv
  stocks end in `.TA` (`RMLI.TA`), crypto uses pairs (`BTC-USD`).
- New stocks show a letter avatar instead of a logo until a logo domain is
  added in `src/screens.ts` (optional, cosmetic).
