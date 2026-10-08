const errorBox=document.getElementById("authError");
const tabs=[...document.querySelectorAll("[data-auth-tab]")];
const forms=[...document.querySelectorAll("[data-auth-form]")];

function setTab(name){
  tabs.forEach(button=>button.classList.toggle("active",button.dataset.authTab===name));
  forms.forEach(form=>form.classList.toggle("active",form.dataset.authForm===name));
  errorBox.textContent="";
}

async function embeddedStorage(){
  if(window.top===window)return;
  if(!document.requestStorageAccess)return;
  try{
    if(document.hasStorageAccess&&await document.hasStorageAccess())return;
    await document.requestStorageAccess();
  }catch{}
}

async function send(url,body){
  await embeddedStorage();
  const response=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Could not sign in");
  location.replace("/");
}

tabs.forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.authTab)));

document.getElementById("accountForm").addEventListener("submit",async event=>{
  event.preventDefault();
  errorBox.textContent="";
  try{
    await send("/api/login",{
      username:document.getElementById("loginUsername").value,
      password:document.getElementById("loginPassword").value
    });
  }catch(error){
    errorBox.textContent=error.message;
  }
});

document.getElementById("passForm").addEventListener("submit",async event=>{
  event.preventDefault();
  errorBox.textContent="";
  try{
    await send("/api/access/redeem",{code:document.getElementById("accessCode").value});
  }catch(error){
    errorBox.textContent=error.message;
  }
});

const code=new URL(location.href).searchParams.get("code");
if(code){
  setTab("pass");
  document.getElementById("accessCode").value=code;
}
