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
- `outing/voteDetails/{uid}`：選配與備註；一般頁面只顯示本人，後台顯示投票明細。首頁「接受任務」登記的備註與家眷也存在這裡。
- `outing/teams`：分隊結果 `{uid: "red" | "blue"}`，由主辦在後台「分隊」儲存。

## 開場

行程為熱血對戰派（六度空間雷射對戰＋飯店下午茶）。網站載入時先是黑色主控台開機畫面（`components/outing-loading.tsx`）：《秋遊特務》字樣、特務持續朝「特」開槍的紅點、掃描光條與「ESTABLISHING SECURE LINK」，純 CSS，腳本還沒載入就會動。

開場是一支 32 秒的預告片《秋遊特務》：前段致敬 007（白點、槍管、轉身開槍、紅色流下、剪影片名卡「今年秋天／兩位老闆／一個戰場／只有一隊能贏」），後段致敬不可能的任務（黑暗中劃亮火柴、導火線一路燒過地面、任務簡報、紅藍隊長檔案、「10.29 攻佔六度空間」、場地／裝備／對戰／下午茶／金庫雷射網快剪、鎖定兩位隊長、007 白點打開的片名、日期、兩位老闆開槍、「全員出動」，打出「一如往常，若你被雷射擊中，主辦單位將否認知情。」，最後「本訊息將自動銷毀」，畫面從字幕處起火燒穿成黑，只剩餘燼與煙）。橫式為 2.39:1 遮幅，手機直式另有重新構圖的版本。

預告片是預先算好的影片（`public/assets/trailer/trailer-16x9.mp4`、`trailer-9x16.mp4`），網站依螢幕方向播放其中一支，畫面上再疊即時底片顆粒。進站先顯示預告海報封面（橫式與直式海報各一張），點「播放預告」才有聲播放；瀏覽器擋下時提示再點一次，影片無法播放時可直接跳過。

**接到主頁的轉場**：影片播到自毀那一刻（`TRAILER_BURN_AT`），畫面凍結成畫布，由網站即時燒穿（`lib/film-burn.ts`：雜訊場擴散的焦痕、白熱火邊、火花、餘燼與煙），主頁就在底下從燒出的洞裡出現，配樂照常播完；主視覺的 logo 同時被雷射刻出。按「跳過預告」（或 Esc）也是同樣的燒穿，只是更快；在封面就跳過時，封面海報燒掉。減少動態效果時直接切換。首頁的「重播預告」會回到頁首並直接開始播放。

首頁主視覺（`components/mission-hero.tsx`、`app/mission-hero.css`）與頂端導覽列沿用預告片風格（導覽列右邊是「探員登入」，登入後是戴著探員紳士帽的頭貼與帳號選單，`components/account-menu.tsx`、`components/agent-hat.tsx`）：黑底電影海報、兩位老闆持雷射槍的主視覺照、雷射紅藍光、取景框。字樣 `components/title-mark.tsx`（樣式 `app/title-mark.css`，字形輪廓 `lib/title-mark-paths.ts`）：Noto Serif TC Black 的鉻金屬字，巧思做在字裡——「遊」右下的「子」換成鋼灰色的特務剪影，鉻色輪廓線讓它在小尺寸也清楚：完成的字樣是他把手槍舉在臉旁、槍口亮著紅光（`public/assets/brand/agent.svg`），「特」字寸的那一點是他雷射留下的紅點；紅藍輪廓光呼應兩隊。`motion="intro"` 時像 007 開場：四個白點滑入、像光圈一樣打開成字，特務先伸直手臂瞄準「特」（`agent-aim.svg`，兩個姿勢同一個人、同一個座標）開槍，雷射落在「特」上留下紅點，接著才把槍舉起來；`motion="scan"`（載入畫面）反覆瞄準、開槍、舉槍。字形輪廓由字型轉出並合併重疊筆畫（字裡不會有接縫線），不再依賴字型載入；剪影與輪廓由 scratchpad 的 `traceagent2.cjs`、`buildmark2.cjs` 產生。字形輪廓由字型轉出，不再依賴字型載入。左側列出集合時間、地點與戰後下午茶，集合時間與地址讀取方案 B 行程的第一站。

