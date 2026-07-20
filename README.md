# Rebootle

A word-chain game: change one letter at a time to get from the start word to the target word.

## Run locally

```bash
cd backend
npm install
npm start
```

Then open http://localhost:3000

## Changing the start/target word

Edit `TARGET` and `START` in [scripts/build-graph.js](scripts/build-graph.js), then regenerate the word graph:

```bash
node scripts/build-graph.js
```

This rebuilds `backend/data/graph.json`, which the server loads at startup.
