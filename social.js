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

  function scopeFor(user, data) {
    const channel = clean(data.channel, 25);
    if (CHANNELS.includes(channel)) return {messages: history[channel], channel};
    const peer = clean(data.peer, 100);
    if (!peer || peer === user.id) return null;
    const messages = dms[roomFor(user.id, peer)];
    return Array.isArray(messages) ? {messages, peer} : null;
  }
  function publish(user, scope, event) {
    if (scope.channel) sendAll(event);
    else { sendUser(user.id, event); sendUser(scope.peer, event); }
  }
  function handle(user, data) {
    if (data.type === "chat") {
      const channel = clean(data.channel, 25), message = clean(data.message, 1000);
      if (!CHANNELS.includes(channel) || !message) return true;
      const entry = {id:uid(), by:user.name, userId:user.id, channel, message, at:timestamp(), reactions:{}};
      history[channel].push(entry);
      history[channel] = history[channel].slice(-120);
      save();
      sendAll({type:"chat", entry});
      const mentioned = mentionedNames(message);
      if (mentioned.length) {
        const recipients = new Set();
        for (const [, member] of clientOf()) {
          if (member.id !== user.id && mentioned.includes(member.name.toLowerCase())) recipients.add(member.id);
        }
        for (const recipient of recipients) {
          sendUser(recipient, {type:"mention", entry});
          updateUnread(recipient);
        }
      }
      return true;
    }
    if (data.type === "dm") {
      const to = clean(data.to, 100), message = clean(data.message, 1000);
      if (!to || to === user.id || !message) return true;
      const recipient = clientOf(to)[0]?.[1] || findUserById(to);
      if (!recipient || recipient.enabled === false || (recipient.expiresAt && recipient.expiresAt <= Date.now())) {
        sendUser(user.id, {type:"error", message:"That Lightning account wasn't found."});
        return true;
      }
      const room = roomFor(user.id, to);
      const entry = {id:uid(), by:user.name, userId:user.id, to, message, at:timestamp(), reactions:{}};
      (dms[room] ??= []).push(entry);
      dms[room] = dms[room].slice(-120);
      save();
      sendUser(user.id, {type:"dm", entry});
      sendUser(to, {type:"dm", entry});
      updateUnread(to);
      return true;
    }

    if (data.type === "socialRead") {
      const channel = clean(data.channel, 25), peer = clean(data.peer, 100);
      const isChannel = CHANNELS.includes(channel);
      if (!isChannel && (!peer || peer === user.id)) return true;
      const messages = isChannel ? history[channel] : (dms[roomFor(user.id, peer)] || []);
      const key = isChannel ? "c:" + channel : "d:" + peer;
      (reads[user.id] ??= {})[key] = Math.max(readAt(user.id, key), messages.at(-1)?.at || Date.now());
      save();
      updateUnread(user.id);
      return true;
    }
    if (data.type !== "socialDelete" && data.type !== "socialReact") return false;
    const scope = scopeFor(user, data);
    if (!scope) return true;
    const messageId = clean(data.id, 40);
    const index = scope.messages.findIndex(message => message.id === messageId);
    if (index < 0) return true;
    const entry = scope.messages[index];
    if (data.type === "socialDelete") {
      if (entry.userId !== user.id && user.role !== "admin") {
        sendUser(user.id, {type:"error", message:"You can only delete your own messages."});
        return true;
      }
      scope.messages.splice(index, 1);
      save();
      publish(user, scope, {type:"socialDeleted", id:messageId, channel:scope.channel || null, peer:scope.peer || null});
      if (scope.peer) { updateUnread(user.id); updateUnread(scope.peer); }
      else for (const [, member] of clientOf()) updateUnread(member.id);
      return true;
    }
    const emoji = String(data.emoji || "");
    if (!EMOJI.includes(emoji)) return true;
    entry.reactions ??= {};
    const voters = Array.isArray(entry.reactions[emoji]) ? entry.reactions[emoji] : [];
    entry.reactions[emoji] = voters.includes(user.id)
      ? voters.filter(voter => voter !== user.id)
      : [...voters, user.id];
    if (!entry.reactions[emoji].length) delete entry.reactions[emoji];
    save();
    publish(user, scope, {type:"socialReaction", id:messageId, channel:scope.channel || null, peer:scope.peer || null, reactions:entry.reactions});
    return true;
  }

  return {history, privateHistory, getUnread, handle};
}
