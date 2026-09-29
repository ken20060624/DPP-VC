# 🍃 DPP-VC 手持電風扇數位產品護照

結合 **DPP（Digital Product Passport）** 與 **W3C VC（Verifiable Credentials）**，為手持電風扇建立數位產品履歷，提供產品資訊、溯源與資料驗證。

## 📌 專案功能

- 🔗 QR Code 綁定實體產品
- 📦 GS1 Digital Link 產品識別與路由解析
- 🌱 DPP 產品資料管理
- 🔐 W3C DID / VC 資料簽發與密碼學驗證
- 🔋 電池合規、碳足跡等環保資訊展示
- 📱 Mobile-first DPP 移動端展示頁面

## 🏗️ 系統架構

```text
實體風扇
   ↓
QR Code / GS1 Digital Link
   ↓
DPP 產品資料
   ↓
W3C DID / VC
   ↓
Web UI
   ↓
消費者 / 監管人員
```

## 🌿 Git 分支

| 分支 | 負責內容 |
| :--- | :--- |
| `feature/gs1` | QR Code 批次產出、GS1 Digital Link 路由 |
| `feature/dpp` | DPP 資料模型、產品規格資料 |
| `feature/vc` | DID、VC 簽發與驗證邏輯 |
| `feature/ui` | 前端介面、展示卡片與驗證狀態反饋 |
| `dev` | 功能整合與測試 |
| `main` | 最終展示版本 |

> ⚠️ **禁止直接 Push 到 `dev` 或 `main`。**  
> 所有功能請在各自分支開發完成後，透過 Pull Request 合併。

## 🛠️ 本地開發與展示步驟

1. **啟動虛擬環境並安裝相依套件**
```bash
source venv/bin/activate
pip install qrcode pillow
```

2. **產生 GS1 QR Code**
```bash
python scripts/generate_qr.py
```

3. **啟動本地 HTTP 伺服器**
```bash
python -m http.server 3000 --bind 127.0.0.1
```

4. **開啟內網穿透（供手機相機掃描實測）**
```bash
npx localtunnel --port 3000
```

## 📋 Commit 格式

- `feat:` 新增功能
- `fix:` 修正問題
- `docs:` 修改文件
- `refactor:` 重構程式
- `test:` 新增測試

## 🎯 專案目標

完成：

```text
📱 掃描 QR Code
      ↓
🔗 找到產品
      ↓
📦 查看 DPP
      ↓
🔐 驗證 VC
      ↓
✅ 確認資料可信
```

## 🔐 VC Issuer 第二階段

可執行的 VC 2.0 簽發與驗證服務位於 [`vc-issuer/`](vc-issuer/)。

### Windows 一鍵啟動

直接雙擊專案根目錄的 [`啟動-VC操作台.bat`](啟動-VC操作台.bat)。第一次啟動會
自動安裝套件、建立本機 Issuer 金鑰與 Operator API Key，之後會啟動服務並開啟
`http://127.0.0.1:3000/operator/`。

啟動器會把 Operator API Key 複製到剪貼簿；在操作台的 API Key 欄位按
`Ctrl+V` 即可。Key 只保存在被 Git 忽略的
`vc-issuer/secrets/operator-api-key.txt`，不會寫入網頁或版本庫。

```bash
cd vc-issuer
npm ci
npm run generate-key
npm run generate-api-key
npm test
npm run dev
```

目前服務已加入簽發／撤銷授權、W3C Bitstring Status List v1.0、`did:web`
provider 與公開 DID/context 路由。它能驗證 Issuer 來源、credential 完整性與
撤銷狀態，但仍不代表商品已通過 SGS 或法規合規審查。完整操作與安全邊界請見
[`vc-issuer/README.md`](vc-issuer/README.md)。

執行計畫：

- [`VC-Issuer-第一階段實作計畫-v2.md`](VC-Issuer-第一階段實作計畫-v2.md)
- [`VC-Issuer-第二階段實作計畫.md`](VC-Issuer-第二階段實作計畫.md)
