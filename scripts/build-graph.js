// One-time offline build: reads the word list, builds the one-letter-apart
// word graph, runs BFS from the target word to compute par, and writes the
// result as static JSON consumed by both frontend and backend.
const fs = require('fs');
const path = require('path');

const TARGET = 'POOL';
const START = 'BYTE';

const words = fs
  .readFileSync(path.join(__dirname, 'words.txt'), 'utf8')
  .split('\n')
  .map((w) => w.trim().toUpperCase())
  .filter((w) => w.length === 4);

const wordSet = new Set(words);

function neighborsOf(word) {
  const result = [];
  for (let i = 0; i < 4; i++) {
    for (let c = 65; c <= 90; c++) {
      const letter = String.fromCharCode(c);
      if (letter === word[i]) continue;
      const candidate = word.slice(0, i) + letter + word.slice(i + 1);
      if (wordSet.has(candidate)) result.push(candidate);
    }
  }
  return result;
}

const neighbors = {};
for (const word of words) {
  neighbors[word] = neighborsOf(word);
}

if (!wordSet.has(TARGET)) {
  throw new Error(`Target word ${TARGET} not found in word list`);
}
if (!wordSet.has(START)) {
  throw new Error(`Start word ${START} not found in word list`);
}

// BFS from TARGET outward; par[word] = shortest distance back to TARGET.
const par = { [TARGET]: 0 };
const queue = [TARGET];
let head = 0;
while (head < queue.length) {
  const current = queue[head++];
  for (const next of neighbors[current]) {
    if (!(next in par)) {
      par[next] = par[current] + 1;
      queue.push(next);
    }
  }
}

if (!(START in par)) {
  throw new Error(`Start word ${START} is not connected to ${TARGET} in the word graph`);
}

const output = { target: TARGET, start: START, words, neighbors, par };

fs.writeFileSync(
  path.join(__dirname, '..', 'backend', 'data', 'graph.json'),
  JSON.stringify(output)
);

console.log(`Words: ${words.length}`);
console.log(`Reachable from ${TARGET}: ${Object.keys(par).length}`);
console.log(`par(${START}) = ${par[START]}`);
