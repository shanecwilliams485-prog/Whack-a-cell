# Whack-a-Cell

A mobile-friendly browser game for GitHub Pages.

## Current version

**High Scores v9 — name entry, scoreboard, final bonus breakdown**

## Features

- 6x6 Whack-a-Cell grid.
- iPhone-friendly tap controls.
- Countdown before the game starts.
- Cell pop-up, shake, flame, smoke and lose effects.
- Electrical zap on successful cell hits.
- Level 5 bonus round: Magnetic Deflector.
- Level 10 bonus round: Pressure Release.
- Bonus rounds last up to 15 seconds and add doubled bonus points to the main score.
- Bonus failure returns to the main game instead of ending the whole run.
- Optional tuition screens, enabled from the start screen.
- Local best-scores board with player name entry.
- Best scores are saved in the browser on the device using `localStorage`.

## Uploading to GitHub Pages

Upload these four files to the root of your repository:

```text
index.html
styles.css
game.js
README.md
```

Then enable GitHub Pages in:

```text
Settings → Pages → Deploy from a branch → main → /root
```

After replacing files, open your Pages URL with a cache-buster such as:

```text
?v=9
```

## Notes

The high-score board is local to each browser/device. It does not sync online unless you later add a backend database.
