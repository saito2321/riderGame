# Lane Split Rush

スマホ縦画面を基準にしたThree.js製すり抜けゲームです。タイトル画面にはHighScore、回転する3Dマシン選択、Play、効果音と振動の切替があります。

## 起動

Node.js 18以上を使用します。

```powershell
npm.cmd install
npm.cmd run dev
```

http://localhost:5173 を開いてください。起動時は読み込み画面を表示し、その描画後にYouTube SDKへ `firstFrameReady()`、タイトル画面を操作できる状態にしてから `gameReady()` を通知します。Three.jsは `src/vendor/` に同梱します。YouTube Playables SDKはゲームコードより先に公式URLから読み込み、ゲームルーム外ではlocalStorageと広告報酬のローカルテストへ分岐します。`src/vendor/` が揃っていれば、追加インストールなしで `npm.cmd run dev` を実行できます。

ゲームルームでは `ytgame.system.getLanguage()` の言語設定が `ja` 系なら日本語、それ以外は英語で表示します。言語を取得できない場合も英語に戻します。アプリ名 `LANE SPLIT RUSH` は共通です。通常ブラウザは英語表示で、`http://localhost:5173/?lang=ja` から日本語表示を確認できます。ブラウザの言語設定は参照せず、言語設定をクラウドセーブにも保存しません。

## 遊び方

- Play → 初回チュートリアル → カウントダウン → 自動走行。
- スマホ：画面を左右へドラッグ。マウス：左ボタンドラッグ。キーボード：← / → または A / D。離した位置を維持し、車線には吸着しません。
- 車の横を近接したまま、車体の後端から前端まで追い越すとNear Miss。4.5秒以内に続けるとコンボ倍率とターボが上がります。
- オレンジ色のジャンプ台付き大型車は、後方の中央から乗るとジャンプして500点。横からぶつかるとライフが減ります。
- 体力は2。衝突で1減り、短時間無敵になります。0で大破演出後に結果画面へ進み、RETRYですぐ再挑戦できます。
- PAUSE / Escで一時停止し、RESUMEで再開します。ゲームルームではYouTube SDKのPause / Resumeにも従い、通常ブラウザではタブ移動やウィンドウのフォーカス喪失時に停止します。
- タイトル右上の♪チェックボックスで効果音とエンジン音を、隣の振動ボタンで衝突時の振動をそれぞれON / OFFできます。BGMはありません。動き抑制は行いません。
- HighScoreが5,000 / 10,000 / 20,000 / 30,000点へ達すると追加マシンが順番に開放されます。タイトルの左右矢印で選択し、ゲーム本編と同じ3Dモデルを回転表示します。未開放マシンは3Dモデルを黒塗りで表示し、その表示中はPlayを無効化します。未開放マシンごとにリワード広告を最後まで視聴しても開放できます。通常ブラウザでは広告を呼ばず、GRANT UNLOCK / CANCELで同じ流れを試せます。5,000点ではスクーター、10,000点ではフルカウルのスーパースポーツ、20,000点ではネタ枠の馬、30,000点ではネタ枠のお掃除ロボットを開放します。馬の脚とお掃除ロボットの左右ブラシは走行中に動き、全マシンの性能は共通です。

## 実装

- Three.jsの固定Perspective Camera、3車線、両側歩道、市街地、Car / Truck / Bus / Ramp Truck / Traffic Bike、Coin。環境を後ろへ動かし、モデル・車両・パーティクルを再利用します。
- 120Hz固定更新、フレーム時間制限、連続交差判定、Near Missの通過全区間判定。描画はrequestAnimationFrameです。
- 初速と最低速度は80km/h、走行距離300mごとに基本速度が5km/h上昇（最大999km/h）。Near MissはCollider表面間の最短隙間が0m超～0.25m以下なら300点、0.25m超～0.75m以下なら100点で、コンボ倍率を適用します。Turboは最大+8m/s、実走行速度の上限は999km/h（277.5m/s）です。
- Carの車線変更候補を一定台数ごとに選び、ウインカーと方向矢印で予告。基本速度に応じて予告開始位置を前倒しし、警告は2.50〜1.25秒、移動は2秒です。
- スコアが10,000点を超えると、左右の端から反対側まで2車線を一度に移動するCarが出現します。
- 生成・車線変更は1秒の反応猶予と実際の横移動処理を使った保守的な経路チェックで制限します。通過するまでの速度範囲を包絡し、変更車線の全幅を予約します。成立しない候補は減らすか見送ります。
- 交通密度と初期配置は、ローカルでコンボを試しやすい試作バランスです。端末ごとの視認性や遮蔽を含む全条件の品質保証は、継続プレイテストが必要です。
- エンジン、得点・衝突音をWeb Audioで生成します。音声はユーザー操作後だけ開始します。

## Platform Adapter

`src/platform/PlatformAdapter.js` でYouTubeゲームルームと通常ブラウザを判定し、`src/platform/LocalAdapter.js` にゲームルーム外の保存処理を分離しています。

