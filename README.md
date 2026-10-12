# 秋遊特務

Next.js App Router、TypeScript、Firebase Authentication 與 Realtime Database 的秋遊方案投票網站。已移除 OpenAI hosting 設定，可部署至一般 Next.js 主機。

## 本機啟動

Node.js 20.9 以上。複製 `.env.example` 為 `.env.local`，填入 Firebase 網頁應用程式設定。

```sh
npm install
npm run dev -- --port 3008
```

首頁：http://127.0.0.1:3008/

方案後台：http://127.0.0.1:3008/admin

Firebase Google 登入提供者須啟用，Auth 授權網域須包含實際使用的網域。環境變數的 `databaseURL` 要使用純 HTTPS URL。更改環境變數後需重啟開發服務；正式部署需重新建置。

## 使用流程

同事先比較預設展開的大卡片，也能在偏好區直接切換方案，選擇午餐／按摩／下午茶後再以 Google 登入並確認送出。切換陣營保留各方案的偏好與專屬備註草稿，登入也保留尚未送出的選擇。選配、投票摘要及送出確認繼承 A 黃色／B 粉色，並標示方案代號與派別。

主方案與每組選配都能使用跑燈抽籤：從該組實際選項等機率抽選，在選項間快速切換、逐漸減速並落定，只更新草稿，不自動送票。使用 crypto.getRandomValues 搭配拒絕取樣消除餘數偏差，不排除連續抽中相同選項。

跑燈短音與最後和弦由 Web Audio 產生，音效排程及畫面共用同一拍點表，優先以音訊輸出時鐘對齊；手動選擇、切換方案、離開頁面、開啟片頭或開始另一組抽籤會取消舊動畫與音效。減少動態設定直接顯示結果；音效無法啟用時仍可完成抽選。

投票可填是否攜帶家眷、家眷總人數（不含本人）及家眷備註。資料存於 voteDetails，投票確認、本人回填與主辦明細都能顯示；家眷不增加公開票數。主辦可看家眷人數及同行合計，舊票未填欄位會明確標示。每個 UID 儲存一票，開放期間可修改。菜單圖片可點開放大。

戰況不需登入即可訂閱 Realtime Database：票數、支持比例、姓名與重疊頭像即時更新。桌面上兩張戰況卡依票數比例平滑調整寬度，範圍為 30–70%，避免少數方內容消失；平手及零票各半，手機維持直排。頭像 hover／鍵盤聚焦／點選顯示姓名。戰況卡滑入視窗時播放登場與 VS 撞擊，邊框流光與背景掃光持續運作，支持度維持原本分段色條，票數變更時跳數與亮框；離開視窗或切到背景分頁時暫停，減少動態設定停用裝飾動畫。主辦入口為方框按鈕，只在管理員登入後顯示。

大卡片中央 VS 在滑入視窗內側時播放紅藍衝線、撞擊回彈與擴散框，完全離開畫面才重置，再次滑入可重播。登入、資料同步及儲存共用方塊跑燈；方案與主辦後台使用 A／B 小卡對決載入面板。方案載入時保留卡片位置，戰況以票數及頭像佔位顯示等待，收到資料立即切換，不額外延長 loading；減少動態效果設定會停用非必要動畫。

首次以管理員登入後，至後台按「建立原始方案」，再編輯活動資訊、方案、選配及截止時間。後台可手動關閉投票，儲存後前台即時更新；同時編輯時以版本檢查避免覆蓋他人的變更。

登入會寫入 `users/{uid}`。下列兩個 Email 自動設為 admin：

- egroup.shelly@gmail.com
- egroup.carol@gmail.com

其餘使用者預設 member。每次登入前先提示使用 Email 以 `egroup.` 開頭的 Google 帳號（例如 egroup.xxx@gmail.com）；這類帳號可直接投票。其他帳號登入後會列入待審核，由主辦人在「帳號與審核」通過或不通過。通過後投票頁即時開放，重新登入保留審核結果；審核綁定當時的 Email，Email 改變需重新判斷。現有投票不會因新增資格流程而被刪除。依本案內部使用需求，管理員及投票資格採前端判斷，未部署自訂資料庫規則。Firebase 控制台現有存取規則仍由專案方管理；前端角色判斷不等於資料庫存取控制。

主辦「帳號與審核」顯示註冊總人數、待審核、可投票與已投票人數；可用姓名或 Email 搜尋，包含尚未投票的帳號。

餐廳／按摩選項維持 ID 關聯；已有投票的選項及題目不能直接移除。修改名稱、時長、說明、價格或安排方式時，儲存前會列出前後內容與受影響名單供確認。新選項使用新的 UUID，不重用刪除的 ID。

## 資料位置

- `users/{uid}`：Email、顯示名稱、頭像、角色、建立及更新時間；人工審核存於 `voteReview`（status、email、reviewedBy、reviewedAt）。未審核與公司帳號資格由 Email 和審核紀錄判斷，不另存重複狀態。
- `outing/catalog`：活動設定、方案、版本與截止時間。
- `outing/votes/{uid}`：投票方案、姓名、Google 頭像及更新時間。
- `outing/voteDetails/{uid}`：選配與備註；一般頁面只顯示本人，後台顯示投票明細。

## 開場

行程為熱血對戰派（六度空間雷射對戰＋飯店下午茶）。開場是一支 32 秒的預告片《秋遊特務》：前段致敬 007（白點、槍管、轉身開槍、紅色流下、剪影片名卡「今年秋天／兩位老闆／一個戰場／只有一隊能贏」），後段致敬不可能的任務（黑暗中劃亮火柴、導火線一路燒過地面、任務簡報、紅藍隊長檔案、「10.29 攻佔六度空間」、場地／裝備／對戰／下午茶／金庫雷射網快剪、鎖定兩位隊長、片名、日期、兩位老闆開槍、「全員出動」，最後「本訊息將自動銷毀」，畫面燒掉化成煙）。橫式為 2.39:1 遮幅，手機直式另有重新構圖的版本。