## 行程頁

首頁只放這次要去玩的內容，投票、方案比較與戰況都已拿掉（後台 /admin 仍可用）。主視覺下方是不可能的任務風格的電腦終端機畫面（`components/mission-sections.tsx`、`app/mission-page.css`）。進場動畫每次捲回來都會重播（`components/use-in-view.ts`：完全離開畫面後再進來就從頭播放，包括字樣、隊長對決、守則、接受任務的簡報與導火線）：

- **01 任務流程**：開機字幕逐字打出（每行之間停一拍），STATUS 依登入的人是否已接受任務顯示「等待特務接受」或綠色的「ACCEPTED」；倒數五秒「本訊息將自動銷毀」、主控台警報、畫面故障、點火燒穿（`components/mission-briefing.tsx`），留下「訊息已銷毀」九秒後才重新傳送；捲走再回來也會重新傳送。減少動態效果時不倒數、不燒。下面是方案 B 的行程紀錄（下午茶一行直接寫出最高票的飯店），右上角倒數到集合時間；最後一行「你的任務，如果你選擇接受——」接到下一段：一條導火線從這行往下燒到「02 接受任務」，隨捲動燃燒，燒到時接受任務區點亮。
- **02 接受任務**：不可能的任務式的機密簡報（`components/mission-accept.tsx`）——「早安／午安／晚安，○○ 特務。你的任務，如果你選擇接受……」逐字打出；點指紋掃描器以公司 Google 帳號驗證身分，填注意事項與行動編制（單獨行動／攜帶家眷、人數、家眷備註），再「按住指紋」直到圓環走完就接受任務。接受後播放完成動畫：綠色掃描線打開特務檔案、鎖定框套上照片、資料逐行進來、MISSION ACCEPTED 印章重重蓋下（卡片震動、墨點飛濺、衝擊波）、打出「身分確認・任務已接受」，簡報倒數三秒後自己燒掉，名單裡自己那格亮起。資料寫進原本的 `votes`／`voteDetails`（方案 B），所以沒投過票的人也能登記、主辦明細照常看得到；投票關閉後仍可登記，資格審核規則不變。右側是已接受任務的特務檔案照名單（每張照片都戴探員帽），分好隊後依紅隊／藍隊／待分隊顯示；資料庫連不上時會直接說明，不會一直轉圈。本機可用 `?agent=new` 預覽完成動畫與示範名單（僅開發模式）。
- **03 作戰場地**：六度空間的監視器畫面（即時時間戳），裡面藏了彩蛋——兩位隊長輪流出現：從左右大柱後探身、從油桶掩體後冒出上半身、站在走廊遠處，或從前景走過；每一輪兩人都會在每個位置各出現一次（所以兩人都會走過畫面），順序隨機、不連續同一位置。滑鼠游標本身就是準心（系統游標圖，滑鼠在哪準心就在哪、不會延遲），對準隊長時換成收緊的紅色準心；畫面中間不再有固定準心；手機點下去的地方會跳出準心。點一下就開槍，命中有白閃、火花與 HIT +1，依出場方式倒下，右下角計分（`components/recon-targets.tsx`）。接著是場地情報、兩位隊長的對決海報（`components/captains-faceoff.tsx`：紅藍兩半斜向雷射接縫、兩人舉槍互瞄、光束在 VS 後方對撞、鎖定框）、任務模式、捷運步行路線，以及六度空間的 Google 評論。場地說明、任務模式、交通與須知整理自六度空間官網（`lib/mission-brief.ts`）。
- **04 戰後補給**：只顯示下午茶票數最高的飯店（`/api/choice-results` 的匿名統計，同票時全部列出；頁面不顯示票數），附地圖、官網與該飯店的 Google 評論。票數還沒讀到或讀不到時，先顯示主辦告知的最高票（`TEA_WINNER`，台北晶華酒店），讀到後以實際票數為準。本機可用 `?topTea=c1` 這類網址參數預覽（僅開發模式）。
- **Google 評論**：左邊是評分總覽（分數、星等、總評論數、「看全部評論」連到 Google 地圖），右邊把網站擷取到的最新評論逐則以全文引言呈現，只留星等的收成一行（`components/review-deck.tsx`）。
- **05 行前須知**：特務守則五條——服裝、準時、置物、禁止攜帶外食、愉快團結的心與健康的身體（`components/mission-protocols.tsx`），卡片捲入時圖示描線、文字解碼；每個人自己按卡片下方的指紋「確認這條守則」，蓋上 CLEARED 章，上方顯示已確認幾條，五條都確認後顯示「準備出動」。確認狀態只存在這台裝置。
- **頁尾**：兩位隊長背對鏡頭走進競技場的收尾畫面（`public/assets/mission/walkout.webp`），加入 Google 日曆、重播預告。
- **06 隊長對決**（最底下，預設就顯示，`components/duel-sim.tsx`）：單人挑戰電腦（每局隨機分配你是紅隊或藍隊隊長，開局先宣布）或雙人同機；背對背走三步立刻開打，A 開槍、按住 S 躲到掩體後（雙人時藍隊為 L／K），躲太久會被拉起來，每人 3 條命；手機用下方按鈕。人物動作圖在 `public/assets/mission/duel/`。

