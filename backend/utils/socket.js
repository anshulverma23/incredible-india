// Real-time notifications via Socket.IO. Optional: if socket.io isn't initialised (tests, scripts) emits are no-ops.
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const logger = require("./logger");

let io = null;

const initSocket = (httpServer) => {
  // Required lazily so the API still runs if the dependency isn't installed.
  const { Server } = require("socket.io");
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    serveClient: false,
  });

  // Authenticate every socket with the same short-lived access token used for REST.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.data.userId = String(decoded.id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    logger.debug(`socket connected user=${socket.data.userId}`);
  });

  return io;
};

const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${String(userId)}`).emit(event, payload);
};

const closeSocket = () => io?.close();

module.exports = { initSocket, emitToUser, closeSocket };
