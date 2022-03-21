const path=require("path");
const fs=require("fs");
const db=require("quick.db");
const http=require("http");
const express=require("express");
const socketio=require("socket.io");
const nodemailer=require("nodemailer");
const{Session}=require("api-ecoledirecte");
const app=express();
const server=http.createServer(app);
const io=socketio(server);
app.use(express.static(path.join(__dirname,"public"),{extensions:["html"]}));
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({extended:true}));
const users={};
const codes=new Map();
io.setMaxListeners(100);
io.on("connection",socket=>{
  socket.setMaxListeners(100);
  (db.get("cache")||[]).forEach(messageData=>socket.emit("message",messageData));
  socket.emit("message",{
    content:"Vous avez rejoint",
    attachments:[],
    user:{
      username:"Bot",
      avatar:"images/default/bot.png",
      bot:true
    }
  });
  socket.on("member-update",memberId=>{
    const user={...db.get(`users.${memberId}`),id:memberId};
    users[socket.id]=user;
    io.emit("status-update",Object.values(users),Object.entries(db.get("users")||[]).map(e=>({...e[1],id:e[0]})));
    socket.emit("user-data",user);
  });
  socket.on("send-message",messageData=>{
    const cache=db.get("cache")||[];
    if(cache.length>=300)cache.shift();
    cache.push(messageData);
    db.set("cache",cache);
    socket.broadcast.emit("message",messageData);
  });
  socket.on("edit-avatar",avatarData=>{
    const member=users[socket.id];
    const data=avatarData.replace(/^data:image\/\w+;base64,/,"");
    const buffer=Buffer.from(data,"base64");
    const filePath=path.join("images","avatars",`${member?.id||socket.id}.png`);
    fs.writeFileSync(path.join(__dirname,"public",filePath),buffer);
    if(member)db.set(`users.${member.id}.avatar`,filePath);
    socket.emit("avatar-edited",filePath);
  });
  socket.on("create-attachment",attachmentData=>{
    const data=attachmentData.buffer.replace(/^data:image\/\w+;base64,/,"");
    const buffer=Buffer.from(data,"base64");
    const filePath=path.join(__dirname,"public","images","attachments",`${attachmentData.id}.png`);
    fs.writeFileSync(filePath,buffer);
    attachmentData.path=path.join("images","attachments",`${attachmentData.id}.png`);
    socket.emit("attachment-loaded",attachmentData);
  });
  socket.on("edit-background",backgroundData=>{
    const member=users[socket.id];
    const data=backgroundData.replace(/^data:image\/\w+;base64,/,"");
    const buffer=Buffer.from(data,"base64");
    const filePath=path.join("images","backgrounds",`${member?.id||socket.id}.png`);
    fs.writeFileSync(path.join(__dirname,"public",filePath),buffer);
    if(member)db.set(`users.${member.id}.background`,filePath);
    socket.emit("background-loaded",backgroundData);
  });
  socket.on("ecoledirecte-credentials",(id,password)=>{
    const member=users[socket.id];
    if(!member)return;
    db.set(`users.${member.id}.ecoledirecte`,{id,password});
  });
  socket.on("disconnect",()=>{
    delete users[socket.id];
    io.emit("status-update",Object.entries(db.get("users")||[]).map(e=>({...e[1],id:e[0]})));
  });
});
const toUsername=s=>s.replace(/([a-z]{1})\.(.*?)@classestaspais\.fr/,(_,i,l)=>`${l[0].toUpperCase()+l.slice(1)}.${i.toUpperCase()}`);
function generateCode(){
  const code=Math.floor(Math.random()*899999)+1e5;
  if(codes.has(code))return generateCode();
  return code;
};
app.post("/api/verify",(req,res)=>{
  if(!req.body?.length)return res.send({error:"Écris ton addresse email"});
  // if(toUsername(req.body)==req.body)return res.send({error:"Utilise l'addresse email du lycée"});
  const code=generateCode();
  nodemailer.createTransport({
    service:"gmail",
    auth:{
      user:"automailchatbox@gmail.com",
      pass:"!4R!}z^E;~H$SsC+"
    },
    tls:{
      rejectUnauthorized:false
    }
  }).sendMail({
    from:"automailchatbox@gmail.com",
    to:req.body,
    subject:"noreply",
    text:`Bonjour, ${toUsername(req.body)} le code est:\n\n${code}\n\n(code valable 10 minutes)`
  },error=>{
    if(error)return res.send({error:"Échec de l'envoi de l'email"});
    codes.set(code,req.body);
    res.send({msg:"Success"});
    setTimeout(()=>{
      codes.delete(code);
    },6e5);
  });
});
app.post("/api/code/use/:code",(req,res)=>{
  const username=toUsername(req.body);
  const email=req.body;
  const id=(Math.floor(Math.random()*8999999999999999)+1e15).toString();
  const authorized=codes?.get(Number(req.params.code))==req.body;
  if(authorized){
    codes.delete(Number(req.params.code));
    const user=Object.entries(db.get("users")||{}).find(e=>e[1].email==email);
    if(user){
      res.send({authorized,id:user[0],username});
    }else{
      db.set(`users.${id}`,{
        username:username,
        email:email,
        createdAt:Date.now(),
        avatar:null,
        backgruond:null,
        ecoledirecte:{id:null,password:null}
      });
      res.send({authorized,id,username});
    };
  }else{
    res.send({authorized});
  };
});
app.post("/api/ecoledirecte/schedule",async(req,res)=>{
  const{identifiant,motdepasse}=JSON.parse(req.body);
  if(!identifiant||!motdepasse)return res.send({data:"Nom d'utilisateur ou mot de passe non renseigné."});
  const session=new Session();
  var error;
  await session.login(identifiant,motdepasse).catch(e=>error=e);
  if(error){
    res.send({data:error});
  }else{
    const date=new Date();
    const now=date.getTime();
    session.accounts[0]?.fetchEDT(date)
    .then(data=>{
      const lesson=data.find(l=>
        (new Date(l.start_date).getTime()<now)&&(now<new Date(l.end_date).getTime())&&
        !l.isAnnule
      );
      res.send({
        data:lesson,
        timeout:lesson?.end_date?
          new Date(lesson.end_date).getTime()-now+5e3:
          6e4
      });
    })
    .catch(error=>{
      res.send({data:error});
    });
  };
});
const PORT=process.env.PORT;
server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
