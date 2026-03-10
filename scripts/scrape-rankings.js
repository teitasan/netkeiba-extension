#!/usr/bin/env node
/**
 * netkeiba 全国リーディングページをスクレイピングし、ranking.json を生成する
 * 騎手・調教師・種牡馬・BMS の4カテゴリを取得
 *
 * 実行: node scripts/scrape-rankings.js
 * 出力: public/ranking.json
 */

const fs = require('fs');
const path = require('path');
const {
  CONFIG,
  parsePage,
  buildRankMap,
  buildStatsMap,
  buildNameToIdMap,
  getPageUrl,
} = require('./lib/parse-ranking-pages');

const OUT_DIR = path.join(__dirname, '..', 'public');
const OUT_FILE = path.join(OUT_DIR, 'ranking.json');

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; netkeiba-ranking-scraper/1.0; +https://github.com)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  // netkeiba は EUC-JP で返すため、正しくデコードする
  try {
    return new TextDecoder('euc-jp').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

async function scrapeCategory(category) {
  const entries = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = getPageUrl(category, page);
    try {
      const html = await fetchHtml(url);
      const pageEntries = parsePage(html, category);
      if (pageEntries.length === 0) break;
      entries.push(...pageEntries);
      hasMore = pageEntries.length >= 50;
      page++;
    } catch (err) {
      console.error(`[${category}] ページ ${page} 取得失敗:`, err.message);
      break;
    }
  }

  const map = buildRankMap(entries);
  const statsMap = buildStatsMap(entries);
  console.log(
    `[${category}] 順位 ${Object.keys(map).length} 件 / 統計 ${Object.keys(statsMap).length} 件取得`
  );
  return {
    rankMap: map,
    statsMap,
    nameToId:
      category === 'sire' || category === 'bms' ? buildNameToIdMap(entries) : {},
  };
}

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const updatedAt = jst.toISOString().replace(/\.\d{3}Z$/, '+09:00');

  const [jockeyResult, trainerResult, sireResult, bmsResult] = await Promise.all([
    scrapeCategory('jockey'),
    scrapeCategory('trainer'),
    scrapeCategory('sire'),
    scrapeCategory('bms'),
  ]);

  const output = {
    updated_at: updatedAt,
    jockey: jockeyResult.rankMap,
    trainer: trainerResult.rankMap,
    sire: sireResult.rankMap,
    bms: bmsResult.rankMap,
    jockey_stats: jockeyResult.statsMap,
    trainer_stats: trainerResult.statsMap,
    sire_stats: sireResult.statsMap,
    bms_stats: bmsResult.statsMap,
    sire_name_to_id: sireResult.nameToId,
    bms_name_to_id: bmsResult.nameToId,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`出力: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
