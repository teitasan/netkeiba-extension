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
  parsePage,
  buildRankMap,
  buildStatRankMap,
  buildStatsMap,
  buildTotalsMap,
  buildNameToIdMap,
  getPageUrl,
} = require('./lib/parse-ranking-pages');
const { buildWeeklyHighlights } = require('./lib/build-weekly-highlights');

const OUT_DIR = path.join(__dirname, '..', 'public');
const OUT_FILE = path.join(OUT_DIR, 'ranking.json');

function buildComparisonLabel(currentUpdatedAt, previousUpdatedAt, hasPrevious) {
  if (!hasPrevious || !currentUpdatedAt || !previousUpdatedAt) return null;

  const currentTime = Date.parse(currentUpdatedAt);
  const previousTime = Date.parse(previousUpdatedAt);
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) {
    return '前回更新後';
  }

  const diffDays = (currentTime - previousTime) / (24 * 60 * 60 * 1000);
  return diffDays >= 5 && diffDays <= 9 ? '先週' : '前回更新後';
}

async function loadPreviousRanking() {
  const previousFile = process.env.PREVIOUS_RANKING_FILE;
  if (previousFile && fs.existsSync(previousFile)) {
    try {
      return JSON.parse(fs.readFileSync(previousFile, 'utf8'));
    } catch (err) {
      console.warn(`前回スナップショット読込失敗: ${previousFile}: ${err.message}`);
    }
  }

  if (fs.existsSync(OUT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    } catch (err) {
      console.warn(`既存 ranking.json 読込失敗: ${err.message}`);
    }
  }

  const previousUrl = process.env.PREVIOUS_RANKING_URL;
  if (previousUrl) {
    try {
      const res = await fetch(previousUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
      console.warn(`前回スナップショット取得失敗: HTTP ${res.status}: ${previousUrl}`);
    } catch (err) {
      console.warn(`前回スナップショット取得エラー: ${err.message}`);
    }
  }

  return null;
}

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

  const statsMap = buildStatsMap(entries);
  const map =
    category === 'jockey' || category === 'trainer'
      ? buildStatRankMap(entries, 'win_rate', 'place_rate')
      : buildRankMap(entries);
  const totalsMap = buildTotalsMap(entries);
  console.log(
    `[${category}] 順位 ${Object.keys(map).length} 件 / 統計 ${Object.keys(statsMap).length} 件取得`
  );
  return {
    rankMap: map,
    statsMap,
    totalsMap,
    nameToId:
      category === 'sire' || category === 'bms' ? buildNameToIdMap(entries) : {},
  };
}

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const updatedAt = jst.toISOString().replace(/\.\d{3}Z$/, '+09:00');
  const previousRanking = await loadPreviousRanking();

  const [jockeyResult, trainerResult, sireResult, bmsResult] = await Promise.all([
    scrapeCategory('jockey'),
    scrapeCategory('trainer'),
    scrapeCategory('sire'),
    scrapeCategory('bms'),
  ]);

  const weekly = buildWeeklyHighlights(
    jockeyResult.totalsMap,
    previousRanking?.jockey_totals || {}
  );
  const comparisonLabel = buildComparisonLabel(
    updatedAt,
    previousRanking?.updated_at,
    weekly.meta.has_previous
  );

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
    jockey_totals: jockeyResult.totalsMap,
    trainer_totals: trainerResult.totalsMap,
    jockey_weekly_stats: weekly.statsMap,
    jockey_weekly_highlights: weekly.highlightMap,
    weekly_meta: {
      ...weekly.meta,
      previous_updated_at: previousRanking?.updated_at || null,
      comparison_label: comparisonLabel,
    },
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
