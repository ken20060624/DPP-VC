# VC Issuer

本服務把 DPP 商品資料簽成 W3C Verifiable Credential，並提供來源、完整性、
Issuer trust、時間與撤銷狀態驗證。第二階段新增 Bearer API key 授權、W3C
Bitstring Status List v1.0、`did:web` provider，以及可公開取得的 DID document
與 JSON-LD context。

它不會證明商品為真、符合法規、通過 SGS，或證明 Product VC 內的商業聲明
經過獨立查核。

## 安全設定檔

| 項目 | 實作 |
| --- | --- |
| Credential model | W3C VC Data Model 2.0 |
| Securing mechanism | Verifiable Credential Data Integrity 1.0 |
| Proof / cryptosuite | `DataIntegrityProof` / `eddsa-jcs-2022` |
| Signature / key | Ed25519 / Multikey |
| Canonicalization | RFC 8785 JCS |
| Proof purpose | `assertionMethod` |
| Development DID | `did:key` |
| Deployment DID | root-domain `did:web` |
| Credential status | W3C Bitstring Status List v1.0 / `revocation` |
| Protected operations | Bearer API key，服務端只保存 SHA-256 digest |

Verifier 不接受 request 自帶的 public key、DID document 或 status list 作為信任根。
它使用 configured issuer identity，檢查 `assertionMethod`、issuer/key binding、兩層
Data Integrity proof、有效時間，以及 131,072-entry status list 的指定 bit。

## 架構

```text
Authorized issue request
  -> product/GS1 validation
  -> random status-list index reservation
  -> Product VC + BitstringStatusListEntry
  -> Ed25519 Data Integrity proof
  -> self verification
  -> atomic credential storage

Public verification request
  -> Product VC proof and issuer checks
  -> signed BitstringStatusListCredential
  -> status-list proof and revocation bit
  -> VERIFIED or REJECTED
```

## 需求與安裝

- Node.js `22.12` 到 `22.x`
- npm

```powershell
cd C:\Users\fsc28\Desktop\DPP-VC\vc-issuer
npm ci
Copy-Item .env.example .env
npm run generate-key
npm run generate-api-key
```

`generate-key` 預設拒絕覆蓋既有 issuer key。`generate-api-key` 會顯示一次 plaintext
operator key 與它的 SHA-256 digest：

1. 把 plaintext key 放進受權 client 的 secret storage；不要寫進 Git 或 `.env`。
2. 把輸出的 `OPERATOR_API_KEY_SHA256=...` 貼進 `.env`，取代 placeholder。

## 環境變數

| 變數 | 預設／要求 | 說明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listener port |
| `HOST` | `127.0.0.1` | bind address |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:3000` | status/context 的 canonical public origin；不可含 path/query/fragment |
| `ISSUER_DID_METHOD` | `key` | `key` 或 `web` |
| `ISSUER_DID_WEB` | web mode 必填 | 必須等於由 HTTPS `PUBLIC_BASE_URL` 推導出的 root-domain DID |
| `ISSUER_VERIFICATION_METHOD_FRAGMENT` | `key-1` | `did:web` key fragment |
| `ISSUER_PRIVATE_KEY_PATH` | `./secrets/issuer-key.json` | 私鑰檔路徑，不是私鑰內容 |
| `OPERATOR_API_KEY_SHA256` | 必填 | 64 字元 SHA-256 hex digest |
| `CREDENTIAL_STORE_ENABLED` | `true` | 保存已簽 Product VC；撤銷需要啟用 |
| `CREDENTIAL_STORE_PATH` | `./data/credentials` | credential file store |
| `STATUS_LIST_STORE_PATH` | `./data/status` | index allocation 與 revocation state |
| `CORS_ORIGINS` | `http://localhost:5173` | 逗號分隔 browser origins |

Application context URL 由 `PUBLIC_BASE_URL` 自動建立為
`{PUBLIC_BASE_URL}/contexts/product-v1.jsonld`，因此簽章內容與實際公開路由一致。

### `did:web` mode

例如正式 origin 是 `https://issuer.example.com`：

```dotenv
PUBLIC_BASE_URL=https://issuer.example.com
ISSUER_DID_METHOD=web
ISSUER_DID_WEB=did:web:issuer.example.com
ISSUER_VERIFICATION_METHOD_FRAGMENT=key-1
```

服務會在 `/.well-known/did.json` 發布 DID document。這只完成應用層行為；正式驗收
仍需從外部網路透過有效 DNS 與 TLS 取得
`https://issuer.example.com/.well-known/did.json`。

## 啟動

```powershell
npm run check
npm test
npm run build
npm start
```

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/ready
```

`/health` 只表示 process 存活；`/ready` 會回報 issuer、DID method、cryptosuite
與 status-list URL。

## 完整 Demo

先把一次性產生並安全保存的 plaintext operator key 輸入目前 PowerShell session：

```powershell
$operatorKey = Read-Host 'Operator API key'
$authHeaders = @{ Authorization = "Bearer $operatorKey" }
```

### 1. 簽發

```powershell
$product = Get-Content ..\fixtures\products\fan-001.json -Raw |
  ConvertFrom-Json
