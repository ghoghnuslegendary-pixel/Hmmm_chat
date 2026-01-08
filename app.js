import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data.json";
const UPLOADS_DIR = "./uploads";

app.use(express.static("public"));
app.use(express.json());

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({
  users: {},
  rooms: {}
}, null, 2));

const db = JSON.parse(fs.readFileSync(DATA_FILE));

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function hash(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

/* ========== Upload (60MB) ========== */
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 60 * 1024 * 1024 }
});

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    name: req.file.originalname,
    url: `/uploads/${req.file.filename}`
  });
});

app.use("/uploads", express.static(UPLOADS_DIR));

/* ========== SOCKET ========== */
const online = {};

io.on("connection", socket => {

  socket.on("register", ({ username, password }) => {
    if (db.users[username]) {
      socket.emit("errorMsg", "این یوزرنیم قبلاً ثبت شده");
      return;
    }
    db.users[username] = { password: hash(password) };
    save();
    socket.emit("registered");
  });

  socket.on("login", ({ username, password, room }) => {
    if (!db.users[username] ||
        db.users[username].password !== hash(password)) {
      socket.emit("errorMsg", "کجا می‌خواستی بری ببم جان، اونجا چیزه 😏");
      return;
    }

    if (!db.rooms[room]) {
      db.rooms[room] = {
        admin: username,
        banned: [],
        messages: []
      };
    }

    if (db.rooms[room].banned.includes(username)) {
      socket.emit("errorMsg", "⛔ بن شدی");
      return;
    }

    socket.join(room);
    socket.username = username;
    socket.room = room;
    online[socket.id] = socket;

    socket.emit("history", db.rooms[room].messages);
    io.to(room).emit("system", `${username} وارد شد`);
  });

  socket.on("message", text => {
    if (!socket.room) return;
    const msg = {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString()
    };
    db.rooms[socket.room].messages.push(msg);
    save();
    io.to(socket.room).emit("message", msg);
  });

  socket.on("file", file => {
    const msg = {
      user: socket.username,
      file,
      time: new Date().toLocaleTimeString()
    };
    db.rooms[socket.room].messages.push(msg);
    save();
    io.to(socket.room).emit("message", msg);
  });

  socket.on("ban", target => {
    const room = db.rooms[socket.room];
    if (room.admin !== socket.username) return;
    room.banned.push(target);
    save();
    io.to(socket.room).emit("system", `${target} بن شد`);
  });

  socket.on("disconnect", () => {
    if (socket.room) {
      io.to(socket.room).emit("system", `${socket.username} رفت`);
    }
    delete online[socket.id];
  });
});

server.listen(PORT, () => console.log("🚀 RUNNING"));
