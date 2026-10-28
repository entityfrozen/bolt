import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CHANNELS = ["general", "games", "suggestions", "support"];
const EMOJI = ["❤️", "🔥", "😂", "😭", "👍", "👎", "💀", "🎉", "👀", "🙏", "✨"];
const uid = () => crypto.randomBytes(7).toString("hex");
const clean = (value, limit) => String(value ?? "").trim().slice(0, limit);
const roomFor = (a, b) => [a, b].sort().join("|");
const mentionedNames = text => [...String(text).matchAll(/(?:^|[^a-z0-9._-])@([a-z0-9._-]{3,32})(?![a-z0-9._-])/gi)].map(m => m[1].toLowerCase());

export function createSocial({dataDir, sendAll, sendUser, clientOf, findUserById = () => null}) {
  const filename = path.join(dataDir, "lightning-social.json");
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(filename, "utf8")); } catch {}
  const history = Object.fromEntries(CHANNELS.map(channel => [channel, Array.isArray(saved[channel]) ? saved[channel].slice(-120) : []]));
  const dms = saved.dms && typeof saved.dms === "object" && !Array.isArray(saved.dms) ? saved.dms : {};
  const reads = saved.reads && typeof saved.reads === "object" && !Array.isArray(saved.reads) ? saved.reads : {};
  let saving = false, lastStamp = Date.now() - 1;
  function save() {
    if (saving) return;
    saving = true;
    const timer = setTimeout(() => {
      saving = false;
      try {
        fs.writeFileSync(filename + ".tmp", JSON.stringify({...history, dms, reads}));
        fs.renameSync(filename + ".tmp", filename);
      } catch (error) { console.warn("Lightning social save:", error.message); }
    }, 250);
    timer.unref?.();
  }
  function timestamp() { return lastStamp = Math.max(Date.now(), lastStamp + 1); }
  function privateHistory(userId) {
    return Object.fromEntries(Object.entries(dms)
      .filter(([room, messages]) => room.split("|").includes(userId) && Array.isArray(messages))
      .map(([room, messages]) => [room, messages.slice(-120)]));
  }
  function readAt(userId, key) { return Number(reads[userId]?.[key] || 0); }
  function getUnread(userId, username) {
    const channels = {}, direct = {};
    for (const channel of CHANNELS) {
      const count = history[channel].filter(message => message.userId !== userId
        && message.at > readAt(userId, "c:" + channel)
        && mentionedNames(message.message).includes(String(username).toLowerCase())).length;
      if (count) channels[channel] = count;
    }
    for (const [room, messages] of Object.entries(dms)) {
      const users = room.split("|");
      if (!users.includes(userId) || !Array.isArray(messages)) continue;
      const peer = users.find(user => user !== userId);
      if (!peer) continue;
      const count = messages.filter(message => message.userId !== userId && message.at > readAt(userId, "d:" + peer)).length;
      if (count) direct[peer] = (direct[peer] || 0) + count;
    }
    return {type:"unread", channels, direct, total:[...Object.values(channels), ...Object.values(direct)].reduce((sum,n)=>sum+n,0)};
  }
  function updateUnread(userId) {
    const user = clientOf(userId)[0]?.[1];
    if (user) sendUser(userId, getUnread(userId, user.name));
  }
