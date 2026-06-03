# Click-Dummy Demo — Decisions Log

This is the audit trail for the demo build. Every choice below was made by the
agent because the user said "Use sane defaults. Do not ask any questions, JUST
make it work." Review and override any of these as needed.

## Goal

Run the existing Vue/Vuetify dashboard with mock data, no backend, no socket
server, deployable to GitHub Pages. Toggle by build mode `demo` /
`VITE_DEMO=true`.

## Files added

- `frontend/src/demo/fixtures.js` — mock projects/seeds/shoots/members/etc
- `frontend/src/demo/jwt.js` — fake unsigned JWT builder
- `frontend/src/demo/fetch-mock.js` — `window.fetch` patcher + URL router
- `frontend/src/demo/socket-stub.js` — replaces `socket.io-client` via vite alias
- `frontend/src/demo/bootstrap.js` — entry that installs the mock layer

## Files modified

- `frontend/src/main.js` — top-level await imports `demo/bootstrap.js` when
  `import.meta.env.VITE_DEMO === 'true'`
- `frontend/vite.config.js` — env-driven `base`, demo aliases socket.io-client,
  defines `import.meta.env.VITE_DEMO`, demo serve uses HTTP, no `/api` proxy
  in demo
- `frontend/package.json` — adds `serve:demo`, `build:demo`, `preview:demo`

## Decisions

### 1. Mock at `window.fetch` instead of MSW
- **Decision:** Monkey-patch `window.fetch` in `bootstrap.js` before app mount.
- **Why:** MSW would need a Service Worker registered at the site root, which
  doesn't survive a sub-path GitHub Pages deployment cleanly. Monkey-patching
  is one file, no SW lifecycle, no scope issues, and the existing
  `fetchWrapper` ultimately calls global `fetch` so a single patch covers
  every API call.
- **Trade-off:** Mocked requests are invisible in the DevTools "Network" tab.
  Acceptable for a demo.

### 2. Auth bypass via cookie + cookie shim
- **Decision:** Build an unsigned `alg:none` JWT and put it in the
  `__Host-gHdrPyl` cookie. On HTTP, also install a `document.cookie` getter
  shim because `__Host-` cookies require `Secure`+HTTPS to be set by the
  browser.
- **Why:** The auth store reads exactly that cookie name via
  `universal-cookie`/`@vueuse/integrations`, then `jwt-decode`s it. No
  signature verification on the client. Any well-formed JWT works.
- **Trade-off:** Token expiry is set to **1 year**. The session never expires
  for the duration of a demo viewing.

### 3. Demo serves over HTTP, not HTTPS
- **Decision:** When `VITE_DEMO=true`, vite serve uses plain HTTP on port
  `8443`.
- **Why:** Self-signed certs from `@vitejs/plugin-basic-ssl` block Chrome
  (`ERR_CERT_AUTHORITY_INVALID`). The cookie shim handles `__Host-` on HTTP,
  so HTTPS isn't required. GitHub Pages deployment is HTTPS so the shim falls
  back to setting a real cookie there.
- **Trade-off:** HTTP locally feels off, but the goal is "run a demo", not
  "match prod transport".

### 4. Socket.io-client replaced by vite alias
- **Decision:** When `VITE_DEMO=true`, `socket.io-client` is aliased to
  `src/demo/socket-stub.js` which exports a fake `io()` and `Manager` class.
- **Why:** Patching the socket store at runtime is fragile (it captures
  `Manager.prototype.open` at import time). A vite alias is compile-time and
  zero-cost.
- **Trade-off:** No real-time updates. The fake socket emits `connect` after
  `connect()` and acks subscribe/unsubscribe with `{statusCode: 200}`. No
  `shoots`/`projects`/`seeds` events ever fire — the initial REST GET drives
  the entire UI. Acceptable; demo doesn't need live updates.

### 5. JWT claims chosen
- `id`/`email`: `demo@gardener.cloud`
- `name`: `Demo User`
- `isAdmin: true`, `canListShootsAllNamespaces: true`
- `exp`: 365d, `refresh_at`: 30d
- **Why:** Admin = unrestricted UI; the "all namespaces" claim unlocks the
  `_all` view that's a marquee feature.

### 6. RBAC stubbed wide open
- **Decision:** `getSubjectRules` returns `{verbs:['*'], apiGroups:['*'],
  resources:['*']}` and `{verbs:['*'], nonResourceURLs:['*']}`.
- **Why:** Every `canI()` check passes; no edit/delete buttons hidden.

### 7. Two demo projects
- `demo` (`garden-demo`, purpose=production, costObject set, members:
  alice/bob/ci-bot) and `trial` (`garden-trial`, purpose=evaluation, no extra
  members).
- **Why:** Tests project switching and shows multi-project sidebar/menu UI.

