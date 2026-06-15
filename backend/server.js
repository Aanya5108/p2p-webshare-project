const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // to create room
  socket.on("create-room", (roomId) => {
    socket.join(roomId);

    console.log(`Room created: ${roomId}`);

    socket.emit("room-created", roomId);
  });

  // for joining room
  socket.on("join-room", (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room && room.size > 0) {
      socket.join(roomId);

      console.log(`User joined room: ${roomId}`);

      socket.emit("room-joined", roomId);

      socket.to(roomId).emit("peer-joined");
    } else {
      socket.emit("room-not-found");
    }
  });

    // WEBRTC SIGNALING

  socket.on("signal", ({ roomId, data }) => {
  console.log("Signal received for room:", roomId);

  socket.to(roomId).emit("signal", data);
});

  socket.on("disconnecting", () => {
  const rooms = [...socket.rooms];

  rooms.forEach((roomId) => {
    if (roomId !== socket.id) {
      socket.to(roomId).emit("peer-disconnected");
    }
  });

  console.log("User disconnected:", socket.id);
});
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});