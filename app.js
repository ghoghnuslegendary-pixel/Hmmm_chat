import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import multer from "multer";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data.json";
const UPLOADS_DIR = "./uploads";
const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB

// داده‌ها
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
const rooms = JSON.parse(fs.readFileSync(DATA_FILE));

// آپلود فایل
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

// کاربران آنلاین: { socketId: {username, room, timer} }
const onlineUsers = {};

function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2)); }

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));

// مسیر آپلود
app.post("/upload", upload.single("file"), (req,res)=>{
  if(!req.file) return res.status(400).send("فایل آپلود نشد یا بیش از 60MB است");
  res.json({ filename: req.file.originalname, url: `/uploads/${req.file.filename}` });
});

// اتصال Socket.IO
io.on("connection", socket => {

  socket.on("login", ({ username, password, room, avatar }) => {
    if(!username||!password||!room) return;

    if(!rooms[room]) rooms[room] = { users:{}, messages:[] };

    // ثبت‌نام یا ورود
    if(!rooms[room].users[username]){
      rooms[room].users[username] = { password, avatar, bg:0 };
    } else if(rooms[room].users[username].password !== password){
      socket.emit("loginError","کجا می خواستی بری ببم جان اونجا جیزه");
      return;
    }

    socket.username = username;
    socket.room = room;
    socket.join(room);
    onlineUsers[socket.id] = { username, room };

    socket.emit("history", rooms[room].messages);
    socket.to(room).emit("system", `${username} وارد شد`);

    // تایمر 15 دقیقه
    const timer = setTimeout(()=>{
      socket.emit("timeup");
      socket.disconnect();
    }, 15*60*1000);
    onlineUsers[socket.id].timer = timer;
  });

  socket.on("typing", () => {
    if(!onlineUsers[socket.id]) return;
    socket.to(onlineUsers[socket.id].room).emit("typing", onlineUsers[socket.id].username);
  });

  socket.on("stopTyping", () => {
    if(!onlineUsers[socket.id]) return;
    socket.to(onlineUsers[socket.id].room).emit("stopTyping");
  });

  socket.on("message", text=>{
    if(!onlineUsers[socket.id]) return;
    const { username, room } = onlineUsers[socket.id];
    const msg = { user:username, text, time:new Date().toLocaleTimeString() };
    rooms[room].messages.push(msg);
    if(rooms[room].messages.length>100) rooms[room].messages.shift();
    save();
    io.to(room).emit("message", msg);
  });

  socket.on("file", ({ filename, url })=>{
    if(!onlineUsers[socket.id]) return;
    const { username, room } = onlineUsers[socket.id];
    const msg = { user:username, file:{name:filename,url}, time:new Date().toLocaleTimeString() };
    rooms[room].messages.push(msg);
    if(rooms[room].messages.length>100) rooms[room].messages.shift();
    save();
    io.to(room).emit("message", msg);
  });

  socket.on("voice", ({ filename, url })=>{
    if(!onlineUsers[socket.id]) return;
    const { username, room } = onlineUsers[socket.id];
    const msg = { user:username, voice:{name:filename,url}, time:new Date().toLocaleTimeString() };
    rooms[room].messages.push(msg);
    if(rooms[room].messages.length>100) rooms[room].messages.shift();
    save();
    io.to(room).emit("voice", msg);
  });

  socket.on("disconnect", ()=>{
    const user = onlineUsers[socket.id];
    if(!user) return;
    clearTimeout(user.timer);
    const { username, room } = user;
    delete onlineUsers[socket.id];
    socket.to(room).emit("system",`${username} خارج شد`);
  });

});

server.listen(PORT,()=>console.log("🚀 Chat running on",PORT));