$issueBody = @{ product = $product } | ConvertTo-Json -Depth 30
$issued = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/v1/credentials/issue `
  -Headers $authHeaders `
  -ContentType 'application/json' `
  -Body $issueBody
$issued.credential | ConvertTo-Json -Depth 30
```

未帶或帶錯 Bearer token 會得到 HTTP 401 與
`AUTHENTICATION_REQUIRED`；兩者使用相同 error shape。

新 credential 會包含：

```json
{
  "credentialStatus": {
    "type": "BitstringStatusListEntry",
    "statusPurpose": "revocation",
    "statusListIndex": "隨機十進位索引",
    "statusListCredential": "http://127.0.0.1:3000/status/v1/revocation"
  }
}
```

### 2. 驗證

```powershell
$verifyBody = @{ credential = $issued.credential } |
  ConvertTo-Json -Depth 30
$verified = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/v1/credentials/verify `
  -ContentType 'application/json' `
  -Body $verifyBody
$verified | ConvertTo-Json -Depth 10
```

成功時除了原有 proof、purpose、binding、time，還會有：

```json
{
  "verified": true,
  "checks": {
    "statusListProof": "passed",
    "credentialStatus": "passed"
  }
}
```

### 3. 撤銷

```powershell
$uuid = $issued.credential.id.Replace('urn:uuid:', '')
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:3000/api/v1/credentials/$uuid/revoke" `
  -Headers $authHeaders `
  -ContentType 'application/json' `
  -Body '{}'
```

再次執行相同撤銷請求是安全的，response 會以 `alreadyRevoked` 區分第一次與重複
操作。撤銷不可逆；同一張 credential 再送到 verify endpoint 會得到：

```json
{
  "verified": false,
  "errors": ["CREDENTIAL_REVOKED"],
  "checks": {
    "proof": "passed",
    "statusListProof": "passed",
    "credentialStatus": "failed"
  }
}
```

### 4. 公開文件

```powershell
Invoke-RestMethod http://127.0.0.1:3000/status/v1/revocation
Invoke-RestMethod http://127.0.0.1:3000/contexts/product-v1.jsonld
```

`/.well-known/did.json` 只在 `did:web` mode 啟用。Status list 與 context 不要求
Bearer token，方便 verifier 快取與公開解析。

## API

| Method | Path | 授權 | 用途 |
| --- | --- | --- | --- |
| GET | `/health` | 公開 | process liveness |
| GET | `/ready` | 公開 | issuer/status readiness |
| GET | `/contexts/product-v1.jsonld` | 公開 | versioned JSON-LD context |
| GET | `/.well-known/did.json` | 公開 | `did:web` document；key mode 回 404 |
| GET | `/status/v1/revocation` | 公開 | signed Bitstring Status List VC |
| POST | `/api/v1/credentials/issue` | Bearer | 簽發 Product VC |
| POST | `/api/v1/credentials/verify` | 公開 | 驗證 proof、trust、time、status |
| GET | `/api/v1/credentials/{uuid}` | 公開 | 讀取已保存 credential |
| POST | `/api/v1/credentials/{uuid}/revoke` | Bearer | 永久撤銷 credential |

穩定 verification codes 新增：

- `INVALID_STATUS_ENTRY`
- `STATUS_LIST_VERIFICATION_FAILED`
- `STATUS_CHECK_FAILED`
- `CREDENTIAL_REVOKED`

## 測試

```powershell
npm run check
npm test
npm run build
npm audit --omit=dev
```

測試涵蓋 API key 正負案例、Product VC 與 Status List VC 的真實簽章、bit ordering、
16 KiB 最低清單長度、跨 store instance 的 index 唯一性、正常驗證、狀態清單竄改
fail-closed、不可逆／idempotent 撤銷、`did:web` document 無私鑰，以及第一階段原有
GS1、tamper、self-signed attacker、CORS、storage 與 QR tests。

## 尚未完成的正式環境工作

- file stores 適合目前單機示範；正式多 replica 需要 transactional database、migration、
  audit log 與跨節點 cache invalidation。
- API key 是單一後端 operator 邊界，不等同 OAuth/OIDC、角色或使用者生命週期管理。
- 尚未建立 retired-key 驗證、金鑰輪替與 compromised-key runbook。
- 尚未部署真實 DNS/TLS，也尚未由外部 resolver 驗收 `did:web`。
- 尚未建立 CI/PR branch protection，遠端 `dev` 仍需 repository owner 決策。

## 依據

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [W3C Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/)
- [W3C Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/)
- [W3C Data Integrity EdDSA Cryptosuites v1.0](https://www.w3.org/TR/vc-di-eddsa/)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [W3C CCG did:web Method](https://w3c-ccg.github.io/did-method-web/)
