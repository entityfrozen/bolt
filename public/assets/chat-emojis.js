/* Searchable emoji picker shared by room reactions and message composition. */
import {icon} from "./ui-icons.js?v=2";

export const EMOJI_GROUPS=[
 ["Popular",[["❤️","heart love"],["😂","laugh laughing"],["🔥","fire"],["👍","thumbs up"],["👀","eyes"],["🎉","party celebrate"]]],
 ["Faces",[["🤣","rolling laugh"],["🥹","moved"],["😍","heart eyes"],["😎","cool"],["😭","crying"],["😢","sad"],["😮","surprised"],["😡","angry"],["😅","relieved"],["😬","awkward"],["😏","smirk"],["🤯","mind blown"],["🤔","thinking"],["😴","sleep"]]],
 ["Gestures",[["👎","thumbs down"],["👏","clap"],["🙏","thanks pray"],["🤝","handshake"],["🫶","heart hands"],["👋","wave"]]],
 ["Symbols",[["💯","one hundred"],["✨","sparkles"],["⚡","lightning"],["🚀","rocket"],["💜","purple heart"],["🤍","white heart"],["💚","green heart"],["✅","yes check"],["❌","no cross"],["💀","skull"]]]
];
export const EMOJI_SET=new Set(EMOJI_GROUPS.flatMap(([,items])=>items.map(([emoji])=>emoji)));
const escapeText=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function reactionChips(message,myId,kind){
 const entries=Object.entries(message.reactions||{}).filter(([,ids])=>Array.isArray(ids)&&ids.length);
 if(!entries.length)return "";
 return '<div class="dc-reactions" aria-label="Reactions">'+entries.map(([emoji,ids])=>
  '<button type="button" class="dc-reaction'+(ids.includes(myId)?" selected":"")+'" data-dc="react" data-kind="'+kind+
  '" data-id="'+escapeText(message.id)+'" data-emoji="'+escapeText(emoji)+'" aria-pressed="'+ids.includes(myId)+'" title="React '+escapeText(emoji)+'">'+
  '<span>'+escapeText(emoji)+'</span><b>'+ids.length+'</b></button>').join("")+
  '<button type="button" class="dc-add-reaction" data-dc="picker" data-kind="'+kind+'" data-id="'+escapeText(message.id)+'" title="Add reaction" aria-label="Add reaction">'+icon("smile-plus")+'</button></div>';
}
export class ChatEmojiPicker{
 constructor(){
  this.element=document.createElement("div");
  const root=this.element;
  root.id="lightningReactionPicker";root.className="dc-emoji-picker";
  root.setAttribute("popover","auto");
  root.setAttribute("aria-label","Choose an emoji");
  root.innerHTML='<header class="dc-picker-head"><strong>Pick an emoji</strong><button type="button" data-picker-close aria-label="Close">'+icon("x")+'</button></header>'+
   '<input type="search" class="dc-picker-search" placeholder="Search emoji" autocomplete="off" aria-label="Search emoji">'+
   '<div class="dc-picker-content"></div><div class="dc-picker-tip">Select an emoji to react</div>';
  document.body.append(root);
  this.search=root.querySelector("input");
  this.results=root.querySelector(".dc-picker-content");
  root.addEventListener("input",()=>this.draw(this.search.value));
  root.addEventListener("click",event=>{
   const close=event.target.closest("[data-picker-close]");
   if(close){this.hide();return;}
   const button=event.target.closest("[data-picker-emoji]");
   if(!button)return;
   this.callback?.(button.dataset.pickerEmoji);
   this.hide();
  });
  root.addEventListener("keydown",event=>{
   const buttons=[...this.results.querySelectorAll("[data-picker-emoji]")];
   if(event.key==="ArrowDown"&&event.target===this.search&&buttons.length){
    event.preventDefault();buttons[0].focus();return;
   }
   if(!buttons.includes(document.activeElement))return;
   const delta={ArrowUp:-8,ArrowDown:8,ArrowRight:1,ArrowLeft:-1}[event.key];
   if(delta!==undefined){
    event.preventDefault();
    const i=buttons.indexOf(document.activeElement);
    buttons[Math.min(buttons.length-1,Math.max(0,i+delta))]?.focus();
   }
  });
  this.draw("");
 }
 draw(query){
  const q=String(query||"").trim().toLowerCase();
  this.results.innerHTML=EMOJI_GROUPS.map(([name,items])=>{
   const filtered=items.filter(([emoji,label])=>!q||name.toLowerCase().includes(q)||label.includes(q)||emoji.includes(q));
   return !filtered.length?"":'<section class="dc-picker-group"><h3>'+name+'</h3><div class="dc-picker-grid">'+
    filtered.map(([emoji,label])=>'<button type="button" data-picker-emoji="'+escapeText(emoji)+'" title="'+escapeText(label)+'" aria-label="'+escapeText(label)+'">'+escapeText(emoji)+'</button>').join("")+
    '</div></section>';
  }).join("")||'<p class="dc-picker-empty">No emoji found.</p>';
 }
 open(button,callback){
  this.callback=callback;
  this.search.value="";this.draw("");
  const root=this.element;
  if(root.matches(":popover-open"))root.hidePopover();
  if(typeof root.showPopover==="function")root.showPopover();else root.hidden=false;
  const box=button.getBoundingClientRect(),width=322,height=380;
  const left=Math.max(12,Math.min(window.innerWidth-width-12,box.right-width));
  const top=box.bottom+height+10<window.innerHeight?box.bottom+8:Math.max(10,box.top-height-8);
  Object.assign(root.style,{left:left+"px",top:top+"px",right:"auto",bottom:"auto"});
  this.search.focus();
 }
 hide(){
  if(this.element.matches(":popover-open"))this.element.hidePopover();
  else this.element.hidden=true;
 }
}
