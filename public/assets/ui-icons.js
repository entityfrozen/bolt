// Small, consistent outline icon set, based on the public Lucide SVG icon style.
// These icons are presentation-only. Actions and accessible names live on buttons.
const PATHS={
 "layout-dashboard":'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 "messages-square":'<path d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3V6a2 2 0 0 1 2-2Z"/><path d="M8 10h9M8 14h7"/>',
 "scroll-text":'<path d="M8 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8v14a4 4 0 0 1-4 4"/><path d="M8 17H3a2 2 0 0 0 0 4h5M12 8h6M12 12h6"/>',
 "arrow-left":'<path d="M19 12H5M12 19l-7-7 7-7"/>',
 "refresh-cw":'<path d="M20 7a8 8 0 0 0-14-2L4 7M4 2v5h5M4 17a8 8 0 0 0 14 2l2-2M20 22v-5h-5"/>',
 "x":'<path d="m18 6-12 12M6 6l12 12"/>',
 "user-check":'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0M17 11l2 2 3-4"/>',
 "clock-3":'<circle cx="12" cy="12" r="9"/><path d="M12 6v6h5"/>',
 "check-circle":'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 "plus-circle":'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 "user-plus":'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0M19 8v8M15 12h8"/>',
 "shield-alert":'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="M12 7v6M12 17h.01"/>',
 "shield-off":'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m4 4 16 16"/>',
 "globe":'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18M12 3c6 6 6 12 0 18"/>',
 "headphones":'<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H3v6h4v-6H4ZM20 13h1v6h-4v-6h3Z"/>',
 "inbox":'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>',

 "bolt":'<path d="m13 2-3 8H4l10 12 1-8h5L13 2Z"/>',
 "youtube":'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
 "link":'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.3 4.6M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  "home":'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
 "hash":'<path d="M4 9h16M4 15h16M11 3 7 21M17 3l-4 18"/>',
 "megaphone":'<path d="m3 11 18-5v12l-18-5v-2ZM3 11v2"/><path d="m8 14 1 6h4l-2-5M21 6v12"/>',
 "book-open":'<path d="M12 7v14M3 18V5c4-2 7-1 9 2 2-3 5-4 9-2v13c-4-2-7-1-9 3-2-4-5-5-9-3Z"/>',
 "message-circle":'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5A8.4 8.4 0 0 1 8 18.7L3 21l1.9-5A8.5 8.5 0 1 1 21 11.5Z"/>',
 "gamepad-2":'<path d="m6 12-2-1c-3 3-2 8 0 9 2 1 5-2 8-2s6 3 8 2c2-1 3-6 0-9l-2 1H6Z"/><path d="M9 14v4M7 16h4"/><circle cx="16" cy="14" r=".75"/><circle cx="18" cy="16" r=".75"/>',
 "compass":'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
 "search":'<circle cx="10.8" cy="10.8" r="7.8"/><path d="m16.5 16.5 5 5"/>',
 "settings":'<path d="M12 3.2 13.7 5l2.4.5 2.4-1 2 3.5-1.8 2 .1 2.4 1.8 2-2 3.5-2.4-1-2.4.5-1.7 1.8-3.5-2-.4-2.4-2-1.4v-4l2-1.4.4-2.4 3.5-2Z"/><circle cx="12" cy="12" r="3"/>',
 "panel-right":'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
 "plus":'<path d="M12 5v14M5 12h14"/>',
 "shield-check":'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
 "lock-keyhole":'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
 "chevron-down":'<path d="m6 9 6 6 6-6"/>',
 "chevron-right":'<path d="m9 6 6 6-6 6"/>',
 "arrow-up-right":'<path d="M7 17 17 7M7 7h10v10"/>',
 "users":'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M17 14c3 0 5 2 5 5v2"/>',
 "crown":'<path d="m2 8 4 5 6-8 6 8 4-5-2 12H4L2 8Z"/>',
 "swords":'<path d="m14 5 5 5M16 2l6 6-9 9M5 14l5 5M2 16l6 6 9-9"/><path d="M4 8 8 4l12 12-4 4L4 8Z"/>',
 "grid-2x2":'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 "bomb":'<circle cx="11" cy="14" r="7"/><path d="m15 8 2-2 3 3M18 3v2M21 5l-2 2"/>',
 "hand":'<path d="M8 13V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7H9c-3 0-4-2-6-6a2 2 0 0 1 4-2l1 2"/>',
 "chess-knight":'<path d="M7 20h14v2H4v-2h3Zm0 0L5 8l5-5 2 4 4 1 3 5v7H7Zm-2-8 5 1"/><circle cx="11" cy="9" r=".8"/>',
 "sparkles":'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/>',
 "monitor":'<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/>',
 "menu":'<path d="M4 6h16M4 12h16M4 18h16"/>',
 "edit-3":'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-5 1 1-5L16.5 3.5Z"/>',
 "trash-2":'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7M14 10v7"/>',
 "sliders-horizontal":'<path d="M4 7h7M15 7h5M4 17h3M11 17h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 "bell":'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4"/>',
 "check":'<path d="m5 12 4 4L19 6"/>',
 "log-out":'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 "list":'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 "smile-plus":'<circle cx="11" cy="11" r="8"/><path d="M8 13c1.4 2 4.7 2 6 0M8 9h.01M14 9h.01M20 17v6M17 20h6"/>',
 "reply":'<path d="m9 17-6-5 6-5M3 12h10a7 7 0 0 1 7 7v1"/>',
 "pin":'<path d="m16 3 5 5-3 1-2 5-3 3-6-6 3-3 5-2 1-3ZM10 14 3 21"/>',
 "more-horizontal":'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 "copy":'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
 "send":'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
 "bookmark":'<path d="M6 3h12v18l-6-4-6 4V3Z"/>'
};
export function icon(name,className=""){
 const path=PATHS[name]||PATHS["hash"];
 const cls=String(className||"").replace(/[^a-zA-Z0-9 _-]/g,"");
 return '<svg class="ui-icon'+(cls?" "+cls:"")+'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
}
export function serverIcon(value){
 if(typeof value==="string"&&PATHS[value])return icon(value);
 return String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])).slice(0,4);
}
