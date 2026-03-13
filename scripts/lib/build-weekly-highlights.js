const MIN_WEEKLY_RIDES = 10;
const TOP_HIGHLIGHT_COUNT = 3;

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildWeeklyStats(currentTotals = {}, previousTotals = {}) {
  const currentWins = toNumber(currentTotals.wins);
  const currentSeconds = toNumber(currentTotals.seconds);
  const currentThirds = toNumber(currentTotals.thirds);
  const currentOthers = toNumber(currentTotals.others);

  const previousWins = toNumber(previousTotals.wins);
  const previousSeconds = toNumber(previousTotals.seconds);
  const previousThirds = toNumber(previousTotals.thirds);
  const previousOthers = toNumber(previousTotals.others);

  const wins = currentWins - previousWins;
  const seconds = currentSeconds - previousSeconds;
  const thirds = currentThirds - previousThirds;
  const others = currentOthers - previousOthers;

  if (wins < 0 || seconds < 0 || thirds < 0 || others < 0) {
    return null;
  }

  const rides = wins + seconds + thirds + others;
  if (rides <= 0) return null;

  const places = wins + seconds + thirds;
  return {
    rides,
    wins,
    seconds,
    thirds,
    others,
    places,
    win_rate: wins / rides,
    place_rate: places / rides,
  };
}

function rankTop(statsEntries, key) {
  return statsEntries
    .filter(([, stats]) => stats.rides >= MIN_WEEKLY_RIDES)
    .sort(([, left], [, right]) => {
      if (right[key] !== left[key]) return right[key] - left[key];
      if (right.rides !== left.rides) return right.rides - left.rides;
      return right.wins - left.wins;
    })
    .slice(0, TOP_HIGHLIGHT_COUNT);
}

function buildWeeklyHighlights(currentTotalsMap = {}, previousTotalsMap = {}) {
  const hasPreviousTotals = Object.keys(previousTotalsMap).length > 0;
  if (!hasPreviousTotals) {
    return {
      statsMap: {},
      highlightMap: {},
      meta: {
        min_rides: MIN_WEEKLY_RIDES,
        top_n: TOP_HIGHLIGHT_COUNT,
        has_previous: false,
      },
    };
  }

  const statsMap = {};

  for (const [id, currentTotals] of Object.entries(currentTotalsMap)) {
    const weeklyStats = buildWeeklyStats(currentTotals, previousTotalsMap[id]);
    if (weeklyStats) {
      statsMap[id] = weeklyStats;
    }
  }

  const entries = Object.entries(statsMap);
  const highlightMap = {};

  rankTop(entries, 'win_rate').forEach(([id], index) => {
    highlightMap[id] = { ...(highlightMap[id] || {}), win_rate_rank: index + 1 };
  });

  rankTop(entries, 'place_rate').forEach(([id], index) => {
    highlightMap[id] = { ...(highlightMap[id] || {}), place_rate_rank: index + 1 };
  });

  return {
    statsMap,
    highlightMap,
    meta: {
      min_rides: MIN_WEEKLY_RIDES,
      top_n: TOP_HIGHLIGHT_COUNT,
      has_previous: true,
    },
  };
}

module.exports = {
  MIN_WEEKLY_RIDES,
  TOP_HIGHLIGHT_COUNT,
  buildWeeklyHighlights,
};
