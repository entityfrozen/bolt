# Celestial rewrite

This is the first vertical slice of Celestial, based on the existing Bolt server and account system. The Railway project and existing production deployments have **not** been changed.

## Run locally

```bash
npm install
BOLT_ADMIN_USER=admin BOLT_ADMIN_PASSWORD='use-a-long-password' npm start
```

Visit http://localhost:3030 and sign in. Celestial reuses the existing authenticated browser and admin APIs.

## Movies & TV

The new Movies panel loads title metadata from TMDB through the server, so the API token is not exposed to the client.

Set one of:

```text
TMDB_READ_TOKEN=<TMDB API read access token>
TMDB_API_KEY=<TMDB API key>
```

For **authorized playback only**, configure a provider that supports the URL patterns `/movie/:tmdbId` and `/tv/:tmdbId/:season/:episode`:

```text
CELESTIAL_EMBED_BASE=https://your-licensed-embed-provider.example/embed
```

Without this variable, the catalog still functions, but the player clearly reports that no streaming source is configured. This is deliberate: an embed service's public API does not by itself establish distribution rights for its catalog.

## What this phase changes

- Celestial brand, favicon artwork asset, theme layer, title and PWA manifest
- A self-contained Movies & TV panel with discover/search, detail sheets, TV episode inputs and an embedded player overlay
- Authenticated server-side catalog endpoints and configurable playback URL resolution
- Existing browser, admin settings, login and persistent storage remain in place

## Next phases

- Migrate more of the recovered Boba visual components and motion language into the main shell
- Move movie details into a full-width, accessible view with a proper season picker
- Build persistent community chat with role labels, online/offline roster, moderation and long-term message storage
- Add a full Apps directory, configurable split-screen and proper fullscreen behavior
- Test Scramjet end-to-end on the actual Railway service before any deployment

Do not switch the Railway service branch or deploy this branch until environment configuration and browser compatibility have been tested.
