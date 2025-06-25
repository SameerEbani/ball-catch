const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Only for local testing. In production, restrict this.
  },
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the mobile controller page
app.get("/soc/:id", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Store pairings: mobileSocketId => desktopSocketId
const pairings = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send socket ID to the client after connecting
  socket.emit("socket_id", socket.id);

  // Mobile device registers with desktop socket ID
  socket.on("register", (desktopId) => {
    const desktopSocket = io.sockets.sockets.get(desktopId);
    if (desktopSocket) {
      pairings[socket.id] = desktopId;
      io.to(desktopId).emit("scanconnected");
      console.log(`Mobile ${socket.id} registered with desktop ${desktopId}`);
    } else {
      console.warn(`Registration failed. Desktop ID not found: ${desktopId}`);
    }
  });

  // Handle joystick movement from mobile to desktop
  socket.on("sliderMove", (data) => {
    const desktopId = pairings[socket.id];
    console.log("sliderMove from", socket.id, "->", data);
    if (desktopId) {
      io.to(desktopId).emit("sliderUpdate", data);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete pairings[socket.id];
  });
});

// Route to generate QR code
app.get("/generate", async (req, res) => {
  const { text } = req.query;
  try {
    const url = text || "http://localhost:3000";
    const qr = await QRCode.toDataURL(url);
    res.type("image/png");
    res.send(Buffer.from(qr.split(",")[1], "base64"));
  } catch (err) {
    res.status(500).send("QR Code generation failed");
  }
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
