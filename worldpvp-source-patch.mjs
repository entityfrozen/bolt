// Source-level changes to the pinned OpenFrontIO checkout.
// Preserve the upstream engine, multiplayer protocol, attribution and licensing.
// Fail the Docker build if a targeted upstream source signature changes.
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function write(file,data){fs.writeFileSync(path.join(root,file),data);}
function replace(file,oldText,newText){
 const content=read(file);
 if(!content.includes(oldText))throw new Error("WorldPvP source patch mismatch: "+file+" missing "+JSON.stringify(oldText.slice(0,120)));
 const next=content.replace(oldText,newText);
 if(next===content)throw new Error("WorldPvP did not patch "+file);
 write(file,next);
 console.log("WorldPvP patched",file);
}
const standaloneImport='import { isWorldPvPStandalone } from "./WorldPvPStandalone";\n';

// Brand the upstream HTML template, not just the embedding Lightning browser.
const htmlPath="index.html";
let html=read(htmlPath);
if(!html.includes('<title data-i18n="main.title">OpenFront (ALPHA)</title>'))throw new Error("Game HTML layout changed");
html=html.replace('<title data-i18n="main.title">OpenFront (ALPHA)</title>','<title>WorldPvP — Global Conquest</title>');
html=html.replace('<meta property="og:title" content="OpenFront - Battle Royale" />','<meta property="og:title" content="WorldPvP — Global Conquest" />');
html=html.replace('content="Conquer the world in this multiplayer battle royale! Expand your nation, eliminate opponents, and dominate the map in this fast-paced IO game."','content="WorldPvP — real-time strategy, online conquest, and private multiplayer battles."');
html=html.replace('    <meta charset="UTF-8" />',
  '    <meta charset="UTF-8" />\n    <script>window.WORLDPVP_STANDALONE=true;</script>\n    <style id="worldpvp-native-home">\n'+read("worldpvp-home.css")+'\n    </style>');
write(htmlPath,html);

// WorldPvP is the installed app's name as well as its visible website name.
const manifestPath="resources/manifest.json";
const manifest=JSON.parse(read(manifestPath));
manifest.name="WorldPvP — Global Conquest";
manifest.short_name="WorldPvP";
manifest.description="Real-time strategy and multiplayer world conquest.";
write(manifestPath,JSON.stringify(manifest,null,2)+"\\n");

// Original game mode architecture is untouched; only replace its landing view.
// All Host/Join button handlers still open the real upstream lobby modals.
write("src/client/components/PlayPage.ts",read("worldpvp-playpage.ts"));
write("src/client/WorldPvPStandalone.ts",read("worldpvp-standalone.ts"));

// Replace the desktop logo in the actual Lit UI component.
const navbar="src/client/components/DesktopNavBar.ts";
replace(navbar,
'            <img\n              class="block h-full aspect-[1364/259]"\n              src=${assetUrl("images/OpenFrontLogo.svg")}\n              alt="OpenFront"\n            />',
'            <strong class="worldpvp-nav-brand">WORLD<span>PVP</span></strong>');
replace(navbar,'import { assetUrl } from "@openfront/shared/AssetUrls";\n','');

// The standalone game serves itself; there is no api.<railway-host> identity
// server or shared OpenFront registry. Guests use the upstream dev-only UUID
// path, which the server already validates ONLY in GAME_ENV=dev.
const auth="src/client/Auth.ts";
replace(auth,'import { TokenPayload, TokenPayloadSchema } from "@openfront/shared/ApiSchemas";\n',
  'import { TokenPayload, TokenPayloadSchema } from "@openfront/shared/ApiSchemas";\n'+standaloneImport);
replace(auth,'async function doRefreshJwt(): Promise<void> {',
'async function doRefreshJwt(): Promise<void> {\n  if (isWorldPvPStandalone()) {\n    __jwt = null;\n    return; // Dev-only anonymous UUID. Do not contact a non-existent upstream account API.\n  }');

// Keep the upstream serverList fallback, but do not flood/disable the page
// against an API server that does not exist on our isolated deployment.
const sl="src/client/ServerList.ts";
replace(sl,'import { ClientEnv } from "./ClientEnv";\n',
  'import { ClientEnv } from "./ClientEnv";\n'+standaloneImport);
replace(sl,'export function startServerListPolling(): void {',
  'export function startServerListPolling(): void {\n  if (isWorldPvPStandalone()) return;');
replace(sl,'export async function ensureServerList(): Promise<ServerListStatus> {',
  'export async function ensureServerList(): Promise<ServerListStatus> {\n  if (isWorldPvPStandalone()) return "fallback";');
replace(sl,'export function refreshServerList(): Promise<ServerListStatus> {',
  'export function refreshServerList(): Promise<ServerListStatus> {\n  if (isWorldPvPStandalone()) return Promise.resolve("fallback");');
replace(sl,'export function retryServerList(): Promise<ServerListStatus> {',
  'export function retryServerList(): Promise<ServerListStatus> {\n  if (isWorldPvPStandalone()) return Promise.resolve("fallback");');

// Other optional upstream API calls can fail fast with HTTP rather than
// blocking on DNS to api.lightning-openfront-production.up.railway.app.
const api="src/client/ApiBase.ts";
replace(api,'import { ClientEnv } from "./ClientEnv";\n',
  'import { ClientEnv } from "./ClientEnv";\n'+standaloneImport);
replace(api,'export function getApiBase() {',
  'export function getApiBase() {\n  if (isWorldPvPStandalone()) return window.location.origin;');

// No cross-site ranked/matchmaker exists on this one-service install.
// Avoid a fake ranked button. Private room and public game feeds still work.
const gm="src/client/GameModeSelector.ts";
replace(gm,'import { ClientEnv } from "src/client/ClientEnv";\n',
  'import { ClientEnv } from "src/client/ClientEnv";\n'+standaloneImport);
replace(gm,'export function multiplayerAllowedForBackend(backendOutage: boolean): boolean {',
  'export function multiplayerAllowedForBackend(backendOutage: boolean): boolean {\n  if (isWorldPvPStandalone()) return true;');
replace(gm,'  private openRankedMenu = () => {',
  '  private openRankedMenu = () => {\n    if (isWorldPvPStandalone()) {\n      showToast("Ranked matchmaking is not enabled on this private server. Host or join a WorldPvP room instead.", "red");\n      return;\n    }');

// Ranked workers were polling remote api.<domain>/matchmaking/checkin every
// five seconds. Remove only those loops in this standalone install.
const worker="src/server/Worker.ts";
replace(worker,
'  setTimeout(\n    () => {\n      // The ranked loop follows the deployment-active flag',
'  if (process.env.WORLDPVP_STANDALONE !== "1") setTimeout(\n    () => {\n      // The ranked loop follows the deployment-active flag');
replace(worker,
'  const privilegeRefresher = new PrivilegeRefresher(\n    ServerEnv.jwtIssuer() + "/cosmetics.json",\n    ServerEnv.apiKey(),\n    ServerEnv.jwtIssuer() + "/reserved_clan_tags",\n    log,\n  );\n  void privilegeRefresher.start();',
'  if (process.env.WORLDPVP_STANDALONE !== "1") {\n    const privilegeRefresher = new PrivilegeRefresher(\n      ServerEnv.jwtIssuer() + "/cosmetics.json",\n      ServerEnv.apiKey(),\n      ServerEnv.jwtIssuer() + "/reserved_clan_tags",\n      log,\n    );\n    void privilegeRefresher.start();\n  }');
console.log("WorldPvP source patches complete.");
