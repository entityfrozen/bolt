import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { bootstrap } from "@mercuryworkshop/proxy-bootstrap";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3030);
const dataDir = path.resolve(here, process.env.BOLT_DATA_DIR || "data");
const dataFile = path.join(dataDir, "bolt.json");
const sessionHours = Math.max(1, Number(process.env.BOLT_SESSION_TTL_HOURS || 168));

fs.mkdirSync(dataDir, { recursive: true });

const freshState = () => ({
  users: [],
  sessions: [],
  passes: [],
  audit: [],
  settings: {
    maintenance: false,
    features: {
      proxy: true,
      music: true,
      video: true
    }
  }
});

function loadState() {
  if (!fs.existsSync(dataFile)) return freshState();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      ...freshState(),
      ...parsed,
      settings: {
        ...freshState().settings,
        ...(parsed.settings || {}),
        features: {
          ...freshState().settings.features,
          ...(parsed.settings?.features || {})
        }
      }
    };
  } catch {
    const backup = `${dataFile}.${Date.now()}.broken`;
    fs.renameSync(dataFile, backup);
    return freshState();
  }
}

let state = loadState();

function saveState() {
  cleanup();
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, dataFile);
}

function now() {
  return Date.now();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;
}

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [, salt, expected] = String(stored).split("$");
    const actual = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9._-]{3,32}$/.test(value);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    enabled: user.enabled,
    temporary: !!user.temporary,
    expiresAt: user.expiresAt || null,
    createdAt: user.createdAt
  };
}

function parseCookies(raw = "") {
  const out = {};
  raw.split(";").forEach(part => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function sessionTokenFromHeaders(headers) {
  const cookies = parseCookies(headers.cookie || "");
  return cookies.bolt_session || cookies.bolt_session_embed || "";
}

function activeUser(user) {
  if (!user || !user.enabled) return false;
  if (user.expiresAt && user.expiresAt <= now()) return false;
  return true;
}

function identityForSession(session) {
  if (!session || session.expiresAt <= now()) return null;

  if (session.userId) {
    const user = state.users.find(item => item.id === session.userId);
    if (!activeUser(user)) return null;
    return { ...publicUser(user), sessionId: session.id, passId: null };
  }

  if (session.passId) {
    return {
      id: `pass:${session.passId}`,
      username: session.passLabel || "guest",
      role: "user",
      enabled: true,
      temporary: true,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      sessionId: session.id,
      passId: session.passId
    };
  }

  return null;
}

function sessionFromHeaders(headers) {
  const raw = sessionTokenFromHeaders(headers);
  if (!raw) return null;
  const hash = digest(raw);
  const session = state.sessions.find(item => item.tokenHash === hash);
  const identity = identityForSession(session);
  if (!identity) return null;
  return { session, identity, raw };
}

function sessionFromRequest(req) {
  return sessionFromHeaders(req.headers);
}

function cleanup() {
  const time = now();
  state.sessions = state.sessions.filter(session => session.expiresAt > time && identityForSession(session));
  state.passes = state.passes.filter(pass => !pass.deleteAfter || pass.deleteAfter > time);
  if (state.audit.length > 600) state.audit = state.audit.slice(-600);
}

function audit(actor, action, target = "", detail = "") {
  state.audit.push({
    id: id("evt"),
    at: now(),
    actor: actor?.username || "system",
    action,
    target,
    detail: String(detail || "").slice(0, 300)
  });
}

function createSession({ userId = null, passId = null, passLabel = "", expiresAt = 0, req }) {
  const raw = token();
  const hardLimit = now() + sessionHours * 60 * 60 * 1000;
  const session = {
    id: id("ses"),
    tokenHash: digest(raw),
    userId,
    passId,
    passLabel,
    createdAt: now(),
    lastSeenAt: now(),
    expiresAt: expiresAt ? Math.min(expiresAt, hardLimit) : hardLimit,
    ip: req.ip || "",
    userAgent: String(req.get("user-agent") || "").slice(0, 220)
  };
  state.sessions.push(session);
  return { raw, session };
}

function setSessionCookies(req, res, raw, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - now()) / 1000));
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  const securePart = secure ? "; Secure" : "";
  res.append("Set-Cookie", `bolt_session=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${securePart}`);
  if (secure) {
    res.append("Set-Cookie", `bolt_session_embed=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${maxAge}`);
  }
}

