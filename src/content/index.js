/**
 * netkeiba 出馬表ページにリーディング順位バッジを挿入する
 * 騎手・調教師・父（種牡馬）・母父（BMS）の各リンクからIDを抽出し、
 * ranking.json と照合して順位を表示する
 */

(function () {
  const BADGE_ATTR = 'data-nk-ranking-badge';
  const SELECTORS = {
    jockey: 'a[href*="db.netkeiba.com/jockey/"]',
    trainer: 'a[href*="db.netkeiba.com/trainer/"]',
    sire: 'a[href*="db.netkeiba.com/horse/sire/"]',
  };

  /**
   * 順位に応じたバッジの追加クラスを返す（トップ5/10強調）
   */
  function getRankClass(rank, isPerson) {
    const base = isPerson ? 'nk-badge-person' : 'nk-badge-sire';
    if (rank <= 5) return `${base} nk-top5`;
    if (rank <= 10) return `${base} nk-top10`;
    return base;
  }

  /**
   * 単一のリンク要素に順位バッジを挿入する
   */
  function insertBadge(anchor, rank, isPerson) {
    if (!anchor || anchor.querySelector(`[${BADGE_ATTR}]`)) return;
    const span = document.createElement('span');
    span.setAttribute(BADGE_ATTR, '1');
    span.className = `nk-ranking-badge ${getRankClass(rank, isPerson)}`;
    span.textContent = String(rank);
    anchor.appendChild(span);
  }

  /**
   * 出馬表のDOMを走査し、該当リンクにバッジを挿入する
   */
  function applyBadges(ranking) {
    if (!ranking) return;

    const { jockey = {}, trainer = {}, sire = {}, bms = {} } = ranking;

    document.querySelectorAll(SELECTORS.jockey).forEach((a) => {
      const id = extractIdFromHref(a.getAttribute('href'));
      const rank = id ? jockey[id] : null;
      if (rank) insertBadge(a, rank, true);
    });

    document.querySelectorAll(SELECTORS.trainer).forEach((a) => {
      const id = extractIdFromHref(a.getAttribute('href'));
      const rank = id ? trainer[id] : null;
      if (rank) insertBadge(a, rank, true);
    });

    document.querySelectorAll(SELECTORS.sire).forEach((a) => {
      const id = extractIdFromHref(a.getAttribute('href'));
      if (!id) return;
      const rank = sire[id] || bms[id];
      if (rank) insertBadge(a, rank, false);
    });
  }

  async function main() {
    try {
      const ranking = await fetchRanking();
      applyBadges(ranking);
    } catch (err) {
      console.warn('[netkeiba拡張] 順位表示エラー:', err.message);
    }
  }

  main();
})();
