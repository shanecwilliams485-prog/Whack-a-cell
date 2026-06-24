# Whack-a-Cell

**Effects Update v3**: countdown, burst animation, smoke loss scene, “YOU LOSE PAL” flash, electric buzz hit sound, flame/smoke sounds, and lose melody.

A mobile-first browser game inspired by whack-a-mole. Tap overheating cylindrical battery cells before they vent into a thermal event.

## Features

- iPhone-friendly touch controls
- 4x4 whack grid, tuned for sensible iPhone touch play
- Countdown start: **3, 2, 1, GOOD LUCK**
- Cylindrical battery cells that pop up from holes, shake, overheat, and get ready to burst
- Big on-screen event words, including **LEVEL UP**, **SUPER WHACK**, **THERMAL RUNAWAY**, and **YOU LOSE PAL**
- Staged loss sequence: cell top pops, thermal flame bursts out, smoke bellows across the screen, then **YOU LOSE PAL** flashes
- Faster levels as score increases
- Browser-generated sound effects:
  - Short sharp electrical buzz when a cell is tapped
  - Roaring flame when a cell bursts
  - Smoke-rush noise as smoke fills the screen
  - Classic descending “you lose” style melody
- Level 5 Super Whack button: doubles points for 10 seconds and plays an original heavy riff generated in-browser
- Local best score storage

## Important audio note

This prototype does **not** include voice clips, impersonated real-person voice audio, or copyrighted music. It uses browser-generated sound effects and original generated Super Whack music. On iPhone, tap **Start Game** first to unlock audio, and make sure the phone is not in Silent Mode. To add licensed, owned, or recorded family-joke audio later, place your files in an `assets/` folder and update `game.js`.

## Run locally

Open `index.html` in a browser, or run a small local server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `game.js`, and `README.md` to the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root`, then save.
6. GitHub will provide a public web app URL after deployment.

## Customisation ideas

- Change scoring and level speed in `game.js`.
- Replace generated audio with licensed audio files.
- Add more levels, different cell types, power-ups, and animations.
- Add a PWA manifest so the game can be installed on an iPhone home screen.