### 8. Six shoots across providers
| Name | Project | Provider | State | Notable |
|------|---------|----------|-------|---------|
| prod-frontend | demo | aws | Reconcile/Succeeded | baseline healthy |
| prod-backend | demo | aws | Reconcile/Succeeded | older k8s 1.28.6 |
| staging-cluster | demo | gcp | Hibernated | shows hibernation UI |
| dev-azure | demo | azure | Reconcile/Processing 65% | "EveryNodeReady=False" condition for unhealthy demo |
| prod-openstack | demo | openstack | Succeeded | older cluster 120 days |
| sandbox | trial | aws | Succeeded | k8s 1.27.10 — out-of-date |
- **Why:** Covers each provider icon, hibernated/processing/healthy states,
  unhealthy condition for the issues filter, version spread for
  upgrade-needed indicators.

### 9. Four seeds
- `aws-eu-west-1`, `gcp-europe-west1`, `azure-westeurope` (one degraded
  condition), `openstack-eu-de-2`.
- **Why:** Matches the providers used by demo shoots; `azure-westeurope` has
  one False condition to exercise unhealthy-seed UI.

### 10. Reused existing fixtures
- `cloudprofiles.js`, `gardenerExtensions.js`, `config.js`, `credentials.js`
  from `frontend/__fixtures__/` are reused **as-is**. They're already
  structurally valid and saved a lot of manual data construction.
- The dashboard config is extended with branding (productName "Gardener",
  productSlogan "Universal Kubernetes at Scale", productTitle "Gardener
  Demo"), themes (green primary), and `terminalEnabled: false`.

### 11. Terminal disabled
- **Decision:** `dashboardConfig.features.terminalEnabled = false`.
- **Why:** A live terminal needs a websocket to a real backend. Out of scope.

### 12. Tickets disabled
- **Decision:** `dashboardConfig.ticket = undefined`. `tickets` fixture is
  empty.
- **Why:** GitHub Issues integration would need a real auth + repo. Skipped.

### 13. Mutations are best-effort echoes
- POST/PUT/PATCH/DELETE handlers either echo the request body back or apply a
  shallow merge to in-memory state. State is **not persisted** across reloads
  — refreshing the page resets everything.
- **Why:** Demos rarely depend on mutation persistence; doing so properly
  needs IndexedDB and a lot of glue.

### 14. Base path env-driven
- `vite.config.js` reads `VITE_BASE_URL` from env (defaults `/`). For GH Pages
  deploy: `VITE_BASE_URL=/<repo-name>/ yarn build:demo`.
- vue-router uses `createWebHistory(import.meta.env.BASE_URL)` already.
- **Why:** GH Pages serves projects at `/<repo>/`; SPA assets and router must
  agree on prefix.

### 15. Login flow short-circuited
- The cookie is set before app mount, so the router guard never redirects to
  `/login`. If the router does navigate to `/auth/logout`, the mock returns
  200 JSON; no actual redirect happens.
- **Why:** Demo never signs out.

## How to run

```sh
cd frontend
yarn install   # if not done
yarn serve:demo
# open http://localhost:8443/
```

## How to build for GitHub Pages

```sh
cd frontend
VITE_BASE_URL=/<repo-name>/ yarn build:demo
# output goes to frontend/dist/
```

The `dist/` folder is a static SPA. GitHub Pages will serve it; you'll need a
`404.html` that copies `index.html` for SPA deep-links to work — that's a
one-line workflow concern, deliberately out of scope per the brief.

## Open questions for review

These are the choices most likely to be wrong for what you actually want:

1. **Demo data shape** — 2 projects, 6 shoots, 4 seeds. Plenty for a UI
   walkthrough; if you want to demo something specific (e.g. credential
   rotation flows, ticket integration, terminal) the fixtures need
   extending.
2. **Terminal off / Tickets off** — both can be wired to a richer mock if
   wanted.
3. **HTTP for local serve** — works around the cert error. If you'd prefer
   HTTPS, run `yarn setup` (sudo, installs CA) and remove the
   `if (VITE_DEMO === 'true') https = false` line in `vite.config.js`.
4. **Mutation persistence** — currently reset on reload. If you want
   "create cluster", "rename project" etc to stick across reloads, fixtures
   need to flow through IndexedDB.
5. **JWT 1-year expiry** — overkill but harmless.
6. **Branding** — "Gardener Demo", green theme. Override in `fixtures.js`
   `dashboardConfig.branding` and `.themes`.
7. **404 fallback for GH Pages** — not added; trivial separate step.
8. **GitHub Pages workflow YAML** — not added (deployment was out of scope).

## What was NOT done

- No CI workflow, no `gh-pages` branch automation
- No git push (per explicit instruction)
- No `.env.demo` file (env vars are passed via the `--mode demo` switch and
  baked in via `define`)
- No service worker / offline support
- No production hardening of the mock (e.g. validation errors for invalid
  payloads)
