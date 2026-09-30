const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data.json");
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

function load(){
  try { return JSON.parse(fs.readFileSync(DATA,"utf8")); }
  catch { return {users:[],chats:[],members:[],messages:[],reactions:[]}; }
}
let db=load();
function save(){ fs.writeFileSync(DATA,JSON.stringify(db,null,2)); }
function id(){return crypto.randomBytes(10).toString("hex")}
function hash(p){return crypto.createHash("sha256").update(String(p)).digest("hex")}
const sessions=new Map();

function auth(req,res,next){
  const token=(req.headers.authorization||"").replace("Bearer ","");
  const uid=sessions.get(token);
  if(!uid) return res.status(401).json({error:"Unauthorized"});
  req.user=db.users.find(x=>x.id===uid);
  if(!req.user) return res.status(401).json({error:"Unauthorized"});
  next();
}
function member(chatId,userId){return db.members.some(m=>m.chat_id===chatId&&m.user_id===userId)}
function broadcast(chatId,event){
  const msg=JSON.stringify(event);
  wss.clients.forEach(c=>{if(c.readyState===WebSocket.OPEN && c.chatId===chatId)c.send(msg)})
}

app.post("/api/register",(req,res)=>{
  const username=String(req.body.username||"").trim().toLowerCase();
  const password=String(req.body.password||"");
  const name=String(req.body.name||username).trim();
  if(username.length<3||password.length<6)return res.status(400).json({error:"Username min 3, password min 6"});
  if(db.users.some(u=>u.username===username))return res.status(409).json({error:"Username sudah digunakan"});
  const u={id:id(),username,name,password_hash:hash(password),created_at:Date.now()};
  db.users.push(u);save();
  const token=id();sessions.set(token,u.id);
  res.json({token,user:{id:u.id,username:u.username,name:u.name}});
});
app.post("/api/login",(req,res)=>{
  const username=String(req.body.username||"").trim().toLowerCase(), password=String(req.body.password||"");
  const u=db.users.find(x=>x.username===username&&x.password_hash===hash(password));
  if(!u)return res.status(401).json({error:"Login gagal"});
  const token=id();sessions.set(token,u.id);
  res.json({token,user:{id:u.id,username:u.username,name:u.name}});
});
app.get("/api/me",auth,(req,res)=>res.json({id:req.user.id,username:req.user.username,name:req.user.name}));
app.get("/api/users",auth,(req,res)=>res.json(db.users.filter(u=>u.id!==req.user.id).map(({password_hash,...u})=>u)));

app.post("/api/chats/direct",auth,(req,res)=>{
  const other=db.users.find(u=>u.id===req.body.user_id);
  if(!other)return res.status(404).json({error:"User tidak ditemukan"});
  let c=db.chats.find(c=>c.type==="direct"&&db.members.filter(m=>m.chat_id===c.id).map(m=>m.user_id).sort().join(",")===[req.user.id,other.id].sort().join(","));
  if(!c){c={id:id(),type:"direct",title:other.name,created_at:Date.now()};db.chats.push(c);db.members.push({chat_id:c.id,user_id:req.user.id},{chat_id:c.id,user_id:other.id});save()}
  res.json(c);
});
app.post("/api/chats/group",auth,(req,res)=>{
  const title=String(req.body.title||"Grup").trim();
  const ids=[req.user.id,...(Array.isArray(req.body.user_ids)?req.body.user_ids:[])].filter((v,i,a)=>a.indexOf(v)===i);
  const c={id:id(),type:"group",title,created_at:Date.now(),owner_id:req.user.id};
  db.chats.push(c);ids.forEach(user_id=>db.members.push({chat_id:c.id,user_id}));save();res.json(c);
});
app.get("/api/chats",auth,(req,res)=>{
  const ids=db.members.filter(m=>m.user_id===req.user.id).map(m=>m.chat_id);
  res.json(db.chats.filter(c=>ids.includes(c.id)));
});
app.get("/api/chats/:id/messages",auth,(req,res)=>{
  if(!member(req.params.id,req.user.id))return res.status(403).json({error:"Forbidden"});
  res.json(db.messages.filter(m=>m.chat_id===req.params.id).slice(-200));
});
app.post("/api/chats/:id/messages",auth,(req,res)=>{
  const chatId=req.params.id;
  if(!member(chatId,req.user.id))return res.status(403).json({error:"Forbidden"});
  const text=String(req.body.text||"").trim();
  if(!text)return res.status(400).json({error:"Pesan kosong"});
  const m={id:id(),chat_id:chatId,user_id:req.user.id,text,created_at:Date.now(),edited:false};
  db.messages.push(m);save();broadcast(chatId,{type:"message",message:m});res.json(m);
});
app.patch("/api/messages/:id",auth,(req,res)=>{
  const m=db.messages.find(x=>x.id===req.params.id);
  if(!m||m.user_id!==req.user.id)return res.status(404).json({error:"Pesan tidak ditemukan"});
  m.text=String(req.body.text||"").trim();m.edited=true;save();broadcast(m.chat_id,{type:"edit",message:m});res.json(m);
});
app.delete("/api/messages/:id",auth,(req,res)=>{
  const i=db.messages.findIndex(x=>x.id===req.params.id);
  if(i<0||db.messages[i].user_id!==req.user.id)return res.status(404).json({error:"Pesan tidak ditemukan"});
  const m=db.messages[i];db.messages.splice(i,1);save();broadcast(m.chat_id,{type:"delete",id:m.id});res.json({ok:true});
});
app.post("/api/messages/:id/react",auth,(req,res)=>{
  const m=db.messages.find(x=>x.id===req.params.id); if(!m)return res.status(404).json({error:"Pesan tidak ditemukan"});
  const emoji=String(req.body.emoji||"👍");
  const key=db.reactions.findIndex(r=>r.message_id===m.id&&r.user_id===req.user.id);
  if(key>=0)db.reactions[key].emoji=emoji;else db.reactions.push({message_id:m.id,user_id:req.user.id,emoji});
  save();broadcast(m.chat_id,{type:"reaction",message_id:m.id,emoji,user_id:req.user.id});res.json({ok:true});
});
wss.on("connection",ws=>{
  ws.on("message",raw=>{try{const x=JSON.parse(raw);if(x.type==="subscribe")ws.chatId=x.chatId}catch{}})
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public/index.html")));
server.listen(PORT,()=>console.log("ChatApp online on port "+PORT));
