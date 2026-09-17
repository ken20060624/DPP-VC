# DPP-VC 專案：VC Issuer 第一階段實作計畫 v2

> 文件日期：2026-09-17  
> 適用範圍：`feature/vc` 及其與 `feature/dpp`、`feature/gs1`、`feature/ui` 的介面  
> 結論：原 `vc部分草稿.md` 不宜直接交給實作者執行；本文件取代它作為第一階段的執行基準，但保留舊檔供追溯。

## 1. Repository 現況基線

以下為 2026-09-17 從 GitHub `origin` 重新取得的分支狀態：

| 分支 | HEAD | 實際內容 | 判斷 |
| --- | --- | --- | --- |
| `main` | `0c24c37620d8` | README、UI mock、GS1 QR 產生器、VC 舊草稿 | 目前唯一包含各分支成果的整合線 |
| `dev` | `41350d27cdc4` | 只有初始 README | 尚未履行「整合與測試」角色 |
| `feature/dpp` | `41350d27cdc4` | 只有初始 README | 尚無 DPP schema 或 API |
| `feature/gs1` | `a88799e925bd` | QR 產生器、兩筆設備資料、QR 圖片 | 有雛形，但識別碼需修正 |
| `feature/ui` | `6a7fd1894660` | `lapo.java` JSON mock 與註解檔 | 尚無實際 UI；兩份 mock 內容不一致 |
| `feature/vc` | `8a50ae567d4b` | README 與 VC 舊草稿 | 尚無 Issuer 程式碼 |

重要事實：`main` 已直接合併 `feature/ui`、`feature/gs1`、`feature/vc`，但 `dev` 仍停在初始 commit。原計畫假設的 `feature/* → dev → main` 與實際歷史不一致。

目前所有遠端 feature/dev 分支的 tip 都已是 `main` 的 ancestor，沒有任何只存在分支、尚未進 `main` 的 commit；相對 `main`，`dev`/`feature/dpp` 落後 14 個 commit、`feature/gs1`/`feature/ui` 落後 12 個、`feature/vc` 落後 6 個。

## 2. 原計畫必須修正的問題

### 2.1 Git 流程與真實分支不一致

- `dev` 和 `feature/dpp` 都只有初始 README。
- `feature/vc` 落後 `main`；若直接開始開發，會錯過已合併到主線的 GS1 與 UI 資料。
- 第一個工作項目必須是由 repository owner 恢復分支策略，而不是直接寫程式。

### 2.2 商品識別碼互相衝突，而且目前範例不符合 GS1

- GS1 分支使用 `gtin = 047199990001`、序號 `FAN-2026-001`。
- UI/VC 草稿使用 `04710000000000`、序號 `SN202603001`。
- 上述兩個 GTIN 的檢查碼都不正確。
- GS1 Digital Link 新實作在 AI `(01)` 後應使用 14 位數 GTIN，序號使用 AI `(21)`。
- 因此不能繼續把自訂的 `urn:gtin:...:SN...` 與 Digital Link URL 當成同一個產品 ID。

### 2.3 VC 2.0 只指定 `@context`，沒有指定安全機制

「有 `proof`」不等於符合 VC 2.0，也不能證明所有欄位都被保護。必須固定：

- securing mechanism；
- cryptosuite；
- key representation；
- canonicalization；
- proof purpose；
- verification method 的可信解析方式。

### 2.4 `did:web:issuer.example.com` 不能當作可驗證的本機 DID

`did:web` 驗證需要從 HTTPS 網址取得 DID document。若網域不存在、沒有 TLS、沒有 `did.json`，外部 Verifier 就無法解析公鑰。開發環境必須採用可自我解析的 DID，或明確標示為只在本機 resolver 中有效。

### 2.5 原 Verification API 的信任邊界不足

Verifier 不可以直接相信 credential 內夾帶的公鑰，也不能只做「用某把 key 驗簽」。它還必須確認：

- `proof.verificationMethod` 可從可信 controller document 解析；
- 該 key 被列在 `assertionMethod`；
- key controller 與 credential issuer 一致；
- proof purpose、cryptosuite、VC 必要欄位、時間欄位均符合預期；
- issuer 是否在本 Demo 的允許名單內。

