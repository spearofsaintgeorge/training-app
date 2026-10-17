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

Confirmed 2026-09-30 (v3.0.0); rows marked v3.1 added 2026-10-10; v3.2 engine rows 2026-10-10. **A stale row is a defect.**

| Concept | Control | Source | Proof |
|---|---|---|---|
| Data upgrade v2 → v3 | automatic on load | `migrate`, `loadFrom`, `load` | self-test migrate rows; real backup: Spartan block archived, logs tagged, bodyweight-typed hang / hip thrust / leg curl normalized, snapshot key written |
| Safe mode | automatic | `load` → `READONLY`, `renderGlobalBanners` | put invalid JSON in `argus_training_v1`, reload: red banner, every write refused, stored string byte-identical, raw copy in `:unreadable` |
| Blocks & season | Season tab: Start / Move start / End block | `startBlock`, `makeBlock`, `moveBlock`, `endBlock`, `timelineHTML`, `blockCardHTML` | Strength + Bulk from Mon Oct 5 2026 ends Jan 24 2027; weeks 8 and 12 labelled Thanksgiving / Christmas |
| Header chip | top-right chip | `chipText`, `renderHeader` | `W3/16 · Groove` mid-block; `5d · To block` before start |
| Prescriptions | px line in Sessions and gym mode | `prescribe`, `PROGRAM`, `TEMPLATES` | self-test prescription rows (build, deload, express, flat day, peak) |
| Progression (v3.2 predictive engine) | 'Suggested' line + basis line on every card; finish summary 'card N @R, got M' | `planFor` → `makeLadder`, `classify` (working vs ramp sets), `rirOf`/`est` (level = load × (1 + (reps + RIR)/30)), `levelOf` (same-slot, 2-session mean, gap/stale/expire), `judgeSession`, `cardFor` (P/D tracks, bridge, guards G0–G4), `hangCard`, `bwCard`, `repredictAfter` | self-test rows 'predicted loads match the hand-worked examples', 'assisted pull-ups…' (both), 'blank RIR…never ratchets down', 'an establish card with a blank RIR…', 'flat/rough days…', 'dumbbell jump…', '2+ weeks away…', 'the week after a deload…', 'a test-week log only overrides…', 'a rough-day express session is logged light…', 'test week…deload…', 'hinges never…'; real-log run reproduces the 14 worked examples in the design spec |
| Draft | any set input, gym mode | `newDraft`, `saveDraft`, `draftEntries`, `commitDraft` | type a set, reload mid-session → Resume banner with the value intact |
| Gym mode | Start / Resume | `openGym`, `renderGym`, `gymDone`, `gymStep`, `gymRir`, `gymVariant` | ✓ Set done → set recorded, weight carried to the next set, rest timer running |
| Rest timer | after ✓ Set done | `startRest`, `tick`, `restAlarm` | set `draft.rest.endAt` to now+1 s: "Rest over — go", flash, 3 oscillator tones, `fired` persisted |
| Plate math + warm-up | gym set card | `plateMath`, `plateViz`, `warmup` | 225 on a 60 lb trap bar = 45 + 35 + 2.5 per side |
| Prescriptions by phase (v3.2) | px line on every card | `prescribe` (phase.mus RIR for muscle work, hiRep → RIR 1, rirFloor 2 on hinges, peak/test overrides, returning +1 RIR, readiness +1/+2 once) | self-test 'hinges never prescribe below 2 RIR; high-rep isolation goes to 1' |
| In-session re-prediction + variant split (v3.2) | Gym mode: after a set that's off plan, the next sets move one notch with a toast and the reps pre-fill; switching variant mid-exercise | `repredictAfter` (uses the card's shown RIR; never on deload/test cards), `gymDone` (stamps `set.vn`), `switchVariant` (clears stale marks), `defaultReps` (`rp`), `draftEntries` (one entry per variant, card only on the current one) | self-test rows 'a set done on another variant…', 'deload and test cards are never re-predicted…', 'after a re-prediction the next set pre-fills…'; e2e: Upper A bench 145×4@1 vs card 145×6@3 → set 2 = 140, reps 3, toast; switch to DB bench → log holds two entries |
| Missed sessions, calendar kept (v3.2) | Card hint 'first full session in N days — …'; Today/Dashboard line 'Back after N days — picking up at week W, Phase. …'; Save/Discard on an unfinished session from 2+ days ago | `AWAY_D`/`longestHole`/`backFromAway` (a real break = 7+ blank days in a row; a lone lift = 21+ days), `levelOf` (age from the last counted session when away; expire branch keeps +1 RIR and a same-slot opener), `cardFor` (no max test when returning; check-in lowers D-track weight), `hangCard`/`bwCard`, `deloadSignal` (ignores a slide from before a break), `awayLineHTML`, `draftStale`/`tidyStaleDraft`/`saveStaleDraft` | self-test rows 'a steady two-a-week stretch is not a break…', 'the dead hang keeps progressing at two sessions a week', 'a muscle-day check-in after 4+ weeks…', 'back from time away in test week…', 'the early-deload offer ignores a slide…', 'one quiet line after 14+ days away…', 'an unfinished session from days ago…', 'the card says when a return means a lighter weight', 'copy matches keep-the-calendar'; before/after harness: old build flags two-a-week as returning, hides a 5-week break behind a deload, check-in 132.5×5 unreachable, max test after a gap — new build fixes all four |
| Log-review fixes (v3.2.2) | Cards after a session with a tired last set; mid-session moves on accessories; Lower B after a home week | `classify` → `bestSet`/`setLevels`/`cardMet` (level and last-time weight from the strongest working set within 3 reps of failure; judgement still reads the last set), `repredictAfter` (accessories/high-rep need a 2-rep miss; next set expects 1 rep lost at 150 s+ rest, 2 below), `trainingDays` (activities from 'Did something else?' count for `longestHole`, `deloadSignal`, `awayLineHTML`) | self-test rows 'a session is read from its strongest close-to-failure set…', 'far-from-failure calls and warm-ups never set the level…', 'mid-session: accessories hold for a 1-rep miss…', 'a home or yoga day logged on Today is training…'; old-vs-new cards on the 10-16 export (`nextcards.js`): Upper B assisted 167.5 → 145 help, Lower B no longer returning, trap 160 → 170 |
| Early deload (v3.2) | Today banner 'Make this week a deload' | `deloadSignal`, `deloadNow`, `ctxAt` (block.deloadWeek) | a main lift's level falling 2 sessions running, or 2 red check-ins, shows the banner; accepting turns this week into a deload only |
| The Why + references (v3.2) | The Why tab | `WHY_CARDS`, `WHY_REFS`, `renderWhy` | 20 cards, 41 references; every DOI checked against Crossref (author + year) before publishing |
| Suspect old entry prompt (v3.2) | Card line on a held-back isolation entry: 'per dumbbell, both together, or a barbell?' | `quarantined`, `suggestLine`, `confirmEntry('each'|'total'|'barbell')` — barbell moves the entry to Barbell Curl (bb), sets the slot's variant, re-cards an unstarted draft | self-test 'a July curl confirmed as a barbell…'; e2e on the real export: Upper B → Biceps Curl → tap Barbell → card = Barbell Curl opener 45 × 8, stored log entry is Barbell Curl/bb |
| Stack add-ons (v3.2) | Settings toggle 'Stacks take 2.5 and 5 lb add-on plates (both = 7.5)'; stack drawing | `makeLadder` (adds 0/2.5/5/7.5 below the stack step), `vizCfg` (addOns), `vizStack` (two add-on plates for 7.5; off = whole plates only) | self-test 'stacks load in 2.5 lb steps with add-ons…'; e2e: Seated Cable Row at 47.5 draws pin 40 + 7.5, no 'won't load' |
| Equipment drawings (v3.1) | gym set card, under the steppers | `equipViz` dispatcher → `plateViz` (barbell), `vizTrap`, `vizSled`, `vizDB`, `vizKB`, `vizStack`, `vizAssist`, `vizBW`, `vizHang`/`vizHangTick` | self-test rows "every variant draws without NaN…" and "drawings exist for every loaded mode"; then open gym mode on one exercise per mode at 375 px and look |
| Implement count (v3.1) | — | `V(name, mode, count)`, `VARIANT_INDEX`, `implCount` | DB Row / Goblet Squat draw one implement, bench/RDL draw a pair; tonnage counts pairs ×2 |
| Send to OneDrive (v3.1) | Logbook → Send to OneDrive; sheet after each log; Today nudge (destination: the Training folder the phone already uses) | `sendLog`, `askSaved`, `confirmPending`, `offerSend`, `unsentCount`, `logStamp`, `logFileName` | share sheet gets `training-log-YYYY-MM-DD-HHMM.json` (iPhone) or the same JSON as `.txt` (Chrome/Android refuse .json); cancel = not sent; no share support or a share error = save-file sheet, counted as sent only after "It's in the Logs folder"; unsent = logs finished after the last send (deletes can't hide new ones); the file embeds its own `lastSent` and re-imports as up to date |
| Readiness + Express | sheet on Start, Express toggle | `askReadiness`, `pickReady`, `prescribe` opts | Wrecked → Express −10%: two starred lifts, +2 RIR |
| Scoreboard | Progress tab | `prBoard`, `prsFor`, `milestoneDates`, `ladderLevel`, `regress` | a heavier second session → PR in the finish summary and the toast; first-ever session never toasts |
| Today | Today tab | `renderToday`, `isDone`, `isRest`, `eatList` | tower shows "gym day — rests" once a lift is logged; Zone 2 shows n / target for the week |
| Import / export | Logbook → Data | `exportData`, `importData`, `undoImport` | import a raw v2 backup → migrated, pre-import kept; Undo restores the prior count |
| Offline shell | — | `sw.js` | registration active, cache `argus-training-shell-v3` holds the 4 assets, cached `index.html` matches the served one |

---

## Recipes by change class

- **Weight engine.** Encode the case as a self-test row with a hand-computed expected card first. Then run the lifter's real exported log through `planFor` in a self-test page (NOSAVE) and compare against the design spec's worked examples. Never ship an engine change on unit rows alone.

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
