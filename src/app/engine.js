/**
 * Hollywood Connections — Graph Engine
 * All logic runs client-side from the static graph.json.
 *
 * Graph shape:
 *   actors: { nconst: { name, movies: [tconst, ...] } }
 *   movies: { tconst: { title, actors: [nconst, ...] } }
 */

// ── Indexes built once after load ──────────────────────────────────────────

let _graph = null;
let _nameToActor = null;   // lowercase name → nconst
let _titleToMovie = null;  // lowercase title → tconst

export function loadGraph(graph) {
  _graph = graph;

  _nameToActor = new Map();
  for (const [nconst, data] of Object.entries(graph.actors)) {
    _nameToActor.set(data.name.toLowerCase(), nconst);
  }

  _titleToMovie = new Map();
  for (const [tconst, data] of Object.entries(graph.movies)) {
    _titleToMovie.set(data.title.toLowerCase(), tconst);
  }
}

// ── Fuzzy lookup helpers ────────────────────────────────────────────────────

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findActor(query) {
  if (!_graph) return null;
  const q = query.toLowerCase().trim();
  // Exact match first
  if (_nameToActor.has(q)) return _nameToActor.get(q);
  // Normalize match
  const qn = normalize(q);
  for (const [name, nconst] of _nameToActor) {
    if (normalize(name) === qn) return nconst;
  }
  // Prefix match
  for (const [name, nconst] of _nameToActor) {
    if (normalize(name).startsWith(qn) || qn.startsWith(normalize(name))) return nconst;
  }
  return null;
}

export function findMovie(query) {
  if (!_graph) return null;
  const q = query.toLowerCase().trim();
  if (_titleToMovie.has(q)) return _titleToMovie.get(q);
  const qn = normalize(q);
  // Remove common articles for matching
  const strip = (s) => s.replace(/^(the|a|an)\s+/, "");
  for (const [title, tconst] of _titleToMovie) {
    if (normalize(title) === qn) return tconst;
    if (strip(normalize(title)) === strip(qn)) return tconst;
  }
  // Prefix
  for (const [title, tconst] of _titleToMovie) {
    if (normalize(title).startsWith(qn)) return tconst;
  }
  return null;
}

export function getActorName(nconst) {
  return _graph?.actors[nconst]?.name ?? null;
}

export function getMovieTitle(tconst) {
  return _graph?.movies[tconst]?.title ?? null;
}

// ── Step validation ─────────────────────────────────────────────────────────

/**
 * Validate one chain step.
 * Returns { valid, error, movieTitle, actor2Name, actor2Id, movieId }
 */
export function validateStep(actor1Id, movieQuery, actor2Query) {
  const movieId = findMovie(movieQuery);
  if (!movieId) {
    return { valid: false, error: `Can't find a movie called "${movieQuery}" in the database. Check spelling?` };
  }

  const movieData = _graph.movies[movieId];
  const movieTitle = movieData.title;

  // Check actor1 was in the movie
  if (!movieData.actors.includes(actor1Id)) {
    const actor1Name = getActorName(actor1Id);
    return { valid: false, error: `${actor1Name} doesn't appear to be in "${movieTitle}". Try another film.` };
  }

  const actor2Id = findActor(actor2Query);
  if (!actor2Id) {
    return { valid: false, error: `Can't find an actor called "${actor2Query}" in the database.` };
  }

  const actor2Name = getActorName(actor2Id);

  // Check actor2 was in the movie
  if (!movieData.actors.includes(actor2Id)) {
    return { valid: false, error: `${actor2Name} doesn't appear to be in "${movieTitle}". Check the cast?` };
  }

  if (actor2Id === actor1Id) {
    return { valid: false, error: "You need to name a different actor!" };
  }

  return { valid: true, movieTitle, movieId, actor2Name, actor2Id };
}

// ── BFS shortest path (for hints) ──────────────────────────────────────────

/**
 * Returns the shortest path between two actor IDs, or null if none.
 * Path is an array of { actorId, movieId } steps.
 */
export function shortestPath(startId, endId, maxDepth = 6) {
  if (!_graph) return null;
  if (startId === endId) return [];

  const queue = [[startId, []]];
  const visited = new Set([startId]);

  while (queue.length) {
    const [currentId, path] = queue.shift();
    if (path.length >= maxDepth) continue;

    const actorMovies = _graph.actors[currentId]?.movies ?? [];
    for (const movieId of actorMovies) {
      const cast = _graph.movies[movieId]?.actors ?? [];
      for (const neighborId of cast) {
        if (neighborId === endId) {
          return [...path, { actorId: currentId, movieId }, { actorId: endId, movieId: null }];
        }
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push([neighborId, [...path, { actorId: currentId, movieId }]]);
        }
      }
    }
  }
  return null;
}

// ── Puzzle generation ───────────────────────────────────────────────────────

const DIFFICULTY_PARAMS = {
  Easy:   { minDegrees: 1, maxDegrees: 2, minMovies: 15 },
  Medium: { minDegrees: 2, maxDegrees: 3, minMovies: 8  },
  Hard:   { minDegrees: 3, maxDegrees: 4, minMovies: 4  },
};

/**
 * Pick a random puzzle pair matching the difficulty.
 * Returns { actor1Id, actor2Id, degrees } or null.
 */
export function generatePuzzle(difficulty, attempts = 200) {
  if (!_graph) return null;
  const { minDegrees, maxDegrees, minMovies } = DIFFICULTY_PARAMS[difficulty];

  const eligible = Object.entries(_graph.actors)
    .filter(([, d]) => d.movies.length >= minMovies)
    .map(([id]) => id);

  if (eligible.length < 2) return null;

  for (let i = 0; i < attempts; i++) {
    const a1 = eligible[Math.floor(Math.random() * eligible.length)];
    const a2 = eligible[Math.floor(Math.random() * eligible.length)];
    if (a1 === a2) continue;

    const path = shortestPath(a1, a2, maxDegrees);
    if (!path) continue;

    // degrees = number of movie hops = path length - 1
    const degrees = path.filter(s => s.movieId !== null).length;
    if (degrees >= minDegrees && degrees <= maxDegrees) {
      return { actor1Id: a1, actor2Id: a2, degrees };
    }
  }
  return null;
}

// ── Hint generator ──────────────────────────────────────────────────────────

/**
 * Give a hint for the next step from currentActorId toward targetActorId.
 * Returns a human-readable string.
 */
export function getHint(currentActorId, targetActorId, usedMovieIds = []) {
  const path = shortestPath(currentActorId, targetActorId);
  if (!path || path.length === 0) return "No path found — this is a tough one!";

  // Find first step with an unused movie
  const firstStep = path.find(s => s.movieId && !usedMovieIds.includes(s.movieId));
  if (!firstStep) return "You're close! Keep thinking about shared films.";

  const movieTitle = getMovieTitle(firstStep.movieId);
  const movieActors = _graph.movies[firstStep.movieId]?.actors ?? [];

  // Show one co-star from that movie (not current actor, not target)
  const teaser = movieActors.find(id => id !== currentActorId && id !== targetActorId);
  const teaserName = teaser ? getActorName(teaser) : null;

  const currentName = getActorName(currentActorId);
  if (teaserName) {
    return `Think about a film where ${currentName} appeared alongside ${teaserName}…`;
  }
  return `${currentName} was in "${movieTitle}" — who else was in that cast?`;
}
