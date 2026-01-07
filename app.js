import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import multer from "multer";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Render و همه دامنه‌ها اجازه
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data.json";
const UPLOADS_DIR = "./uploads";

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ایجاد پوشه uploads
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Multer برای آپلود فایل
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage });

// داده‌ها
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
const rooms = JSON.parse(fs.readFileSync(DATA_FILE));

// ذخیره داده
function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
}

// کاربران آنلاین
const onlineUsers = {};

// -------------------- SOCKET.IO --------------------
io.on("connection", socket => {

  // Login
  socket.on("login", ({ username, password, room, avatar }) => {
    if (!username || !password || !room) return;

    if (!rooms[room]) rooms[room] = { users: {}, messages: [] };

    if (rooms[room].users[username]) {
      socket.emit("loginError", "نام کاربری قبلاً استفاده شده!");
      return;
    }

    rooms[room].users[username] = { password, avatar };
    save();

    socket.username = username;
    socket.room = room;
    socket.join(room);
    onlineUsers[socket.id] = { username, room };

    // ارسال تاریخچه
    socket.emit("history", rooms[room].messages);

    // پیام سیستم
    socket.to(room).emit("system", `${username} وارد شد`);

    // تایمر ۱۵ دقیقه
    const timer = setTimeout(() => {
      socket.emit("timeup");
      socket.disconnect();
    }, 15 * 60 * 1000);
    onlineUsers[socket.id].timer = timer;
  });

  // تایپینگ
  socket.on("typing", () => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    socket.to(user.room).emit("typing", user.username);
  });

  socket.on("stopTyping", () => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    socket.to(user.room).emit("stopTyping");
  });

  // پیام معمولی
  socket.on("message", text => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const { username, room } = user;

    const msg = { user: username, text, time: new Date().toLocaleTimeString() };
    rooms[room].messages.push(msg);
    if (rooms[room].messages.length > 100) rooms[room].messages.shift();
    save();

    io.to(room).emit("message", msg);
  });

  // ارسال فایل
  socket.on("file", ({ filename, url }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const { username, room } = user;

    const msg = { user: username, file: { name: filename, url }, time: new Date().toLocaleTimeString() };
    rooms[room].messages.push(msg);
    if (rooms[room].messages.length > 100) rooms[room].messages.shift();
    save();

    io.to(room).emit("message", msg);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    clearTimeout(user.timer);

    const { username, room } = user;
    delete onlineUsers[socket.id];
    delete rooms[room].users[username];
    save();

    socket.to(room).emit("system", `${username} خارج شد`);
  });

});

// -------------------- ROUTES --------------------

// آپلود فایل
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({ filename: req.file.originalname, url: `/uploads/${req.file.filename}` });
});

// مسیر آپلود
app.use("/uploads", express.static(UPLOADS_DIR));

// -------------------- START --------------------
server.listen(PORT, () => console.log("🚀 Chat running on", PORT));