### 2.6 Demo 文案超出第一階段能證明的範圍

GS1 mock 目前寫有「通過 SGS」、「憑證被撤銷」等敘述，但第一階段明確不串 SGS，也不實作 credential status/revocation。第一階段只能證明「由指定 Issuer 簽發且簽發後未被竄改」，不能證明商品真實、合規、通過 SGS 或未被撤銷。

### 2.7 私鑰直接放 `.env` 不是理想預設

`.env` 可以保存「私鑰檔案路徑」，但不應把整把私鑰當作預設做法。開發金鑰應存在被 Git 忽略的 `secrets/`，程式啟動時從檔案載入；正式環境再替換為 Secret Manager 或 KMS adapter。

## 3. 第一階段目標

建立一個獨立可啟動、可測試的 Product VC Issuer：

```text
Product JSON
    ↓ 格式與識別碼驗證（不是商品合規審查）
W3C VC Data Model 2.0 credential
    ↓ Ed25519 Data Integrity 簽章
Signed ProductCredential
    ↓ 可信 DID/key 解析與驗證
VERIFIED 或 REJECTED
```

成功定義：

1. 同一個 Product ID 能貫穿 GS1、DPP、VC、UI。
2. 正常 credential 驗證成功。
3. 修改任何已簽欄位後驗證失敗。
4. Verifier 不接受攻擊者自簽、錯誤 issuer、錯誤 purpose 或不受信任 key。
5. 私鑰不進 Git、不出現在 log 或 API response。
6. 測試與 Demo 不宣稱尚未實作的合規、撤銷或第三方背書。

## 4. 明確不在第一階段範圍

- SGS、LaPO 或電池供應商的真實 API 與真實背書
- 商品合規審核或人工批准流程
- OAuth、登入、角色與權限管理
- Wallet、Verifiable Presentation、選擇性揭露
- Credential Status、Status List、撤銷與金鑰輪替流程
- Blockchain、Smart Contract、IPFS
- 正式資料庫、雲端部署、Kubernetes
- 把整份 DPP 固定等同於一張 VC

## 5. 先決工作：恢復分支基線

此段由 repository owner 執行或核准；實作者不得自行改寫共享分支歷史。

1. 用 PR 將 `main` 的目前成果同步回 `dev`，使 `dev` 成為真實整合線。
2. 保護 `main` 與 `dev`，禁止直接 push。
3. 在乾淨的 `feature/vc` 上合併最新 `origin/dev`；共享分支不使用強制 rebase/force-push。
4. 後續路徑固定為：

```text
feature/vc → PR → dev → 整合測試 → PR → main
```

5. 若團隊決定不要 `dev`，必須先同步修改根 README 與本計畫，再改成 `feature/* → main`；不能同時維持兩套說法。

## 6. 跨分支 Product Identity Contract

### 6.1 唯一 canonical Product ID

第一階段統一使用 GS1 Digital Link URI 作為 `product.id` 與 VC `credentialSubject.id`：

```text
https://dpp-demo.example.com/01/{GTIN-14}/21/{SERIAL}
```

Demo fixture 統一為：

```json
{
  "id": "https://dpp-demo.example.com/01/00047199990002/21/FAN-2026-001",
  "gtin": "00047199990002",
  "serialNumber": "FAN-2026-001"
}
```

注意：`00047199990002` 是由目前 mock 修正出的測試值，只供 Demo，不代表真實註冊或獲授權的 LaPO GTIN。正式展示前必須由 GS1 owner 換成合法配置的 GTIN。

### 6.2 Issuer 端格式規則

- `gtin` 必須是 14 位數字且通過 GS1 Mod-10 check digit。
- `serialNumber` 必須符合 AI `(21)` 的允許長度與字元規則。
- `id` 必須可解析，且其中 `(01)`、`(21)` 必須分別等於 `gtin`、`serialNumber`。
- 三者不一致時回傳 `422 PRODUCT_ID_MISMATCH`；這是資料格式錯誤，不是商業審核。
- API 不從 QR 圖片讀取資料；QR 只負責傳遞同一個 canonical URI。

