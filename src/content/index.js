/**
 * netkeiba 出馬表ページにリーディング順位バッジを挿入する
 * 騎手・調教師・父（種牡馬）・母父（BMS）の各リンクからIDを抽出し、
 * ranking.json と照合して順位を表示する
 * newspaper / shutuba_past / shutuba_past_9 では父・母父がテキストのため、
 * 名前→IDマップで照合してバッジを表示する
 */

(function () {
  const BADGE_ATTR = 'data-nk-ranking-badge';
  const TEXT_BADGE_ATTR = 'data-nk-text-badge';
  const SELECTORS = {
    jockey: 'a[href*="db.netkeiba.com/jockey/"]',
    trainer: 'a[href*="db.netkeiba.com/trainer/"]',
    sire: 'a[href*="db.netkeiba.com/horse/sire/"], a[href*="db.netkeiba.com/horse/ped/"]',
  };

  const TEXT_PAGES = ['newspaper.html', 'shutuba_past.html', 'shutuba_past_9.html'];

  function isTextPage() {
    return TEXT_PAGES.some((p) => location.pathname.includes(p));
  }

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
   * テキストノードをラップし、その横に順位バッジを挿入する
   */
  function insertBadgeForTextNode(textNode, rank, isPerson) {
    const parent = textNode.parentNode;
    if (!parent) return;
    const wrapper = document.createElement('span');
    wrapper.setAttribute(TEXT_BADGE_ATTR, '1');
    wrapper.style.display = 'inline';
    wrapper.textContent = textNode.textContent;
    const badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, '1');
    badge.className = `nk-ranking-badge ${getRankClass(rank, isPerson)}`;
    badge.textContent = String(rank);
    wrapper.appendChild(badge);
    parent.replaceChild(wrapper, textNode);
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

  /**
   * newspaper / shutuba_past / shutuba_past_9 用: テキストの父・母父名の横にバッジを挿入
   */
  function applyBadgesForTextNames(ranking) {
    if (!ranking || !isTextPage()) return;

    const { sire = {}, bms = {}, sire_name_to_id = {}, bms_name_to_id = {} } = ranking;
    if (Object.keys(sire_name_to_id).length === 0 && Object.keys(bms_name_to_id).length === 0) {
      return;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          let p = node.parentNode;
          while (p && p !== document.body) {
            const tag = (p.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
              return NodeFilter.FILTER_REJECT;
            }
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const toProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text) continue;

      let rank = null;

      if (sire_name_to_id[text]) {
        const id = sire_name_to_id[text];
        rank = sire[id] || null;
      } else if (text.startsWith('(') && text.endsWith(')')) {
        const inner = text.slice(1, -1).trim();
        if (bms_name_to_id[inner]) {
          const id = bms_name_to_id[inner];
          rank = bms[id] || null;
        }
      }

      if (rank) {
        toProcess.push({ node, rank });
      }
    }

    toProcess.forEach(({ node, rank }) => {
      insertBadgeForTextNode(node, rank, false);
    });
  }

  async function main() {
    try {
      const ranking = await fetchRanking();
      applyBadges(ranking);
      applyBadgesForTextNames(ranking);
    } catch (err) {
      console.warn('[netkeiba拡張] 順位表示エラー:', err.message);
    }
  }

  main();
})();
