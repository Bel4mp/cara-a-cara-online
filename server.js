
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

// Sala: { code, players: [{id, name, secretId}], status, turnSocketId, lastQuestion, lastAnswer }
const rooms = new Map();

function createRoom(code) {
  const room = {
    code,
    players: [],
    status: "waiting", // waiting -> choosing -> playing -> finished
    turnSocketId: null,
    lastQuestion: null,
    lastAnswer: null,
    winnerSocketId: null
  };
  rooms.set(code, room);
  return room;
}

function roomState(room) {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map(p => ({ id: p.id, name: p.name || "", hasSecret: p.secretId != null })),
    turnSocketId: room.turnSocketId,
    lastQuestion: room.lastQuestion,
    lastAnswer: room.lastAnswer,
    winnerSocketId: room.winnerSocketId
  };
}

function getOpponent(room, socketId) {
  return room.players.find(p => p.id !== socketId);
}

io.on("connection", (socket) => {
  let joinedRoomCode = null;

  socket.on("createRoom", (code, ack) => {
    if (!code || typeof code !== "string") code = Math.random().toString(36).slice(2, 6).toUpperCase();
    if (rooms.has(code)) return ack({ ok: false, error: "Código já existe. Tente outro." });
    const room = createRoom(code);
    room.players.push({ id: socket.id, name: "", secretId: null });
    socket.join(code);
    joinedRoomCode = code;
    ack({ ok: true, code, state: roomState(room) });
    io.to(code).emit("state", roomState(room));
  });

  socket.on("joinRoom", (code, ack) => {
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "Sala não encontrada." });
    if (room.players.length >= 2) return ack({ ok: false, error: "Sala cheia." });
    room.players.push({ id: socket.id, name: "", secretId: null });
    socket.join(code);
    joinedRoomCode = code;
    if (room.players.length === 2) {
      room.status = "choosing";
    }
    ack({ ok: true, code, state: roomState(room) });
    io.to(code).emit("state", roomState(room));
  });

  socket.on("setName", (name) => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me) return;
    me.name = (name || "").toString().slice(0, 24);
    io.to(code).emit("state", roomState(room));
  });

  socket.on("setSecret", (secretId) => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me) return;
    if (typeof secretId !== "number" || secretId < 0 || secretId > 39) return;
    me.secretId = secretId;

    if (room.players.length === 2 && room.players.every(p => p.secretId != null)) {
      room.status = "playing";
      const rand = Math.random() < 0.5 ? room.players[0].id : room.players[1].id;
      room.turnSocketId = rand;
      room.lastQuestion = null;
      room.lastAnswer = null;
    }
    io.to(code).emit("state", roomState(room));
  });

  socket.on("ask", (questionText) => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;
    if (room.turnSocketId !== socket.id) return;
    const q = (questionText || "").toString().slice(0, 200).trim();
    if (!q) return;
    room.lastQuestion = { from: socket.id, text: q, ts: Date.now() };
    room.lastAnswer = null;
    io.to(code).emit("state", roomState(room));
    const opp = getOpponent(room, socket.id);
    if (opp) {
      io.to(opp.id).emit("question", q);
    }
  });

  socket.on("answer", (isYes) => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;
    const opp = getOpponent(room, socket.id);
    if (!opp) return;
    if (!room.lastQuestion || room.lastQuestion.from === socket.id) return;
    room.lastAnswer = { from: socket.id, yes: !!isYes, ts: Date.now() };
    room.turnSocketId = socket.id;
    io.to(code).emit("state", roomState(room));
  });

  socket.on("guess", (charId, ack) => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;
    const opp = getOpponent(room, socket.id);
    if (!opp) return;
    const guessId = Number(charId);
    if (Number.isNaN(guessId)) return;
    const correct = opp.secretId === guessId;
    if (correct) {
      room.status = "finished";
      room.winnerSocketId = socket.id;
      io.to(code).emit("state", roomState(room));
      if (ack) ack({ ok: true, correct: true });
    } else {
      room.turnSocketId = opp.id;
      io.to(code).emit("state", roomState(room));
      if (ack) ack({ ok: true, correct: false });
    }
  });

  socket.on("resetRoom", () => {
    const code = joinedRoomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.status = room.players.length === 2 ? "choosing" : "waiting";
    room.turnSocketId = null;
    room.lastQuestion = null;
    room.lastAnswer = null;
    room.winnerSocketId = null;
    room.players.forEach(p => p.secretId = null);
    io.to(code).emit("state", roomState(room));
  });

  socket.on("chat", (msg) => {
    const code = joinedRoomCode;
    if (!code) return;
    const text = (msg || "").toString().slice(0, 200).trim();
    if (!text) return;
    io.to(code).emit("chat", { from: socket.id, text, ts: Date.now() });
  });

  socket.on("disconnect", () => {
    if (!joinedRoomCode) return;
    const code = joinedRoomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      room.status = room.players.length === 1 ? "waiting" : room.status;
      if (room.turnSocketId === socket.id) room.turnSocketId = null;
      io.to(code).emit("state", roomState(room));
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor on na porta", PORT);
});