### 6.3 單一 fixture

建立一份由團隊共用的 `fixtures/products/fan-001.json`。GS1、DPP、VC、UI 的自動測試都讀取或複製自這份契約，不再各自維護互相矛盾的產品名稱、型號、電池容量與序號。

## 7. VC 與密碼學決策

### 7.1 Credential data model

- W3C Verifiable Credentials Data Model v2.0
- Base context：`https://www.w3.org/ns/credentials/v2`
- `type`：`["VerifiableCredential", "ProductCredential"]`
- `validFrom`：UTC RFC 3339 timestamp
- Credential ID：`urn:uuid:{UUIDv4}`
- `credentialSubject.id`：第 6 節的 canonical Product ID
- 自訂商品欄位使用固定、版本化的 local application context；測試和正式服務皆採 allowlist 與本地快取，不在每次簽發/驗證時任意抓遠端 context。

### 7.2 Securing mechanism

第一階段固定使用：

| 項目 | 決策 |
| --- | --- |
| Securing mechanism | W3C Verifiable Credential Data Integrity 1.0 |
| Proof type | `DataIntegrityProof` |
| Cryptosuite | `eddsa-jcs-2022` |
| Signature algorithm | Ed25519 |
| Canonicalization | JSON Canonicalization Scheme（JCS / RFC 8785） |
| Key representation | `Multikey` + `publicKeyMultibase` |
| Proof purpose | `assertionMethod` |

選用 JCS 是為了讓完整 JSON 文件以 lossless 方式進入 canonicalization，降低自訂商品欄位因 JSON-LD/RDF term 未定義而未被簽到的風險。仍須依 Data Integrity 規範驗證/allowlist context。

預期 proof：

```json
{
  "type": "DataIntegrityProof",
  "cryptosuite": "eddsa-jcs-2022",
  "created": "2026-09-17T00:00:00Z",
  "verificationMethod": "did:key:...#...",
  "proofPurpose": "assertionMethod",
  "proofValue": "z..."
}
```

不得自己手刻 Ed25519、JCS、Multibase 或 Data Integrity 演算法。選定套件後，先以 W3C 官方 test vector 做 compatibility spike；若套件不能產生與驗證 VC 2.0 + `eddsa-jcs-2022`，先寫 ADR 更換維護中的實作，不以自製簽章流程補洞。

## 8. DID 策略

### 8.1 開發與自動測試

- 使用由 Ed25519 public key 派生的 `did:key`。
- DID resolver 必須回傳 controller document，公鑰列在 `verificationMethod`，並以 `assertionMethod` 授權。
- 驗證只讀取 resolver/controller document 的公鑰，不讀取 request 額外夾帶的任意公鑰。
- `did:key` 是 W3C Credentials Community Group draft，適合這個可重現 Demo，但缺乏更新/輪替能力，不作為長期正式 issuer identity。

### 8.2 正式展示或部署

- 只有在團隊能控制真實 HTTPS 網域並發布 DID document 後，才切換到 `did:web`。
- `did:web:dpp.lapo.com.tw` 必須解析到 `https://dpp.lapo.com.tw/.well-known/did.json`，且文件中的 `id`、controller、verification method 與實際 key 完全一致。
- `did:web:issuer.example.com` 只能出現在說明範例，不能列為已驗證 Demo 的 issuer。

### 8.3 可替換介面

程式以介面隔離：

```text
IssuerIdentityProvider
├─ DevDidKeyProvider
└─ WebDidProvider（第二階段啟用）

DidResolver
├─ DidKeyResolver
└─ DidWebResolver（第二階段啟用）
```

Issuer 與 Verifier 不得在 controller/API handler 中硬寫 DID method。

## 9. API Contract

所有 response 都是 JSON；錯誤不得包含 stack、私鑰、secret path 或完整內部例外。

### 9.1 `POST /api/v1/credentials/issue`

Request：

