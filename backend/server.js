const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'data', 'leaderboard.json');
const GRAPH_FILE = path.join(__dirname, 'data', 'graph.json');

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

const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'));
const wordSet = new Set(graph.words);

function isOneLetterApart(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff === 1;
}

// Map of nickname -> best (lowest) timeMs
let leaderboard = loadLeaderboard();

function sortedEntries() {
  return Object.entries(leaderboard)
    .map(([nickname, timeMs]) => ({ nickname, timeMs }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

let nextSessionId = 1;

io.on('connection', (socket) => {
  let session = null;

  function newSession() {
    session = {
      id: nextSessionId++,
      current: graph.start,
      startTime: Date.now(),
      finished: false,
    };
    socket.emit('init', { sessionId: session.id, start: graph.start, current: session.current });
  }

  socket.emit('leaderboard', sortedEntries());

  socket.on('startGame', () => {
    newSession();
  });

  socket.on('guess', ({ sessionId, word } = {}) => {
    if (!session) return;
    if (sessionId !== session.id) return;
    if (session.finished) return;
    if (typeof word !== 'string') return;

    const guess = word.trim().toUpperCase();

    if (guess.length !== 4) {
      socket.emit('guessResult', { sessionId: session.id, ok: false, reason: 'length', word: guess });
      return;
    }
    if (!wordSet.has(guess)) {
      socket.emit('guessResult', { sessionId: session.id, ok: false, reason: 'not_a_word', word: guess });
      return;
    }
    if (guess === session.current) {
      socket.emit('guessResult', { sessionId: session.id, ok: false, reason: 'repeat', word: guess });
      return;
    }
    if (!isOneLetterApart(session.current, guess)) {
      socket.emit('guessResult', { sessionId: session.id, ok: false, reason: 'not_adjacent', word: guess, current: session.current });
      return;
    }

    session.current = guess;
    const won = guess === graph.target;
    if (won) session.finished = true;

    const matches = [];
    for (let i = 0; i < guess.length; i++) matches.push(guess[i] === graph.target[i]);

    socket.emit('guessResult', { sessionId: session.id, ok: true, word: guess, won, matches });
  });

  socket.on('finish', ({ sessionId, nickname } = {}) => {
    if (!session) return;
    if (sessionId !== session.id) return;
    if (!session.finished) return;
    if (typeof nickname !== 'string' || !nickname.trim()) return;

    const timeMs = Date.now() - session.startTime;
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
