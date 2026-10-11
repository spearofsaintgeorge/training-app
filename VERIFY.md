# VERIFY.md — Training System's verification contract

Read with the `prove-it` skill. This file is how a change gets proven.

The app is a single-file PWA: `index.html` (everything), `sw.js` (offline shell),
`manifest.webmanifest`, `icon.svg`. No build step, no dependencies. It stays one file
on purpose — pages are network-first in the service worker, so a single file
guarantees each update lands whole.

---

## ⚠ Gap — no test runner, no typecheck

The static gate is a syntax check only. Behaviour is proven by the in-page self-test
plus a real-data run in the Browser pane.

## The gates

1. **Syntax** (from the repo root):

```bash
python -c "import re,io;s=io.open('index.html',encoding='utf-8').read();io.open('app.check.js','w',encoding='utf-8').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))" && node --check app.check.js && rm app.check.js
```

2. **Self-test** — open `index.html?selftest=1` (or `#selftest`). Console prints
   `SELFTEST n/n PASS`; a panel lists every assertion. Synthetic fixtures only —
   self-test mode never writes to storage. A failing row is a failing build.

Preview: port **8831**, served by the Argus registry server (autostart).
`.claude/launch.json` entry `trainingapp` attaches to it — no process is started.

**Before testing a change:** unregister the service worker and clear caches, or the
first load can be the cached copy.

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k);
```

---

## The debug handle

```js
window.__train = { DB, draft, version, readonly(), migrate, loadFrom, plateMath, e1rm,
  suggest, prescribe, ladderLevel, liftStats, ctx, chipText, prBoard, milestoneDates,
  selftest, PROGRAM, TEMPLATES }