```json
{
  "product": {
    "id": "https://dpp-demo.example.com/01/00047199990002/21/FAN-2026-001",
    "gtin": "00047199990002",
    "serialNumber": "FAN-2026-001",
    "productName": "LaPO 迷你渦輪隨身風扇",
    "modelNumber": "LF-02",
    "brand": "LaPO",
    "countryOfOrigin": "TW",
    "batteryComponent": {
      "chemistry": "Li-ion",
      "capacityMah": 5100,
      "voltageV": 3.7,
      "energyWh": 18.87
    },
    "environmentalMetrics": {
      "carbonFootprintKgCO2e": 2.1,
      "pcrPlasticPercentage": 25,
      "recyclabilityPercentage": 88,
      "rohsCompliant": true,
      "reachCompliant": true
    }
  }
}
```

行為：

1. 限制 request body 大小並解析 JSON。
2. 驗證 core schema、GTIN check digit 與 identity consistency。
3. 保留並簽署 schema 允許的完整 product payload；不得只簽 `id` 卻把其他欄位原樣附在外面。
4. 建立 UUID、`validFrom` 與 issuer。
5. 用 `eddsa-jcs-2022` 產生 Data Integrity proof。
6. 先在服務內部驗證剛簽出的 credential；失敗則不回傳成功。
7. 成功回傳 HTTP `201` 與 `{ "credential": { ... } }`。
8. 可選擇以 atomic write 保存副本；儲存失敗的處置需由設定決定，不可產生半個 JSON 檔。

只有格式錯誤可拒發；`rohsCompliant: false`、較高碳排或其他商業內容不屬於第一階段拒發條件。

### 9.2 `POST /api/v1/credentials/verify`

Request：

```json
{
  "credential": {}
}
```

驗證至少包含：

1. VC 2.0 必要結構與允許的 context/type。
2. `DataIntegrityProof` 與 `eddsa-jcs-2022`。
3. `proofPurpose === "assertionMethod"`。
4. verification method 的 DID resolution。
5. verification method 確實受 controller 的 `assertionMethod` 授權。
6. issuer 與 key controller binding。
7. Ed25519 signature。
8. `validFrom` 尚未生效等時間錯誤。
9. issuer allowlist（Demo 只信任由本機 issuer key 派生的 identity）。

成功回傳：

```json
{
  "verified": true,
  "issuerTrusted": true,
  "credentialId": "urn:uuid:...",
  "subjectId": "https://dpp-demo.example.com/01/00047199990002/21/FAN-2026-001",
  "checks": {
    "proof": "passed",
    "proofPurpose": "passed",
    "issuerBinding": "passed",
    "time": "passed"
  },
  "warnings": [
    "Product claims were not independently audited."
  ]
}
```

失敗回傳 `verified: false` 與穩定的 machine-readable error code，例如 `INVALID_SIGNATURE`、`UNTRUSTED_ISSUER`、`UNSUPPORTED_CRYPTOSUITE`；不得把底層 stack 直接回傳。

### 9.3 其他端點

- `GET /health`：只表示 process 存活。
- `GET /ready`：確認 key 已載入、issuer identity 可建立、必要 context/resolver 可用。
- `GET /api/v1/credentials/:id`：僅在 file store 啟用時提供；需阻擋 path traversal，參數只接受 UUID。

## 10. 建議技術與專案結構

技術方向：Node.js + TypeScript + Fastify（或團隊一致同意的同級框架），使用維護中的 VC/Data Integrity library、schema validator 與 test runner。套件版本鎖在 lockfile，`package.json` 固定 Node engine，CI 使用同一 major 版本。

```text
vc-issuer/
├─ src/
│  ├─ api/
│  │  ├─ issue-route.ts
│  │  ├─ verify-route.ts
│  │  └─ health-route.ts
│  ├─ vc/
│  │  ├─ credential-builder.ts
│  │  ├─ credential-issuer.ts
│  │  └─ credential-verifier.ts
│  ├─ identity/
│  │  ├─ issuer-identity-provider.ts
│  │  ├─ did-key-provider.ts
│  │  └─ did-resolver.ts
│  ├─ crypto/
│  │  └─ key-loader.ts
│  ├─ models/
│  │  └─ product-schema.ts
│  ├─ storage/
│  │  └─ credential-store.ts
│  ├─ config.ts
│  └─ server.ts
├─ contexts/
│  └─ product-v1.jsonld
├─ data/credentials/.gitkeep
├─ secrets/.gitkeep
├─ scripts/generate-key.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ security/
│  └─ fixtures/
├─ .env.example
├─ package.json
├─ tsconfig.json
└─ README.md
```

