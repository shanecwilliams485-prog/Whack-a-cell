# Whack-a-Cell

A GitHub Pages-ready mobile web game prototype built for iPhone-style touch controls.

## Current version

**Sound + Tutorial Update v5**

## Features

- 6x6 whack grid with 36 battery-cell holes.
- Battery cells pop up, shake, glow, and vent if not tapped in time.
- 3, 2, 1, GOOD LUCK countdown before play starts.
- Big on-screen messages for level ups, bonus rounds, thermal runaway, and loss.
- Loss sequence with cap burst, thermal flame, smoke fill, and flashing **YOU LOSE PAL** text.
- Level 5 bonus round: **Magnetic Deflector**.
- Level 10 bonus round: **Pressure Release**.
- New start-screen tutorial toggle:
  - When enabled, quick tuition appears before the game.
  - Extra tuition appears before each bonus round.
- Super Whack has been removed.

## Sound effects

All sound is generated in the browser, so there are no external audio files to upload.

- Sharper electrical buzz/zap when tapping cells.
- Flame roar when a cell bursts.
- Smoke-rush sound during the loss sequence.
- Classic descending lose melody.
- Intense rushing bonus-round music that accelerates during the 15-second bonus rounds.

On iPhone, turn off silent mode and raise the volume. Audio starts after tapping **Start Game**, which is required by iOS Safari.

## Files to upload to GitHub

Upload these four files to the root of your repository:

```text
index.html
styles.css
game.js
README.md
```

Do not place them inside a folder. GitHub Pages needs `index.html` at the repo root.

## GitHub Pages setup

1. Go to your repository on GitHub.
2. Open **Settings**.
3. Open **Pages**.
4. Set source to **Deploy from a branch**.
5. Choose branch **main** and folder **/root**.
6. Save and wait for the deployment to finish.

If your iPhone shows an older version, open the URL with a cache-buster such as:

```text
?v=5
```
