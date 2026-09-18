# 秋遊要對決

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

同事先比較預設展開的大卡片，也能在偏好區直接切換方案，選擇午餐／按摩／下午茶後再以 Google 登入並確認送出。切換陣營保留各方案的偏好草稿，登入也保留尚未送出的選擇。每個 UID 儲存一票，開放期間可修改。菜單圖片可點開放大。

戰況不需登入即可訂閱 Realtime Database：票數、支持比例、姓名與重疊頭像即時更新。桌面上兩張戰況卡依票數比例平滑調整寬度，範圍為 30–70%，避免少數方內容消失；平手及零票各半，手機維持直排。頭像 hover／鍵盤聚焦／點選顯示姓名。主辦入口為方框按鈕，只在管理員登入後顯示。

大卡片中央 VS 在滑入視窗內側時播放紅藍衝線、撞擊回彈與擴散框，完全離開畫面才重置，再次滑入可重播。頁面、登入、資料同步及儲存共用方塊載入動畫；減少動態效果設定會停用非必要動畫。

首次以管理員登入後，至後台按「建立原始方案」，再編輯活動資訊、方案、選配及截止時間。後台可手動關閉投票，儲存後前台即時更新；同時編輯時以版本檢查避免覆蓋他人的變更。

登入會寫入 `users/{uid}`。下列兩個 Email 自動設為 admin：

- egroup.shelly@gmail.com
- egroup.carol@gmail.com

其餘使用者預設 member。依本案內部使用需求，管理員及投票資格採前端判斷，未部署自訂資料庫規則。Firebase 控制台現有存取規則仍由專案方管理；前端角色判斷不等於資料庫存取控制。

## 資料位置

- `users/{uid}`：Email、顯示名稱、頭像、角色、建立及更新時間。
- `outing/catalog`：活動設定、方案、版本與截止時間。
- `outing/votes/{uid}`：投票方案、姓名、Google 頭像及更新時間。
- `outing/voteDetails/{uid}`：選配與備註；一般頁面只顯示本人，後台顯示投票明細。

## 開場

使用提供的兩位老闆照片生成去背素材；開場順序為人物介紹、同心圓旋轉、手持方案、雙人比較及「你的一票，決定秋遊去哪！」。進站約 0.8 秒後自動開始，播放約 10.85 秒。人物及圓形圖層提前掛載，在入場等待期間預載、解碼與繪製。分鏡依統一時間軸播放，音訊起播或解除靜音時對齊當前進度。

音樂來自使用者提供的片頭 MP4。原始擷取音軌保留為 `public/assets/joeman-opening.m4a`；實際播放 `autumn-opening-score.m4a`，保留主要節奏，將最後殘響同步淡出。先嘗試有聲自動播放；如果瀏覽器阻擋，動畫仍準時開始並嘗試靜音播放，點擊畫面後從目前進度接上聲音。沒有開始或音量切換按鈕，播放中只保留跳過，首頁可重播。

## 檢查與正式啟動

```sh
npm run typecheck
npm run build
npm start -- --port 3008
```

本次另外以匿名瀏覽器驗證：公開票數由 9：3 即時改為 8：4，總票數保持 12、卡片寬度約 2：1、頭像姓名提示與 390px 手機排版正常。3008 雲端頁面已確認訪客可讀取目前空戰況，未寫入雲端測試資料。

本機 Firebase Emulator 已驗證：登入建立 profile、兩位管理員身分、一般成員無管理 UI、投票、改票仍只計一票、跨瀏覽器即時更新、管理端明細及關閉投票後前台停用。測試資料僅寫入 demo 專案的本機模擬器，沒有寫入雲端測試票。

實際 Google 帳號登入及雲端初次建立方案仍須由管理員在首頁／後台完成。模擬器結果不代表已完成雲端驗證。

## 主要檔案

- `components/opening-animation.tsx`：開場與音樂時間軸。
- `components/trip-showdown.tsx`：看方案、選偏好與投票確認。
- `components/outing-provider.tsx`：登入、使用者資料與即時同步。
- `components/admin-dashboard.tsx`：方案管理。
- `lib/firebase.ts`：環境變數及 Firebase 初始化。
- `app/globals.css`：頁面與動畫樣式。
