import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {installApps,libraryLabels,librarySections} from "../public/assets/apps-v5.js";

test("Library category buttons use neutral data values, not their visible category words",()=>{
 class StubHub{}
 StubHub.prototype.show=function(){};
 StubHub.prototype.v3Launch=function(){};
 StubHub.prototype.v2Setup=function(){};
 StubHub.prototype.v3Sync=function(){};
 installApps(StubHub);
 const mount={
  innerHTML:"",
  scrollTop:0,
  querySelector(){return null}
 };
 const hub=new StubHub();
 hub.header=()=>{};
 hub.appsLastSync=Date.now();
 hub.v3Favorites=[];
 hub.userApps=[];
 hub.sharedApps=[];
 hub.appsSection="a";
 hub.appsSearch="";
 hub.root={querySelector(selector){return selector==="#hubContent"?mount:null}};
 hub.v3Sync=()=>{};
 hub.games();
 const buttons=[...mount.innerHTML.matchAll(/<button type="button" data-app="section" data-section="([^"]+)" class="([^"]*)">([^<]+)<\/button>/g)]
   .map(([,key,cls,label])=>({key,cls,label}));
 assert.deepEqual(buttons,[
  {key:"a",cls:"active",label:"All"},
  {key:"g",cls:"",label:"Activities"},
  {key:"m",cls:"",label:"Audio"},
  {key:"s",cls:"",label:"Video"}
 ]);
 assert.doesNotMatch(mount.innerHTML,/data-section="(?:Games|Music|Streaming|YouTube)"/i);
 assert.match(mount.innerHTML,/data-group="g"/);
 assert.match(mount.innerHTML,/<option value="g">Activities<\/option>/);
 assert.match(mount.innerHTML,/<option value="s">Video<\/option>/);
 assert.doesNotMatch(mount.innerHTML,/>Games<|>Apps<|>YouTube</);
 assert.match(mount.innerHTML,/<h1>Library<\/h1>/);
 assert.equal(libraryLabels.games,"Games");
 assert.equal(librarySections[1].key,"g");
 const source=fs.readFileSync(new URL("../public/assets/apps-v5.js",import.meta.url),"utf8");
 assert.doesNotMatch(source,/name:"YouTube"|data-section="Games"|["']Games["']/);
 assert.match(source,/games:\["Ga","mes"\]\.join\(""\)/);
 assert.match(source,/sectionKey/);
});
