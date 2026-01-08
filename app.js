// app.js (FINAL)

import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data.json";
const UPLOAD_DIR = "./uploads";
const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB
const CHAT_TIME = 15 * 60 * 1000; // 15 min

// ---------- MIDDLEWARE ----------
app.use(express.static("public"));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

// ---------- INIT FILES ----------
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DATA_FILE))
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {}, rooms: {} }, null, 2));

let db = JSON.parse(fs.readFileSync(DATA_FILE));

const saveDB = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

// ---------- MULTER ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ---------- SOCKET ----------
const online = {}; // socket.id => {username, room, timer}

io.on("connection", (socket) => {
  // -------- REGISTER / LOGIN --------
  socket.on("login", async ({ username, password, room, avatar }) => {
    if (!username || !password || !room) return;

    // user exists?
    if (!db.users[username]) {
      // REGISTER
      const hash = await bcrypt.hash(password, 10);
      db.users[username] = { password: hash, avatar };
      saveDB();
    } else {
      // LOGIN
      const ok = await bcrypt.compare(
        password,
        db.users[username].password
      );
      if (!ok) {
        socket.emit(
          "loginError",
          "کجا می‌خواستی بری ببم جان، اونجا چیزه 😏"
        );
        return;
      }
    }

    // room init
    if (!db.rooms[room]) {
      db.rooms[room] = {
        admin: username,
        banned: [],
        messages: [],
      };
    }

    // banned?
    if (db.rooms[room].banned.includes(username)) {
      socket.emit("loginError", "🚫 بن شدی");
      return;
    }

    socket.join(room);
    socket.username = username;
    socket.room = room;

    online[socket.id] = { username, room };

    socket.emit("history", db.rooms[room].messages, {
      admin: db.rooms[room].admin,
    });

    socket.to(room).emit("system", `${username} وارد شد`);

    // timer
    const timer = setTimeout(() => {
      socket.emit("timeup");
      socket.disconnect();
    }, CHAT_TIME);

    online[socket.id].timer = timer;
  });

  // -------- MESSAGE --------
  socket.on("message", (text) => {
    if (!online[socket.id]) return;
    const { username, room } = online[socket.id];
    const msg = {
      user: username,
      text,
      time: new Date().toLocaleTimeString(),
    };
    db.rooms[room].messages.push(msg);
    io.to(room).emit("message", msg);
    saveDB();
  });

  // -------- FILE / VOICE --------
  socket.on("file", (file) => {
    if (!online[socket.id]) return;
    const { username, room } = online[socket.id];
    const msg = {
      user: username,
      file,
      time: new Date().toLocaleTimeString(),
    };
    db.rooms[room].messages.push(msg);
    io.to(room).emit("message", msg);
    saveDB();
  });

  // -------- TYPING --------
  socket.on("typing", () => {
    if (!online[socket.id]) return;
    socket
      .to(online[socket.id].room)
      .emit("typing", online[socket.id].username);
  });

  socket.on("stopTyping", () => {
    if (!online[socket.id]) return;
    socket.to(online[socket.id].room).emit("stopTyping");
  });

  // -------- ADMIN --------
  socket.on("ban", (target) => {
    const { room, username } = online[socket.id];
    if (db.rooms[room].admin !== username) return;
    db.rooms[room].banned.push(target);
    io.to(room).emit("system", `${target} بن شد`);
    saveDB();
  });

  // -------- DISCONNECT --------
  socket.on("disconnect", () => {
    const user = online[socket.id];
    if (!user) return;
    clearTimeout(user.timer);
    socket.to(user.room).emit("system", `${user.username} خارج شد`);
    delete online[socket.id];
  });
});

// ---------- UPLOAD ROUTE ----------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).end();
  res.json({
    name: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
  });
});

// ---------- START ----------
server.listen(PORT, () =>
  console.log("🔥 Hmmm Chat Pro running on", PORT)
);
