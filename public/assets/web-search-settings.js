(() => {
 "use strict";
 const panel=document.getElementById("boltAiPanel");
 if(!panel)return;
 const head=panel.querySelector(".bolt-aux-head");
 const button=document.createElement("button");
 button.type="button";button.className="bolt-aux-btn ai-search-config";
 button.id="boltSearchSetup";button.title="Configure Tavily or Brave web search";
 button.textContent="Web setup";
 head.insertBefore(button,head.querySelector("#boltAiSize"));
 const dialog=document.createElement("dialog");
 dialog.className="ai-search-dialog";dialog.id="aiSearchDialog";
 dialog.setAttribute("aria-labelledby","aiSearchDialogTitle");
 dialog.innerHTML='<section class="ai-search-shell"><header><div><small>LIGHTNING AI · WEB ACCESS</small><h2 id="aiSearchDialogTitle">Connect web search</h2></div>'+
  '<button id="aiSearchClose" type="button" aria-label="Close search settings">×</button></header>'+
  '<p class="ai-search-description">Search keys are different from the AI model key. Choose a provider, save its API key securely to your account, then test the connection.</p>'+
  '<div class="ai-search-provider-state" id="aiProviderStatus" role="status">Checking search providers…</div>'+
  '<form id="aiSearchKeyForm"><label for="aiSearchProvider">Search service</label>'+
  '<select id="aiSearchProvider" name="provider"><option value="tavily">Tavily Search</option><option value="brave">Brave Search</option></select>'+
  '<label for="aiSearchKey">API key</label><input id="aiSearchKey" name="key" type="password" autocomplete="off" spellcheck="false" required minlength="10" maxlength="300" placeholder="Paste API key here" />'+
  '<p class="ai-search-note">Stored encrypted on Lightning’s server, tied to your account. Your key is never displayed again. It is sent only to the chosen search provider during requests.</p>'+
  '<div class="ai-search-actions"><button type="submit" class="ai-search-primary">Save key</button>'+
  '<button type="button" id="aiSearchTest">Test connection</button><button type="button" id="aiSearchRemove">Remove my key</button></div></form>'+
  '<div id="aiSearchFeedback" class="ai-search-feedback" role="status" aria-live="polite"></div></section>';
 document.body.append(dialog);
 const $=selector=>dialog.querySelector(selector);
 async function api(path,method="GET",body=null){
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"The search settings request failed.");
  return data;
 }
 const status=$("#aiProviderStatus"),feedback=$("#aiSearchFeedback"),provider=$("#aiSearchProvider");
 const statusMessage=data=>{
  status.innerHTML=["tavily","brave"].map(key=>{
   const label=key==="tavily"?"Tavily":"Brave Search";
   const ready=data?.[key],location=data?.source?.[key];
   return '<div><span>'+label+'</span><strong class="'+(ready?"ready":"missing")+'">'+
    (ready?(location==="server"?"Server configured":"Key saved"):"No key configured")+'</strong></div>';
  }).join("");
 };
 async function refresh(){
  try{statusMessage(await api("/api/ai/search-settings"));}catch(error){status.textContent=error.message;}
 }
 function report(message,success){feedback.textContent=message;feedback.classList.toggle("success",!!success);}
 button.addEventListener("click",()=>{report("");dialog.showModal();void refresh();});
 $("#aiSearchClose").addEventListener("click",()=>dialog.close());
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
 $("#aiSearchKeyForm").addEventListener("submit",async event=>{
  event.preventDefault();const key=$("#aiSearchKey").value.trim();
  if(!key)return;
  const btn=event.submitter;btn.disabled=true;
  try{
   await api("/api/ai/search-settings","POST",{provider:provider.value,key});
   $("#aiSearchKey").value="";
   await refresh();report("Key saved. Select Test connection to verify it.",true);
  }catch(error){report(error.message,false);}
  finally{btn.disabled=false;}
 });
 $("#aiSearchTest").addEventListener("click",async()=>{
  const b=$("#aiSearchTest");b.disabled=true;report("Checking the provider…");
  try{
   const res=await api("/api/ai/search-test","POST",{provider:provider.value});
   report(res.ok?"Connected to "+(provider.value==="tavily"?"Tavily":"Brave")+
    " · "+res.sourceCount+" search results returned.":res.error||"No usable results.",res.ok);
  }catch(error){report(error.message,false);}
  finally{b.disabled=false;}
 });
 $("#aiSearchRemove").addEventListener("click",async()=>{
  const name=provider.value,yes=confirm("Remove your saved "+name+" key?");
  if(!yes)return;
  try{await api("/api/ai/search-settings/"+name,"DELETE");await refresh();report("Saved key removed.",true);}
  catch(error){report(error.message,false);}
 });
})();
