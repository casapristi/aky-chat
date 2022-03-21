const appHeight=()=>{
  const doc=document.documentElement;
  doc.style.setProperty("--app-height",`${window.innerHeight}px`);
};
window.addEventListener("resize",appHeight);
appHeight();
const emailLogin=document.getElementById("email-login");
const codeVerification=document.getElementById("code-verification");
const emailError=document.getElementById("error-email");
const codeError=document.getElementById("error-code");
var email="";
const rootURL="https://aky-chat.herokuapp.com";
emailLogin.addEventListener("submit",event=>{
  event.preventDefault();
  email=document.getElementById("email").value;
  fetch(`${rootURL}/api/verify`,{
    method:"POST",
    body:email
  })
  .then(res=>res.json())
  .then(response=>{
    if(response.error)return emailError.textContent=response.error;
    emailLogin.hidden=true;
    codeVerification.hidden=false;
    document.getElementById("digit-1").focus();
  });
});
var code="";
function next(curDiv){
  code+=curDiv.textContent;
  curDiv.contentEditable=false;
  const num=Number(curDiv.id.split("-")[1]);
  const newDiv=document.getElementById(`digit-${num+1}`);
  newDiv.contentEditable=true;
  newDiv.focus();
};
function verify(curDiv){
  code+=curDiv.textContent;
  curDiv.contentEditable=false;
  fetch(`${rootURL}/api/code/use/${code}`,{
    method:"POST",
    body:email
  })
  .then(res=>res.json())
  .then(({authorized,id,username})=>{
    if(!authorized){
      codeError.textContent="Code non-valide";
      for(let i=1;i<7;i++){
        document.getElementById(`digit-${i}`).textContent="";
        document.getElementById("digit-1").contentEditable=true;
        document.getElementById("digit-1").focus();
        code="";
      };
    }else{
      window.localStorage.setItem("id",id);
      window.location.href="chat";
    };
  });
};
