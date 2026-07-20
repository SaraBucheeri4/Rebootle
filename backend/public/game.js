let chain = [];
let currentWord = null;
let startTime = null;
let timerInterval = null;
let finished = false;
let socket = null;
let lastLeaderboard = [];
let awaitingGuess = false;

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

function renderChain() {
  chainEl.innerHTML = '';
  chain.forEach(({ word, matches, isWin }) => {
    const row = document.createElement('div');
    row.className = 'chain-row';
    for (let i = 0; i < word.length; i++) {
      const tile = document.createElement('div');
      const isMatch = matches ? matches[i] : false;
      tile.className = 'tile' + (isWin ? ' win' : isMatch ? ' match' : '');
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

function showScreen(screen) {
  nicknameScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  leaderboardScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

function handleGuessResult(result) {
  awaitingGuess = false;
  if (finished) return;

  if (!result.ok) {
    if (result.reason === 'length') {
      messageEl.textContent = 'Word must be 4 letters.';
    } else if (result.reason === 'not_a_word') {
      messageEl.textContent = `${result.word} is not a real word.`;
    } else if (result.reason === 'repeat') {
      messageEl.textContent = 'Already used that word.';
    } else if (result.reason === 'not_adjacent') {
      messageEl.textContent = `${result.word} must differ from ${result.current} by exactly one letter.`;
    }
    return;
  }

  currentWord = result.word;
  chain.push({ word: result.word, matches: result.matches, isWin: result.won });
  renderChain();

  if (result.won) {
    finished = true;
    const timeMs = stopTimer();
    const moves = chain.length - 1;
    pendingFinish = { nickname: nicknameInput.value.trim() };

    resultTextEl.textContent = `Solved in ${moves} moves, ${(timeMs / 1000).toFixed(1)}s`;
    guessForm.classList.add('hidden');
    hintText.classList.add('hidden');
    donePanel.classList.remove('hidden');
  }
}

guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (finished || awaitingGuess) return;

  const guess = guessInput.value.trim().toUpperCase();
  guessInput.value = '';
  messageEl.textContent = '';

  if (!guess) return;

  awaitingGuess = true;
  socket.emit('guess', guess);
});

document.getElementById('nickname-submit').addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return;
  await startGame(nickname);
});

nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('nickname-submit').click();
});

function ensureSocket() {
  if (!socket) {
    socket = io();
    socket.on('leaderboard', renderLeaderboard);
    socket.on('guessResult', handleGuessResult);
  }
}

async function startGame(nickname) {
  ensureSocket();

  playerNameLabel.textContent = nickname;
  messageEl.textContent = '';
  finished = false;
  awaitingGuess = false;
  pendingFinish = null;
  chain = [];
  currentWord = null;
  guessForm.classList.remove('hidden');
  hintText.classList.remove('hidden');
  donePanel.classList.add('hidden');

  socket.once('init', ({ start, current }) => {
    currentWord = current;
    chain = [{ word: start, matches: null, isWin: false }];
    renderChain();
    showScreen(gameScreen);
    guessInput.focus();
    startTimer();
  });
  socket.emit('startGame');
}

document.getElementById('nickname-view-leaderboard').addEventListener('click', (e) => {
  e.preventDefault();
  ensureSocket();
  renderLeaderboard(lastLeaderboard);
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
