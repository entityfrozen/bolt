import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const arcade=fs.readFileSync(new URL("../public/assets/arcade.js",import.meta.url),"utf8");
const hub=fs.readFileSync(new URL("../public/assets/hub.js",import.meta.url),"utf8");
const arena=fs.readFileSync(new URL("../public/assets/arena-v3.js",import.meta.url),"utf8");
test("arcade lists only the three active games",()=>{
  for(const name of ["WorldPvP","Chess","Rock Paper Scissors"])assert.ok(arcade.includes('title:"'+name+'"'));
  assert.doesNotMatch(arcade,/Pixel Basketball|Pixel Soccer|pixelSoccer|pixelBasketball|sportsOpen|Pixel sports/);
  assert.match(arcade,/THREE GAMES/);
});
test("changelog is empty and network heading is gone",()=>{
  assert.match(hub,/No updates yet/);
  assert.doesNotMatch(arena,/Hub\.prototype\.updates=function/);
  assert.doesNotMatch(hub,/LIGHTNING NETWORK|The Lightning network/);
});
