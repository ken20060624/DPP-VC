# DPP-VC 專案：VC Issuer 第二階段實作計畫

> 文件日期：2026-09-17  
> 工作基線：第一階段 `vc-issuer` 已通過 19 項測試，但尚未 commit、push 或 merge  
> 第二階段目標：將「本機簽章範例」提升為「具備簽發授權、公開身分與撤銷語意的可部署服務」。

## 1. 基線與原則

- 保留 VC Data Model 2.0、Data Integrity、`eddsa-jcs-2022`、Ed25519 Multikey 與 `assertionMethod`。
- 簽發端點必須授權；驗證、DID document、JSON-LD context 與 status list 維持可公開讀取。
- 撤銷使用 W3C Bitstring Status List v1.0，不使用舊的 `StatusList2021Entry` 名稱。
- 開發環境仍可使用 `did:key`；只有 DNS、TLS 與 HTTPS `did.json` 都實際上線後，才能宣稱 `did:web` 對外可解析。
- 驗證結果必須分開「簽章正確」、「Issuer 可信」、「時間有效」、「尚未撤銷」與「商品聲明已被審核」；本服務不證明最後一項。

## 2. 本階段交付項目

### Stage 2A：簽發與撤銷 API 授權

- `POST /api/v1/credentials/issue` 與撤銷端點要求 Bearer API key。
- 服務只保存 SHA-256 digest，比對使用 constant-time operation。
- 缺少、錯誤、格式異常的 token 統一回傳 `401 AUTHENTICATION_REQUIRED`，避免成為 token oracle。
- Authorization header 不得出現在 log 或 error response。

### Stage 2B：Bitstring Status List v1.0

- 每張新 Product VC 加入 `BitstringStatusListEntry`，`statusPurpose` 固定為 `revocation`。
- 依官方規範使用至少 16 KiB / 131,072 entries 的 bitstring。
- 狀態索引以密碼安全隨機方式分配，並永久保留已分配位置，避免從索引推測簽發順序。
- 發布經 GZIP 壓縮、base64url-no-padding、Multibase `u` 前綴的 signed `BitstringStatusListCredential`。
- 撤銷是不可逆操作；重複撤銷必須 idempotent。
- Verifier 必須驗證 Product VC 與 Status List VC 兩層簽章，再判斷對應 bit。

### Stage 2C：`did:web` 與公開文件路由

- `IssuerIdentityProvider` 新增 `DidWebProvider`，重用同一組 Ed25519 key material。
- `GET /.well-known/did.json` 發布不含私鑰的 DID document。
- `GET /contexts/product-v1.jsonld` 發布版本化 application context。
- 服務會校驗 configured `did:web` 與 public base URL 的 host/path 對應；本機 HTTP 只能證明路由與內容，不代表公網 TLS 部署已完成。

### Stage 2D：稽核、持久化與部署加固

- 簽發、撤銷、授權失敗寫入可追溯 audit event，但不記錄 token、私鑰或整張 credential payload。
- 將 file store/status state 換成具有 transaction 與 migration 的正式資料庫。
- 支援多 replica 的唯一索引分配、狀態更新與 cache invalidation。
- rate limit、reverse proxy trust、TLS、backup/restore、monitoring 與 disaster recovery。

### Stage 2E：金鑰輪替與生態串接

- DID document 可同時發布 current/retired-but-verifiable keys，新簽發只使用 current key。
- 建立 key compromise 與 DID deactivation runbook。
- DPP 保存 VC/status metadata，UI 分開顯示四種驗證結果。
- GS1 QR 維持 canonical Product ID，不放入每張 credential 的個別狀態查詢 URL。

## 3. API 契約

### 受保護的請求

```http
Authorization: Bearer <operator-api-key>
```

- `POST /api/v1/credentials/issue`
- `POST /api/v1/credentials/{uuid}/revoke`

### 公開讀取

- `POST /api/v1/credentials/verify`
- `GET /api/v1/credentials/{uuid}`
- `GET /status/v1/revocation`
- `GET /.well-known/did.json`（僅 `did:web` mode）
- `GET /contexts/product-v1.jsonld`
- `GET /health`、`GET /ready`

### Verification result

`checks` 新增：

```json
{
  "statusListProof": "passed",
  "credentialStatus": "passed"
}
```

已撤銷 credential 回傳 HTTP 200、`verified: false`、`errors: ["CREDENTIAL_REVOKED"]`；這是驗證結果，不是 HTTP protocol error。

## 4. 安全邊界

- API key digest 不是取代 OAuth/OIDC；它是單一後端 operator 的第二階段最小權限邊界。
- Bitstring Status List 表達「這張 VC 已撤銷」，不表示實體商品消失、不合格或被回收。
- Verifier 不接受 request 夾帶的 DID document、public key 或 status list URL 作為信任根。
- 開發用 file state 僅支援單一 process/replica；多實例部署前必須完成 Stage 2D。
- 撤銷狀態檢查失敗必須 fail closed，不得降級成「簽章有效所以整體有效」。

## 5. 測試與驗收

- 未帶 token、錯 token、正確 token。
- 授權不影響 verify/status/context/DID 公開路由。
- 每張 VC 有唯一隨機 `statusListIndex`，重啟後不重複分配。
- status list 解壓後恰為 16 KiB，且 bit ordering 符合官方演算法。
- 正常 VC：Product proof、Status List proof、revocation bit 皆通過。
- 撤銷後：相同 VC 變為 `CREDENTIAL_REVOKED`，重複撤銷結果不變。
- 竄改 status index/list URL/list proof/encoded bitstring 皆失敗。
- `did:web` DID document 不含 `secretKeyMultibase`，issuer/key/controller 完全一致。
- 實際 compiled server HTTP E2E：unauthorized issue → authorized issue → verify → revoke → reject。

## 6. Definition of Done

- [x] 第一階段回歸基線通過
- [x] 選定 W3C Bitstring Status List v1.0 而非舊規範
- [x] 簽發與撤銷端點有 constant-time API key 授權
- [x] 新簽 VC 含 signed `BitstringStatusListEntry`
- [x] 公開且簽章的 `BitstringStatusListCredential`
- [x] Verifier 同時檢查 status-list proof 與 revocation bit
- [x] 撤銷端點不可逆且 idempotent
- [x] `did:web` provider 與公開 DID/context routes
- [x] 自動測試、build、audit 與 compiled-server HTTP E2E 通過
- [ ] 正式資料庫與 audit log（Stage 2D）
- [ ] 舊 key 驗證與 rotation runbook（Stage 2E）
- [ ] 真實 DNS/TLS/HTTPS `did:web` 第三方解析
- [ ] 遠端 `dev`/PR/CI 治理完成

## 7. 官方依據

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [W3C Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/)
- [W3C Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/)
- [W3C Data Integrity EdDSA Cryptosuites v1.0](https://www.w3.org/TR/vc-di-eddsa/)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [W3C CCG did:web Method](https://w3c-ccg.github.io/did-method-web/)
