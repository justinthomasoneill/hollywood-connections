#!/usr/bin/env python3
"""
Hollywood Connections - IMDb Dataset Builder
============================================
Run this script once to generate public/data/graph.json for the game.

Requirements: pip install requests
Usage:       python scripts/build_dataset.py

Downloads ~150MB of IMDb TSV data, processes it, and outputs a compact
~500KB JSON graph of top actors and their shared movies.
"""

import gzip
import json
import os
import urllib.request
from collections import defaultdict

# ── Config ─────────────────────────────────────────────────────────────────

IMDB_BASE = "https://datasets.imdbws.com"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "tmp_imdb")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "graph.json")

# Only keep movies/films (not TV series, shorts, etc.)
ALLOWED_TYPES = {"movie", "tvMovie"}

# Minimum IMDb rating votes to filter obscure titles
MIN_VOTES = 50_000

# How many top actors to include (by number of qualifying film appearances)
TOP_ACTORS = 600

# Minimum movies an actor must have to be included
MIN_MOVIES_PER_ACTOR = 3

# ── Helpers ────────────────────────────────────────────────────────────────

def download(filename):
    url = f"{IMDB_BASE}/{filename}"
    dest = os.path.join(DATA_DIR, filename)
    if os.path.exists(dest):
        print(f"  ✓ {filename} already cached")
        return dest
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"  ↓ Downloading {filename} ...")
    urllib.request.urlretrieve(url, dest)
    print(f"    Done.")
    return dest

def read_tsv(path):
    print(f"  Reading {os.path.basename(path)} ...")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        headers = f.readline().strip().split("\t")
        for line in f:
            parts = line.strip().split("\t")
            yield dict(zip(headers, parts))

# ── Step 1: Load highly-rated movies ───────────────────────────────────────

print("\n[1/5] Loading title ratings ...")
high_rated = set()
for row in read_tsv(download("title.ratings.tsv.gz")):
    if int(row["numVotes"]) >= MIN_VOTES:
        high_rated.add(row["tconst"])
print(f"  → {len(high_rated):,} titles with ≥{MIN_VOTES:,} votes")

# ── Step 2: Filter to movies only ──────────────────────────────────────────

print("\n[2/5] Loading title basics (movies only) ...")
movies = {}  # tconst → title string
for row in read_tsv(download("title.basics.tsv.gz")):
    if row["titleType"] in ALLOWED_TYPES and row["tconst"] in high_rated:
        if row["primaryTitle"] and row["primaryTitle"] != "\\N":
            movies[row["tconst"]] = row["primaryTitle"]
print(f"  → {len(movies):,} qualifying movies")

# ── Step 3: Load actor names ───────────────────────────────────────────────

print("\n[3/5] Loading actor names ...")
actors = {}  # nconst → name string
for row in read_tsv(download("name.basics.tsv.gz")):
    profs = row.get("primaryProfession", "")
    if "actor" in profs or "actress" in profs:
        if row["primaryName"] and row["primaryName"] != "\\N":
            actors[row["nconst"]] = row["primaryName"]
print(f"  → {len(actors):,} actors/actresses in database")

# ── Step 4: Build actor↔movie graph from principals ────────────────────────

print("\n[4/5] Building graph from title.principals ...")
actor_movies = defaultdict(set)   # nconst → set of tconsts
movie_actors = defaultdict(set)   # tconst → set of nconsts

for row in read_tsv(download("title.principals.tsv.gz")):
    tconst = row["tconst"]
    nconst = row["nconst"]
    category = row.get("category", "")
    if tconst in movies and nconst in actors and category in ("actor", "actress"):
        actor_movies[nconst].add(tconst)
        movie_actors[tconst].add(nconst)

print(f"  → {len(actor_movies):,} actors with at least one qualifying movie")

# ── Step 5: Select top actors and build compact output ─────────────────────

print("\n[5/5] Selecting top actors and serialising ...")

# Rank actors by number of qualifying movies
ranked = sorted(
    [(nconst, mids) for nconst, mids in actor_movies.items() if len(mids) >= MIN_MOVIES_PER_ACTOR],
    key=lambda x: -len(x[1])
)[:TOP_ACTORS]

selected_actors = {nconst for nconst, _ in ranked}

# Only keep movies that have ≥ 2 selected actors (otherwise useless for the game)
useful_movies = {
    tconst
    for tconst, cast in movie_actors.items()
    if len(cast & selected_actors) >= 2
}

# Build compact output structures
out_actors = {}   # nconst → {name, movies: [tconst, ...]}
out_movies = {}   # tconst → {title, actors: [nconst, ...]}

for nconst, mids in ranked:
    valid_mids = [m for m in mids if m in useful_movies]
    if not valid_mids:
        continue
    out_actors[nconst] = {
        "name": actors[nconst],
        "movies": valid_mids,
    }

for tconst in useful_movies:
    cast = [n for n in movie_actors[tconst] if n in selected_actors]
    if len(cast) >= 2:
        out_movies[tconst] = {
            "title": movies[tconst],
            "actors": cast,
        }

# Remove actors with no useful movies after filtering
out_actors = {k: v for k, v in out_actors.items() if v["movies"]}

print(f"  → {len(out_actors):,} actors, {len(out_movies):,} movies in final graph")

# ── Write output ───────────────────────────────────────────────────────────

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump({"actors": out_actors, "movies": out_movies}, f, separators=(",", ":"))

size_kb = os.path.getsize(OUT_PATH) / 1024
print(f"\n✅ Written to {OUT_PATH}  ({size_kb:.0f} KB)\n")
print("Now run: npm run dev")