## 11. Key 與 secret 管理

`.env.example` 只放非 secret 值與 secret path：

```dotenv
PORT=3000
ISSUER_DID_METHOD=key
ISSUER_PRIVATE_KEY_PATH=./secrets/issuer-key.json
CREDENTIAL_STORE_ENABLED=true
CREDENTIAL_STORE_PATH=./data/credentials
```

要求：

- `.gitignore` 必須包含 `.env`、`secrets/*`、`data/credentials/*.json`，並用 `.gitkeep` 保留空目錄。
- key generation 預設不覆蓋既有 key；若要覆蓋必須明確加旗標並二次確認。
- public export 永遠移除 `secretKeyMultibase`。
- log 需遮蔽名稱含 `secret`、`privateKey`、`token` 的欄位。
- CI 執行 tracked-file secret scan，另用 `git ls-files` 證明 private key 未被追蹤。

## 12. 實作階段與每階段出口條件

### Stage 0：Repository 與契約對齊

- 完成第 5 節的分支決策。
- 建立 canonical fixture。
- 由 GS1 owner 修正 GTIN 與 QR fixture；由 UI/DPP owner改用同一 Product ID。
- 出口：四個 feature owner 對 `product.id`、`gtin`、`serialNumber` 有相同測試值。

### Stage 1：Service skeleton 與設定

- 建立 TypeScript service、schema validation、config validation、`/health`、`/ready`。
- 出口：缺 key 時 `/health` 可存活但 `/ready` 失敗，且錯誤不洩漏 secret。

### Stage 2：Key、DID 與 resolver

- 產生 Ed25519 Multikey，建立 `did:key` issuer/controller document。
- 實作 `assertionMethod` resolution 與 trusted issuer 設定。
- 出口：公鑰可解析；私鑰未被 Git 追蹤；錯 key 與未授權 key 會失敗。

### Stage 3：VC builder 與 issuer

- 建立 VC 2.0 credential，套用 local context，產生 Data Integrity proof。
- 出口：官方/固定 test vector compatibility test 通過；輸出無 `issuanceDate` v1 欄位。

### Stage 4：Verifier

- 完成 cryptographic verification、purpose、controller binding、time 與 allowlist。
- 出口：正常 VC 通過，任何 signed claim 被改動都失敗，自簽攻擊也失敗。

### Stage 5：HTTP API、storage 與整合

- 完成 issue/verify API、可選 file store、穩定錯誤格式與 UI 可用的 CORS 設定。
- 出口：以真實 HTTP request 完成 issuance → verify → tamper → reject。

### Stage 6：文件與 PR

- README 包含 install、generate key、start、issue、verify、tamper demo、API、信任限制、DPP/GS1/UI 整合。
- PR 只合併到團隊選定的整合線，不自動 merge `dev` 或 `main`。

## 13. 最低測試矩陣

