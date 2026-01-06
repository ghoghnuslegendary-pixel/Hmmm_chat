import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data.json";

app.use(express.static("."));

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
const rooms = JSON.parse(fs.readFileSync(DATA_FILE));

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
}

io.on("connection", socket => {
  let timer;

  socket.on("join", ({ username, room }) => {
    if (!username || !room) return;

    if (!rooms[room]) rooms[room] = { users: [], messages: [] };
    if (rooms[room].users.includes(username)) {
      socket.emit("error", "این نام قبلاً گرفته شده");
      return;
    }

    socket.username = username;
    socket.room = room;
    rooms[room].users.push(username);
    socket.join(room);
    save();

    socket.emit("history", rooms[room].messages);
    socket.to(room).emit("system", `${username} وارد شد`);

    timer = setTimeout(() => {
      socket.emit("timeup");
      socket.disconnect();
    }, 15 * 60 * 1000);
  });

  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", socket.username);
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  socket.on("message", text => {
    const msg = {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString()
    };

    rooms[socket.room].messages.push(msg);
    if (rooms[socket.room].messages.length > 100)
      rooms[socket.room].messages.shift();

    save();
    io.to(socket.room).emit("message", msg);
  });

  socket.on("disconnect", () => {
    clearTimeout(timer);
    if (!socket.room) return;

    rooms[socket.room].users =
      rooms[socket.room].users.filter(u => u !== socket.username);
    save();

    socket.to(socket.room).emit("system", `${socket.username} خارج شد`);
  });
});

server.listen(PORT, () =>
  console.log("🚀 Chat running on", PORT)
);
