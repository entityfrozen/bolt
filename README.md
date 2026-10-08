# Bolt

Bolt is a hosted browser shell with account gating, admin controls, Scramjet browsing, a stripped-down video player, SoundCloud/local music, and an optional local about:blank launcher.

## Run locally

```bash
npm install
BOLT_ADMIN_USER=admin BOLT_ADMIN_PASSWORD='change-this' npm start
```

Open `http://localhost:3030`.

If `BOLT_ADMIN_PASSWORD` is not set on the first run, Bolt generates an admin password and prints it once in the server log.

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

Do not add `X-Frame-Options: DENY` or a CSP `frame-ancestors 'none'` rule if you want the local about:blank launcher to embed Bolt.

## Admin

The admin account can create, disable, expire, promote, demote and delete accounts; revoke sessions; issue temporary access codes; revoke codes; toggle browsing/music/video; enter maintenance mode; and read the app audit log.

Temporary access codes can have an expiry and a use limit. Redeeming one creates a temporary session without creating a permanent account.

## Scramjet

The integration follows Mercury Workshop's current bootstrap pattern:

- `@mercuryworkshop/proxy-bootstrap` serves the current Scramjet/controller/transport assets.
- `initBootstrap()` initializes the browser transport.
- each Bolt web tab gets a `controller.createFrame(...)` frame.
- Wisp upgrades are accepted only for an active Bolt session.

Bolt does not expose Wisp to anonymous users.

## about:blank launcher

Open `launcher.html`. For now it lets you enter the deployed Bolt URL manually. Once the final launcher destination is chosen, that URL can be hard-wired and the setup field removed entirely.

Scramjet needs a service worker. Browsers can restrict service-worker registration in third-party iframes when third-party storage is blocked. Bolt requests storage access on user navigation when the API exists and includes an **Open direct** fallback in Settings. The most reliable mode is still opening the hosted site directly once.

## Data

The small built-in store is `data/bolt.json`. Passwords use Node's `scrypt`; session tokens and access codes are stored as SHA-256 digests. The store is deliberately simple for a small private deployment. If Bolt becomes a public multi-instance service, move the state layer to Postgres/SQLite/Redis before scaling horizontally.
