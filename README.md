# Headbands

A party game for phones. Each player holds their phone up to their forehead, showing a name or word that **everyone else can see but them**. Ask questions, get clues, and guess who (or what) you are.

## How to play

1. **Host:** tap **Create a new room**, enter your name, and type a list of names or words (one per line or comma-separated). You can also add starter packs (Celebrities, Historical, Characters, Animals, Things). You get a 4-letter room code.
2. **Everyone else:** open the site, enter the room code and your name, and tap **Join**. The host can also tap **Share invite link**.
3. The host taps **Start game**. Every player gets a random word from the list.
4. Tap **Put it on my forehead**. After a 3-second countdown your word is shown big. Hold the phone to your forehead with the screen facing out.
5. When you guess right, **tilt down** or **tap the right side**. To skip, **tilt up** or **tap the left side**. You then get a new word. Skipped words go back into the pile.
6. Off your forehead, the room screen shows what everyone else is so you can give them clues. Your own word shows as `???`.
7. The host taps **End game** to show the scoreboard and what each person guessed. They can then play again or go back to the lobby.

The host can add more words mid-game.

## Run it

Needs Node 18 or newer. There are no dependencies.

```bash
npm start            # http://localhost:3000
PORT=8080 npm start  # different port
```

To play with phones on the same Wi-Fi, open `http://<your-computer-ip>:3000` on each phone. To play over the internet, deploy to any Node host (Render, Railway, Fly.io, etc.). Phones need **HTTPS** for tilt controls and full screen; tapping works everywhere.

## How it works

- `server.js` is a plain Node HTTP server. Rooms are stored in memory and dropped after 6 hours idle. Live updates go out over Server-Sent Events, and actions come in as `POST /api/action`.
- `public/index.html` is the whole client in one file: no build step and no framework.
