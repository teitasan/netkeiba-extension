/**
 * ranking.json 取得・キャッシュ・ID照合の共通処理
 * 配信URLは定数化し、将来の変更を1か所で済ませる
 */

const RANKING_JSON_URL = 'https://teitasan.github.io/netkeiba-extension/ranking.json';

let cachedRanking = null;
let fetchPromise = null;

/**
 * ranking.json を取得する。失敗時は null を返す。
 * ブラウザキャッシュを有効活用するため、同一セッションでは再利用する。
 * @returns {Promise<{updated_at:string,jockey:Object,trainer:Object,sire:Object,bms:Object}|null>}
 */
async function fetchRanking() {
  if (cachedRanking) return cachedRanking;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch(RANKING_JSON_URL, {
        cache: 'default',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        console.warn('[netkeiba拡張] ranking.json 取得失敗:', res.status);
        return null;
      }
      const data = await res.json();
      if (!data || typeof data !== 'object') {
        console.warn('[netkeiba拡張] ranking.json 形式不正');
        return null;
      }
      cachedRanking = data;
      return data;
    } catch (err) {
      console.warn('[netkeiba拡張] ranking.json 取得エラー:', err.message);
      return null;
    }
  })();

  return fetchPromise;
}

/**
 * URL から netkeiba ID を抽出する（末尾の数字部分）
 * @param {string} href - 例: "https://db.netkeiba.com/jockey/result/recent/01209/"
 * @returns {string|null} - 例: "01209"
 */
function extractIdFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  const match = href.match(/\/([0-9a-zA-Z]+)\/?$/);
  return match ? match[1] : null;
}
