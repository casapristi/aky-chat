const appHeight=()=>{
  const doc=document.documentElement;
  doc.style.setProperty("--app-height",`${window.innerHeight}px`);
};
window.addEventListener("resize",appHeight);
appHeight();
const socket=io();
const messageField=document.getElementById("send-container");
const messageInput=document.getElementById("message-input");
const messageContainer=document.getElementById("message-container");
const avatarImage=document.getElementById("user-avatar");
const usernameField=document.getElementById("username");
const imageSelector=document.getElementById("image-selector");
const attachmentButton=document.getElementById("uplaod-file-button");
const backgroundButton=document.getElementById("edit-background");
const sendButton=document.getElementById("send-message-button");
const screenOverlay=document.getElementById("image-overlay");
const mainImage=document.getElementById("main-image");
const imageInfo=document.getElementById("file-info");
const previewField=document.getElementById("display-attachments");
const onlineMembers=document.getElementById("online-members");
const offlineMembers=document.getElementById("offline-members");
const messageManager=document.getElementById("messages-manager");
const showPassword=document.getElementById("show-password");
const ecoledirectePassword=document.getElementById("password-ecoledirecte");
const ecoledirecteId=document.getElementById("id-ecoledirecte");
const ecoledirecteForm=document.getElementById("ecoledirecte-login-form");
const ecoledirecteLoginPannel=document.getElementById("ecoledirecte-login");
const associateEcoledirecte=document.getElementById("associate-ecoledirecte");
const ecoledirecteError=document.getElementById("ecoledirecte-error");
const attachmentSelector=document.createElement("input");
const backgroundSelector=document.createElement("input");
const rootURL="https://aky-chat.herokuapp.com";
var timeouts=0;
document.body.scrollTop=document.body.scrollHeight+document.body.clientHeight;
if(!window.localStorage.getItem("id")){
  window.location.href="login";
};
var userInfos={username:"Unknown",bot:false,avatar:null};
var ecoledirecte={};
var attachments=[];
socket.emit("member-update",window.localStorage.getItem("id"));
socket.on("status-update",(users,allUsers)=>{
  const online=users;
  const offline=(allUsers||[]).filter(u=>!online.find(user=>user.id==u.id));
  onlineMembers.innerHTML=`<p class="member-number">- ${online.length} membre${online.length>1?"s":""} en ligne -</p>`+online.map(u=>`
  <div class="display-member">
    <img src="${u.avatar||generateAvatar(u.username)}" alt="user-avatar" class="user-avatar all-members">
    <p class="member-username">${u.username}</p>
  </div>
  `).join("");
  offlineMembers.innerHTML=`<p class="member-number">- ${offline.length} membre${offline.length>1?"s":""} hors ligne -</p>`+offline.map(u=>`
  <div class="display-member offline">
    <img src="${u.avatar||generateAvatar(u.username)}" alt="user-avatar" class="user-avatar all-members">
    <p class="member-username">${u.username}</p>
  </div>
  `).join("");
});
function ecoledirecteLogin(id,password){
  fetch(`${rootURL}/api/ecoledirecte/schedule`,{
    method:"POST",
    body:JSON.stringify({identifiant:id,motdepasse:password})
  })
  .then(res=>res.json())
  .then(({data,timeout})=>{
    if(typeof data=="string"){
      ecoledirecteError.textContent=data;
    }else{
      delete userInfos.ecoledirecte;
      ecoledirecteError.textContent="";
      ecoledirecte=data;
      ecoledirecteLoginPannel.hidden=true;
    };
    setTimeout(()=>ecoledirecteLogin(id,password),timeout);
  });
};
socket.on("user-data",userData=>{
  userInfos=userData;
  if(userData?.ecoledirecte?.id&&userData?.ecoledirecte?.password){
    ecoledirecteLogin(userData.ecoledirecte.id,userData.ecoledirecte.password);
  };
  messageManager.style.backgroundImage=`url(${userInfos.background?.replace(/\\/g,"/")||"images/default/background.jpg"})`;
  avatarImage.src=userInfos.avatar||generateAvatar(userInfos.username);
  attachmentSelector.type="file";
  attachmentSelector.accept="image/*";
  attachmentSelector.multiple=true;
  backgroundSelector.type="file";
  backgroundSelector.accept="image/*";
  usernameField.textContent=userInfos.username;
  messageField.addEventListener("submit",event=>{
    document.body.scrollTop=document.body.scrollHeight+document.body.clientHeight;
    event.preventDefault();
    sendMessage();
  });
  avatarImage.addEventListener("click",()=>{
    imageSelector.click();
  });
  attachmentButton.addEventListener("click",()=>{
    attachmentSelector.click();
  });
  backgroundButton.addEventListener("click",()=>{
    backgroundSelector.click();
  });
  associateEcoledirecte.addEventListener("click",()=>{
    ecoledirecteLoginPannel.hidden=false;
  });
  imageSelector.addEventListener("change",()=>{
    const reader=new FileReader();
    reader.addEventListener("load",()=>{
      socket.emit("edit-avatar",reader.result);
    });
    reader.readAsDataURL(imageSelector.files[0]);
  });
  attachmentSelector.addEventListener("change",()=>{
    for(const attachment of attachmentSelector.files){
      const reader=new FileReader();
      reader.addEventListener("load",()=>{
        const attachmentData={
          buffer:reader.result,
          id:(Math.floor(Math.random()*8999999999999999)+1e15).toString(),
          name:attachment.name,
          size:attachment.size
        };
        socket.emit("create-attachment",attachmentData);
      });
      reader.readAsDataURL(attachment);
    };
  });
  backgroundSelector.addEventListener("change",()=>{
    const reader=new FileReader();
    reader.addEventListener("load",()=>{
      socket.emit("edit-background",reader.result);
    });
    reader.readAsDataURL(backgroundSelector.files[0]);
  });
  showPassword.addEventListener("click",()=>{
    if(ecoledirectePassword.type=="password"){
      ecoledirectePassword.type="text";
    }else{
      ecoledirectePassword.type="password";
    };
  });
  ecoledirecteForm.addEventListener("submit",event=>{
    event.preventDefault();
    socket.emit("ecoledirecte-credentials",ecoledirecteId.value,ecoledirectePassword.value);
    ecoledirecteLogin(ecoledirecteId.value,ecoledirectePassword.value);
  });
});
socket.on("attachment-loaded",attachmentData=>{
  if(attachments.length<10)attachments.push(attachmentData);
  previewField.hidden=false;
  const image=document.createElement("div");
  image.classList.add("image-preview");
  image.id=attachmentData.id;
  image.innerHTML=`
  <img src="${attachmentData.path}">
  <i class="fas fa-times" onclick="deleteAttachment(${attachmentData.id})"></i>
  `;
  previewField.appendChild(image);
  messageInput.focus();
});
socket.on("background-loaded",backgroundPath=>{
  messageManager.style.backgroundImage=`url(${backgroundPath})`;
});
socket.on("avatar-edited",avatarPath=>{
  userInfos.avatar=avatarPath;
  avatarImage.src=avatarPath;
});
socket.on("message",messageData=>{
  appendMessage(messageData);
});
function appendMessage(messageData){
  const shouldScroll=messageContainer.scrollTop==messageContainer.scrollHeight-messageContainer.clientHeight;
  const message=document.createElement("div");
  message.classList.add("message");
  if(messageData.user.bot)message.classList.add("bot");
  message.innerHTML=`
  <img src="${messageData.user.avatar||generateAvatar(messageData.user.username)}" class="message-avatar">
  <div class="message-textual-content">
  <p class="message-author">${messageData.user.username}${messageData.user?.room?`<span class="room">${messageData.user.room}</span>`:""}<span class="message-date">${new Date().toDateString()}</span><p>
    ${messageData.content?.length?`<p class="message-content">${markdown(messageData.content)}</p>`:""}
    ${(messageData.attachments||[]).map(attachment=>`
    <img src="${attachment.path}" class="message-attachment" alt="message-attachment" onclick="zoomImage('${JSON.stringify({path:attachment.path,name:attachment.name,size:attachment.size}).replace(/"/g,"`")}')">
    `).join("")}
  </div>
  `;
  messageContainer.append(message);
  if(shouldScroll)messageContainer.scrollTop=messageContainer.scrollHeight;
};
function deleteAttachment(attachmentId){
  document.getElementById(attachmentId).remove();
  attachments.splice(attachments.findIndex(a=>a.id==attachmentId),1);
  if(!attachments.length)previewField.hidden=true;
};
function sendMessage(){
  if(messageInput.value==""&&attachments.length==0)return;
  const messageData={
    content:messageInput.value,
    attachments:attachments,
    user:{
      ...userInfos,
      room:ecoledirecte?.salle||null
    }
  };
  const time=5;
  if(!timeouts){
    setTimeout(()=>timeouts=0,time*1e3);
  };
  timeouts++;
  if(timeouts<=time){
    appendMessage(messageData);
    socket.emit("send-message",messageData);
    previewField.hidden=true;
    attachments.forEach(attachment=>document.getElementById(attachment.id).remove());
    attachments=[];
    messageInput.value="";
  };
};
function zoomImage(image){
  image=JSON.parse(image.replace(/`/g,"\"").replace(/\\/g,"\\\\"));
  mainImage.src=image.path;
  imageInfo.textContent=`Name: ${image.name} - Size: ${image.size}px`;
  screenOverlay.hidden=false;
};
function generateAvatar(username){
  const alphabet=["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
  const colors=[
    "#49e744",
    "#d86e48",
    "#48cad8",
    "#7a48d8",
    "#c348d8",
    "#d8d148",
  ];
  const letters=username.split(/[ _\-.]/).map(w=>w[0].toUpperCase()).slice(0,3).join("");
  const canvas=document.createElement("canvas");
  canvas.height=200;
  canvas.width=200;
  const ctx=canvas.getContext("2d");
  const gradient=ctx.createLinearGradient(canvas.width/2,0,canvas.width/2,canvas.height);
  gradient.addColorStop(0,"#ff0000");
  gradient.addColorStop(.2,"#ff8800");
  gradient.addColorStop(.4,"#ffff00");
  gradient.addColorStop(.6,"#00ff00");
  gradient.addColorStop(.8,"#0000ff");
  gradient.addColorStop(1,"#8800ff");
  ctx.fillStyle=username=="Druand.W"?
    gradient:
    colors[alphabet.indexOf(username[0].toLowerCase())%5];
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.font="bold 90px Arial";
  ctx.fillStyle="#1d1d1f";
  ctx.fillText(letters,canvas.width/2,canvas.height/2);
  return canvas.toDataURL("image/png");
};
window.addEventListener("click",e=>{
  if(!e.path.find(e=>e.id=="settings")){
    document.getElementById("settings-menu").hidden=true;
  };
  if(!e.path.find(e=>e.id=="ecoledirecte-login-form")&&!e.path.find(e=>e.id=="settings-menu")){
    document.getElementById("ecoledirecte-login").hidden=true;
  };
});
function markdown(str){
  str=str.replace(/</g,"&lt");
  str=str.replace(/>/g,"&gt");
  str=str.replace(/\\\\/g,"[%UNBRACKETABLE%]");
  str=str.replace(/[^\\]\*\*(.*?.{1})\*\*/g,(_,i)=>`<b>${i}</b>`);
  str=str.replace(/[^\\]__(.*?.{1})__/g,(_,i)=>`<u>${i}</u>`);
  str=str.replace(/[^\\]\*(.*?.{1})\*/g,(_,i)=>`<i>${i}</i>`);
  str=str.replace(/[^\\]_(.*?.{1})_/g,(_,i)=>`<i>${i}</i>`);
  str=str.replace(/[^\\]`(.*?.{1})`/g,(_,i)=>`<code>${i}</code>`);
  str=str.replace(/\\(\*|_|`)/g,(_,i)=>`${i}`);
  str=str.replace(/\[%UNBRACKETABLE%]/g,"\\");
  return str;
};
