const errorBox = document.getElementById("authError");
const tabs = [...document.querySelectorAll("[data-auth-tab]")];
const forms = [...document.querySelectorAll("[data-auth-form]")];
const pending = document.getElementById("authPending");

function setTab(name) {
  tabs.forEach(button => button.classList.toggle("active",button.dataset.authTab === name));
  forms.forEach(form => form.classList.toggle("active",form.dataset.authForm === name));
  pending.classList.remove("active");
  errorBox.textContent = "";
}
async function request(url,body) {
  const res = await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const json = await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.error || "Something went wrong.");
  return json;
}
tabs.forEach(tab => tab.addEventListener("click",()=>setTab(tab.dataset.authTab)));
document.getElementById("accountForm").addEventListener("submit",async event=>{
  event.preventDefault();errorBox.textContent="";
  const button=event.currentTarget.querySelector("[type=submit]");
  button.disabled=true;
  try {
    await request("/api/login",{
      username:document.getElementById("loginUsername").value,
      password:document.getElementById("loginPassword").value
    });
    const invite=new URLSearchParams(location.search).get("invite");
    location.replace(invite&&/^[a-f0-9]{32}$/.test(invite)?"/workspace?invite="+invite:"/workspace");
  } catch(error) { errorBox.textContent=error.message;button.disabled=false; }
});
document.getElementById("registerForm").addEventListener("submit",async event=>{
  event.preventDefault();errorBox.textContent="";
  const form=event.currentTarget,button=form.querySelector("[type=submit]");
  const username=document.getElementById("registerUsername").value.trim();
  const password=document.getElementById("registerPassword").value;
  if(password!==document.getElementById("registerConfirm").value){
    errorBox.textContent="Your passwords do not match.";return;
  }
  button.disabled=true;
  try{
    await request("/api/register",{username,password});
    forms.forEach(form=>form.classList.remove("active"));
    tabs.forEach(button=>button.classList.remove("active"));
    pending.classList.add("active");
    form.reset();
  }catch(error){errorBox.textContent=error.message}
  finally{button.disabled=false}
});
document.getElementById("pendingSignIn").addEventListener("click",()=>setTab("account"));

document.querySelectorAll("[data-password-toggle]").forEach(button=>{
 button.addEventListener("click",()=>{
  const fields=button.dataset.passwordToggle.split(",").map(id=>document.getElementById(id)).filter(Boolean);
  const show=fields[0]?.type==="password";
  for(const field of fields)field.type=show?"text":"password";
  button.setAttribute("aria-pressed",String(show));button.textContent=show?"Hide password":"Show password";
 });
});
