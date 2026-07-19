let graph = null;
let wordSet = null;
let chain = [];
let startTime = null;
let timerInterval = null;
let finished = false;
let socket = null;
let lastLeaderboard = [];

const nicknameScreen = document.getElementById('nickname-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const nicknameInput = document.getElementById('nickname-input');
const playerNameLabel = document.getElementById('player-name-label');
const chainEl = document.getElementById('chain');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
const messageEl = document.getElementById('message');
const hintText = document.getElementById('hint-text');
const timerEl = document.getElementById('timer');
const donePanel = document.getElementById('done-panel');
const resultTextEl = document.getElementById('result-text');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const leaderboardCount = document.getElementById('leaderboard-count');
let pendingFinish = null;

function isOneLetterApart(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff === 1;
}

function renderChain() {
  chainEl.innerHTML = '';
  const target = graph.target;
  chain.forEach((word) => {
    const row = document.createElement('div');
    row.className = 'chain-row';
    const isWin = word === target;
    for (let i = 0; i < word.length; i++) {
      const tile = document.createElement('div');
      const matches = word[i] === target[i];
      tile.className = 'tile' + (isWin ? ' win' : matches ? ' match' : '');
      tile.textContent = word[i];
      row.appendChild(tile);
    }
    chainEl.appendChild(row);
  });
}

function renderLeaderboard(entries) {
  lastLeaderboard = entries;
  leaderboardList.innerHTML = '';
  leaderboardEmpty.classList.toggle('hidden', entries.length > 0);
  leaderboardCount.textContent = `${entries.length} run${entries.length === 1 ? '' : 's'}`;

  const best = entries.length ? entries[0].timeMs : 0;
  const worst = entries.length ? entries[entries.length - 1].timeMs : 0;

  entries.forEach(({ nickname, timeMs }, idx) => {
    const isFirst = idx === 0;
    const pct = Math.max(8, 100 - ((timeMs - best) / (worst - best || 1)) * 92);

    const li = document.createElement('li');
    li.className = 'leaderboard-row' + (isFirst ? ' first' : '');
    li.innerHTML = `
      <div class="leaderboard-rank">${idx + 1}</div>
      <div class="leaderboard-name">${escapeHtml(nickname)}${isFirst ? '<span class="leaderboard-badge">Fastest</span>' : ''}</div>
      <div class="leaderboard-result">${(timeMs / 1000).toFixed(1)}s</div>
      <div class="leaderboard-bar-track"><div class="leaderboard-bar-fill" style="width:${pct}%"></div></div>
    `;
    leaderboardList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function startTimer() {
  startTime = performance.now();
  timerEl.textContent = '0.0s';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = `${((performance.now() - startTime) / 1000).toFixed(1)}s`;
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
  const timeMs = performance.now() - startTime;
  timerEl.textContent = `${(timeMs / 1000).toFixed(1)}s`;
  return timeMs;
}

async function init() {
  const res = await fetch('/data/graph.json');
  graph = await res.json();
  wordSet = new Set(graph.words);
  chain = [graph.start];
  renderChain();
}

function showScreen(screen) {
  nicknameScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  leaderboardScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (finished) return;

  const guess = guessInput.value.trim().toUpperCase();
  guessInput.value = '';
  messageEl.textContent = '';

  const current = chain[chain.length - 1];

  if (guess.length !== 4) {
    messageEl.textContent = 'Word must be 4 letters.';
    return;
  }
  if (!wordSet.has(guess)) {
    messageEl.textContent = `${guess} is not a real word.`;
    return;
  }
  if (!isOneLetterApart(current, guess)) {
    messageEl.textContent = `${guess} must differ from ${current} by exactly one letter.`;
    return;
  }
  if (guess === current) {
    messageEl.textContent = 'Already used that word.';
    return;
  }

  chain.push(guess);
  renderChain();

  if (guess === graph.target) {
    finished = true;
    const timeMs = stopTimer();
    const moves = chain.length - 1;
    pendingFinish = { nickname: nicknameInput.value.trim(), timeMs };

    resultTextEl.textContent = `Solved in ${moves} moves, ${(timeMs / 1000).toFixed(1)}s`;
    guessForm.classList.add('hidden');
    hintText.classList.add('hidden');
    donePanel.classList.remove('hidden');
  }
});

document.getElementById('nickname-submit').addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return;
  await startGame(nickname);
});

nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('nickname-submit').click();
});

async function startGame(nickname) {
  await init();

  playerNameLabel.textContent = nickname;
  messageEl.textContent = '';
  finished = false;
  pendingFinish = null;
  guessForm.classList.remove('hidden');
  hintText.classList.remove('hidden');
  donePanel.classList.add('hidden');

  showScreen(gameScreen);
  guessInput.focus();

  if (!socket) {
    socket = io();
    socket.on('leaderboard', renderLeaderboard);
  }

  startTimer();
}

document.getElementById('nickname-view-leaderboard').addEventListener('click', (e) => {
  e.preventDefault();
  if (!socket) {
    socket = io();
    socket.on('leaderboard', renderLeaderboard);
  } else {
    renderLeaderboard(lastLeaderboard);
  }
  showScreen(leaderboardScreen);
});

document.getElementById('game-view-leaderboard').addEventListener('click', (e) => {
  e.preventDefault();
  renderLeaderboard(lastLeaderboard);
  showScreen(leaderboardScreen);
});

document.getElementById('leaderboard-back').addEventListener('click', (e) => {
  e.preventDefault();
  showScreen(nicknameScreen);
});

document.getElementById('done-button').addEventListener('click', () => {
  if (pendingFinish) {
    socket.emit('finish', pendingFinish);
    pendingFinish = null;
  }
  renderLeaderboard(lastLeaderboard);
  showScreen(leaderboardScreen);
});
