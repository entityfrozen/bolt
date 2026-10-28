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
  '    <meta charset="UTF-8" />\n    <script>window.WORLDPVP_STANDALONE=true;</script>');
html=html.replace(
  'class="select-none font-sans min-h-screen bg-neutral-800 transition-opacity',
  'class="worldpvp-ui select-none font-sans min-h-screen bg-neutral-800 transition-opacity'
);
if(!html.includes('class="worldpvp-ui select-none'))throw new Error("WorldPvP body class not applied");
write(htmlPath,html);

// WorldPvP is the installed app's name as well as its visible website name.
const manifestPath="resources/manifest.json";
const manifest=JSON.parse(read(manifestPath));
manifest.name="WorldPvP — Global Conquest";
manifest.short_name="WorldPvP";
manifest.description="Real-time strategy and multiplayer world conquest.";
write(manifestPath,JSON.stringify(manifest,null,2)+"\n");

// Original game mode architecture is untouched; only replace its landing view.
// All Host/Join button handlers still open the real upstream lobby modals.
write("src/client/components/PlayPage.ts",read("worldpvp-playpage.ts"));
write("src/client/WorldPvPStandalone.ts",read("worldpvp-standalone.ts"));

// The upstream homepage is limited to 20cm (~756px) on desktop.
// That cap made the redesigned game occupy only a strip of the screen.
// Give the real MainLayout full viewport width for all non-game pages.
const mainLayout="src/client/components/MainLayout.ts";
replace(mainLayout,
  'w-full lg:max-w-[20cm] 2xl:max-w-[24cm] desktop:lg:max-w-[min(100%,clamp(80rem,50%,90rem))] mx-auto',
  'worldpvp-layout-inner w-full max-w-none mx-auto');
replace(mainLayout,
  'class="relative [.in-game_&]:hidden flex flex-col flex-1',
  'class="worldpvp-main-shell relative [.in-game_&]:hidden flex flex-col flex-1');

// The live-lobby feed is part of our page, but the upstream action strips
// are duplicates of the new Host, Join, and Solo cards. Keep its websocket,
// lobby cards and event handling, only remove the duplicate visible actions.
const gameModes="src/client/GameModeSelector.ts";
replace(gameModes,
  'class="flex flex-col gap-4 sm:compact:gap-3 sm:compact:has-[>ios-add-to-home-screen-banner:empty]:-mt-3 w-full',
  'class="worldpvp-lobby-board flex flex-col gap-4 sm:compact:gap-3 sm:compact:has-[>ios-add-to-home-screen-banner:empty]:-mt-3 w-full');
replace(gameModes,
  'class="flex gap-4 sm:compact:gap-3 h-14 sm:col-span-2 sm:row-start-3 ${',
  'class="worldpvp-hidden-legacy flex gap-4 sm:compact:gap-3 h-14 sm:col-span-2 sm:row-start-3 ${');
replace(gameModes,
  'class="grid grid-cols-3 gap-4 sm:compact:gap-3 h-14 sm:col-span-2 sm:row-start-4"',
  'class="worldpvp-hidden-legacy grid grid-cols-3 gap-4 sm:compact:gap-3 h-14 sm:col-span-2 sm:row-start-4"');
replace(gameModes,
  'class="min-w-0 sm:col-start-1 sm:row-start-2"',
  'class="worldpvp-featured-lobby min-w-0 sm:col-start-1 sm:row-start-2"');
replace(gameModes,
  'class="flex flex-col gap-4 sm:compact:gap-3 min-w-0 sm:grid sm:grid-rows-[auto_1fr_1fr] sm:row-start-2',
  'class="worldpvp-upcoming-lobbies flex flex-col gap-4 sm:compact:gap-3 min-w-0 sm:grid sm:grid-rows-[auto_1fr_1fr] sm:row-start-2');

// The mobile drawer still showed the old OpenFront emblem even after the
// desktop navbar was rebranded.
const mobileNav="src/client/components/MobileNavBar.ts";
replace(mobileNav,
  '            <img\n              src=${assetUrl("images/OpenFrontLogo.svg")}\n              alt="OpenFront"\n              class="w-auto h-auto max-w-[220px] max-h-[4.5rem]"\n            />',
  '            <strong class="worldpvp-nav-brand">WORLD<span>PVP</span></strong>');
replace(mobileNav,'import { assetUrl } from "@openfront/shared/AssetUrls";\n','');

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

// OModal renders within shadow DOM, where global CSS cannot reach.
// Apply the native WorldPvP design within the actual Host/Join/Solo dialogs.
const modal="src/client/components/baseComponents/Modal.ts";
replace(modal,
  'import { LitElement, PropertyValues, html } from "lit";',
  'import { LitElement, PropertyValues, html, css } from "lit";');
replace(modal,
  '  static styles = [documentStylesSheet()];',
  "  static styles = [documentStylesSheet(), css`\n    :host { --color-malibu-blue:#50bea9; --color-aquarius:#79e9d5; --color-surface:#102333; }\n    section {color:#edf9f9!important; background:linear-gradient(145deg,#142637f6,#0b1824fc)!important;\n      border:1px solid #4d8994a6!important; border-radius:18px!important;box-shadow:0 18px 48px #0009!important}\n    [role=\"tablist\"] {border-bottom:1px solid #74bcb849!important}\n    [role=\"tablist\"] button[aria-selected=\"true\"] {color:#97f1dd!important}\n    [data-modal-scroll] {scrollbar-color:#397478 #102333}\n    button:hover:not(:disabled) {border-color:#8debd3}\n    input:focus-visible, select:focus-visible {outline-color:#83e9d5}\n    :host([inline]) aside {background:transparent!important}\n    :host(:not([inline])) aside {backdrop-filter:blur(8px);background:#040b13b8}\n  `];");

// Ranked workers were polling remote api.<domain>/matchmaking/checkin every
// five seconds. Remove only those loops in this standalone install.
const worker="src/server/Worker.ts";
replace(worker,
'  setTimeout(\n    () => {\n      // The ranked loop follows the deployment-active flag',
'  if (process.env.WORLDPVP_STANDALONE !== "1") setTimeout(\n    () => {\n      // The ranked loop follows the deployment-active flag');
replace(worker,
'  const privilegeRefresher = new PrivilegeRefresher(\n    ServerEnv.jwtIssuer() + "/cosmetics.json",\n    ServerEnv.apiKey(),\n    ServerEnv.jwtIssuer() + "/reserved_clan_tags",\n    log,\n  );\n  void privilegeRefresher.start();',
'  const privilegeRefresher = new PrivilegeRefresher(\n    ServerEnv.jwtIssuer() + "/cosmetics.json",\n    ServerEnv.apiKey(),\n    ServerEnv.jwtIssuer() + "/reserved_clan_tags",\n    log,\n  );\n  if (process.env.WORLDPVP_STANDALONE !== "1") void privilegeRefresher.start();');
console.log("WorldPvP source patches complete.");
