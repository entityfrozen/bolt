import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/assets/bolt-v6.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../views/app.html", import.meta.url), "utf8");
const toolsCss = fs.readFileSync(new URL("../public/assets/bolt-tools.css", import.meta.url), "utf8");
const themeCss = fs.readFileSync(new URL("../public/assets/theme-cleanup.css", import.meta.url), "utf8");
const toolsJs = fs.readFileSync(new URL("../public/assets/bolt-tools.js", import.meta.url), "utf8");

test("empty browsing layer does not block homepage clicks", () => {
  assert.match(css, /\.frame-stack\s*\{\s*pointer-events:\s*none\s*\}/);
  assert.match(css, /\.frame-stack\s*>\s*\.proxy-frame\.active\s*\{\s*pointer-events:\s*auto\s*\}/);
});

test("new tab search and suggestion controls remain interactable", () => {
  assert.match(html, /id="newtabInput"/);
  assert.match(html, /id="lightningSuggestionButton"/);
  assert.ok(html.indexOf('id="newtabView"') < html.indexOf('id="frameStack"'));
});

test("closed multiplayer overlay cannot absorb clicks", () => {
  assert.match(html, /id="hubMount" hidden/);
  assert.match(css, /#hubMount\[hidden\][^\n]*display:\s*none\s*!important/);
});

test("live search sources use appearance colors instead of hardcoded gold", () => {
  assert.ok(toolsJs.includes('refs.className = "bolt-ai-sources"'));
  assert.ok(css.includes(".bolt-ai-sources strong {color:var(--lg-accent"));
  assert.ok(css.includes("color: var(--lg-accent"));
  assert.ok(themeCss.includes("#boltTools .bolt-ai-sources a"));
  assert.ok(themeCss.includes("#boltTools .bolt-ai-web-status"));
  assert.ok(toolsCss.includes("--lg-rgb"));
  assert.ok(toolsCss.includes("color:var(--lg-accent"));
  assert.ok(html.includes("/assets/theme-cleanup.css?v=2"));
});

test("thinking panel shows high-level progress and hides after reply", () => {
  assert.ok(toolsJs.includes('id="boltAiThinkingDetails" open'));
  assert.ok(toolsJs.includes('id="boltAiThoughtLog" aria-live="polite"'));
  assert.ok(toolsJs.includes('function describeActivity(message)'));
  assert.ok(toolsJs.includes('entry.append(title, description)'));
  assert.ok(toolsJs.includes('if(type==="sources")showSearchedSites(data)'));
  assert.ok(toolsJs.includes('if(type==="delta")showGeneratedText(data.text||"")'));
  assert.ok(toolsJs.includes('setActivity("");'));
  assert.ok(!toolsJs.includes('id="boltAiActivityDraft"'));
  assert.ok(toolsCss.includes(".bolt-ai-thought-entry em"));
  assert.ok(toolsCss.includes("@media(prefers-reduced-motion:reduce)"));
});

test("Lightning AI accepts pasted screenshots with preview and a remove action",()=>{
  assert.ok(toolsJs.includes('id="boltAiAttachImage"'));
  assert.ok(toolsJs.includes('id="boltAiImagePreview" hidden'));
  assert.ok(toolsJs.includes('id="boltAiRemoveImage"'));
  assert.ok(toolsJs.includes('input.addEventListener("paste",event=>'));
  assert.ok(toolsJs.includes('event.clipboardData?.items'));
  assert.ok(toolsJs.includes('context.drawImage(bitmap'));
  assert.ok(toolsJs.includes('canvas.toDataURL("image/jpeg"'));
  assert.ok(toolsJs.includes('image:attached'));
  assert.ok(toolsJs.includes('lastImageIndex'));
  assert.ok(toolsCss.includes(".bolt-ai-message-image"));
  assert.ok(toolsCss.includes(".bolt-ai-image-preview[hidden]"));
});