| 類別 | 測試 | 預期 |
| --- | --- | --- |
| Schema | 缺 `product`、缺 `id`、錯誤型別 | 4xx + 穩定 error code |
| Identity | 錯 GTIN check digit | 拒發 |
| Identity | URL、GTIN、serial 不一致 | `PRODUCT_ID_MISMATCH` |
| Issue | 正常 fixture | 201，VC 2.0 欄位正確 |
| Proof | proof type/suite/purpose | 完全符合第 7 節 |
| Verify | 原始 VC | `verified: true` |
| Tamper | 改 `productName` | `INVALID_SIGNATURE` |
| Tamper | 改 `batteryComponent.capacityMah` | `INVALID_SIGNATURE` |
| Tamper | 改 subject ID | `INVALID_SIGNATURE` |
| Trust | 攻擊者用自己的 key 重簽並夾帶公鑰 | `UNTRUSTED_ISSUER` 或 key resolution 失敗 |
| Trust | key 存在但不在 `assertionMethod` | 驗證失敗 |
| Trust | issuer 與 key controller 不一致 | 驗證失敗 |
| Time | `validFrom` 在未來 | 驗證失敗 |
| Robustness | 未知 cryptosuite/context | 明確拒絕，不 crash |
| Storage | 相同 UUID/非法 path/寫入中斷 | 不覆蓋、不 traversal、不留半檔 |
| Secret | tracked files 與 log 掃描 | 找不到 private key |
| HTTP E2E | 啟動實際 server 後完整 Demo | 所有 request/response 與文件一致 |

測試必須 deep-clone credential 後再竄改，避免測試程式誤改原物件造成假陽性/假陰性。時間與 UUID 以 injectable clock/ID generator 固定，避免 flaky test。

## 14. Demo 驗收流程

1. 從乾淨 checkout 安裝相依套件。
2. 產生開發 key，證明 Git 沒追蹤 private key。
3. 啟動 service，`/health` 與 `/ready` 均通過。
4. 對 canonical fan fixture 呼叫 issue API。
5. 顯示 credential ID、issuer、subject ID、cryptosuite、verification method；不顯示 private key。
6. 將原始 credential 送到 verify API，得到 `verified: true`。
7. 把 `capacityMah` 從 `5100` 改成 `9999`，再次驗證，得到 `INVALID_SIGNATURE`。
8. 用另一把 key 自簽同一內容，再次驗證，得到 untrusted issuer/key 錯誤。
9. 說明驗證結果只代表來源與完整性，不代表 SGS、法規合規或資料真實性。

## 15. Definition of Done

- [ ] 分支整合策略已與實際 Git 歷史一致（仍需 repository owner 同步遠端 `dev`）
- [x] GS1、DPP、VC、UI 使用同一 canonical Product ID
- [x] Demo GTIN 是 14 位且通過 check digit
- [x] `feature/vc` 有獨立可啟動的 service
- [x] 輸出符合 VC Data Model 2.0 的 credential
- [x] 使用 `DataIntegrityProof` / `eddsa-jcs-2022` / Ed25519 Multikey
- [x] 開發 issuer 使用可解析的 `did:key`
- [x] Verifier 驗證 `assertionMethod`、issuer binding、signature、time 與 trust allowlist
- [x] 修改任何被簽商品欄位後驗證失敗
- [x] 攻擊者自簽 credential 不會被視為可信
- [x] private key 不在 Git、log、response
- [x] HTTP E2E、unit、integration、security tests 全部通過
- [ ] README 的 command 可從乾淨 checkout 重現
- [x] UI 不把「signature verified」誤寫成「商品已合規」
- [x] 未自動 merge 或 push 到 `dev` / `main`

## 16. 完成後回報格式

1. 新增與修改的檔案
2. 實際套件與鎖定版本
3. VC securing mechanism、cryptosuite、key algorithm
4. Issuer DID 與 verification method 如何產生/解析
5. 啟動、issue、verify 指令
6. 正常與 tamper Demo 的完整結果
7. 自簽/錯 key/錯 issuer 的負面測試結果
8. Automated test 與 HTTP E2E 結果
9. private key 未進 Git 的證據
10. 已證明、部分證明、尚未證明的邊界
11. DPP、GS1、UI 下一步如何串接

## 17. 依據

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [W3C Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/)
- [W3C Data Integrity EdDSA Cryptosuites v1.0](https://www.w3.org/TR/vc-di-eddsa/)
- [W3C Decentralized Identifiers (DID) v1.0](https://www.w3.org/TR/did-core/)
- [W3C CCG did:key Method Specification](https://w3c-ccg.github.io/did-key-spec/)
- [W3C CCG did:web Method Specification](https://w3c-ccg.github.io/did-method-web/)
- [GS1 Digital Link URI Syntax](https://ref.gs1.org/standards/digital-link/uri-syntax/)
