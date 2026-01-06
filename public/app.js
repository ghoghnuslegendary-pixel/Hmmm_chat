const socket = io();
let time = 900; // 15 دقیقه
let typingTimer;

function join(){
  socket.emit("join",{
    username:document.getElementById("username").value.trim(),
    room:document.getElementById("room").value.trim()
  });
}

socket.on("error",msg=>{
  document.getElementById("error").innerText = msg;
});

socket.on("history",msgs=>{
  document.getElementById("login").style.display="none";
  document.getElementById("chat").style.display="block";
  msgs.forEach(addMsg);
  setInterval(()=>{
    time--;
    document.getElementById("timer").innerText=`⏳ ${Math.floor(time/60)}:${time%60}`;
  },1000);
});

function send(){
  const textEl = document.getElementById("text");
  if(textEl.value.trim()){
    socket.emit("message",textEl.value);
    textEl.value="";
    socket.emit("stopTyping");
  }
}

function typingFn(){
  socket.emit("typing");
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>{
    socket.emit("stopTyping");
  },1000);
}

socket.on("message",msg=>{
  addMsg(msg);
  document.getElementById("sound").play();
});

socket.on("system",msg=>{
  document.getElementById("messages").innerHTML+=`<div class="system">${msg}</div>`;
});

socket.on("typing",user=>{
  document.getElementById("typing").innerText=`${user} در حال تایپ...`;
});

socket.on("stopTyping",()=>{
  document.getElementById("typing").innerText="";
});

socket.on("timeup",()=>{
  alert("⛔ زمان چت تموم شد");
  location.reload();
});

function addMsg(m){
  document.getElementById("messages").innerHTML+=
    `<div class="msg"><b>${m.user}</b>: ${m.text} <small>${m.time}</small></div>`;
  const msgDiv = document.getElementById("messages");
  msgDiv.scrollTop=msgDiv.scrollHeight;
}
