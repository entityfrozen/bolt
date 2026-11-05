/* Open Lightning in a user-created about:blank shell.
 * A blank address bar is only a presentation option, not an anonymity feature.
 * The original site is still loaded by a same-origin iframe.
 */
(function(){
 "use strict";
 const UPDATE="lightning:cloak-identity";
 const safeIcon=(value)=>{
  try{
   const url=new URL(String(value||""),location.origin);
   return ["https:","http:"].includes(url.protocol)?url.href:new URL("/favicon.svg",location.origin).href;
  }catch{return new URL("/favicon.svg",location.origin).href;}
 };
 function insideBlank(){
  if(window.parent===window)return false;
  try{return window.parent.location.href==="about:blank";}catch{return false;}
 }
 function open(){
  if(insideBlank())return {ok:true,alreadyOpen:true};
  let tab;
  try{tab=window.open("about:blank","_blank");}
  catch{return {ok:false,reason:"blocked"};}
  if(!tab)return {ok:false,reason:"blocked"};
  try{
   const doc=tab.document;
   // The new document remains about:blank. Its iframe loads the actual app.
   doc.open();
   doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tab</title>'+
    '<style>html,body{height:100%;margin:0;overflow:hidden;background:#111827}'+
    'iframe{display:block;width:100%;height:100%;border:0;position:fixed;inset:0}'+
    '</style></head><body></body></html>');
   doc.close();
   doc.title=String(document.title||"Tab").slice(0,100);
   const favicon=doc.createElement("link");
   favicon.rel="icon";
   favicon.href=safeIcon(document.querySelector('link[rel="icon"]')?.href);
   doc.head.append(favicon);
   // Avoid granting the new document unnecessary access to the source tab.
   try{tab.opener=null;}catch{}
   const frame=doc.createElement("iframe");
   frame.title="Browser workspace";
   frame.setAttribute("allow","clipboard-write; fullscreen");
   frame.setAttribute("referrerpolicy","same-origin");
   frame.src=window.location.href;
   tab.addEventListener("message",event=>{
    if(event.origin!==window.location.origin||event.source!==frame.contentWindow)return;
    const info=event.data;
    if(!info||info.type!==UPDATE||typeof info.title!=="string")return;
    doc.title=info.title.slice(0,100);
    favicon.href=safeIcon(info.icon);
   });
   doc.body.append(frame);
   tab.focus();
   // An ordinary tab cannot be closed by script in most browsers. Do not blank
   // the source tab or lose the user's session when closing is disallowed.
   return {ok:true,alreadyOpen:false};
  }catch(error){
   try{tab.close();}catch{}
   return {ok:false,reason:"unavailable"};
  }
 }
 window.LightningBlankCloak={open,insideBlank};
})();
