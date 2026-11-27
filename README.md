# Headbands

A party game for phones. Each player holds their phone up to their forehead, showing a name or word that **everyone else can see but them**. Ask questions, get clues, and guess who (or what) you are.

## How to play

1. **Host:** tap **Create a new room**, enter your name, and type a list of names or words (one per line or comma-separated). You can also add starter packs (Celebrities, Historical, Characters, (In)famous, Animals, Things). You get a 4-letter room code.
2. **Everyone else:** open the site, enter the room code and your name, and tap **Join**. The host can also tap **Share invite link**.
3. The host taps **Start game**. Every player gets **one** random name from the list, and it stays the same for the whole game.
4. Tap **Put it on my forehead**. After a 3-second countdown your name fills the screen. Hold the phone to your forehead with the screen facing out.
5. Take turns asking yes/no questions. When the others say you've got it, tap **I guessed it!**. Your name is revealed and you get a place (1st, 2nd…). Stuck? Tap **Give up**.
6. Off your forehead, the room screen shows everyone else's name so you can answer their questions. Your own shows as `???`.
7. The game ends when everyone has guessed or given up, or when the host taps **End game**. The host can then play again with new names.

The host can add more words mid-game, for example for late joiners.

## Play online

**https://hassmax.github.io/headbands/** (deployed by GitHub Pages from `main`)

There's no game server. The host's phone runs the room, so **the host should keep the page open**. Other phones connect straight to it over WebRTC, using [PeerJS](https://peerjs.com)'s free public broker to find each other. If anyone refreshes or briefly loses signal, they reconnect to the same room automatically.

## Run it locally

Needs Node 18 or newer. There are no dependencies.

```bash
npm start            # http://localhost:3000
```

Phones still need internet access to find each other. Full screen needs HTTPS, which GitHub Pages provides.

## Deploying

`.github/workflows/pages.yml` publishes the `public/` folder to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. `public/` is plain static files, so any static host (Netlify, Cloudflare Pages, Vercel) also works.

## Files

- `public/index.html`: the whole game: UI, host room logic, and peer connections.
- `public/peerjs.min.js`: PeerJS 1.5.4, a vendored copy (MIT license).
- `server.js`: tiny static file server for local testing.
