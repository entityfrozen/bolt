import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { attachLightningLive } from "../live.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(t) {
  const temp = mkdtempSync(path.join(tmpdir(), "lightning-live-"));
  const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  attachLightningLive({
    server, dataDir: temp,
    sessionFromHeaders: headers => {
      const token = /(?:^|;\s*)tester=(\w+)/.exec(headers.cookie || "")?.[1];
      return token ? { identity: { id: token, username: token }, session: { id: token } } : null;
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const sockets = [];
  const messages = new Map();
  t.after(async () => {
    for (const ws of sockets) { try { ws.terminate() } catch {} }
    await new Promise(resolve => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  });
  async function connect(name) {
    const ws = new WebSocket("ws://127.0.0.1:" + port + "/live", { headers: { Cookie: "tester=" + name } });
    const history = [];
    sockets.push(ws);
    messages.set(ws, history);
    ws.on("message", raw => { try { history.push(JSON.parse(raw.toString())) } catch {} });
    await once(ws, "open");
    await until(() => history.some(m => m.type === "hello"));
    return ws;
  }
  async function until(predicate, timeout = 2500) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = predicate();
      if (result) return result;
      await delay(20);
    }
    throw new Error("Timed out waiting for WebSocket event");
  }
  return { connect, until, messages, port };
}

test("rejects unauthenticated websocket upgrades", async t => {
  const env = await setup(t);
  const ws = new WebSocket("ws://127.0.0.1:" + env.port + "/live");
  await new Promise((resolve, reject) => {
    ws.once("error", e => { assert.match(e.message, /401/); resolve() });
    ws.once("open", () => reject(new Error("Unauthenticated connection accepted")));
  });
});

test("shared chat broadcasts and records history", async t => {
  const env = await setup(t), alice = await env.connect("alice"), bob = await env.connect("bob");
  alice.send(JSON.stringify({ type: "chat", channel: "general", message: "Hello from Alice" }));
  const entry = await env.until(() => env.messages.get(bob).find(m => m.type === "chat"));
  assert.equal(entry.entry.message, "Hello from Alice");
  assert.equal(entry.entry.by, "alice");
  assert.equal(entry.entry.channel, "general");
  assert.equal(env.messages.get(alice).find(m => m.type === "hello").name, "alice");
});

test("chess enforces player turn and broadcasts legal moves", async t => {
  const env = await setup(t), alice = await env.connect("alice"), bob = await env.connect("bob");
  alice.send(JSON.stringify({ type: "queue", game: "chess" }));
  await env.until(() => env.messages.get(alice).some(m => m.type === "queued"));
  bob.send(JSON.stringify({ type: "queue", game: "chess" }));
  const start = await env.until(() => env.messages.get(alice).find(m => m.type === "chessStart"));
  await env.until(() => env.messages.get(bob).find(m => m.type === "chessStart"));
  await delay(600);
  alice.send(JSON.stringify({ type: "chessMove", id: start.id, from: "e2", to: "e4" }));
  const state = await env.until(() => env.messages.get(bob).find(m => m.type === "chessState"));
  assert.equal(state.last, "e4");
  assert.equal(state.turn, "b");
  await delay(600);
  alice.send(JSON.stringify({ type: "chessMove", id: start.id, from: "d2", to: "d4" }));
  const rejected = await env.until(() => env.messages.get(alice).find(m => m.type === "error" && /not your turn/.test(m.message)));
  assert.match(rejected.message, /not your turn/);
});

test("WorldPvP spawns a nation on land with persistent world state", async t => {
  const env = await setup(t), alice = await env.connect("alice");
  alice.send(JSON.stringify({ type: "worldJoin" }));
  const msg = await env.until(() => env.messages.get(alice).find(m => m.type === "world" && m.players.length));
  assert.equal(msg.cells.length, 2048);
  assert.ok(msg.landTotal > 0);
  assert.ok(msg.players.some(p => p.name === "alice"));
  assert.ok(msg.players.find(p => p.name === "alice").land > 0);
});
