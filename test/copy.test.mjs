import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Games use plain labels without promotional headlines",()=>{
 const workspace=read("public/assets/workspace-v3.js");
 const arena=read("public/assets/arena-v3.js");
 assert.match(workspace,/Pick your game\./);
 assert.match(arena,/Play chess\./);
 assert.doesNotMatch(workspace,/obsession\.|Six games\. One place to play\.|LIGHTNING COMMUNITY/);
 assert.doesNotMatch(arena,/The world is your battlefield|LIGHTNING CHESS CLUB/);
});

test("Browser, login, settings and AI use direct language",()=>{
 const home=read("views/app.html"),login=read("views/login.html");
 const settings=read("public/assets/glass-settings.js"),ai=read("public/assets/bolt-tools.js");
 assert.match(home,/New tab\.<span>Where to\?/);
 assert.match(login,/type="submit">Sign in</);
 assert.match(settings,/Used for buttons and highlights/);
 assert.match(ai,/What do you need\?/);
 for(const [name,source] of [["browser",home],["login",login],["settings",settings],["AI",ai]]){
  assert.doesNotMatch(source,/Go anywhere\.|Stay connected\.|Your space, your rules|Good design\. Your signature|A hand when you need one|Your browser, your communities, your space/,name+" still has over-written copy");
 }
});
