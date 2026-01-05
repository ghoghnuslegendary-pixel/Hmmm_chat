const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // اجازه ارسال فایل تا ۱۰ مگابایت
});

app.use(express.static(path.join(__dirname, 'public')));
const rooms = {};

io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, username, passcode, icon }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { passcode };
        }
        if (rooms[roomId].passcode !== passcode) {
            socket.emit('error-msg', 'پسکد اشتباه است!');
            return;
        }
        socket.join(roomId);
        socket.username = username;
        socket.icon = icon;
        socket.roomId = roomId;
    });

    socket.on('send-message', ({ roomId, message, file, fileName, fileType }) => {
        io.to(roomId).emit('new-message', {
            username: socket.username,
            icon: socket.icon,
            message: message,
            file: file,
            fileName: fileName,
            fileType: fileType
        });
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('new-message', {
                username: 'System', icon: '📢', message: `${socket.username} خارج شد.`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running...`));
