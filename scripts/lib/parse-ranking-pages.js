/**
 * netkeiba リーディングページのHTMLを解析し、IDと順位のマップを抽出する
 * カテゴリごとにセレクタを分離し、DOM変更時の原因追跡を容易にする
 */

const BASE = 'https://db.netkeiba.com';

const CONFIG = {
  jockey: {
    url: `${BASE}/jockey/jockey_leading_jra.html?year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/jockey\/[^"']*\/([0-9a-zA-Z]+)\/?/,
  },
  trainer: {
    url: `${BASE}/?pid=trainer_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/trainer\/[^"']*\/([0-9a-zA-Z]+)\/?/,
  },
  sire: {
    url: `${BASE}/?pid=sire_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/horse\/sire\/([0-9a-zA-Z]+)\/?/,
  },
  bms: {
    url: `${BASE}/?pid=bms_leading&year=2026`,
    linkPattern: /(?:db\.netkeiba\.com)?\/horse\/sire\/([0-9a-zA-Z]+)\/?/,
  },
};

/**
 * 1ページ分のHTMLから、順位とIDのペアを抽出する
 * テーブル行を走査し、先頭列の順位と名前リンクのIDを対応させる
 * @param {string} html - ページのHTML
 * @param {string} category - jockey | trainer | sire | bms
 * @returns {Array<{rank:number, id:string}>}
 */
function parsePage(html, category) {
  const { linkPattern } = CONFIG[category];
  const results = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const rankMatch = row.match(/<td[^>]*>(\d+)<\/td>/);
    const hrefMatch = row.match(/href="([^"]+)"/);
    if (!rankMatch || !hrefMatch) continue;

    const rank = parseInt(rankMatch[1], 10);
    const idMatch = hrefMatch[1].match(linkPattern);
    if (!idMatch) continue;

    const id = idMatch[1];
    const entry = { rank, id };
    // 種牡馬・BMS: リンクテキスト（名前）を抽出し、テキスト表示ページ用の名前→IDマップに利用
    if (category === 'sire' || category === 'bms') {
      const linkTextMatch = row.match(/href="[^"]*"[^>]*>([^<]+)<\/a>/);
      if (linkTextMatch) {
        entry.name = linkTextMatch[1].trim();
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
  buildNameToIdMap,
  getPageUrl,
};
