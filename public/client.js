const socket = io();

// ---------------- STATE ----------------
let time = 900;
let typingTimer;
let mediaRecorder;
let audioChunks = [];

const backgrounds = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b",
];
let bgIndex = Number(localStorage.getItem("bgIndex")) || 0;

const stickers = [
  "🔥","😂","❤️","👍","😎","👻","🐱","🐶","🐼","🦊",
  "🐵","🐸","🦁","🐷","🐔","🐧","🦄","🐙","🦖","🐢"
];

// ---------------- INIT ----------------
applyBackground();
applyTheme();
initStickers();

// ---------------- LOGIN ----------------
function join() {
  const username = usernameEl().value.trim();
  const password = passwordEl().value.trim();
  const room = roomEl().value.trim();
  const avatar = avatarEl().value;

  if (!username || !password || !room) return;

  socket.emit("login", { username, password, room, avatar });
}

socket.on("loginError", (msg) => {
  errorEl().innerText = msg;
});

socket.on("history", (msgs) => {
  loginEl().style.display = "none";
  chatEl().style.display = "block";

  msgs.forEach(addMsg);

  setInterval(() => {
    time--;
    timerEl().innerText = `⏳ ${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  }, 1000);
});

// ---------------- CHAT ----------------
function send() {
  const val = textEl().value.trim();
  if (!val) return;
  socket.emit("message", val);
  textEl().value = "";
  socket.emit("stopTyping");
}

function typingFn() {
  socket.emit("typing");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit("stopTyping"), 1000);
}

socket.on("message", (msg) => {
  addMsg(msg);
  soundEl().play();
});

socket.on("system", (msg) => {
  messagesEl().innerHTML += `<div class="system">${msg}</div>`;
});

socket.on("typing", (user) => {
  typingEl().innerText = `${user} در حال تایپ...`;
});

socket.on("stopTyping", () => {
  typingEl().innerText = "";
});

socket.on("timeup", () => {
  alert("⛔ زمان چت تموم شد");
  location.reload();
});

// ---------------- FILE ----------------
fileInputEl().addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 60 * 1024 * 1024) {
    alert("❌ حجم فایل بیشتر از ۶۰ مگ است");
    return;
  }

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json();
  socket.emit("file", data);
});

// ---------------- VOICE ----------------
async function startVoice() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    const file = new File([blob], "voice.webm");

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    socket.emit("file", data);
  };

  mediaRecorder.start();
}

function stopVoice() {
  if (mediaRecorder) mediaRecorder.stop();
}

// ---------------- UI HELPERS ----------------
function addMsg(m) {
  let html = `<div class="msg"><b>${m.user}</b>: `;
  if (m.text) html += m.text;
  if (m.file) {
    if (m.file.url.endsWith(".webm")) {
      html += `<br><audio controls src="${m.file.url}"></audio>`;
    } else {
      html += `<br><a href="${m.file.url}" target="_blank">${m.file.name}</a>`;
    }
  }
  html += ` <small>${m.time}</small></div>`;

  messagesEl().innerHTML += html;
  messagesEl().scrollTop = messagesEl().scrollHeight;
}

// ---------------- STICKERS ----------------
function initStickers() {
  stickersEl().innerHTML = "";
  stickers.forEach((s) => {
    const el = document.createElement("span");
    el.innerText = s;
    el.onclick = () => socket.emit("message", s);
    stickersEl().appendChild(el);
  });
}

// ---------------- THEME ----------------
function toggleTheme() {
  const t = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = t;
  localStorage.setItem("theme", t);
}

function applyTheme() {
  document.body.dataset.theme = localStorage.getItem("theme") || "dark";
}

// ---------------- BACKGROUND ----------------
function changeBackground() {
  bgIndex = (bgIndex + 1) % backgrounds.length;
  localStorage.setItem("bgIndex", bgIndex);
  applyBackground();
}

function applyBackground() {
  document.documentElement.style.background = `url(${backgrounds[bgIndex]}) center/cover no-repeat fixed`;
  document.body.style.background = "transparent";
}

// ---------------- DOM SHORTCUTS ----------------
const $ = (id) => document.getElementById(id);
const loginEl = () => $("login");
const chatEl = () => $("chat");
const messagesEl = () => $("messages");
const typingEl = () => $("typing");
const timerEl = () => $("timer");
const textEl = () => $("text");
const fileInputEl = () => $("fileInput");
const soundEl = () => $("sound");
const stickersEl = () => document.querySelector(".stickers");
const usernameEl = () => $("username");
const passwordEl = () => $("password");
const roomEl = () => $("room");
const avatarEl = () => $("avatar");
const errorEl = () => $("error");
