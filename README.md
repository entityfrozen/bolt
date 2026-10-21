# Lightning

Lightning is a luxury-gold browser workspace with account gating, admin controls, Scramjet browsing, a stripped-down video player, SoundCloud/local music, and an optional local about:blank launcher.

## Lightning AI (NVIDIA)

The preview service uses `openai/gpt-oss-20b` with low reasoning effort for fast everyday responses. NVIDIA currently lists a hosted Free Endpoint for this model.

Set these on your Railway **Lightning preview service → Variables**:

```text
NVIDIA_MODEL=openai/gpt-oss-20b
NVIDIA_API_KEY=<your own NVIDIA API Catalog key>
```

Generate your key at https://build.nvidia.com and paste it into Railway, not a chat message or the repository. The app reads the secret server-side. AI replies are disabled until a valid key is present.

## Hosted About:Blank launcher

Visit `/launch` (also stored as `public/launch.html`). The page attempts to open a new `about:blank` tab containing the Lightning site in an iframe. Chromium may block the popup or the embedded session. Use **Open Lightning** or **Open directly** if necessary. The local downloadable launcher can work independently of the hosted route.

## Run locally

```bash
npm install
BOLT_ADMIN_USER=admin BOLT_ADMIN_PASSWORD='change-this' npm start
```

Open `http://localhost:3030`.

If `BOLT_ADMIN_PASSWORD` is not set on the first run, Lightning generates an admin password and prints it once in the server log.

## Deploy

Use a Node host that supports WebSocket upgrades. Railway, Render, Fly.io, a VPS, or a Docker host are appropriate. Static-only hosts and request-only serverless functions are not enough because Scramjet uses Wisp over WebSocket.

Set these variables:

```text
BOLT_ADMIN_USER=admin
BOLT_ADMIN_PASSWORD=use-a-long-password
BOLT_SESSION_TTL_HOURS=168
BOLT_DATA_DIR=/persistent/path
```

Mount `BOLT_DATA_DIR` on persistent storage if your host has an ephemeral filesystem.

Do not add `X-Frame-Options: DENY` or a CSP `frame-ancestors 'none'` rule if you want the local about:blank launcher to embed Lightning.

## Admin

The admin account can create, disable, expire, promote, demote and delete accounts; revoke sessions; issue temporary access codes; revoke codes; toggle browsing/music/video; enter maintenance mode; and read the app audit log.

Temporary access codes can have an expiry and a use limit. Redeeming one creates a temporary session without creating a permanent account.

## Scramjet

The integration follows Mercury Workshop's current bootstrap pattern:

- `@mercuryworkshop/proxy-bootstrap` serves the current Scramjet/controller/transport assets.
- `initBootstrap()` initializes the browser transport.
- each Lightning web tab gets a `controller.createFrame(...)` frame.
- Wisp upgrades are accepted only for an active Lightning session.

Lightning does not expose Wisp to anonymous users.

## about:blank launcher

Open `launcher.html`. For now it lets you enter the deployed Lightning URL manually. Once the final launcher destination is chosen, that URL can be hard-wired and the setup field removed entirely.

Scramjet needs a service worker. Browsers can restrict service-worker registration in third-party iframes when third-party storage is blocked. Lightning requests storage access on user navigation when the API exists and includes an **Open direct** fallback in Settings. The most reliable mode is still opening the hosted site directly once.

## Data

The small built-in store is `data/bolt.json`. Passwords use Node's `scrypt`; session tokens and access codes are stored as SHA-256 digests. The store is deliberately simple for a small private deployment. If Lightning becomes a public multi-instance service, move the state layer to Postgres/SQLite/Redis before scaling horizontally.

The Lightning browser UI and optional in-page DevTools are served from this Node app. DevTools can only inspect page content exposed to the app and is not native Chromium DevTools.
