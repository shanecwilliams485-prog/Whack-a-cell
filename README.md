# Whack-a-Cell

A mobile-friendly browser game for GitHub Pages.

## Current version

**Banked Bonus Scores v11 — bonuses add at final score screen**

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
?v=10
```

## Notes

The high-score board now uses Firebase Firestore for shared online scores. It also keeps local backup scores if Firebase is unavailable.


## Shared online scores

This version uses Firebase Firestore for a shared family leaderboard. Scores are also saved locally as a backup if Firebase or the internet is unavailable.

Create a Cloud Firestore database in the Firebase project `whack-a-cell-score-sheet`, then use simple test/family rules while you are developing. For a private family game, consider adding tighter rules or a family passcode before sharing the link widely.

Recommended Firestore collection name: `scores`.


## v11 scoring update

Bonus-round points are now banked separately during play. They are not added to the Whack-a-Cell score during the main game. At game over, the final score screen clearly shows Whack score + bonus points = total score, and that total is saved to the shared leaderboard.
