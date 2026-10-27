# Scripts

All three need Node 18+ and Playwright with Chromium (`require('playwright')`
must work; many cloud sessions have it preinstalled). `audit.js` also needs
`axe-core`: run `npm install` in this folder once (it's pinned in package.json).

## Scenes file
A JSON array. Each scene has a `name` and a `setup`: JavaScript evaluated in the
page to open that screen (call the app's own functions, click buttons, set
state). Run from a fresh page load unless `keep: true`.

```json
[
  { "name": "main" },
  { "name": "settings", "setup": "document.getElementById('settingsBtn').click()" },
  { "name": "game-over", "setup": "score = 2940; showGameOver()" },
  { "name": "leaderboard", "setup": "lbOpen('everyone')", "keep": true }
]
```

## Themes
`--themes data-skin=fruit,night,halloween` sets `document.documentElement`
attributes before load. `--theme-storage fruitpicnic.theme` writes the value to
localStorage instead (for apps that read their theme from there). Omit for one
theme. `--init "<js>"` runs before every load (e.g., to mark a tutorial done).

## Stubs
`--stub stub.json` answers network calls whose URL contains a key with the JSON
value, so screens show real-looking data without a backend:
```json
{ "/rpc/leaderboard": [ { "name": "Juniper", "score": 9000, "place": 1 } ], "/rpc/check_name": true }
```

## Commands
```
node audit.js  <url> --scenes scenes.json [--themes ...] [--stub stub.json] [--viewport 390x844] [--init "<js>"] [--json out.json]
node motion.js <dir-or-files...> [--tokens]
node shots.js  <url> --scenes scenes.json [--themes ...] [--stub ...] [--viewport 390x844] --out shots/
```
`<url>` may be `file:///…/index.html` or `http://localhost:…`.

## Example (Fruit Picnic)
```
node audit.js file:///path/to/fruit-picnic/index.html --scenes examples/fruit-picnic.scenes.json \
  --themes data-skin=fruit,night,halloween --theme-storage fruitpicnic.theme \
  --stub examples/fruit-picnic.stub.json --init "localStorage.setItem('fruitpicnic.tutorial','done'); localStorage.setItem('fruitpicnic.lbName','Mimi')"
node motion.js /path/to/fruit-picnic --tokens
```
