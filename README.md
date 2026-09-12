# Lane Split Rush — タイトル画面

Node.js 18以上で起動します。追加パッケージは不要です。

```powershell
npm.cmd run dev
```

ブラウザーで http://localhost:5173 を開いてください。停止は Ctrl+C。

トップページにはタイトル、HighScore、Play、optionだけを表示します。スマホ縦画面を優先し、PCでは最大480px幅で中央配置します。360×640でスクロールなしに収まることを確認済みです。

HighScoreはローカル保存キー `lsr.bestScore` の非負の安全整数を表示します。記録なし・不正値・保存領域にアクセスできない場合は0になります。本編とスコア更新は未実装です。

Playは本編準備中の案内を表示します。optionはREDUCE MOTION設定を開き、設定をローカル保存します。Tab、Enter / Space、Escに対応しています。

YouTube SDK、広告、スコア送信は使用しません。表示文は `locales/en.json`、スタイルは `src/styles.css`、操作は `src/main.js` にあります。
