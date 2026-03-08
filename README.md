# Telegram Web A (MOD)

A **modified version** of [Telegram Web A](https://github.com/Ajaxy/telegram-tt) with built-in **WebSocket proxy support** for regions where Telegram access is restricted.

> **Source:** [github.com/PBhadoo/telegram-tt](https://github.com/PBhadoo/telegram-tt)

## What's Different from Official Telegram Web A?

- 🌐 **Proxy Support** — Connect through a WebSocket proxy (Cloudflare Workers / custom domain) when Telegram is blocked
- 📝 **Proxy Settings on Login Page** — Toggle proxy on/off and enter your proxy domain before logging in
- 🔗 **Any Proxy Domain** — Supports `*.workers.dev`, custom domains, or any valid proxy hostname
- 🏷️ **Renamed to "Telegram Web A (MOD)"** to avoid confusion with the official client

## How Proxy Works

```
Browser (GramJS) → wss://your-proxy-domain/pluto.web.telegram.org/apiws → Telegram Server
```

1. User enables proxy and enters their proxy domain on the login page
2. All Telegram WebSocket connections are automatically rewritten to route through the proxy
3. The proxy bridges traffic bidirectionally: Browser ↔ Proxy Worker ↔ Telegram

**Proxy Server:** Deploy your own using [TG-WS-API](https://github.com/CloudflareHackers/TG-WS-API) (Cloudflare Workers + Durable Objects)

## Deploy to Cloudflare Pages

### One-Click Setup

1. Fork this repo
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages) → **Create a project** → **Connect to Git**
3. Select your forked repo and configure:

| Setting | Value |
|---------|-------|
| **Framework preset** | `None` |
| **Build command** | `npm run build:production` |
| **Build output directory** | `dist` |
| **Node.js version** | `22` (set via Environment Variable `NODE_VERSION` = `22`) |

4. Add **Environment Variables**:

| Variable | Value | Required |
|----------|-------|----------|
| `TELEGRAM_API_ID` | Your API ID from [my.telegram.org](https://my.telegram.org) | ✅ Yes |
| `TELEGRAM_API_HASH` | Your API Hash from [my.telegram.org](https://my.telegram.org) | ✅ Yes |
| `NODE_VERSION` | `22` | ✅ Yes |
| `APP_TITLE` | `Telegram Web A (MOD)` | Optional |
| `BASE_URL` | Your Pages URL (e.g. `https://tg.yourdomain.com/`) | Optional |

5. Click **Save and Deploy**

### Manual / CLI Deploy

```sh
# Clone
git clone https://github.com/PBhadoo/telegram-tt.git
cd telegram-tt

# Setup
cp .env.example .env
# Edit .env and add your TELEGRAM_API_ID and TELEGRAM_API_HASH

npm i

# Build
npm run build:production

# Output is in ./dist — deploy this folder to CF Pages
npx wrangler pages deploy dist --project-name=your-project-name
```

### Build Reference

| Command | Description |
|---------|-------------|
| `npm run build:production` | Production build |
| `npm run build:dev` | Development build |
| `npm run dev` | Local dev server (port 1234) |

**Build output directory:** `dist`

## Deploy Proxy Server (TG-WS-API)

You also need a WebSocket proxy server. Deploy [TG-WS-API](https://github.com/CloudflareHackers/TG-WS-API):

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/CloudflareHackers/TG-WS-API)

Once deployed, enter your worker domain (e.g. `tg-ws-api.your-account.workers.dev` or your custom domain) in the proxy settings on the login page.

## Local Setup

```sh
cp .env.example .env
# Add TELEGRAM_API_ID and TELEGRAM_API_HASH from https://my.telegram.org

npm i
npm run dev
```

Open `http://localhost:1234`

## Original Project

This is a fork of the official [Telegram Web A](https://github.com/Ajaxy/telegram-tt) which won first prize 🥇 at the [Telegram Lightweight Client Contest](https://contest.com/javascript-web-3). It's fully based on [Teact](https://github.com/Ajaxy/teact) framework and uses [GramJS](https://github.com/gram-js/gramjs) for MTProto.

## License

[GPL-3.0-or-later](LICENSE)