function clearSessionCookies(req, res) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  const securePart = secure ? "; Secure" : "";
  res.append("Set-Cookie", `bolt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${securePart}`);
  if (secure) {
    res.append("Set-Cookie", "bolt_session_embed=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0");
  }
}

function mustBeSignedIn(req, res, next) {
  const found = sessionFromRequest(req);
  if (!found) return res.status(401).json({ error: "Sign in required" });
  if (state.settings.maintenance && found.identity.role !== "admin") return res.status(503).json({ error: "Bolt is in maintenance mode" });
  req.auth = found;
  found.session.lastSeenAt = now();
  next();
}

function mustBeAdmin(req, res, next) {
  const found = sessionFromRequest(req);
  if (!found) return res.status(401).json({ error: "Sign in required" });
  if (found.identity.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.auth = found;
  found.session.lastSeenAt = now();
  next();
}

function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();
  const expected = `${req.protocol}://${req.get("host")}`;
  if (origin !== expected) return res.status(403).json({ error: "Origin rejected" });
  next();
}

function ensureFirstAdmin() {
  if (state.users.some(user => user.role === "admin")) return;
  const username = normalizeUsername(process.env.BOLT_ADMIN_USER || "admin");
  const supplied = process.env.BOLT_ADMIN_PASSWORD || "";
  const password = supplied || token(15);
  const admin = {
    id: id("usr"),
    username,
    passwordHash: hashPassword(password),
    role: "admin",
    enabled: true,
    temporary: false,
    expiresAt: null,
    createdAt: now()
  };
  state.users.push(admin);
  audit(null, "admin.created", username, supplied ? "environment password" : "generated password");
  saveState();
  console.log(`Bolt admin: ${username}`);
  if (!supplied) console.log(`Bolt admin password: ${password}`);
}

ensureFirstAdmin();

const { routeRequest, routeUpgrade } = await bootstrap();
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

app.get("/api/me", (req, res) => {
  const found = sessionFromRequest(req);
  if (!found) return res.status(401).json({ signedIn: false });
  res.json({
    signedIn: true,
    user: found.identity,
    settings: state.settings
  });
});

app.post("/api/login", sameOrigin, (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || "");
  const user = state.users.find(item => item.username === username);

  if (!user || !activeUser(user) || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Wrong username or password" });
  }

  const created = createSession({ userId: user.id, expiresAt: user.expiresAt || 0, req });
  setSessionCookies(req, res, created.raw, created.session.expiresAt);
  audit(publicUser(user), "session.login", created.session.id, req.ip || "");
  saveState();
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/access/redeem", sameOrigin, (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const hash = digest(code);
  const pass = state.passes.find(item => item.codeHash === hash);
  const time = now();

  if (!pass || !pass.enabled || pass.expiresAt <= time || pass.uses >= pass.maxUses) {
    return res.status(401).json({ error: "That access code is not active" });
  }

  pass.uses += 1;
  const created = createSession({
    passId: pass.id,
    passLabel: pass.label || "guest",
    expiresAt: pass.expiresAt,
    req
  });
  setSessionCookies(req, res, created.raw, created.session.expiresAt);
  audit({ username: pass.label || "guest" }, "pass.redeemed", pass.id, `${pass.uses}/${pass.maxUses}`);
  saveState();
  res.json({ ok: true });
});

app.post("/api/logout", sameOrigin, (req, res) => {
  const found = sessionFromRequest(req);
  if (found) {
    state.sessions = state.sessions.filter(item => item.id !== found.session.id);
    audit(found.identity, "session.logout", found.session.id);
    saveState();
  }
  clearSessionCookies(req, res);
  res.json({ ok: true });
});

app.get("/api/config", mustBeSignedIn, (req, res) => {
  res.json({
    user: req.auth.identity,
    settings: state.settings
  });
});

