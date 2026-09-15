DPP-VC 專案 — VC Issuer 模組第一階段實作計畫
1. 專案背景

目前專案：

ken20060624/DPP-VC

專案主題為：

Digital Product Passport (DPP)
+
W3C Verifiable Credentials (VC)

Git 分工如下：

feature/gs1
→ QR Code / GS1 Digital Link / Product Routing

feature/dpp
→ DPP 資料模型 / 商品資料 / Mock Data

feature/vc
→ DID / VC Issuance / Verification

feature/ui
→ 使用者介面 / 商品資訊 / VC 驗證結果

dev
→ 功能整合

main
→ 最終展示版本

本任務只開發 feature/vc。

不要直接修改：

main
dev
feature/dpp
feature/gs1
feature/ui

完成後預期透過 PR：

feature/vc
    ↓
   dev
2. 第一階段目標

第一階段只完成一個：

Product VC Issuer

功能非常單純：

收到商品資料
      ↓
不進行任何審核
      ↓
建立 Verifiable Credential
      ↓
Issuer 使用 Private Key 簽章
      ↓
產生 VC
      ↓
回傳 VC JSON

目前不考慮：

❌ 商品是否符合條件
❌ 商品審核流程
❌ 管理員批准
❌ SGS 真實 API
❌ 真實電池廠 API
❌ 區塊鏈
❌ VC Revocation
❌ Status List
❌ 使用者登入
❌ 權限管理
❌ Wallet
❌ 複雜資料庫

核心目標只有：

給一個商品資料，系統可以產生一張真正具有密碼學簽章的 VC。

3. 必須先理解現有 Repository

請在開始 coding 前檢查：

main
dev
feature/dpp
feature/gs1
feature/vc
feature/ui

尤其參考：

Desktop/Lapo/lapo.java
Desktop/Lapo/Lopo註解
README.md

注意：

lapo.java

雖然副檔名叫 .java，目前內容實際上是 JSON Mock Data，不是 Java source code。

不要因此把現有專案判斷成 Java 專案。

4. 現有 DPP Product Subject

目前商品範例大致為：

{
  "id": "urn:gtin:04710000000000:SN202603001",
  "productName": "LaPO 多功能多角度手持風扇",
  "modelNumber": "LA-F1",
  "brand": "LaPO",
  "countryOfOrigin": "TW"
}

並包含：

{
  "batteryComponent": {
    "supplierDid": "did:web:cert.battery-supplier.com",
    "chemistry": "Li-ion (18650/21700)",
    "capacityMah": 2000,
    "voltageV": 3.7,
    "energyWh": 7.4
  }
}

以及：

{
  "environmentalMetrics": {
    "carbonFootprintKgCO2e": 1.85,
    "pcrPlasticPercentage": 25.0,
    "recyclabilityPercentage": 85.0,
    "rohsCompliant": true,
    "reachCompliant": true
  }
}

VC Issuer 必須可以接受這類資料。

5. 重要架構原則

第一版不要把：

DPP = VC

寫死。

請分開處理：

DPP
= 商品護照 / 商品資料

VC
= 某個 Issuer 對某些商品資料做出的可驗證聲明

兩者透過相同 Product ID 關聯。

例如：

DPP Product ID

urn:gtin:04710000000000:SN202603001

VC：

{
  "credentialSubject": {
    "id": "urn:gtin:04710000000000:SN202603001"
  }
}

如此 DPP 和 VC 就知道是在描述同一件商品。

6. 第一階段系統角色

現在只模擬一個 Issuer：

DPP VC Issuer

例如：

did:web:issuer.example.com

第一階段不用真的控制 LaPO 官方網域。

開發環境可以使用適合本機測試的 DID 設計。

但架構必須讓未來可以替換成：

did:web:dpp.lapo.com.tw
7. VC 標準

新程式優先使用：

W3C Verifiable Credentials Data Model 2.0

Context：

"@context": [
  "https://www.w3.org/ns/credentials/v2"
]

不要在新的核心 Issuer 裡硬寫舊版：

