import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/assets/bolt-v6.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../views/app.html", import.meta.url), "utf8");

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
