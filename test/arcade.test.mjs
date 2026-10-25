import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const arcade=fs.readFileSync(new URL("../public/assets/arcade.js",import.meta.url),"utf8");
const hub=fs.readFileSync(new URL("../public/assets/hub.js",import.meta.url),"utf8");
const arena=fs.readFileSync(new URL("../public/assets/arena-v3.js",import.meta.url),"utf8");
test("arcade lists only the three active games",()=>{
  for(const name of ["WorldPvP","Chess","Rock Paper Scissors"])assert.ok(arcade.includes('title:"'+name+'"'));
  assert.doesNotMatch(arcade,/Pixel Basketball|Pixel Soccer|pixelSoccer|pixelBasketball|sportsOpen|Pixel sports/);
  assert.match(arcade,/<span>ARCADE<\/span>/);
  assert.doesNotMatch(arcade,/THREE GAMES|Three games/);
});
test("changelog is empty and network heading is gone",()=>{
  assert.match(hub,/No updates yet/);
  assert.doesNotMatch(arena,/Hub\.prototype\.updates=function/);
  assert.doesNotMatch(hub,/LIGHTNING NETWORK|The Lightning network/);
});

test("arcade labels stay minimal and do not repeat the product name",()=>{
  assert.match(arcade,/this\.header\("Arcade",""\)/);
  assert.match(arcade,/<span>ARCADE<\/span>/);
  assert.doesNotMatch(arcade,/THREE GAMES|Three games|LIGHTNING \/ ARCADE/);
  assert.equal((arcade.match(/<span>ARCADE<\/span>/g)||[]).length,1);
});

test("Uma Versus is linked to the creator's browser game",()=>{
  assert.match(arcade,/title:"Uma Versus"/);
  assert.match(arcade,/action:"umaView"/);
  assert.match(arcade,/https:\/\/tiramisuzu701\.github\.io\/uma-versus\//);
  assert.match(arcade,/Open in new tab/);
  assert.match(arcade,/fighting","Fighting"/);
});
test("Chess and RPS have complete server-backed interaction controls",()=>{
  const chess=fs.readFileSync(new URL("../public/assets/chess-visuals.js",import.meta.url),"utf8");
  const rps=fs.readFileSync(new URL("../public/assets/rps-visuals.js",import.meta.url),"utf8");
  for(const action of ["chessQueue","chessCancelQueue","chessBot","chessDuel","chessRefresh","chessResign","square"])assert.ok(chess.includes(action),action);
  for(const action of ["rpsQueue","rpsBot","rpsDuel","tournament","rpsPick"])assert.ok(rps.includes(action),action);
});