https://www.w3.org/2018/credentials/v1

但讀取現有 Repository Mock Data 時，不需要強行修改舊資料。

8. VC 資料模型

第一階段產生類似：

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2"
  ],

  "id": "urn:uuid:GENERATED_UUID",

  "type": [
    "VerifiableCredential",
    "ProductCredential"
  ],

  "issuer": "did:web:issuer.example.com",

  "validFrom": "2026-09-15T12:00:00Z",

  "credentialSubject": {
    "id": "urn:gtin:04710000000000:SN202603001",

    "productName": "LaPO 多功能多角度手持風扇",

    "modelNumber": "LA-F1",

    "brand": "LaPO",

    "countryOfOrigin": "TW",

    "batteryComponent": {
      "chemistry": "Li-ion (18650/21700)",
      "capacityMah": 2000,
      "voltageV": 3.7,
      "energyWh": 7.4
    },

    "environmentalMetrics": {
      "carbonFootprintKgCO2e": 1.85,
      "pcrPlasticPercentage": 25.0,
      "recyclabilityPercentage": 85.0,
      "rohsCompliant": true,
      "reachCompliant": true
    }
  },

  "proof": {
    "...": "..."
  }
}

注意：

Proof 不可以是假字串。

必須真的使用密碼學 Private Key 產生。

9. Issuer Key

系統必須有：

Private Key
Public Key

用途：

Private Key
→ Issue / Sign VC

Public Key
→ Verify VC

Private Key：

不可直接 hard-code 在 source code

開發環境至少：

.env

例如：

ISSUER_DID=
ISSUER_PRIVATE_KEY=
ISSUER_PUBLIC_KEY=

如果需要首次執行產生 key pair，可以提供：

npm run generate-key

或同等指令。

10. DID 模組

建立獨立 DID 模組。

至少包含：

Issuer DID
Verification Method
Public Key

概念：

Issuer
 |
 ├─ DID
 |
 ├─ Private Key
 |
 └─ Public Key

建議模組：

did/
  did-service
  key-service

不要把 DID 邏輯全部塞進 API Controller。

11. Issuer API

至少建立：

POST /api/v1/credentials/issue

Request：

{
  "product": {
    "id": "urn:gtin:04710000000000:SN202603001",
    "productName": "LaPO 多功能多角度手持風扇",
    "modelNumber": "LA-F1",
    "brand": "LaPO",
    "countryOfOrigin": "TW",

    "batteryComponent": {
      "chemistry": "Li-ion",
      "capacityMah": 2000,
      "voltageV": 3.7,
      "energyWh": 7.4
    },

    "environmentalMetrics": {
      "carbonFootprintKgCO2e": 1.85,
      "pcrPlasticPercentage": 25,
      "recyclabilityPercentage": 85,
      "rohsCompliant": true,
      "reachCompliant": true
    }
  }
}

流程：

POST product
   ↓
確認 JSON 可以解析
   ↓
建立 UUID
   ↓
建立 VC
   ↓
加入 issuer DID
   ↓
加入 validFrom
   ↓
Private Key Sign
   ↓
產生 proof
   ↓
Return VC
12. 目前不做商業規則

非常重要：

第一階段：

商品只要送進 API
→ 就發 VC

不要加入：

if (rohsCompliant === false) reject()

也不要：

if (carbonFootprint > xxx) reject()

也不要：

人工批准

目前只有最基本的資料格式錯誤才能拒絕，例如：

JSON 無法解析
完全沒有 product
沒有任何 product id

除此之外：

直接發證。
13. Verification API

雖然目前工作核心是「發 VC」，但為了證明真的有成功簽名，第一版必須提供最小 Verification。

建立：

POST /api/v1/credentials/verify

輸入：

{
  "credential": {
    ...
  }
}

回傳成功：

{
  "valid": true,
  "issuer": "did:web:issuer.example.com",
  "credentialId": "urn:uuid:...",
  "subjectId": "urn:gtin:04710000000000:SN202603001"
}

失敗：

{
  "valid": false,
  "errors": [
    "Invalid signature"
  ]
}

