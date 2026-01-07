const socket = io();
let time = 900;
let typingTimer;

const backgrounds = [
  'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb)',
  'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e)',
  'url(https://images.unsplash.com/photo-1518837695005-2083093ee35b)'
];
let bgIndex = 0;

function join() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const room = document.getElementById("room").value.trim();
  const avatar = document.getElementById("avatar").value;

  if (!username || !password || !room) return;
  socket.emit("login", { username, password, room, avatar });
}

socket.on("loginError", msg => {
  document.getElementById("error").innerText = msg;
});

socket.on("history", msgs => {
  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";
  msgs.forEach(addMsg);

  setInterval(() => {
    time--;
    document.getElementById("timer").innerText = `⏳ ${Math.floor(time/60)}:${time%60}`;
  }, 1000);

  initStickers();
});

function send() {
  const textEl = document.getElementById("text");
  if (textEl.value.trim()) {
    socket.emit("message", textEl.value);
    textEl.value = "";
    socket.emit("stopTyping");
  }
}

function typingFn() {
  socket.emit("typing");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit("stopTyping");
  }, 1000);
}

document.getElementById("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  socket.emit("file", data);
});

socket.on("message", msg => {
  addMsg(msg);
  document.getElementById("sound").play();
});

socket.on("system", msg => {
  document.getElementById("messages").innerHTML += `<div class="system">${msg}</div>`;
});

socket.on("typing", user => {
  document.getElementById("typing").innerText = `${user} در حال تایپ...`;
});

socket.on("stopTyping", () => {
  document.getElementById("typing").innerText = "";
});

socket.on("timeup", () => {
  alert("⛔ زمان چت تموم شد");
  location.reload();
});

function addMsg(m) {
  let content = `<div class="msg"><b>${m.user}</b>: `;
  if (m.text) content += m.text;
  if (m.file) content += `<br><a href="${m.file.url}" target="_blank">${m.file.name}</a>`;
  content += ` <small>${m.time}</small></div>`;
  document.getElementById("messages").innerHTML += content;
  const msgDiv = document.getElementById("messages");
  msgDiv.scrollTop = msgDiv.scrollHeight;
}

// استیکرها
const stickerList = ["🔥","😂","❤️","👍","😎","👻","🐱","🐶","🐼","🦊","🐵","🐸","🦁","🐷","🐔","🐧","🦄","🐙","🦖","🐢"];
function initStickers() {
  const container = document.querySelector(".stickers");
  container.innerHTML = "";
  stickerList.forEach(s => {
    const img = document.createElement("span");
    img.innerText = s;
    img.style.cursor = "pointer";
    img.onclick = () => socket.emit("message", s);
    container.appendChild(img);
  });
}

// تغییر پس‌زمینه
function changeBackground() {
  bgIndex = (bgIndex + 1) % backgrounds.length;
  document.body.style.backgroundImage = backgrounds[bgIndex];
}
