# 🍃 DPP-VC 手持電風扇數位產品護照

結合 **DPP（Digital Product Passport）** 與 **W3C VC（Verifiable Credentials）**，為手持電風扇建立數位產品履歷，提供產品資訊、溯源與資料驗證。

## 📌 專案功能

- 🔗 QR Code 綁定實體產品
- 📦 GS1 Digital Link 產品識別與路由
- 🌱 DPP 產品資料管理
- 🔐 W3C DID / VC 資料簽發與驗證
- 🔋 電池與產品合規資訊
- 📊 碳足跡、再生材料等環保資訊
- 📱 Mobile-first DPP 展示頁面

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
| `feature/gs1` | QR Code、GS1 Digital Link、產品路由 |
| `feature/dpp` | DPP 資料模型、產品資料、Mock Data |
| `feature/vc` | DID、VC 簽發與驗證 |
| `feature/ui` | 前端介面、產品資訊、VC 驗證結果 |
| `dev` | 整合與測試 |
| `main` | 最終展示版本 |

> ⚠️ **禁止直接 Push 到 `dev` 或 `main`。**  
> 所有功能請在自己的 `feature/*` 分支開發，完成後建立 PR 合併至 `dev`。

> 2026-09-17 實際稽核：遠端 `dev` 仍落後 `main`，目前 Git 歷史曾由
> `feature/*` 直接合併到 `main`。上表是團隊預定流程，不是已完成的 branch
> protection；repository owner 仍需以 PR 同步 `dev` 或正式改寫流程。

## 🛠️ 開發流程

1. **更新 dev**
```bash
git checkout dev
git pull origin dev
```

2. **切換自己的分支**
```bash
git checkout feature/<你的分支>
```

3. **同步最新 dev**
```bash
git merge dev
```

4. **開發並提交**
```bash
git add .
git commit -m "feat: 新增功能"
git push origin feature/<你的分支>
```

5. **建立 Pull Request**
```text
feature/*
    ↓
Pull Request
    ↓
   dev
    ↓
   測試
    ↓
  main
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
