/* Compact, safe names shared by Lightning's account and community UIs. */
(function(){
 "use strict";
 const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 function label(name,username){
  const nick=String(name??"").trim(),handle=String(username??"").trim().replace(/^@/,"");
  const visible=nick||handle||"Member";
  if(!handle||visible.toLowerCase()===handle.toLowerCase())return esc(visible);
  return esc(visible)+',<small class="lightning-username">'+esc(handle)+'</small>';
 }
 window.LightningNames={label};
})();
