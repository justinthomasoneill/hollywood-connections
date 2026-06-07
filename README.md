# 🎬 Hollywood Connections — Static Edition

A Six Degrees of Separation quiz game powered by real IMDb data.
**No AI API. No server calls during gameplay.** Everything runs client-side from a pre-built JSON graph.

---

## How it works

1. A Python script downloads 3 IMDb TSV files (~150MB total), filters them to
   the top 600 most-filmed actors and highly-rated movies, and outputs a
   compact `public/data/graph.json` (~500KB).
2. The Next.js app loads that JSON once on startup, then does all pathfinding
   and validation in the browser using BFS (Breadth-First Search).
3. No API keys. No server calls during play. Works offline after first load.

---

## Setup (do this once)

### 1. Install dependencies

```bash
npm install
```

### 2. Build the dataset

```bash
npm run build-data
```

This downloads IMDb data into a `tmp_imdb/` folder (can be deleted afterward)
and writes `public/data/graph.json`. Takes 2–5 minutes depending on your connection.

> **Note:** IMDb datasets are free for personal/non-commercial use.
> See: https://developer.imdb.com/non-commercial-datasets/

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel (free, no env vars needed)

1. Push this whole folder to a GitHub repo
2. Go to https://vercel.com → **Add New Project** → import your repo
3. Click **Deploy** — no environment variables required
4. Done. You get a live URL like `hollywood-connections.vercel.app`

> Make sure `public/data/graph.json` is committed to your repo before deploying.
> It's ~500KB so well within GitHub/Vercel limits.

---

## Game features

- 🎬 **Easy / Medium / Hard** — difficulty controls degrees of separation (1-2 / 2-3 / 3-4)
- 💡 **Hints** — BFS-powered, shows a real intermediate actor without giving it away
- ⭐ **Optimal path** — revealed on the win screen so you can see the shortest route
- 🔤 **Autocomplete** — start typing an actor or movie name for suggestions
- 📊 **Best scores** — tracked per difficulty in session

---

## Customising the dataset

Edit `scripts/build_dataset.py`:

| Variable | Default | Effect |
|----------|---------|--------|
| `MIN_VOTES` | 50,000 | Minimum IMDb votes to include a film |
| `TOP_ACTORS` | 600 | Number of top actors to include |
| `MIN_MOVIES_PER_ACTOR` | 3 | Min films an actor must have |

Lower `MIN_VOTES` = more obscure films. Higher `TOP_ACTORS` = larger graph (bigger file).
