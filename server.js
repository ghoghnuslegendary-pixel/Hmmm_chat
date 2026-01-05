const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// متصل کردن فایل‌های پوشه public (مثل index.html) به سرور
app.use(express.static(path.join(__dirname, 'public')));

// دیتابیس موقت برای ذخیره اطلاعات روم‌ها
const rooms = {};

io.on('connection', (socket) => {
    console.log('یک کاربر متصل شد:', socket.id);

    // وقتی کاربر درخواست ورود به روم را می‌دهد
    socket.on('join-room', ({ roomId, username, passcode, icon }) => {
        
        // اگر روم وجود نداشت، آن را بساز و پسکد را ذخیره کن
        if (!rooms[roomId]) {
            rooms[roomId] = { 
                passcode: passcode, 
                users: [] 
            };
        }

        // بررسی امنیت: اگر پسکد اشتباه بود، اجازه ورود نده
        if (rooms[roomId].passcode !== passcode) {
            socket.emit('error-msg', 'پسکد وارد شده برای این روم اشتباه است!');
            return;
        }

        // وارد کردن کاربر به اتاق مجازی در Socket.io
        socket.join(roomId);
        
        // ذخیره اطلاعات کاربر در این اتصال خاص (session)
        socket.username = username;
        socket.icon = icon;
        socket.roomId = roomId;

        console.log(`${username} با آیکون ${icon} وارد روم [${roomId}] شد.`);
        
        // اطلاع‌رسانی به بقیه افراد حاضر در آن روم
        socket.to(roomId).emit('new-message', {
            username: 'سیستم',
            icon: '📢',
            message: `${username} به جمع ما اضافه شد!`
        });
    });

    // دریافت و ارسال پیام چت
    socket.on('send-message', ({ roomId, message }) => {
        if (message.trim() !== "") {
            io.to(roomId).emit('new-message', {
                username: socket.username,
                icon: socket.icon,
                message: message
            });
        }
    });

    // مدیریت قطع اتصال
    socket.on('disconnect', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('new-message', {
                username: 'سیستم',
                icon: '👋',
                message: `${socket.username} از چت خارج شد.`
            });
        }
    });
});

// تعیین پورت اجرا (برای Render و محیط‌های آنلاین)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
