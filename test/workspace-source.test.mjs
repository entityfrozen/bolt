import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../views/app.html",import.meta.url),"utf8");
const decoded=source.replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));

test("The actual signed-in workspace HTML is education-themed in View Source",()=>{
 assert.match(source,/<title>Brightpath \| Learning Workspace<\/title>/);
 assert.match(source,/mathematics practice, science notes, and research tools/);
 assert.match(source,/DAILY MATH WARM-UP/);
 assert.match(source,/8 × 7 = \?/);
 assert.match(source,/Science notes/);
 assert.match(source,/Study groups/);
 assert.match(source,/data-research-link="https:\/\/www\.google\.com\/"/);
 assert.doesNotMatch(source,/(?:lightning|worldpvp|scramjet|arcade|games?|music|video|streaming|chat|bolt|proxy|social|apps|entertainment|play|rps|chess)/i);
 // Encoding works in text and quoted attribute VALUES, not in attribute names.
 assert.doesNotMatch(source,/\s[\w-]*&#\d+;[\w-]*=/);
});

test("Decoded HTML retains every critical application hook and loads real scripts",()=>{
 for(const id of ["boltShell","tabs","homeMark","accountButton","newtabView",
  "newtabInput","newtabForm","recentList","bookmarkList","hubMount","frameStack",
  "lightningSuggestionButton","accountPopover","sidePanel"]){
  assert.ok(decoded.includes('id="'+id+'"'),"Missing DOM id: "+id);
 }
 for(const view of ["overview","chat","games","updates"]){
  assert.ok(decoded.includes('data-hub="'+view+'"'),"Missing hub navigation: "+view);
 }
 assert.match(decoded,/<symbol id="i-games"/);
 assert.match(decoded,/href="#i-games"/);
 assert.match(decoded,/class="lightning-quick"/);
 assert.match(decoded,/src="\/assets\/app\.js\?v=\d+"/);
 assert.match(decoded,/src="\/assets\/bolt-tools\.js\?v=18"/);
 assert.match(decoded,/href="\/assets\/bolt\.css"/);
 assert.match(decoded,/href="\/assets\/worldpvp-overhaul\.css\?v=1"/);
 assert.match(decoded,/data-research-link="https:\/\/www\.wikipedia\.org\/"/);
 assert.match(decoded,/family=Instrument\+Sans[^"]*display=swap/);
 const application=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");
 assert.match(application,/dataset\.researchLink/);
 assert.doesNotMatch(application,/dataset\.lightningQuick/);
});
