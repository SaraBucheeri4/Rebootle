const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'data', 'leaderboard.json');

function loadLeaderboard() {
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveLeaderboard(board) {
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(board, null, 2));
}

// Map of nickname -> best (lowest) timeMs
let leaderboard = loadLeaderboard();

function sortedEntries() {
  return Object.entries(leaderboard)
    .map(([nickname, timeMs]) => ({ nickname, timeMs }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

const app = express();
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/data', express.static(path.join(__dirname, 'data')));

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  socket.emit('leaderboard', sortedEntries());

  socket.on('finish', ({ nickname, timeMs }) => {
    if (typeof nickname !== 'string' || !nickname.trim()) return;
    if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs <= 0) return;

    const clean = nickname.trim().slice(0, 24);
    const existing = leaderboard[clean];
    if (existing === undefined || timeMs < existing) {
      leaderboard[clean] = timeMs;
      saveLeaderboard(leaderboard);
      io.emit('leaderboard', sortedEntries());
    }
  });
});

server.listen(PORT, () => {
  console.log(`Rebootle server listening on http://localhost:${PORT}`);
});
