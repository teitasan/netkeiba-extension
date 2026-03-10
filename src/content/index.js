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
   * 順位に応じたバッジの追加クラスを返す（1〜3位は色分け）
   */
  function getRankClass(rank, isPerson) {
    if (rank === 1) return 'nk-ranking-badge nk-rank-1';
    if (rank === 2) return 'nk-ranking-badge nk-rank-2';
    if (rank === 3) return 'nk-ranking-badge nk-rank-3';
    return 'nk-ranking-badge';
  }

  function formatPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatDecimal(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function buildTooltipText(category, stats) {
    if (!stats) return '';
    if (category === 'jockey' || category === 'trainer') {
      const lines = [];
      const winRate = formatPercent(stats.win_rate);
      const placeRate = formatPercent(stats.place_rate);
      if (winRate) lines.push(`勝率: ${winRate}`);
      if (placeRate) lines.push(`複勝率: ${placeRate}`);
      return lines.join('\n');
    }
    if (category === 'sire' || category === 'bms') {
      const lines = [];
      const winHorseRate = formatPercent(stats.win_horse_rate);
      const ei = formatDecimal(stats.ei);
      if (winHorseRate) lines.push(`勝ち馬率: ${winHorseRate}`);
      if (ei) lines.push(`EI: ${ei}`);
      return lines.join('\n');
    }
    return '';
  }

  function applyTooltip(el, tooltipText) {
    if (!el || !tooltipText) return;
    el.title = tooltipText;
    el.setAttribute('aria-label', tooltipText);
  }

  function detectPedigreeCategory(anchor, id, sire, bms, prefs) {
    const hasSire = Boolean(prefs.sire && sire[id]);
    const hasBms = Boolean(prefs.bms && bms[id]);
    if (hasSire && hasBms) {
      const prevText = anchor.previousSibling?.textContent || '';
      const nextText = anchor.nextSibling?.textContent || '';
      if (/[（(]\s*$/.test(prevText) || /^\s*[）)]/.test(nextText)) {
        return 'bms';
      }
      return 'sire';
    }
    if (hasSire) return 'sire';
    if (hasBms) return 'bms';
    return null;
  }

  /**
   * 単一のリンク要素に順位バッジを挿入する
   */
  function insertBadge(anchor, rank, isPerson, tooltipText) {
    if (!anchor || anchor.querySelector(`[${BADGE_ATTR}]`)) return;
    const span = document.createElement('span');
    span.setAttribute(BADGE_ATTR, '1');
    span.className = getRankClass(rank, isPerson);
    span.textContent = String(rank);
    applyTooltip(span, tooltipText);
    anchor.appendChild(span);
  }

  /**
   * テキストノードをラップし、その横に順位バッジを挿入する
   */
  function insertBadgeForTextNode(textNode, rank, isPerson, tooltipText) {
    const parent = textNode.parentNode;
    if (!parent) return;
    const wrapper = document.createElement('span');
    wrapper.setAttribute(TEXT_BADGE_ATTR, '1');
    wrapper.style.color = '#222';
    wrapper.textContent = textNode.textContent;
    const badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, '1');
    badge.className = getRankClass(rank, isPerson);
    badge.textContent = String(rank);
    applyTooltip(badge, tooltipText);
    wrapper.appendChild(badge);
    parent.replaceChild(wrapper, textNode);
  }

  const DEFAULT_PREFS = { jockey: true, trainer: true, sire: true, bms: true };

  function getPreferences() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get('preferences', ({ preferences }) => {
          resolve({ ...DEFAULT_PREFS, ...preferences });
        });
      } else {
        resolve(DEFAULT_PREFS);
      }
    });
  }

  /**
   * 出馬表のDOMを走査し、該当リンクにバッジを挿入する
   */
  function applyBadges(ranking, prefs) {
    if (!ranking) return;
    prefs = prefs || DEFAULT_PREFS;

    const {
      jockey = {},
      trainer = {},
      sire = {},
      bms = {},
      jockey_stats = {},
      trainer_stats = {},
      sire_stats = {},
      bms_stats = {},
    } = ranking;

    if (prefs.jockey) {
      document.querySelectorAll(SELECTORS.jockey).forEach((a) => {
        const id = extractIdFromHref(a.getAttribute('href'));
        const rank = id ? jockey[id] : null;
        const tooltipText = id ? buildTooltipText('jockey', jockey_stats[id]) : '';
        if (rank) insertBadge(a, rank, true, tooltipText);
      });
    }

    if (prefs.trainer) {
      document.querySelectorAll(SELECTORS.trainer).forEach((a) => {
        const id = extractIdFromHref(a.getAttribute('href'));
        const rank = id ? trainer[id] : null;
        const tooltipText = id ? buildTooltipText('trainer', trainer_stats[id]) : '';
        if (rank) insertBadge(a, rank, true, tooltipText);
      });
    }

    if (prefs.sire || prefs.bms) {
      document.querySelectorAll(SELECTORS.sire).forEach((a) => {
        const id = extractIdFromHref(a.getAttribute('href'));
        if (!id) return;
        const category = detectPedigreeCategory(a, id, sire, bms, prefs);
        if (!category) return;
        const rank = category === 'sire' ? sire[id] : bms[id];
        const stats = category === 'sire' ? sire_stats[id] : bms_stats[id];
        if (rank) insertBadge(a, rank, false, buildTooltipText(category, stats));
      });
    }
  }

  /**
   * テキストノードを処理してバッジを挿入
   */
  function processTextNode(
    node,
    sire,
    bms,
    sire_name_to_id,
    bms_name_to_id,
    sire_stats,
    bms_stats,
    prefs
  ) {
    const text = node.textContent.trim();
    if (!text) return null;

    if (prefs.sire && sire_name_to_id[text]) {
      const id = sire_name_to_id[text];
      const rank = sire[id] || null;
      const tooltipText = buildTooltipText('sire', sire_stats[id]);
      return rank ? { node, rank, tooltipText } : null;
    }
    if (prefs.bms && ((text.startsWith('(') && text.endsWith(')')) || (text.startsWith('（') && text.endsWith('）')))) {
      const inner = text.slice(1, -1).trim();
      if (bms_name_to_id[inner]) {
        const id = bms_name_to_id[inner];
        const rank = bms[id] || null;
        const tooltipText = buildTooltipText('bms', bms_stats[id]);
        return rank ? { node, rank, tooltipText } : null;
      }
    }
    return null;
  }

  /**
   * リンクでない父・母父名（テキスト）の横にもバッジを挿入する（全ページ対象）
   */
  function applyBadgesForTextNames(ranking, prefs) {
    if (!ranking) return;
    prefs = prefs || DEFAULT_PREFS;
    if (!prefs.sire && !prefs.bms) return;

    const {
      sire = {},
      bms = {},
      sire_stats = {},
      bms_stats = {},
      sire_name_to_id = {},
      bms_name_to_id = {},
    } = ranking;
    if (Object.keys(sire_name_to_id).length === 0 && Object.keys(bms_name_to_id).length === 0) {
      return;
    }

    const toProcess = [];

    // 方法1: 出走馬リンクを起点に、同一セル内のテキストを探索（馬柱の構造に対応）
    const horseLinks = document.querySelectorAll('a[href*="db.netkeiba.com/horse/"]');
    horseLinks.forEach((a) => {
      const href = (a.getAttribute('href') || '').toString();
      if (href.includes('horse/sire/') || href.includes('horse/ped/')) return;

      const container = a.closest('td') || a.closest('div') || a.parentElement;
      if (!container) return;

      const subWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let subNode;
      while ((subNode = subWalker.nextNode())) {
        if (subNode.parentElement && subNode.parentElement.hasAttribute && subNode.parentElement.hasAttribute(TEXT_BADGE_ATTR)) continue;
        let p = subNode.parentNode;
        let skip = false;
        while (p && p !== container) {
          if (p.tagName === 'A') {
            const h = (p.getAttribute('href') || '').toString();
            if (h.includes('horse/sire/') || h.includes('horse/ped/')) { skip = true; break; }
          }
          p = p.parentNode;
        }
        if (skip) continue;
        const result = processTextNode(
          subNode,
          sire,
          bms,
          sire_name_to_id,
          bms_name_to_id,
          sire_stats,
          bms_stats,
          prefs
        );
        if (result) toProcess.push(result);
      }
    });

    // 方法2: 全文走査（テーブル外の表示にも対応）
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          let p = node.parentNode;
          while (p && p !== document.body) {
            const tag = (p.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
            if (p.hasAttribute && p.hasAttribute(TEXT_BADGE_ATTR)) return NodeFilter.FILTER_REJECT;
            if (tag === 'A') {
              const href = (p.getAttribute('href') || '').toString();
              if (href.includes('horse/sire/') || href.includes('horse/ped/')) return NodeFilter.FILTER_REJECT;
            }
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );
    let node;
    while ((node = walker.nextNode())) {
      const result = processTextNode(
        node,
        sire,
        bms,
        sire_name_to_id,
        bms_name_to_id,
        sire_stats,
        bms_stats,
        prefs
      );
      if (result) toProcess.push(result);
    }

    // 重複を除去（同一ノードを複数回処理しない）
    const seen = new WeakSet();
    toProcess.forEach(({ node, rank, tooltipText }) => {
      if (seen.has(node)) return;
      seen.add(node);
      insertBadgeForTextNode(node, rank, false, tooltipText);
    });
  }

  let rankingCache = null;
  let prefsCache = null;

  function removeBadges() {
    document.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll(`[${TEXT_BADGE_ATTR}]`).forEach((wrapper) => {
      const parent = wrapper.parentNode;
      if (!parent) return;
      const textNode = document.createTextNode(wrapper.childNodes[0]?.textContent || '');
      parent.replaceChild(textNode, wrapper);
    });
  }

  function run(ranking, prefs, shouldRemoveFirst = false) {
    if (!ranking) return;
    prefs = prefs || DEFAULT_PREFS;
    if (shouldRemoveFirst) removeBadges();
    applyBadges(ranking, prefs);
    applyBadgesForTextNames(ranking, prefs);
  }

  async function main() {
    try {
      const [ranking, prefs] = await Promise.all([fetchRanking(), getPreferences()]);
      rankingCache = ranking;
      prefsCache = prefs;
      run(ranking, prefs);

      // 動的読み込み対応: 少し遅れて再実行
      setTimeout(() => run(ranking, prefs), 800);
      setTimeout(() => run(ranking, prefs), 2000);

      // DOM 変更を監視して再実行（馬柱など遅延読み込み対応）
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        if (!rankingCache) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          run(rankingCache, prefsCache);
        }, 300);
      });

      // 設定変更時に再実行（ポップアップでチェックを変えた場合）
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes.preferences) {
            prefsCache = { ...DEFAULT_PREFS, ...changes.preferences.newValue };
            if (rankingCache) run(rankingCache, prefsCache, true);
          }
        });
      }
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