```

`DB` and `draft` are live getters. Read state from here rather than scraping text.

## Storage keys (per device, localStorage)

| Key | Holds |
|---|---|
| `argus_training_v1` | the data, `v: 3` |
| `argus_training_v1:draft` | the in-progress session — source of truth while lifting |
| `argus_training_v2_snapshot` | raw pre-upgrade copy, written once, never overwritten |
| `argus_training_v1:pre-import` | data from before the last import (Logbook → Undo) |
| `argus_training_v1:unreadable` | raw copy of data that failed to load (safe mode) |

Sent logs land in the owner's OneDrive training Logs folder (outside this repo); the newest `training-log-*.json` is the current truth.

---

## Feature map

Confirmed 2026-09-30 (v3.0.0); rows marked v3.1 added 2026-10-10. **A stale row is a defect.**

| Concept | Control | Source | Proof |
|---|---|---|---|
| Data upgrade v2 → v3 | automatic on load | `migrate`, `loadFrom`, `load` | self-test migrate rows; real backup: Spartan block archived, logs tagged, bodyweight-typed hang / hip thrust / leg curl normalized, snapshot key written |
| Safe mode | automatic | `load` → `READONLY`, `renderGlobalBanners` | put invalid JSON in `argus_training_v1`, reload: red banner, every write refused, stored string byte-identical, raw copy in `:unreadable` |
| Blocks & season | Season tab: Start / Move start / End block | `startBlock`, `makeBlock`, `moveBlock`, `endBlock`, `timelineHTML`, `blockCardHTML` | Strength + Bulk from Mon Oct 5 2026 ends Jan 24 2027; weeks 8 and 12 labelled Thanksgiving / Christmas |
| Header chip | top-right chip | `chipText`, `renderHeader` | `W3/16 · Groove` mid-block; `5d · To block` before start |
| Prescriptions | px line in Sessions and gym mode | `prescribe`, `PROGRAM`, `TEMPLATES` | self-test prescription rows (build, deload, express, flat day, peak) |
| Progression | "Suggested" line | `suggest`, `incFor`, `roundLoad` | all sets at the top of the range → +10 lower / +5 upper next time; assisted pull-up help −10 (−5 at ≤30) |
| Draft | any set input, gym mode | `newDraft`, `saveDraft`, `draftEntries`, `commitDraft` | type a set, reload mid-session → Resume banner with the value intact |
| Gym mode | Start / Resume | `openGym`, `renderGym`, `gymDone`, `gymStep`, `gymRir`, `gymVariant` | ✓ Set done → set recorded, weight carried to the next set, rest timer running |
| Rest timer | after ✓ Set done | `startRest`, `tick`, `restAlarm` | set `draft.rest.endAt` to now+1 s: "Rest over — go", flash, 3 oscillator tones, `fired` persisted |
| Plate math + warm-up | gym set card | `plateMath`, `plateViz`, `warmup` | 225 on a 60 lb trap bar = 45 + 35 + 2.5 per side |
| Equipment drawings (v3.1) | gym set card, under the steppers | `equipViz` dispatcher → `plateViz` (barbell), `vizTrap`, `vizSled`, `vizDB`, `vizKB`, `vizStack`, `vizAssist`, `vizBW`, `vizHang`/`vizHangTick` | self-test rows "every variant draws without NaN…" and "drawings exist for every loaded mode"; then open gym mode on one exercise per mode at 375 px and look |
| Implement count (v3.1) | — | `V(name, mode, count)`, `VARIANT_INDEX`, `implCount` | DB Row / Goblet Squat draw one implement, bench/RDL draw a pair; tonnage counts pairs ×2 |
| Send to OneDrive (v3.1) | Logbook → Send to OneDrive; sheet after each log; Today nudge | `sendLog`, `askSaved`, `confirmPending`, `offerSend`, `unsentCount`, `logStamp`, `logFileName` | share sheet gets `training-log-YYYY-MM-DD-HHMM.json` (iPhone) or the same JSON as `.txt` (Chrome/Android refuse .json); cancel = not sent; no share support or a share error = save-file sheet, counted as sent only after "It's in the Logs folder"; unsent = logs finished after the last send (deletes can't hide new ones); the file embeds its own `lastSent` and re-imports as up to date |
| Readiness + Express | sheet on Start, Express toggle | `askReadiness`, `pickReady`, `prescribe` opts | Wrecked → Express −10%: two starred lifts, +2 RIR |
| Scoreboard | Progress tab | `prBoard`, `prsFor`, `milestoneDates`, `ladderLevel`, `regress` | a heavier second session → PR in the finish summary and the toast; first-ever session never toasts |
| Today | Today tab | `renderToday`, `isDone`, `isRest`, `eatList` | tower shows "gym day — rests" once a lift is logged; Zone 2 shows n / target for the week |
| Import / export | Logbook → Data | `exportData`, `importData`, `undoImport` | import a raw v2 backup → migrated, pre-import kept; Undo restores the prior count |
| Offline shell | — | `sw.js` | registration active, cache `argus-training-shell-v3` holds the 4 assets, cached `index.html` matches the served one |

---

## Recipes by change class

- **Data model.** Add a self-test row first. `migrate` must be idempotent: run it twice,
  compare. Never ship a `migrate` change without running it against a real exported
  backup from the phone.
- **Program / prescriptions.** Read the result from `__train.prescribe` against a built
  context; the UI only formats it.
- **Copy.** This repo is public. No health terms, no emails, no personal paths or
  personal details — the push guard blocks them, and it should.

## Deploy

Public repo on GitHub Pages. Push only through the machine's push script
(`-Mode manual -Only training-app`); commits use the GitHub no-reply identity. After a
push, fetch the Pages `index.html` and check `APP_VERSION`. On the phone: open with
signal, wait ~5 s, fully close, reopen.

## Known hazards

- **First open after an update can be the old copy;** the second open gets the new one.
- **An older cached copy of the app can touch v3 data** before the new page loads.
  `migrate` runs on every load and is idempotent for exactly this reason (self-test row
  "old cached app…").
- **iOS:** no vibration; screen wake lock needs 16.4+; the beep needs one tap first.
- **Per-device data.** Phone and desktop are separate logbooks — Export/Import moves data.