預告片是預先算好的影片（`public/assets/trailer/trailer-16x9.mp4`、`trailer-9x16.mp4`），網站依螢幕方向播放其中一支，畫面上再疊即時底片顆粒。進站先顯示預告海報封面（橫式與直式海報各一張），點「播放預告」才有聲播放；瀏覽器擋下時提示再點一次，影片無法播放時可直接跳過。看完或跳過後首頁主視覺從黑中淡入；首頁的「重播預告」會直接開始播放。

首頁主視覺（`components/mission-hero.tsx`、`app/mission-hero.css`）與頂端導覽列沿用預告片風格：黑底電影海報、兩位老闆持雷射槍的主視覺照、雷射紅藍光、取景框與《秋遊特務》鉻銀字樣（`components/title-mark.tsx`）。左側列出集合時間、地點與戰後下午茶，集合時間與地址讀取方案 B 行程的第一站。

## 行程頁

首頁只放這次要去玩的內容，投票、方案比較與戰況都已拿掉（後台 /admin 仍可用）。主視覺下方是不可能的任務風格的電腦終端機畫面（`components/mission-sections.tsx`、`app/mission-page.css`）：

- **任務流程**：開機字幕逐字打出後倒數五秒「本訊息將自動銷毀」，字幕燒掉只留下「訊息已銷毀」（減少動態效果時不倒數、不燒）；下面是方案 B 的行程紀錄，右上角倒數到集合時間。
- **作戰場地**：六度空間的監視器畫面（即時時間戳）、場地情報、紅藍隊長的臉部辨識、任務模式與捷運步行路線。場地說明、任務模式、交通與須知整理自六度空間官網（`lib/mission-brief.ts`）。
- **戰後補給**：飯店下午茶的候選飯店、Google 評分與連結。
- **行前須知**：可逐項打勾的裝備檢查，勾選只存在這台裝置。
- **頁尾**：加入 Google 日曆、重播預告。

頁面最底下藏了一個 `> run duel.exe` 彩蛋（`components/duel-sim.tsx`）：兩位隊長背對背走三步、轉身，聽到「開槍！」後紅隊按 A、藍隊按 L（手機直接點按鈕），先開槍的一方獲勝、另一位中彈倒地；搶先開槍會走火判輸。人物動作圖在 `public/assets/mission/duel/`。

### 製作預告片

每個鏡頭由 `scripts/trailer/film/` 的 HTML／CSS／JS 合成（`FILM.seek(t)` 依時間擺好每一層），素材在 `scripts/trailer/film/assets/`，人物以兩位老闆照片為參考生成。所有切點寫在 `scripts/trailer/timeline.json`，畫面與配樂共用。配樂為原創合成（沒有使用任何電影原曲），由 `scripts/trailer/score.js` 在瀏覽器以 Web Audio 離線合成。需要 Chrome（`CHROME_PATH`，預設為 Windows 安裝路徑）與 ffmpeg：

```sh
FFMPEG_PATH=/path/to/ffmpeg node scripts/trailer/render-score.mjs
FFMPEG_PATH=/path/to/ffmpeg node scripts/trailer/render-film.mjs --ar 16x9 --audio .trailer-build/score.wav --crf 24
FFMPEG_PATH=/path/to/ffmpeg node scripts/trailer/render-film.mjs --ar 9x16 --audio .trailer-build/score.wav --crf 24
```

`render-film.mjs` 用多個無頭 Chrome 每格拍 8 個子畫面（180° 快門）合成動態模糊，加上高光暈光後與配樂合併。`node scripts/trailer/film-frames.mjs --ar 16x9 --times 10.5,22 --out frames` 可輸出單格靜照檢查。重新輸出影片後，請一併更新 `lib/opening-assets.ts` 影片網址的 `?v=`，避免瀏覽器沿用舊檔。

## 檢查與正式啟動

```sh
npm run typecheck
npm run test:opening
npm run test:votes
npm run test:admin
npm run test:draw
npm run build
npm start -- --port 3008
```

本次另外以匿名瀏覽器驗證：公開票數由 9：3 即時改為 8：4，總票數保持 12、卡片寬度約 2：1、頭像姓名提示與 390px 手機排版正常。3008 雲端頁面已確認訪客可讀取目前空戰況，未寫入雲端測試資料。

本機 Firebase Emulator 已驗證：登入建立 profile、兩位管理員身分、一般成員無管理 UI、投票、改票仍只計一票、跨瀏覽器即時更新、管理端明細及關閉投票後前台停用。測試資料僅寫入 demo 專案的本機模擬器，沒有寫入雲端測試票。

實際 Google 帳號登入及雲端初次建立方案仍須由管理員在首頁／後台完成。模擬器結果不代表已完成雲端驗證。

## 主要檔案

- `components/opening-animation.tsx`：預告片海報封面與播放。
- `components/mission-sections.tsx`：行程頁的終端機區塊與頁尾；`components/duel-sim.tsx`：隊長決鬥彩蛋。
- `scripts/trailer/`：預告片合成、配樂與輸出。
- `components/trip-showdown.tsx`：首頁：預告片、主視覺與行程頁。
- `components/outing-provider.tsx`：登入、使用者資料與即時同步。
- `components/admin-dashboard.tsx`：方案管理。
- `lib/firebase.ts`：環境變數及 Firebase 初始化。
- `app/globals.css`：頁面與動畫樣式。
