# netkeiba リーディング＆血統表示拡張機能

netkeiba の出馬表（PCブラウザ版）に、騎手・調教師・種牡馬・BMS（母父）の全国リーディング順位を名前の横に自動表示する Chrome / Edge 拡張機能です。

## 機能

- **対象ページ**: https://race.netkeiba.com/race/shutuba.html*（出馬表）
- **表示内容**: 騎手・調教師・父（種牡馬）・母父の各リンク横に全国リーディング順位を数字で表示
- **デザイン**: 騎手・調教師は青系、種牡馬・BMSは紫系で区別。上位5位・10位は強調表示

## セットアップ

### 1. ranking.json の配信

1. 本リポジトリを GitHub にプッシュ
2. リポジトリの **Settings → Pages** で Source を **GitHub Actions** に設定
3. **Actions** タブから「Update ranking.json」ワークフローを手動実行
4. デプロイ完了後、`https://<あなたのGitHubユーザー名>.github.io/netkeiba/ranking.json` にアクセスできることを確認

### 2. 拡張機能の ranking.json URL を設定

`src/shared/ranking-client.js` の `RANKING_JSON_URL` を、上記で確認した URL に置き換えてください。

```javascript
const RANKING_JSON_URL = 'https://<あなたのGitHubユーザー名>.github.io/netkeiba/ranking.json';
```

### 3. 拡張機能の読み込み

1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. 本リポジトリのルートフォルダ（`manifest.json` がある場所）を選択

## ZIP 配布用パッケージ作成

```bash
# 拡張機能本体のみをZIP化（.git 等は除外）
zip -r netkeiba-extension.zip . -x "*.git*" -x "scripts/*" -x ".github/*" -x "public/*" -x "*.md" -x "node_modules/*"
```

または、配布用に必要なファイルのみを含む ZIP を作成：

```bash
zip -r netkeiba-extension.zip manifest.json src/
```

購入者には、ZIP を展開したフォルダを「パッケージ化されていない拡張機能を読み込む」で指定するよう案内してください。

## ローカルでの ranking.json 更新

```bash
node scripts/scrape-rankings.js
```

`public/ranking.json` が生成されます。GitHub Actions は毎週木曜 18:00 JST に自動実行されます。

## 免責事項（販売ページ用）

本ツールは個人開発の非公式ツールです。netkeiba の出馬表ページの DOM 構造やリーディングページの仕様が変更された場合、予告なく表示できなくなる可能性があります。300円の買い切り・現状渡し（As-Is）としてご理解ください。返金はお受けしておりません。

## ディレクトリ構成

```
├── manifest.json          # 拡張機能定義
├── src/
│   ├── content/           # 出馬表ページ用スクリプト・スタイル
│   └── shared/            # ranking.json 取得ロジック
├── scripts/               # スクレイピングバッチ
├── public/                # ranking.json 出力先（GitHub Pages 配信）
└── .github/workflows/     # 週次更新ワークフロー
```
