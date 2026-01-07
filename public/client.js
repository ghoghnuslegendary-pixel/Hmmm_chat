const socket = io(window.location.origin, {
  transports: ["websocket"],
  secure: true
});

let time = 900;
let typingTimer;

const backgrounds = [
  'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb)',
  'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e)',
  'url(https://images.unsplash.com/photo-1518837695005-2083093ee35b)'
];
let bgIndex = 0;

// ---------- LOGIN ----------
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

  const timerEl = document.getElementById("timer");
  const interval = setInterval(() => {
    time--;
    timerEl.innerText = `⏳ ${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
    if (time <= 0) clearInterval(interval);
  }, 1000);

  initStickers();
});

// ---------- MESSAGE ----------
function send() {
  const textEl = document.getElementById("text");
  const text = textEl.value.trim();

  if (!text) return;

  socket.emit("message", text);
  textEl.value = "";
  socket.emit("stopTyping");
}

function typingFn() {
  socket.emit("typing");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit("stopTyping");
  }, 1000);
}

// ---------- FILE ----------
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    socket.emit("file", data);
  });
}

// ---------- SOCKET EVENTS ----------
socket.on("message", msg => {
  addMsg(msg);
  const sound = document.getElementById("sound");
  if (sound) sound.play();
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

// ---------- UI ----------
function addMsg(m) {
  let html = `<div class="msg"><b>${m.user}</b>: `;

  if (m.text) html += m.text;
  if (m.file) {
    html += `<br><a href="${m.file.url}" target="_blank">${m.file.name}</a>`;
  }

  html += ` <small>${m.time}</small></div>`;

  const box = document.getElementById("messages");
  box.innerHTML += html;
  box.scrollTop = box.scrollHeight;
}

// ---------- STICKERS ----------
const stickerList = [
  "🔥","😂","❤️","👍","😎","👻","🐱","🐶","🐼","🦊",
  "🐵","🐸","🦁","🐷","🐔","🐧","🦄","🐙","🦖","🐢"
];

function initStickers() {
  const container = document.querySelector(".stickers");
  if (!container) return;

  container.innerHTML = "";
  stickerList.forEach(s => {
    const span = document.createElement("span");
    span.innerText = s;
    span.style.cursor = "pointer";
    span.onclick = () => socket.emit("message", s);
    container.appendChild(span);
  });
}

// ---------- BACKGROUND ----------
function changeBackground() {
  bgIndex = (bgIndex + 1) % backgrounds.length;
  document.body.style.backgroundImage = backgrounds[bgIndex];
}
