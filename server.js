// Headbands: zero-dependency Node server. Rooms live in memory; clients get
// live updates over Server-Sent Events and send actions with POST.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map(); // code -> room

const id = () => crypto.randomBytes(8).toString('hex');
function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}
const clean = (s, max = 40) => String(s || '').trim().slice(0, max);
function parseWords(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[\n,]+/);
  return [...new Set(list.map((w) => clean(w, 60)).filter(Boolean))].slice(0, 500);
}

function draw(room) {
  if (!room.deck.length) return null;
  const i = crypto.randomInt(room.deck.length);
  return room.deck.splice(i, 1)[0];
}

function stateFor(room, playerId) {
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    online: p.streams.size > 0,
    // Everyone sees everyone else's word. Your own word is sent too, because it is
    // shown on your screen while the phone is on your forehead.
    word: p.word,
    guessed: p.guessed,
  }));
  return {
    code: room.code,
    status: room.status,
    you: playerId,
    hostId: room.hostId,
    wordsLeft: room.deck.length,
    totalWords: room.words.length,
    players,
  };
}

function broadcast(room) {
  for (const p of room.players.values()) {
    const data = `data: ${JSON.stringify(stateFor(room, p.id))}\n\n`;
    for (const res of p.streams) res.write(data);
  }
}

function addPlayer(room, name) {
  const p = { id: id(), name: clean(name, 24) || 'Player', score: 0, word: null, guessed: [], streams: new Set() };
  room.players.set(p.id, p);
  if (room.status === 'playing') p.word = draw(room);
  return p;
}

function handleAction(room, player, body) {
  const isHost = player.id === room.hostId;
  switch (body.type) {
    case 'start':
      if (!isHost) throw new Error('Only the host can start');
      room.deck = [...room.words];
      room.status = 'playing';
      for (const p of room.players.values()) {
        p.score = 0;
        p.guessed = [];
        p.word = draw(room);
      }
      break;
    case 'correct':
    case 'pass': {
      if (room.status !== 'playing' || !player.word) break;
      const old = player.word;
      if (body.type === 'correct') {
        player.score++;
        player.guessed.push(old);
      }
      player.word = draw(room);
      if (body.type === 'pass') room.deck.push(old); // passed word goes back in the pile
      break;
    }
    case 'addWords':
      if (!isHost) throw new Error('Only the host can add words');
      for (const w of parseWords(body.words)) {
        if (!room.words.includes(w)) {
          room.words.push(w);
          if (room.status === 'playing') room.deck.push(w);
        }
      }
      // Give a word to anyone who ran out
      if (room.status === 'playing') for (const p of room.players.values()) if (!p.word) p.word = draw(room);
      break;
    case 'end':
      if (!isHost) throw new Error('Only the host can end the game');
      room.status = 'ended';
      break;
    case 'lobby':
      if (!isHost) throw new Error('Only the host can do that');
      room.status = 'lobby';
      for (const p of room.players.values()) p.word = null;
      break;
    case 'leave':
      room.players.delete(player.id);
      for (const res of player.streams) res.end();
      if (room.hostId === player.id) {
        const next = room.players.values().next().value;
        if (next) room.hostId = next.id;
      }
      break;
    default:
      throw new Error('Unknown action');
  }
  room.touched = Date.now();
  broadcast(room);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 100_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('Bad JSON')); }
    });
  });
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && url.pathname === '/api/create') {
      const body = await readBody(req);
      const words = parseWords(body.words);
      if (words.length < 1) return json(res, 400, { error: 'Add at least one name or word' });
      const room = { code: newCode(), words, deck: [], status: 'lobby', players: new Map(), hostId: null, touched: Date.now() };
      const p = addPlayer(room, body.name);
      room.hostId = p.id;
      rooms.set(room.code, room);
      return json(res, 200, { code: room.code, playerId: p.id });
    }
    if (req.method === 'POST' && url.pathname === '/api/join') {
      const body = await readBody(req);
      const room = rooms.get(clean(body.code, 8).toUpperCase());
      if (!room) return json(res, 404, { error: 'No room with that code' });
      const p = addPlayer(room, body.name);
      broadcast(room);
      return json(res, 200, { code: room.code, playerId: p.id });
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      const body = await readBody(req);
      const room = rooms.get(clean(body.code, 8).toUpperCase());
      const player = room && room.players.get(body.playerId);
      if (!player) return json(res, 404, { error: 'Room or player not found' });
      handleAction(room, player, body);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/check') {
      const room = rooms.get(clean(url.searchParams.get('code'), 8).toUpperCase());
      const ok = !!(room && room.players.get(url.searchParams.get('playerId')));
      return json(res, ok ? 200 : 404, { ok });
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const room = rooms.get(clean(url.searchParams.get('code'), 8).toUpperCase());
      const player = room && room.players.get(url.searchParams.get('playerId'));
      if (!player) return json(res, 404, { error: 'Room or player not found' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      player.streams.add(res);
      broadcast(room);
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => {
        clearInterval(ping);
        player.streams.delete(res);
        if (rooms.has(room.code)) broadcast(room);
      });
      return;
    }
    // Static files
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    json(res, 400, { error: e.message });
  }
});

// Drop rooms idle for 6 hours
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600 * 1000;
  for (const [code, room] of rooms) {
    const online = [...room.players.values()].some((p) => p.streams.size);
    if (!online && room.touched < cutoff) rooms.delete(code);
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Headbands running on http://localhost:${PORT}`));