app.get("/api/admin/state", mustBeAdmin, (req, res) => {
  cleanup();
  res.json({
    users: state.users.map(publicUser),
    passes: state.passes.map(pass => ({
      id: pass.id,
      label: pass.label,
      enabled: pass.enabled,
      createdAt: pass.createdAt,
      expiresAt: pass.expiresAt,
      maxUses: pass.maxUses,
      uses: pass.uses
    })),
    sessions: state.sessions.map(session => {
      const identity = identityForSession(session);
      return {
        id: session.id,
        username: identity?.username || "expired",
        role: identity?.role || "",
        temporary: !!identity?.temporary,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        ip: session.ip,
        userAgent: session.userAgent
      };
    }),
    settings: state.settings,
    audit: state.audit.slice(-200).reverse()
  });
});

app.post("/api/admin/users", mustBeAdmin, sameOrigin, (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || "");
  const role = req.body.role === "admin" ? "admin" : "user";
  const expiresAt = Number(req.body.expiresAt || 0) || null;

  if (!validUsername(username)) return res.status(400).json({ error: "Use 3-32 letters, numbers, dots, dashes or underscores" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (state.users.some(item => item.username === username)) return res.status(409).json({ error: "Username already exists" });
  if (expiresAt && expiresAt <= now()) return res.status(400).json({ error: "Expiry must be in the future" });

  const user = {
    id: id("usr"),
    username,
    passwordHash: hashPassword(password),
    role,
    enabled: true,
    temporary: !!expiresAt,
    expiresAt,
    createdAt: now()
  };
  state.users.push(user);
  audit(req.auth.identity, "user.created", username, role);
  saveState();
  res.status(201).json({ user: publicUser(user) });
});

app.patch("/api/admin/users/:id", mustBeAdmin, sameOrigin, (req, res) => {
  const user = state.users.find(item => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const adminCount = state.users.filter(item => item.role === "admin").length;
  const lastAdmin = user.role === "admin" && adminCount <= 1;
  if (lastAdmin && req.body.role === "user") return res.status(400).json({ error: "Create another admin first" });
  if (lastAdmin && req.body.enabled === false) return res.status(400).json({ error: "Create another admin first" });
  if (lastAdmin && Object.prototype.hasOwnProperty.call(req.body, "expiresAt") && Number(req.body.expiresAt || 0) > 0) return res.status(400).json({ error: "The last admin cannot expire" });

  if (typeof req.body.enabled === "boolean") user.enabled = req.body.enabled;
  if (req.body.role === "admin" || req.body.role === "user") user.role = req.body.role;
  if (Object.prototype.hasOwnProperty.call(req.body, "expiresAt")) {
    const value = Number(req.body.expiresAt || 0);
    user.expiresAt = value > 0 ? value : null;
    user.temporary = !!user.expiresAt;
  }
  if (typeof req.body.password === "string" && req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    user.passwordHash = hashPassword(req.body.password);
  }

  if (!user.enabled || (user.expiresAt && user.expiresAt <= now())) {
    state.sessions = state.sessions.filter(session => session.userId !== user.id);
  }

  audit(req.auth.identity, "user.updated", user.username, JSON.stringify({ enabled: user.enabled, role: user.role, expiresAt: user.expiresAt }));
  saveState();
  res.json({ user: publicUser(user) });
});

app.delete("/api/admin/users/:id", mustBeAdmin, sameOrigin, (req, res) => {
  const index = state.users.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "User not found" });
  const user = state.users[index];
  if (user.id === req.auth.identity.id) return res.status(400).json({ error: "You cannot delete your current account" });
  if (user.role === "admin" && state.users.filter(item => item.role === "admin").length <= 1) {
    return res.status(400).json({ error: "Create another admin first" });
  }
  state.users.splice(index, 1);
  state.sessions = state.sessions.filter(session => session.userId !== user.id);
  audit(req.auth.identity, "user.deleted", user.username);
  saveState();
  res.json({ ok: true });
});

