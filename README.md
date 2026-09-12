# Lane Split Rush

スマホ縦画面向けのThree.js製すり抜けゲームです。トップページはタイトル、HighScore、Play、optionの4項目です。

## 起動

Node.js 18以上を使用します。

```powershell
npm.cmd install
npm.cmd run dev
```

http://localhost:5173 を開いてください。Three.jsはnpmから取得して `src/vendor/` にコピーします。ランタイムにCDN、外部フォント、YouTube SDK、広告サービスへの通信はありません。既に同梱済みのファイルがあれば、追加インストールなしでも `npm.cmd run dev` で起動できます。

## 遊び方

- Play → 初回チュートリアル → カウントダウン → 自動走行。
- スマホ：画面を左右へドラッグ。マウス：左ボタンドラッグ。キーボード：← / → または A / D。離した位置を維持し、車線には吸着しません。
- 車の横を近接したまま、車体の後端から前端まで追い越すとNear Miss。3秒以内に続けるとコンボ倍率とターボが上がります。
- 体力は3。衝突で1減り、短時間無敵になります。0で結果画面へ進み、RETRYですぐ再挑戦できます。
- PAUSE / Escで一時停止。タブ移動やウィンドウのフォーカス喪失でも停止し、RESUMEで再開します。
- optionでMUSIC / SFX / HAPTICS / REDUCE MOTIONと交通のSeedを変更できます。振動は対応する端末だけで動作します。

## 実装

- Three.jsの固定Perspective Camera、3車線、両側歩道、市街地、バイク、Car / Truck / Bus。環境を後ろへ動かし、モデル・車両・パーティクルを再利用します。
- 120Hz固定更新、フレーム時間制限、連続交差判定、Near Missの通過全区間判定。描画はrequestAnimationFrameです。
- 走行距離500mごとの基本速度上昇、Near Missの3段階得点、コンボと最大+8m/sのTurbo、最高速度44m/s。
- スコア500からCarの車線変更候補を選び、ウインカーと方向矢印で予告。警告は2.50〜1.25秒、移動は2秒です。
- 生成・車線変更は1秒の反応猶予と実際の横移動処理を使った保守的な経路チェックで制限します。通過するまでの速度範囲を包絡し、変更車線の全幅を予約します。成立しない候補は減らすか見送ります。
- 交通密度と初期配置は、ローカルでコンボを試しやすい試作バランスです。端末ごとの視認性や遮蔽を含む全条件の品質保証は、継続プレイテストが必要です。
- 簡易BGM、エンジン、得点・衝突音をWeb Audioで生成します。音声はユーザー操作後だけ開始します。

## ローカル用Platform Adapter

`src/platform/LocalAdapter.js` に環境依存処理を分離しています。

| 本番で必要な機能 | ローカルの代替 |
|---|---|
| セーブ読込・保存 | localStorageの `lsr.save.v1` |
| Best Score送信 | 通信せず、同じローカルデータへ保存 |
| Pause / Resume | Visibility / blurによる停止と明示的なRESUME |
| 広告復活 | 結果画面のREVIVE (LOCAL) → GRANT REVIVE / CANCEL |
| 音声制御 | ローカル設定とWeb Audio |

復活はGRANT REVIVEを選んだ場合だけ体力1で成立し、1ラン1回です。復活中のゲーム進行は停止し、成功後に安全地帯とカウントダウンを挟みます。キャンセル時は結果画面へ戻ります。YouTube SDKや実際の広告は呼び出しません。

Best Score、Best Distance、Best Combo、チュートリアル完了と設定を保存します。旧 `lsr.bestScore` と `lsr.title.reduceMotion` は初回読込時に移行します。不正データは上書きせずセッション内でプレイできます。保存制限や失敗時は結果画面・optionに表示します。

`?seed=12345` またはoptionのTRAFFIC SEEDで交通の乱数を固定できます。同じSeedと同じ入力で同じ交通になります。

## 検証・ビルド

```powershell
npm.cmd test
npm.cmd run build
```

テストは衝突、Near Miss境界、コンボ、速度、車線変更、保存、復活、30/60fpsでの固定更新一致、30分相当のロジック継続を確認します。実機での30分描画試験とは別です。

`dist/` にローカルアセットを含む静的配布用フォルダーができます。HTTPサーバーで配信してください。WebGL 2対応ブラウザーが必要です。

主要ファイル：`src/main.js`（画面・状態遷移）、`src/game/Simulation.js`（ゲームロジック）、`src/game/World.js`（Three.js描画）、`src/game/Input.js`（入力）、`src/game/config.js`（基本値）、`src/platform/LocalAdapter.js`（環境依存処理）、`locales/en.json`（英語UI）。

Three.jsのライセンスは `src/vendor/THREE-LICENSE.txt` に同梱しています。
