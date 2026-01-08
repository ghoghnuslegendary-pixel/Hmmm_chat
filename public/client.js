const socket = io();
const body = document.body;

function register(){
  socket.emit("register", {
    username:user.value,
    password:pass.value
  });
}

function login(){
  socket.emit("login", {
    username:user.value,
    password:pass.value,
    room:room.value
  });
}

socket.on("registered", ()=>alert("ثبت‌نام شد"));

socket.on("errorMsg", m => err.innerText = m);

socket.on("history", msgs=>{
  auth.style.display="none";
  chat.style.display="block";
  msgs.forEach(add);
});

socket.on("message", add);
socket.on("system", m=>add({text:m}));

function send(){
  socket.emit("message", text.value);
  text.value="";
}

file.onchange=async ()=>{
  const f=new FormData();
  f.append("file",file.files[0]);
  const r=await fetch("/upload",{method:"POST",body:f});
  socket.emit("file", await r.json());
}

function add(m){
  msgs.innerHTML+=`<div>${m.user||"⚙"}: ${m.text||""}</div>`;
}

function toggle(){
  body.classList.toggle("light");
}
