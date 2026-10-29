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
  assert.match(workspace,/settings\.set\(key,value\)/);
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
  assert.match(workspace,/class="v4-home(?: v5-dashboard)?"/);
  assert.match(browser,/lightning-island\.css/);
  assert.doesNotMatch(workspace,/#44eda7|#38f0a4|#72c9ff/);
});

test("Glass appearance engine is shared by browser and workspace",()=>{
  const runtime=fs.readFileSync(new URL("../public/assets/glass-settings.js",import.meta.url),"utf8");
  const css=fs.readFileSync(new URL("../public/assets/liquid-glass.css",import.meta.url),"utf8");
  const studio=fs.readFileSync(new URL("../public/assets/glass-settings.css",import.meta.url),"utf8");
  assert.match(browser,/glass-settings\.js/);
  assert.match(browser,/liquid-glass\.css/);
  assert.match(browser,/glass-settings\.css/);
  assert.match(browser,/data-glass-settings/);
  assert.match(runtime,/--lg-accent/);
  assert.match(runtime,/--accent-rgb/);
  for(const feature of ["opacity","blur","radius","saturation","wallpaper","sidebar","layout","inspector","dock","contrast","motion","shadows","scale"])
    assert.ok(runtime.includes(feature),"Missing appearance control "+feature);
  assert.match(runtime,/account-settings-loaded/);
  assert.match(runtime,/settings\.set\("appearance"/);
  assert.match(runtime,/aria-label/);
  assert.match(css,/backdrop-filter/);
  assert.match(studio,/lg-preview/);
  assert.match(workspace,/window\.LightningGlass\?\.open/);
});

test("Community icon system and protected announcement navigation are installed",()=>{
 const c=fs.readFileSync(new URL("../public/assets/community-ui.js",import.meta.url),"utf8");
 const icons=fs.readFileSync(new URL("../public/assets/ui-icons.js",import.meta.url),"utf8");
 assert.match(c,/announcements/);
 assert.match(c,/data-cm="manage"/);
 assert.match(c,/data-cm-form="role"/);
 assert.match(icons,/stroke-linecap="round"/);
 assert.match(workspace,/lightning-main/);
 assert.doesNotMatch(workspace,/icon:"²"|icon:"✱"|icon:"✊"/);
});

test("Default appearance no longer relies on device-only theme migrations",()=>{
 const settings=fs.readFileSync(new URL("../public/assets/glass-settings.js",import.meta.url),"utf8");
 assert.match(settings,/accent:"#a3cef8"/);
 assert.match(settings,/lightning:account-settings-loaded/);
 assert.doesNotMatch(settings,/localStorage\.setItem\(KEY/);
 assert.match(browser,/glass-settings\.js\?v=6/);
});

test("Dashboard shows real announcement feed and direct community links",()=>{
 const styles=fs.readFileSync(new URL("../public/assets/dashboard-refine.css",import.meta.url),"utf8");
 assert.match(workspace,/main\?\.messages\?\.announcements/);
 assert.match(workspace,/data-channel="announcements"/);
 assert.match(workspace,/v5-channel-shortcut/);
 assert.match(workspace,/v5-game-launch/);
 assert.match(styles,/v5-lead-grid/);
 assert.match(styles,/v5-middle-grid/);
 assert.doesNotMatch(workspace,/YOUR TURN/);
});

test("Single-brand vector mark is used throughout browser and community",()=>{
 const room=fs.readFileSync(new URL("../public/assets/v2.js",import.meta.url),"utf8");
 const glass=fs.readFileSync(new URL("../public/assets/glass-settings.js",import.meta.url),"utf8");
 const assistant=fs.readFileSync(new URL("../public/assets/bolt-tools.js",import.meta.url),"utf8");
 const asset=fs.readFileSync(new URL("../public/assets/lightning-mark.svg",import.meta.url),"utf8");
 assert.match(asset,/<svg/);assert.match(asset,/viewBox="0 0 64 64"/);
 for(const page of [room,glass,assistant,workspace,browser])assert.match(page,/lightning-mark\.svg/);
 assert.doesNotMatch(room,/title="Home">ϟ/);
});
test("Channel picker is always reachable and remembers the chosen server channel",()=>{
 const navigation=fs.readFileSync(new URL("../public/assets/community-ui.js",import.meta.url),"utf8");
 const room=fs.readFileSync(new URL("../public/assets/v2.js",import.meta.url),"utf8");
 assert.match(navigation,/id="cmChannelSelect"/);
 assert.match(navigation,/aria-label="Switch channel"/);
 assert.match(navigation,/cmSyncPicker/);
 assert.match(navigation,/data-cm="previous"/);
 assert.match(navigation,/data-cm="next"/);
 assert.match(navigation,/nav\.scrollTop=scrollTop/);
 assert.match(room,/settings\.set\("channels"/);
 assert.match(room,/v2ChooseChannel/);
 assert.match(room,/v2RememberChannel/);
});
test("Accounts, DMs, server history and appearance links are all integrated",()=>{
 const app=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 const ai=fs.readFileSync(new URL("../public/assets/bolt-tools.js",import.meta.url),"utf8");
 const account=fs.readFileSync(new URL("../public/assets/account-space-ui.js",import.meta.url),"utf8");
 assert.match(browser,/account-space-ui\.js/);
 assert.match(browser,/account-refine\.css/);
 assert.match(app,/LightningAccount\?\.history\.load\("browser"\)/);
 assert.match(app,/popoverDMs/);assert.match(app,/popoverProfile/);
 assert.match(ai,/api\/account\/ai\/workspace/);
 assert.match(ai,/api\/account\/ai\/chats/);
 assert.match(ai,/api\/account\/ai\/preferences/);
 assert.doesNotMatch(ai,/localStorage\.getItem\("bolt\.ai\.messages"\)/);
 assert.match(account,/api\/account\/dms/);
 assert.match(account,/data-as-form="profile"/);
});

test("The game remains mounted when chat opens, and outside clicks do not close the hub",()=>{
 const hub=fs.readFileSync(new URL("../public/assets/hub.js",import.meta.url),"utf8");
 const split=fs.readFileSync(new URL("../public/assets/split-chat.js",import.meta.url),"utf8");
 const css=fs.readFileSync(new URL("../public/assets/workspace-interactions.css",import.meta.url),"utf8");
 assert.doesNotMatch(hub,/this\.active&&!this\.root\.contains\(event\.target\)/);
 assert.match(split,/splitToggle/);
 assert.match(split,/type:"v2Message"/);
 assert.match(split,/lightningSideChat/);
 assert.match(css,/split-chat-open/);
 assert.match(css,/bolt-ai-intro strong/);
 assert.match(browser,/web-search-settings\.js/);
});

test("WorldPvP chat and name controls are connected to the hosted game",()=>{
 const openfront=fs.readFileSync(new URL("../public/assets/openfront-port.js",import.meta.url),"utf8");
 const chat=fs.readFileSync(new URL("../public/assets/split-chat.js",import.meta.url),"utf8");
 const style=fs.readFileSync(new URL("../public/assets/worldpvp-overhaul.css",import.meta.url),"utf8");
 assert.match(openfront,/openfront-port-chat/);
 assert.match(openfront,/lightning:toggleChat/);
 assert.match(openfront,/refreshProfile/);
 assert.match(openfront,/displayName/);
 assert.match(chat,/openfront-port-chat/);
 assert.match(style,/openfront-port-bar/);
 assert.match(style,/lg-accent/);
});
test("Browser, glass and games read account-backed settings",()=>{
 const account=fs.readFileSync(new URL("../public/assets/account-space-ui.js",import.meta.url),"utf8");
 const app=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 const glass=fs.readFileSync(new URL("../public/assets/glass-settings.js",import.meta.url),"utf8");
 const game=fs.readFileSync(new URL("../public/assets/workspace-v3.js",import.meta.url),"utf8");
 assert.match(account,/api\/account\/settings/);
 assert.match(app,/LightningAccount\?\.settings\.load\(\)/);
 assert.doesNotMatch(glass,/localStorage\.setItem\(KEY/);
 assert.match(game,/settings\.set\(key,value\)/);
 assert.doesNotMatch(game,/localStorage\.getItem\("lightning\.v3\.best2048"/);
});

test("Apps library starts empty, has YouTube in streaming and private custom links",()=>{
 const apps=fs.readFileSync(new URL("../public/assets/apps-v5.js",import.meta.url),"utf8");
 const css=fs.readFileSync(new URL("../public/assets/apps-v5.css",import.meta.url),"utf8");
 assert.match(apps,/name:"YouTube",type:"Streaming"/);
 assert.match(apps,/["']customApps["']/);
 assert.match(apps,/Games","Music","Streaming/);
 assert.match(apps,/No favorites yet/);
 assert.match(apps,/data-app="favorite"/);
 assert.doesNotMatch(apps,/catalog\.slice\(0,4\)/);
 assert.match(css,/uma-stage-frame/);
 assert.match(css,/rps-fresh/);
 assert.match(css,/new-chess-match/);
});
test("Apps search and starring do not reset scroll or rebuild every card",()=>{
 const apps=fs.readFileSync(new URL("../public/assets/apps-v5.js",import.meta.url),"utf8");
 assert.match(apps,/appsFilter=function/);
 assert.match(apps,/tile\.hidden=!show/);
 assert.match(apps,/scroller\.scrollTop=scroll/);
 assert.match(apps,/aria-pressed/);
 assert.match(apps,/this\.umaSavedFrame/);
 assert.match(browser,/apps-v5\.css/);
});
test("Community roles and administrator message moderation are visible",()=>{
 const community=fs.readFileSync(new URL("../public/assets/community-ui.js",import.meta.url),"utf8");
 const channels=fs.readFileSync(new URL("../public/assets/v2.js",import.meta.url),"utf8");
 assert.match(community,/data-cm-form="role"/);
 assert.match(community,/Create role/);
 assert.match(community,/Existing roles/);
 assert.match(channels,/server\.canManage/);
});

test("YouTube and external app links use Lightning browser tabs",()=>{
 const apps=fs.readFileSync(new URL("../public/assets/apps-v5.js",import.meta.url),"utf8");
 const browserApp=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 assert.match(apps,/name:"YouTube",type:"Streaming"/);
 assert.match(apps,/lightning:open-browser-tab/);
 assert.match(browserApp,/addEventListener\("lightning:open-browser-tab"/);
 assert.match(browserApp,/openInsideLightning\(event\.detail\?\.url/);
 assert.doesNotMatch(apps,/window\.open\(external\.url/);
 assert.match(apps,/this\.sharedApps/);
 assert.match(apps,/Visible to<select name="visibility"/);
 assert.match(apps,/canShareApps/);
 assert.match(apps,/\/api\/apps/);
});

test("Private servers and deletion controls are exposed in management and discovery",()=>{
 const ui=fs.readFileSync(new URL("../public/assets/community-ui.js",import.meta.url),"utf8");
 const nav=fs.readFileSync(new URL("../public/assets/v2.js",import.meta.url),"utf8");
 const css=fs.readFileSync(new URL("../public/assets/community-modern.css",import.meta.url),"utf8");
 assert.match(ui,/v2SetPrivacy/);
 assert.match(ui,/v2RotateInvite/);
 assert.match(ui,/v2DeleteServer/);
 assert.match(ui,/data-cm="copy-invite"/);
 assert.match(nav,/v2JoinInvite/);
 assert.match(nav,/v2InviteOnly/);
 assert.match(nav,/new URLSearchParams\(location\.search\)/);
 assert.match(css,/cm-danger-zone/);
});

test("proxied new windows stay inside Lightning's tab manager",()=>{
 const app=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 assert.match(app,/function openInsideLightning\(/);
 assert.match(app,/function popupRoutingPlugin\(/);
 assert.match(app,/ManagedPlugin/);
 assert.match(app,/context\.window/);
 assert.match(app,/doc\.addEventListener\("click",handleLink,true\)/);
 assert.match(app,/doc\.addEventListener\("auxclick",handleLink,true\)/);
 assert.match(app,/win\.open=function\(url,target,features\)/);
 assert.match(app,/if\(open\(url\)\)return null/);
 assert.match(app,/newTab\(\{url:destination,title:/);
 assert.match(app,/plugins:\[cache,watcher,popupRoutingPlugin\(\),escaped\]/);
 assert.match(app,/anchor\.hasAttribute\("download"\)/);
});

test("Lightning workspace links and WorldPvP fullscreen never launch outside tabs",()=>{
 const browserApp=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 const world=fs.readFileSync(new URL("../public/assets/openfront-port.js",import.meta.url),"utf8");
 assert.match(browserApp,/document\.addEventListener\("click",event=>\{/);
 assert.match(browserApp,/a\[href\]\[target="_blank"\]/);
 assert.match(browserApp,/if\(openInsideLightning\(anchor\.href/);
 assert.match(world,/data-act="worldFullscreen"/);
 assert.match(world,/requestFullscreen\(\)/);
 assert.doesNotMatch(world,/href="'\+GAME_URL\+'" target="_blank"/);
 assert.match(browser,/\/assets\/app\.js\?v=\d+/);
});
