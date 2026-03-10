const KEYS = ['jockey', 'trainer', 'sire', 'bms'];
const DEFAULT = { jockey: true, trainer: true, sire: true, bms: true };

async function load() {
  const { preferences } = await chrome.storage.local.get('preferences');
  const prefs = { ...DEFAULT, ...preferences };
  KEYS.forEach((k) => {
    const el = document.getElementById(k);
    if (el) el.checked = prefs[k];
  });
}

function save() {
  const prefs = {};
  KEYS.forEach((k) => {
    const el = document.getElementById(k);
    if (el) prefs[k] = el.checked;
  });
  chrome.storage.local.set({ preferences: prefs });
}

document.addEventListener('DOMContentLoaded', load);
KEYS.forEach((k) => {
  const el = document.getElementById(k);
  if (el) el.addEventListener('change', save);
});
