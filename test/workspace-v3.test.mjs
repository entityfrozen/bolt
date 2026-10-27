import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {slide2048,make2048,makeMines,openMine} from "../public/assets/workspace-v3.js";
const browser=fs.readFileSync(new URL("../views/app.html",import.meta.url),"utf8");
const workspace=fs.readFileSync(new URL("../public/assets/workspace-v3.js",import.meta.url),"utf8");
test("V2 browser has a redesigned, navigable workspace launcher",()=>{
  for(const id of ["newtabInput","newtabForm","recentList","bookmarkList","lightningSuggestionButton"])assert.ok(browser.includes('id="'+id+'"'));
  assert.match(browser,/workspace-v3\.css/);
  assert.match(browser,/workspace-browser\.css/);
  for(const route of ["overview","chat","games"])assert.ok(browser.includes('data-hub="'+route+'"'));
});
test("V3 workspace has functional navigation, search and preferences",()=>{
  for(const action of ["overview","channel","arcade","browser","command","theme","toggleInspector","toggleDock","setTheme","favorite","play"]){
    assert.ok(workspace.includes('action==="'+action+'"'),"V3 missing action "+action);
  }
  assert.match(workspace,/Hub\.prototype\.v3Overview/);
  assert.match(workspace,/Hub\.prototype\.v3DrawCommands/);
  assert.match(workspace,/Hub\.prototype\.v3Launch/);
  assert.match(workspace,/localStorage\.setItem/);
});
test("2048 merges tiles, scores them and spawns a new tile",()=>{
  const game=make2048();
  game.cells=[2,2,4,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const moved=slide2048(game,"left");
  assert.equal(moved,true);
  assert.equal(game.score,4);
  assert.equal(game.cells[0],4);
  assert.equal(game.cells[1],4);
  assert.equal(game.cells.filter(Boolean).length,3);
  assert.equal(game.over,false);
});
test("2048 does not spawn a tile if nothing moves",()=>{
  const game=make2048();game.cells[0]=2;
  assert.equal(slide2048(game,"left"),false);
  assert.equal(game.cells.filter(Boolean).length,1);
});
test("Minesweeper first-click protection and win conditions are real",()=>{
  const game=makeMines();
  openMine(game,27);
  assert.equal(game.started,true);
  assert.equal(game.cells[27].mine,false);
  assert.equal(game.cells[27].open,true);
  assert.equal(game.cells.filter(c=>c.mine).length,10);
  assert.equal(game.cells.filter(c=>!c.mine).length,54);
});
test("Minesweeper loses on a mine after starting",()=>{
  const game=makeMines();openMine(game,0);
  const mine=game.cells.findIndex(c=>c.mine);
  assert.ok(mine>=0);
  openMine(game,mine);
  assert.equal(game.over,true);
  assert.equal(game.won,false);
});

test("Lightning island restores the warm brass identity",()=>{
  const skin=fs.readFileSync(new URL("../public/assets/lightning-island.css",import.meta.url),"utf8");
  assert.match(skin,/--accent:#e2bb75/);
  assert.match(skin,/grid-template-columns:270px minmax\(0,1fr\) 246px/);
  assert.match(skin,/\.v3-primary-tabs\s*\{/);
  assert.match(skin,/border-radius:999px/);
  assert.match(skin,/\.v4-nav-shell/);
  assert.match(workspace,/navShell\.append\(serverRail,channelRail\)/);
  assert.match(workspace,/class="v4-home"/);
  assert.match(browser,/lightning-island\.css/);
  assert.doesNotMatch(workspace,/#44eda7|#38f0a4|#72c9ff/);
});
