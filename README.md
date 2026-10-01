# DPP-VC (數位產品護照與可驗證憑證驗證系統)

基於歐盟電池法規 (ESPR) 趨勢，結合 GS1 數位連結 (Digital Link) 與 W3C 可驗證憑證 (Verifiable Credentials, VC) 建構之實體產品防偽與資安防竄改驗證系統。

## 🔗 系統入口 (Live Demo)
- **消費者前端介面 (GitHub Pages)：** [https://ken20060624.github.io/DPP-VC/](https://ken20060624.github.io/DPP-VC/)
- **後台管理儀表板 (Lapo)：** [https://ken20060624.github.io/DPP-VC/Desktop/Lapo/index.html](https://ken20060624.github.io/DPP-VC/Desktop/Lapo/index.html)
- **實體綁定標籤：** 掃描測試請使用 `public/qrcodes/` 目錄下之 GS1 標準 QR Code 圖片。

## 🏗️ 系統架構
本專案採用前後端分離架構，分為三大模組：
1. **實體錨定層 (Physical Binding)：** 動態生成帶有 GTIN 與專屬序號 (Serial) 的永久性 QR Code 圖片。
2. **展示與互動層 (Frontend)：** 部署於 GitHub Pages，負責讀取條碼參數並向後端發起密碼學驗證請求。
3. **密碼學驗證層 (Backend Issuer/Verifier)：** 封裝於 Docker 容器，負責 Ed25519 數位簽章運算與狀態比對。

## 🚀 報告展示操作手冊 (Demo 步驟)

為了完整展現「資料竄改即時攔截」功能，請依循以下步驟啟動系統：

1. **啟動後端驗證引擎：**
   - 於本機執行 `啟動-VC操作台.bat`，確保 Docker 容器於 Port 3000 運行。
2. **開啟對外通道 (Ngrok)：**
   - 於終端機執行 `ngrok http 3000` 取得對外暫時網址。
   - 將前端網頁程式碼中 `fetch()` 的驗證端點，暫時替換為該 ngrok 網址。
3. **情境展示：**
   - **正品驗證：** 掃描 `FAN-001` QR Code，前端綠燈顯示 VC 驗證通過。
   - **防竄改攔截：** 於 Lapo 後台點擊「模擬竄改電池容量」，重新整理手機前端頁面，系統比對簽章失效，即時觸發紅燈警報。
   - **防偽造攔截：** 掃描未授權之 `FAN-002` QR Code，系統拒絕驗證並顯示無效。