目的不是開發完整 Verifier 平台。

只是讓 Issuer 能證明：

我發的 VC 真的可以被驗證。
14. 必須完成竄改測試

這是 Demo 最重要的測試。

正常：

"capacityMah": 2000

Verify：

VALID

然後手動改成：

"capacityMah": 9999

再次驗證：

INVALID

也就是必須證明：

原始 VC
→ ✅

竄改 Credential Subject
→ ❌

如果修改 VC 內容之後還是 Verify Success：

實作視為失敗。
15. Credential Storage

第一階段不需要大型資料庫。

可以先：

data/
credentials/

每次產生 VC 後：

credential UUID.json

例如：

data/
  credentials/
    550e8400-e29b-41d4-a716-446655440000.json

但 API 不應依賴檔案才能正常回傳。

流程：

建立
↓
簽名
↓
回傳
↓
可選擇保存副本
16. 查詢 API

如果實作成本不高，再建立：

GET /api/v1/credentials/:id

用途：

取得已簽發 VC

另外：

GET /health

Response：

{
  "status": "ok"
}
17. 建議專案結構

由於 Repository 目前沒有真正的後端 Framework，請建立獨立、乾淨的 VC 模組。

建議：

vc-issuer/
│
├─ src/
│  │
│  ├─ api/
│  │  ├─ issue
│  │  └─ verify
│  │
│  ├─ vc/
│  │  ├─ credential-builder
│  │  ├─ credential-issuer
│  │  └─ credential-verifier
│  │
│  ├─ did/
│  │  ├─ did-service
│  │  └─ key-service
│  │
│  ├─ models/
│  │  ├─ product
│  │  └─ credential
│  │
│  ├─ storage/
│  │  └─ credential-store
│  │
│  └─ server
│
├─ data/
│  └─ credentials/
│
├─ scripts/
│  └─ generate-key
│
├─ tests/
│  ├─ issue.test
│  ├─ verify.test
│  └─ tamper.test
│
├─ .env.example
├─ package.json
└─ README.md

實際檔案副檔名、Framework 可以依選定技術調整。

18. 技術選擇原則

Repository 目前沒有既定 backend stack。

因此：

不要為了 lapo.java 使用 Java。

優先考慮容易處理：

JSON
REST API
W3C VC
DID
Cryptographic Signature

的技術。

建議：

Node.js
TypeScript

搭配一個輕量 API Framework。

例如：

Fastify

或：

Express

密碼學與 VC 請優先使用成熟 library。

不要自己實作 Ed25519、ECDSA 等底層密碼演算法。

在選 library 前確認：

仍有維護
支援目前 Node 版本
支援 VC / JOSE / Data Integrity 所需功能
19. 安全要求

第一階段雖然是 Demo，也必須做到：

✅ Private Key 不 commit
✅ .env 加入 .gitignore
✅ Repository 只放 .env.example
✅ Public Key 可以公開
✅ Credential ID 使用 UUID
✅ Server error 不輸出 Private Key

任何 Log：

不得 print Private Key。
20. 與 DPP 分支的 Interface

這是最重要的整合點。

未來：

feature/dpp

只需要把商品 JSON 傳給：

feature/vc

例如：

DPP Product Object
       ↓
POST /api/v1/credentials/issue
       ↓
Product VC

VC 回來後，DPP 可以保存：

{
  "verifiableCredentials": [
    {
      "id": "urn:uuid:...",
      "type": "ProductCredential"
    }
  ]
}

或者未來改成：

Credential URI

第一版不用處理最終 DPP Schema。

只需要讓接口乾淨。

21. 與 GS1 分支的關係

feature/gs1 未來負責：

GS1 Digital Link
QR Code
產品 Routing

你的 VC 模組目前不要依賴 QR Code 才能發證。

應為：

Product ID
→ VC

而不是：

QR Code
→ VC

GS1 之後只要把 Product ID 傳進來即可。

22. 與 UI 分支的關係

feature/ui 未來可能需要：

[簽發 VC]
[驗證 VC]

