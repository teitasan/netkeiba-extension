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
const { CONFIG, parsePage, buildRankMap, getPageUrl } = require('./lib/parse-ranking-pages');

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
  return res.text();
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
  console.log(`[${category}] ${Object.keys(map).length} 件取得`);
  return map;
}

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const updatedAt = jst.toISOString().replace(/\.\d{3}Z$/, '+09:00');

  const [jockey, trainer, sire, bms] = await Promise.all([
    scrapeCategory('jockey'),
    scrapeCategory('trainer'),
    scrapeCategory('sire'),
    scrapeCategory('bms'),
  ]);

  const output = {
    updated_at: updatedAt,
    jockey,
    trainer,
    sire,
    bms,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`出力: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
