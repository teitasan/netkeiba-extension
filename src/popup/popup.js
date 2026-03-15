const KEYS = ['jockey', 'trainer', 'sire', 'bms'];
const DEFAULT = {
  jockey: true,
  trainer: true,
  sire: true,
  bms: true,
  minimumWeeklyRides: 10,
};

function normalizeMinimumWeeklyRides(value) {
  const numericValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numericValue) || numericValue < 0) return DEFAULT.minimumWeeklyRides;
  return numericValue;
}

async function load() {
  const { preferences } = await chrome.storage.local.get('preferences');
  const prefs = { ...DEFAULT, ...preferences };
  KEYS.forEach((k) => {
    const el = document.getElementById(k);
    if (el) el.checked = prefs[k];
  });
  const minimumWeeklyRidesInput = document.getElementById('minimumWeeklyRides');
  if (minimumWeeklyRidesInput) {
    minimumWeeklyRidesInput.value = String(normalizeMinimumWeeklyRides(prefs.minimumWeeklyRides));
  }
}

function save() {
  const prefs = {};
  KEYS.forEach((k) => {
    const el = document.getElementById(k);
    if (el) prefs[k] = el.checked;
  });
  const minimumWeeklyRidesInput = document.getElementById('minimumWeeklyRides');
  if (minimumWeeklyRidesInput) {
    const normalizedValue = normalizeMinimumWeeklyRides(minimumWeeklyRidesInput.value);
    minimumWeeklyRidesInput.value = String(normalizedValue);
    prefs.minimumWeeklyRides = normalizedValue;
  }
  chrome.storage.local.set({ preferences: prefs });
}

document.addEventListener('DOMContentLoaded', load);
KEYS.forEach((k) => {
  const el = document.getElementById(k);
  if (el) el.addEventListener('change', save);
});

const minimumWeeklyRidesInput = document.getElementById('minimumWeeklyRides');
if (minimumWeeklyRidesInput) {
  minimumWeeklyRidesInput.addEventListener('change', save);
}
