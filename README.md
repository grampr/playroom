# PlayLoom

PlayLoom は Next.js + Socket.IO で作られたリアルタイム対戦アプリです。  
`server.js` のカスタムサーバーで WebSocket 通信を処理します。

## 必要環境

- Node.js（LTS 推奨）
- npm

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

起動後、ブラウザで `http://localhost:3000` を開いてください。

## 本番ビルドと起動

```bash
npm run build
npm start
```

## Redis について

- `REDIS_URL` を設定していない場合は、メモリ上のモック Redis で動作します（再起動でデータ消失）。
- 永続化したい場合は `REDIS_URL` を環境変数に設定してください。

## 無料ホスティング（例）

WebSocket を使う構成のため、Vercel より Render が適しています。

1. GitHub に push
2. Render で `New > Web Service`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`

## 参考リンク

- Next.js: https://nextjs.org/docs
- Socket.IO: https://socket.io/docs/v4
- Render: https://render.com/docs
