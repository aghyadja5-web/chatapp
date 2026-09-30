let token=localStorage.token||"",me=null,current=null,ws=null;
const $=id=>document.getElementById(id);
async function api(url,opt={}){opt.headers={...(opt.headers||{}),...(token?{Authorization:"Bearer "+token}:{})};if(opt.body&&typeof opt.body!=="string"){opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(opt.body)}const r=await fetch(url,opt);const d=await r.json();if(!r.ok)throw Error(d.error||"Error");return d}
async function login(){try{const d=await api("/api/login",{method:"POST",body:{username:$("user").value,password:$("pass").value}});start(d)}catch(e){$("err").textContent=e.message}}
async function register(){try{const d=await api("/api/register",{method:"POST",body:{username:$("user").value,password:$("pass").value,name:$("name").value||$("user").value}});start(d)}catch(e){$("err").textContent=e.message}}
async function start(d){token=d.token;localStorage.token=token;me=d.user;$("auth").classList.add("hidden");$("app").classList.remove("hidden");await users()}
function logout(){localStorage.removeItem("token");location.reload()}
async function users(){if(!token)return;const q=$("search").value.toLowerCase();const us=await api("/api/users");$("users").innerHTML=us.filter(u=>(u.name+" "+u.username).toLowerCase().includes(q)).map(u=>`<div class="user" onclick="openUser('${u.id}','${esc(u.name)}')"><b>${esc(u.name)}</b><br><small>@${esc(u.username)}</small></div>`).join("")}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function openUser(uid,name){current=await api("/api/chats/direct",{method:"POST",body:{user_id:uid}});$("title").textContent=name;await load();if(ws)ws.close();ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);ws.onopen=()=>ws.send(JSON.stringify({type:"subscribe",chatId:current.id}));ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.type==="message")renderMessage(x.message)}}
async function load(){const ms=await api("/api/chats/"+current.id+"/messages");$("msgs").innerHTML="";ms.forEach(renderMessage);$("msgs").scrollTop=$("msgs").scrollHeight}
function renderMessage(m){const div=document.createElement("div");div.className="msg "+(m.user_id===me.id?"me":"");div.dataset.id=m.id;div.textContent=m.text;$("msgs").appendChild(div);$("msgs").scrollTop=$("msgs").scrollHeight}
async function send(){if(!current)return;const t=$("text").value.trim();if(!t)return;$("text").value="";await api("/api/chats/"+current.id+"/messages",{method:"POST",body:{text:t}})}
if(token)api("/api/me").then(u=>start({token,user:u})).catch(()=>logout());