app.post("/api/admin/users/:id/revoke", mustBeAdmin, sameOrigin, (req, res) => {
  const user = state.users.find(item => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(session => session.userId !== user.id);
  audit(req.auth.identity, "user.sessions_revoked", user.username, String(before - state.sessions.length));
  saveState();
  res.json({ ok: true });
});

app.post("/api/admin/passes", mustBeAdmin, sameOrigin, (req, res) => {
  const label = String(req.body.label || "guest").trim().slice(0, 40) || "guest";
  const minutes = Math.min(43200, Math.max(5, Number(req.body.minutes || 60)));
  const maxUses = Math.min(100, Math.max(1, Number(req.body.maxUses || 1)));
  const code = `BOLT-${token(6).toUpperCase()}`;
  const pass = {
    id: id("pass"),
    codeHash: digest(code),
    label,
    enabled: true,
    createdAt: now(),
    expiresAt: now() + minutes * 60 * 1000,
    maxUses,
    uses: 0
  };
  state.passes.push(pass);
  audit(req.auth.identity, "pass.created", label, `${minutes}m/${maxUses}`);
  saveState();
  res.status(201).json({
    pass: {
      id: pass.id,
      code,
      label,
      expiresAt: pass.expiresAt,
      maxUses,
      uses: 0,
      enabled: true
    }
  });
});

app.delete("/api/admin/passes/:id", mustBeAdmin, sameOrigin, (req, res) => {
  const pass = state.passes.find(item => item.id === req.params.id);
  if (!pass) return res.status(404).json({ error: "Pass not found" });
  state.passes = state.passes.filter(item => item.id !== pass.id);
  state.sessions = state.sessions.filter(session => session.passId !== pass.id);
  audit(req.auth.identity, "pass.deleted", pass.label);
  saveState();
  res.json({ ok: true });
});

app.patch("/api/admin/settings", mustBeAdmin, sameOrigin, (req, res) => {
  if (typeof req.body.maintenance === "boolean") state.settings.maintenance = req.body.maintenance;
  if (req.body.features && typeof req.body.features === "object") {
    for (const key of ["proxy", "music", "video"]) {
      if (typeof req.body.features[key] === "boolean") state.settings.features[key] = req.body.features[key];
    }
  }
  audit(req.auth.identity, "settings.updated", "bolt", JSON.stringify(state.settings));
  saveState();
  res.json({ settings: state.settings });
});

app.delete("/api/admin/sessions/:id", mustBeAdmin, sameOrigin, (req, res) => {
  if (req.params.id === req.auth.session.id) return res.status(400).json({ error: "Use logout for your current session" });
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(item => item.id !== req.params.id);
  if (before === state.sessions.length) return res.status(404).json({ error: "Session not found" });
  audit(req.auth.identity, "session.killed", req.params.id);
  saveState();
  res.json({ ok: true });
});

app.post("/api/admin/sessions/revoke-users", mustBeAdmin, sameOrigin, (req, res) => {
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(session => {
    const identity = identityForSession(session);
    return identity?.role === "admin";
  });
  audit(req.auth.identity, "sessions.users_revoked", "all", String(before - state.sessions.length));
  saveState();
  res.json({ ok: true });
});

app.use((req, res, next) => {
  const found = sessionFromRequest(req);
  const allowed = found && (found.identity.role === "admin" || (!state.settings.maintenance && state.settings.features.proxy));
  if (!allowed) return next();
  if (routeRequest(req, res)) return;
  next();
});

app.use("/assets", express.static(path.join(here, "public", "assets"), {
  etag: true,
  maxAge: "1h",
  immutable: false
}));
app.use("/favicon.svg", express.static(path.join(here, "public", "favicon.svg")));
app.use("/manifest.webmanifest", express.static(path.join(here, "public", "manifest.webmanifest")));

app.get("/login", (req, res) => {
  const found = sessionFromRequest(req);
  if (found) return res.redirect("/");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(here, "views", "login.html"));
});

app.get("/", (req, res) => {
  const found = sessionFromRequest(req);
  if (!found) return res.redirect("/login");
  if (state.settings.maintenance && found.identity.role !== "admin") {
    res.status(503);
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(path.join(here, "views", "maintenance.html"));
  }
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(here, "views", "app.html"));
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const found = sessionFromHeaders(req.headers);
  const allowed = found && (found.identity.role === "admin" || (!state.settings.maintenance && state.settings.features.proxy));
  if (!allowed) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  routeUpgrade(req, socket, head);
});

server.listen(port, () => {
  console.log(`Bolt listening on http://localhost:${port}`);
});
