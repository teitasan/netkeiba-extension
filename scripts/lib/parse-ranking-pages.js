/**
 * netkeiba リーディングページのHTMLを解析し、IDと順位のマップを抽出する
 * カテゴリごとにセレクタを分離し、DOM変更時の原因追跡を容易にする
 */

const BASE = 'https://db.netkeiba.com';

const CONFIG = {
  jockey: {
    url: `${BASE}/jockey/jockey_leading_jra.html?year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/jockey\/[^"']*\/([0-9a-zA-Z]+)\/?/,
    stats: {
      win_rate: 18,
      place_rate: 20,
    },
    totals: {
      wins: 4,
      seconds: 5,
      thirds: 6,
      others: 7,
    },
  },
  trainer: {
    url: `${BASE}/?pid=trainer_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/trainer\/[^"']*\/([0-9a-zA-Z]+)\/?/,
    stats: {
      win_rate: 18,
      place_rate: 20,
    },
  },
  sire: {
    url: `${BASE}/?pid=sire_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/horse\/sire\/([0-9a-zA-Z]+)\/?/,
    stats: {
      win_horse_rate: 16,
      ei: 17,
    },
  },
  bms: {
    url: `${BASE}/?pid=bms_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/horse\/sire\/([0-9a-zA-Z]+)\/?/,
    stats: {
      win_horse_rate: 16,
      ei: 17,
    },
  },
};

function stripTags(html = '') {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(text = '') {
  const normalized = text.replace(/,/g, '').trim();
  if (!normalized || normalized === '-') return null;
  const value = Number.parseFloat(
    normalized.startsWith('.') ? `0${normalized}` : normalized
  );
  return Number.isFinite(value) ? value : null;
}

/**
 * 1ページ分のHTMLから、順位とIDのペアを抽出する
 * テーブル行を走査し、先頭列の順位と名前リンクのIDを対応させる
 * @param {string} html - ページのHTML
 * @param {string} category - jockey | trainer | sire | bms
 * @returns {Array<{rank:number, id:string, name?:string, stats?:Object<string, number>}>}
 */
function parsePage(html, category) {
  const { linkPattern, stats: statIndexes = {}, totals: totalIndexes = {} } = CONFIG[category];
  const results = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      stripTags(match[1])
    );
    if (cells.length === 0) continue;

    const rank = Number.parseInt(cells[0], 10);
    const hrefMatch = row.match(/href="([^"]+)"/);
    if (!Number.isFinite(rank) || !hrefMatch) continue;
    const idMatch = hrefMatch[1].match(linkPattern);
    if (!idMatch) continue;

    const id = idMatch[1];
    const entry = { rank, id };
    const stats = {};
    const totals = {};
    for (const [key, index] of Object.entries(statIndexes)) {
      const value = parseNumber(cells[index]);
      if (value !== null) stats[key] = value;
    }
    for (const [key, index] of Object.entries(totalIndexes)) {
      const value = parseNumber(cells[index]);
      if (value !== null) totals[key] = value;
    }
    if (Object.keys(stats).length > 0) {
      entry.stats = stats;
    }
    if (Object.keys(totals).length > 0) {
      entry.totals = totals;
    }
    // 種牡馬・BMS: 名前を抽出し、テキスト表示ページ用の名前→IDマップに利用
    if (category === 'sire' || category === 'bms') {
      if (cells[1]) {
        entry.name = cells[1];
      }
    }
    results.push(entry);
  }

  return results;
}

/**
 * 全ページを考慮してID→順位のマップを構築する
 * 同一IDが複数回出現する場合（同率順位）は最小順位を採用
 * @param {Array<{rank:number, id:string}>} entries
 * @returns {Object<string, number>}
 */
function buildRankMap(entries) {
  const map = {};
  for (const { rank, id } of entries) {
    if (!(id in map) || map[id] > rank) {
      map[id] = rank;
    }
  }
  return map;
}

/**
 * 全ページを考慮してID→統計値のマップを構築する
 * @param {Array<{id:string, stats?:Object<string, number>}>} entries
 * @returns {Object<string, Object<string, number>>}
 */
function buildStatsMap(entries) {
  const map = {};
  for (const { id, stats } of entries) {
    if (!stats || Object.keys(stats).length === 0) continue;
    map[id] = stats;
  }
  return map;
}

/**
 * 全ページを考慮してID→累計件数のマップを構築する
 * @param {Array<{id:string, totals?:Object<string, number>}>} entries
 * @returns {Object<string, Object<string, number>>}
 */
function buildTotalsMap(entries) {
  const map = {};
  for (const { id, totals } of entries) {
    if (!totals || Object.keys(totals).length === 0) continue;
    map[id] = totals;
  }
  return map;
}

/**
 * 種牡馬・BMS用: 名前→IDのマップを構築する（テキスト表示ページで順位表示に利用）
 * @param {Array<{id:string, name?:string}>} entries
 * @returns {Object<string, string>}
 */
function buildNameToIdMap(entries) {
  const map = {};
  for (const { id, name } of entries) {
    if (name) {
      map[name] = id;
    }
  }
  return map;
}

/**
 * ページネーション用のURLを生成する
 */
function getPageUrl(category, page = 1) {
  const base = CONFIG[category].url;
  const sep = base.includes('?') ? '&' : '?';
  return page <= 1 ? base : `${base}${sep}page=${page}`;
}

module.exports = {
  CONFIG,
  parsePage,
  buildRankMap,
  buildStatsMap,
  buildTotalsMap,
  buildNameToIdMap,
  getPageUrl,
};