| 機能 | YouTubeゲームルーム | ゲームルーム外（GitHub Pages / localhost） |
|---|---|---|
| セーブ読込・保存 | `ytgame.game.loadData/saveData` | localStorageの `lsr.save.v1` |
| ベストスコア | `ytgame.engagement.sendScore` | LocalStorageへ保存 |
| Pause / Resume | `ytgame.system.onPause/onResume` | Visibility / blurによる停止と明示的なRESUME |
| 復活 | `requestRewardedAd('revive-one-health')` | REVIVE (LOCAL) → GRANT REVIVE / CANCEL |
| マシン開放 | `requestRewardedAd('unlock-<machine-id>')` | UNLOCK (LOCAL TEST) → GRANT UNLOCK / CANCEL |
| インタースティシャル広告 | ゲームオーバー後に `requestInterstitialAd()` | 呼び出さない |
| 音声制御 | YouTubeの音声設定と♪チェックボックス | ♪チェックボックスとWeb Audio |

ゲームルームではリワード広告の結果が `true` の場合だけ、ゲームルーム外ではGRANT REVIVEを選んだ場合だけ体力1で復活します。復活は1ラン1回で、成功後に安全地帯とカウントダウンを挟みます。広告の失敗やキャンセル時は結果画面へ戻ります。

Best Score、Best Distance、Best Combo、チュートリアル完了、選択マシン、広告で開放したマシン、効果音と振動の設定を保存します。公開前のため旧形式からの移行処理は持ちません。不正データは上書きせずセッション内でプレイできます。ゲームルーム外では `lsr.save.v1` を使います。ゲームルームでは変更後500msを目安に保存し、更新が続いても約5秒以内に保存を要求します。読込・保存・スコア送信の失敗は1秒・2秒・4秒で再試行し、Pause中は再試行を停止します。読込が後から成功した場合はクラウド記録とセッション中の記録を統合し、保存済みBest ScoreをYouTubeへ再送信します。保存制限や失敗時は結果画面に表示します。

交通のSeedはラン開始ごとにランダムに生成します。テストではSimulationへSeedを直接注入して、同じSeedと同じ入力による再現性を検証します。

## 検証・ビルド

```powershell
npm.cmd test
npm.cmd run build
```

テストは衝突、Near Miss境界、コンボ、速度、車線変更、保存失敗後の復旧、広告によるマシン開放、復活、30/60fpsでの固定更新一致、30分相当のロジック継続を確認します。YouTube SDKはテスト用の模擬実装で確認しており、実機での30分描画試験やPlayables Test Suiteでの確認とは別です。

`dist/` にローカルアセットを含む静的配布用フォルダーができます。HTTPサーバーで配信してください。WebGL 2対応ブラウザーが必要です。提出用ZIPはこのコマンドでは作成しません。

主要ファイル：`src/main.js`（画面・状態遷移）、`src/game/Simulation.js`（ゲームロジック）、`src/game/World.js`（Three.js描画）、`src/game/Input.js`（入力）、`src/game/config.js`（基本値）、`src/platform/PlatformAdapter.js`（SDK分岐）、`src/platform/LocalAdapter.js`（通常ブラウザ保存）、`locales/en.json`・`locales/ja.json`（英語・日本語UI）。

Three.jsのライセンスは `src/vendor/THREE-LICENSE.txt` に同梱しています。

## 市街地・車両の描画品質と容量

雪のない市街地。車体の面取り、タイヤ・ホイール、窓ガラス、ミラー、バイクのフロントフォーク・エンジン・排気管を追加しています。小さな生成環境マップによる金属・ガラスの反射、アスファルトの質感、接地影、距離フォグで奥行きを表現します。リアルタイムの影・鏡面反射用の追加描画やポストエフェクトは使用しません。

建物は共有の256×512外壁テクスチャ1枚に窓枠・レンガ・窓の明暗を焼き込み、36棟と店舗・街灯を6個のInstancedMeshで描画します。テクスチャは起動時に生成するため、画像・3Dモデルの追加ダウンロードはありません。車両の固定パーツは材質ごとに結合し、遠方では簡略モデルへ切り替えます。ウインカー・ブレーキ・進路予告は簡略化の対象外です。

CPUコア数・端末メモリーのブラウザー報告値を手がかりに、初期DPRとアンチエイリアスを抑えます。遅いフレームが続くとDPRを段階的に0.7まで下げます。これらの報告値は端末性能の確定判定ではありません。実際の低価格Android/iPhoneでのFPS・発熱・メモリーの確認は別途必要です。

`?renderStats` を付けて開始すると、FPS、描画回数、三角形数、DPRを画面下部に表示します（通常のプレイでは非表示）。

ビルド時に全配布ファイルのサイズ・ファイル名・個数をチェックします。初期容量は全ファイルのgzip合計で保守的に見積もります。[YouTube Playables公式の容量要件](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability?hl=en) の初期30 MiB未満、全体250 MiB未満、個別30 MiB未満、8000ファイル以下を超えるとビルドを失敗させます。容量チェックの成功は、YouTube環境でのSDK動作、実機性能、認証の合格を意味しません。
