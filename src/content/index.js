/**
 * netkeiba 出馬表ページにリーディング順位バッジを挿入する
 * 騎手・調教師・父（種牡馬）・母父（BMS）の各リンクからIDを抽出し、
 * ranking.json と照合して順位を表示する
 * 父・母父はリンクでなくても、テキスト表示の場合は名前→IDマップで照合してバッジを表示する
 */

(function () {
  const BADGE_ATTR = 'data-nk-ranking-badge';
  const TEXT_BADGE_ATTR = 'data-nk-text-badge';
  const SELECTORS = {
    jockey: 'a[href*="db.netkeiba.com/jockey/"]',
    trainer: 'a[href*="db.netkeiba.com/trainer/"]',
    sire: 'a[href*="db.netkeiba.com/horse/sire/"], a[href*="db.netkeiba.com/horse/ped/"]',
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
   * リンクでない父・母父名（テキスト）の横にもバッジを挿入する（全ページ対象）
   */
  function applyBadgesForTextNames(ranking) {
    if (!ranking) return;

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
            if (p.hasAttribute && p.hasAttribute(TEXT_BADGE_ATTR)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (tag === 'A') {
              const href = (p.getAttribute('href') || '').toString();
              if (href.includes('horse/sire/') || href.includes('horse/ped/')) {
                return NodeFilter.FILTER_REJECT;
              }
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
      } else if ((text.startsWith('(') && text.endsWith(')')) || (text.startsWith('（') && text.endsWith('）'))) {
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

  let rankingCache = null;

  function run(ranking) {
    if (!ranking) return;
    applyBadges(ranking);
    applyBadgesForTextNames(ranking);
  }

  async function main() {
    try {
      const ranking = await fetchRanking();
      rankingCache = ranking;
      run(ranking);

      // 動的読み込み対応: 少し遅れて再実行
      setTimeout(() => run(ranking), 800);
      setTimeout(() => run(ranking), 2000);

      // DOM 変更を監視して再実行（馬柱など遅延読み込み対応）
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        if (!rankingCache) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          run(rankingCache);
        }, 300);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      setTimeout(() => observer.disconnect(), 8000);
    } catch (err) {
      console.warn('[netkeiba拡張] 順位表示エラー:', err.message);
    }
  }

  main();
})();
