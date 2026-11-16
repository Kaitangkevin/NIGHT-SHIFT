<p align="center">
  <img src="assets/favicon.svg" alt="NIGHT SHIFT streetlight logo" width="84" height="84">
</p>

<h1 align="center">NIGHT SHIFT</h1>

<p align="center"><strong>One map a day. Light up your city.</strong></p>

<p align="center">
  <a href="https://github.com/Kaitangkevin/NIGHT-SHIFT"><strong>Visit the project on GitHub ↗</strong></a>
  ·
  <a href="#run-locally">Play locally</a>
</p>

## About the game

Night has fallen, and parts of the city have gone dark. You’re tonight’s lighting technician. Use the fixed electrical cabinets and the numbers around an 8×8 grid to work out where every streetlight belongs.

NIGHT SHIFT is a daily browser puzzle by **PaJii Studio**. A quiet 3D street scene leads into a timed logic challenge you can play on desktop or mobile. A new map opens at midnight Beijing time. Once you solve it, you can submit your time to the daily leaderboard.

## Game rules · V4.0

- **Match one fixture to every cabinet.** Each cabinet must be paired with exactly one fixture, and each fixture must be paired with a different cabinet. Cabinets are fixed. A fixture must touch its assigned cabinet above, below, to the left, or to the right. Diagonal contact does not count.
- **Choose the fixture type.** A single-cell streetlight occupies one square. A double-cell streetlight occupies two consecutive squares, horizontally or vertically. The two squares form one fixture, and either square can provide the connection to its one cabinet.
- **Leave space between fixtures.** Separate fixtures cannot touch horizontally, vertically, or diagonally. Only the two squares within one double-cell fixture can touch.
- **Match the row and column clues.** Each clue gives the number of squares that must be occupied by streetlights in that row or column. A horizontal double counts twice in its row. A vertical double counts once in each of its two rows. Cabinets do not count toward the clues.
- **Use only the inventory you need.** Each puzzle provides up to seven single-cell fixtures and two double-cell fixtures. The cabinet count tells you how many fixtures you need, and the clues tell you how many squares those fixtures must occupy.

The game automatically detects a win when all cabinets can be paired, all row and column clues are met, and the layout respects the spacing and inventory rules. Each published map is checked by the solver for a unique legal fixture layout.

### Controls

| Action | How to do it |
| --- | --- |
| Place a single-cell streetlight | Select the single-cell tool, then click or tap an empty square. |
| Place a double-cell streetlight | Select the double-cell tool and choose an orientation. Click or tap the first square, then a highlighted adjacent square. |
| Remove a fixture | Double-click or double-tap either of its squares. On a keyboard, press Delete on the square. |
| Mark an exclusion | Select the × tool and click or tap an empty square. Click or tap it again to clear the mark. |
| Reset the board | Clear your fixtures and exclusion marks while retaining the original clues, cabinets, and elapsed time. |

Start with rows or columns marked **0**. Then look for cabinets with only one possible adjacent square.

### Daily challenges and rankings

A new published map becomes available at **00:00 Beijing time** (`Asia/Shanghai`). Everyone plays the same map on a given date. After solving it, enter a display name to submit your time. The first three places appear on the podium, with the remaining places listed below. Each date has its own leaderboard, and past scores stay in storage.

## Run locally

Requires Node.js 22 or later. No dependency installation is needed.

```sh
node server.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Without a Supabase configuration, scores are stored locally in `.night-shift-scores.json`.

### Connect Supabase

1. Run the [leaderboard migration](supabase/migrations/20261116000000_night_shift_leaderboard.sql) in your Supabase project's SQL Editor.
2. Copy [`.env.example`](.env.example) to `.env.local` and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Keep the secret key in the server environment.
3. Start the server with `node --env-file=.env.local server.mjs`.

The server validates each completed board and records the time before accepting a score. Each attempt can produce only one score. Active attempts are held in memory and must be restarted if the server restarts.

### Publish a map

`config.mjs` defines the start date for DAY 001. The [map manifest](maps.json) includes daily challenges through December 14, 2026. To add dates, run:

```sh
node scripts/publish-map.mjs 2026-12-15
node scripts/publish-map.mjs 2026-12-16 8 1
```

The optional arguments are the cabinet count and the double-cell fixture count. The script verifies that the map has exactly one solution before writing it and preserves existing dates.

## Copyright

Copyright © 2026 PaJii Studio. All rights reserved.

NIGHT SHIFT is a product of PaJii Studio. Third-party software remains subject to its own license. See the [Three.js license](assets/three-LICENSE.txt).