後台多了「分隊」分頁（`components/admin-teams.tsx`、`lib/teams.ts`）：列出所有接受任務的人（含家眷人數），可逐一點紅隊／藍隊，或「隨機分配其餘的人」（保留已手動指定的人，其餘洗牌補到人數較少的一隊）、「全部重新抽籤」、「清空」，最後按「儲存分隊」寫入 `outing/teams`，前台名單即時更新。

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
npm run test:teams
npm run build
npm start -- --port 3008
```

本次另外以匿名瀏覽器驗證：公開票數由 9：3 即時改為 8：4，總票數保持 12、卡片寬度約 2：1、頭像姓名提示與 390px 手機排版正常。3008 雲端頁面已確認訪客可讀取目前空戰況，未寫入雲端測試資料。

本機 Firebase Emulator 已驗證：登入建立 profile、兩位管理員身分、一般成員無管理 UI、投票、改票仍只計一票、跨瀏覽器即時更新、管理端明細及關閉投票後前台停用。測試資料僅寫入 demo 專案的本機模擬器，沒有寫入雲端測試票。

實際 Google 帳號登入及雲端初次建立方案仍須由管理員在首頁／後台完成。模擬器結果不代表已完成雲端驗證。

## 主要檔案

- `components/opening-animation.tsx`：預告片海報封面、播放與燒穿轉場。
- `components/mission-sections.tsx`：行程頁的終端機區塊與頁尾；`components/mission-briefing.tsx`：自毀簡報；`components/captains-faceoff.tsx`：隊長對決海報；`components/recon-targets.tsx`：監視器射擊彩蛋；`components/mission-accept.tsx`：接受任務與名單；`components/duel-sim.tsx`：隊長對決小遊戲。
- `components/title-mark.tsx`、`app/title-mark.css`、`lib/title-mark-paths.ts`：字裡藏著特務剪影與雷射紅點的《秋遊特務》字樣；`components/outing-loading.tsx`：載入畫面。
- `lib/film-burn.ts`：燒穿特效（自毀簡報與預告片接主頁共用）；`lib/teams.ts`：分隊邏輯（`npm run test:teams`）。
- `scripts/trailer/`：預告片合成、配樂與輸出。
- `components/trip-showdown.tsx`：首頁：預告片、主視覺與行程頁。
- `components/outing-provider.tsx`：登入、使用者資料與即時同步。
- `components/admin-dashboard.tsx`：方案管理。
- `lib/firebase.ts`：環境變數及 Firebase 初始化。
- `app/globals.css`：頁面與動畫樣式。