所以 API Response 必須是正常 JSON。

不要讓 UI 直接操作：

Private Key
crypto library
filesystem

UI：

POST API

即可。

23. 最低測試要求

至少需要以下測試：

Test 1
正常商品
→ VC issuance success


Test 2
VC credentialSubject
→ Product ID 正確


Test 3
Issuer DID
→ 正確


Test 4
正常 VC
→ Verify = true


Test 5
簽發後修改 productName
→ Verify = false


Test 6
簽發後修改 battery capacity
→ Verify = false


Test 7
使用錯誤 Public Key
→ Verify = false


Test 8
Private Key
→ 不存在 git tracked files
24. Demo 流程

最終必須可以現場演示：

① 啟動 VC Issuer

② 輸入 LaPO 商品 JSON

③ POST /credentials/issue

④ 系統產生 VC

⑤ 顯示：
   Credential ID
   Issuer DID
   Product ID
   Proof

⑥ POST /credentials/verify

⑦ 顯示：
   VALID ✅

⑧ 手動修改：
   capacityMah 2000 → 9999

⑨ 再 Verify

⑩ 顯示：
   INVALID ❌

這是第一階段最重要成果。

25. README 必須說明

feature/vc README 至少新增：

# VC Issuer

## Purpose

## Architecture

## Install

## Environment Variables

## Generate Keys

## Start Server

## Issue Credential

## Verify Credential

## Tampering Demo

## API

## Integration With DPP

附可以直接複製的：

curl

範例。

26. Definition of Done

只有滿足下面條件才算完成：

[ ] feature/vc 有獨立可啟動 VC Issuer
[ ] 有 Issuer DID
[ ] 有 Public / Private Key
[ ] Private Key 不進 Git
[ ] 可以接受 Product JSON
[ ] 可以產生 W3C VC
[ ] VC 有真實 cryptographic proof/signature
[ ] Credential Subject 使用 DPP Product ID
[ ] 正常 VC Verify = true
[ ] 修改 VC 後 Verify = false
[ ] 有基本 automated tests
[ ] 有 README
[ ] 不破壞其他 feature branches
27. Codex 執行規則

開始時：

git status
git branch
git fetch --all
git checkout feature/vc

確認自己位於：

feature/vc

不要：

git push main
git push dev

不要刪除其他人現有檔案。

每完成一個階段先測試。

建議 Commit：

feat: initialize vc issuer service

feat: add issuer did and key management

feat: implement product vc issuance

feat: add credential verification

test: add vc tampering verification tests

docs: add vc issuer documentation
28. 第一階段不要做的事情

避免 scope creep。

不要自行加入：

Blockchain
Ethereum
Smart Contract
IPFS
OAuth
Login System
Admin Dashboard
User Account
Approval Workflow
Product Qualification Rules
Credential Revocation
Wallet
Database Cluster
Docker/Kubernetes
Cloud Deployment
Microservices

除非既有程式必須需要。

我們第一階段追求：

簡單
能跑
真的簽名
真的能驗證
可以跟 DPP 串接

而不是一次完成整個 VC 生態。

29. 完成後請回報

Codex 完成後不要只說：

Done

請提供：

1. 新增 / 修改了哪些檔案
2. 使用什麼 VC security mechanism
3. 使用什麼 key algorithm
4. DID 如何建立
5. 如何啟動
6. 如何 Issue VC
7. 如何 Verify VC
8. Tampering test 結果
9. Automated test 結果
10. 尚未完成項目
11. 未來 feature/dpp 如何串接

不要自動 merge dev 或 main。

我另外幫你把這個第一版想成一句話

Codex 最後真正要做的是：

┌──────────────────────┐
│      商品 JSON        │
│ LaPO Fan / ID / 電池  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      VC Issuer        │
│                      │
│  建 VC               │
│  + Issuer DID        │
│  + Credential ID     │
│  + 發證時間           │
│  + Digital Signature │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Signed Product VC  │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  沒被修改      被修改
     │           │
     ▼           ▼
  VALID ✅    INVALID ❌