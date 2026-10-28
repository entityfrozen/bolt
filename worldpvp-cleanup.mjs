// WorldPvP-only cleanup of the pinned OpenFront checkout.
// Keep the original UI and all of its lobby/game handlers intact.
// This runs before Vite builds client assets.
import fs from "node:fs";

function update(file, fn) {
  const original=fs.readFileSync(file,"utf8");
  const modified=fn(original);
  if(modified===original)throw new Error("WorldPvP cleanup found no change in "+file);
  fs.writeFileSync(file,modified);
  console.log("WorldPvP cleaned:",file);
}
function replaceOnce(content,from,to,file) {
  if(!content.includes(from))throw new Error("Upstream file drift in "+file+": "+from.slice(0,90));
  return content.replace(from,to);
}

update("index.html",(source)=>{
  const file="index.html";
  // Remove all ad networks, ad shield and advertising/analytics trackers. Preserve
  // Turnstile's script, which the multiplayer join process still needs.
  const sdkStart=source.indexOf("    <!-- CrazyGames SDK -->");
  const turnstile=source.indexOf("    <!-- Cloudflare Turnstile -->",sdkStart);
  if(sdkStart<0||turnstile<sdkStart)throw Error("WorldPvP SDK section changed");
  source=source.slice(0,sdkStart)+source.slice(turnstile);
  const adStart=source.indexOf("    <!-- AdShield -->");
  const headEnd=source.indexOf("  </head>",adStart);
  if(adStart<0||headEnd<adStart)throw Error("WorldPvP advertisement section changed");
  source=source.slice(0,adStart)+source.slice(headEnd);
  // Never reserve screen space for absent advertising.
  source=replaceOnce(source,"<html lang=\"en\" class=\"h-full preload\"",
    "<html lang=\"en\" class=\"h-full preload worldpvp-adfree\"",file);
  source=replaceOnce(source,
    "    <!-- Preload styles -->",
    "    <style>html.worldpvp-adfree{--top-ad-height:0px!important;--top-ad-pad:0px!important}html.worldpvp-adfree #adBanner,html.worldpvp-adfree [id^=\"pw-oop\"],html.worldpvp-adfree #in-game-promo-container{display:none!important}</style>\n    <!-- Preload styles -->",file);
  return source;
});
update("src/client/Main.ts",(source)=>{
  const file="src/client/Main.ts";
  const old=[
    '      const isAdFree =',
    '        userMeResponse !== false && userMeResponse.player?.adfree === true;',
    '      window.adsEnabled =',
    '        !isAdFree && !gamePortal.isOnGamePortal() && !isDesktopShell();'
  ].join("\n");
  // Home and in-game ad components rely on this switch; keeping it false also
  // prevents Admiral's adblock popup and ad tracking from initializing.
  return replaceOnce(source,old,
    '      // Self-hosted WorldPvP does not run ads or adblock prompts.\n      window.adsEnabled = false;',file);
});
update("src/server/MapPlaylist.ts",(source)=>{
  const file="src/server/MapPlaylist.ts";
  const old="    const trusted = this.scheduled % TRUSTED_PUBLIC_EVERY === 0;";
  // No scheduled public lobby is trust-gated. The original server-side join
  // authorization still exists for unrelated access policies and moderation.
  return replaceOnce(source,old,
    '    const trusted = process.env.WORLDPVP_TRUSTED_LOBBIES === "1" && this.scheduled % TRUSTED_PUBLIC_EVERY === 0;',file);
});
console.log("WorldPvP original interface preserved, ad loading disabled and public games open to guests.");
