const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, origin); // ✅ Use dynamic origin (secure it further if needed)
    },
  },
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve mobile controller
app.get("/soc/:id", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// QR code generator
app.get("/generate", async (req, res) => {
  const { text } = req.query;
  try {
    const qr = await QRCode.toDataURL(text || "");
    res.type("image/png");
    res.send(Buffer.from(qr.split(",")[1], "base64"));
  } catch {
    res.status(500).send("QR Code generation failed");
  }
});

// Pairing logic
const pairings = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("socket_id", socket.id);

  socket.on("register", (desktopId) => {
    const desktopSocket = io.sockets.sockets.get(desktopId);
    if (desktopSocket) {
      pairings[socket.id] = desktopId;
      io.to(desktopId).emit("scanconnected");
      console.log(`Mobile ${socket.id} registered with desktop ${desktopId}`);
    } else {
      console.warn(`Desktop ID not found: ${desktopId}`);
    }
  });

  socket.on("sliderMove", (data) => {
    const desktopId = pairings[socket.id];
    if (desktopId) {
      io.to(desktopId).emit("sliderUpdate", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete pairings[socket.id];
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
