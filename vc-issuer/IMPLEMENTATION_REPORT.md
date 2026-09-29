# VC Issuer 第一階段實作報告

> 執行日期：2026-09-17  
> 工作分支：本機 `feature/vc`  
> 遠端狀態：未 push、未 merge `dev` 或 `main`

## 1. 完成內容

- 本機 `feature/vc` 已以 fast-forward 同步至檢查過的 `origin/main`。
- 新增獨立 Node.js/TypeScript/Fastify VC Issuer service。
- 建立共用 product fixture，統一 GS1、DPP、VC、UI Product ID。
- 修正 Demo GTIN 為通過 Mod-10 的 14 位數 `00047199990002`。
- 重新產生兩張 QR 圖，測試會實際解碼 PNG 並核對目標 URL。
- 把 `lapo.java` 從「DPP 與 VC 混在一起」改成純商品 JSON。
- 實作 key generation、`did:key` identity、Data Integrity 簽發與可信驗證。
- 實作 issue、verify、health、ready、credential retrieval API。
- 實作 optional atomic/no-overwrite file storage。
- 完成 README、PowerShell Demo 與安全限制說明。

## 2. Security mechanism

| 項目 | 實作 |
| --- | --- |
| Credential model | W3C Verifiable Credentials Data Model 2.0 |
| Securing mechanism | Verifiable Credential Data Integrity 1.0 |
| Proof type | `DataIntegrityProof` |
| Cryptosuite | `eddsa-jcs-2022` |
| Signature | Ed25519 |
| Canonicalization | RFC 8785 JCS |
| Key representation | Multikey / `publicKeyMultibase` |
| Proof purpose | `assertionMethod` |

實作過程曾發現 `eddsa-jcs-2022` 套件對「HTTP round-trip 後的內嵌
JSON-LD context 物件」會因參照比較而誤判。最後改為版本化 context URL，
並由本地 allowlist/cache 解析；已證明簽章通過 JSON serialization 後仍可驗證。

## 3. Issuer DID

開發環境從 Ed25519 public key 派生 `did:key`，再建立包含
`verificationMethod` 與 `assertionMethod` 的 controller document。

本次本機 key 的 DID：

```text
did:key:z6MkfhbHKJpUGMVe8JYhGj3ZmpxF62UpbGizFfS9ub43gRPL
```

私鑰位於被 Git 忽略的 `vc-issuer/secrets/issuer-key.json`。重新產生 key
會得到不同 DID；正式環境尚未部署 `did:web`。

## 4. 啟動方式

```powershell
cd C:\Users\fsc28\Desktop\DPP-VC\vc-issuer
npm ci
npm run generate-key
npm run check
npm test
npm run build
npm start
```

若 key 已存在，generate command 會拒絕覆寫。刻意輪替必須同時提供
`--force --confirm-overwrite`。

## 5. API

- `GET /health`
- `GET /ready`
- `POST /api/v1/credentials/issue`
- `POST /api/v1/credentials/verify`
- `GET /api/v1/credentials/:id`

完整 request、response 與 tampering commands 見 `README.md`。

## 6. 驗證結果

### Static/build/test

```text
npm run check   PASS
npm test        PASS: 4 test files, 19 tests
npm run build   PASS
npm audit --omit=dev   0 vulnerabilities
git diff --check       PASS（只有 Windows LF/CRLF 提示）
```

19 個測試涵蓋：

- VC 2.0 真實簽發、HTTP JSON round-trip、驗證與 retrieval；
- 固定 seed/time/UUID 的 `eddsa-jcs-2022` proof vector；
- product name、battery capacity、subject ID 竄改；
- 攻擊者使用另一把 key 自簽；
- 未來 `validFrom`；
- context、proof purpose、issuer/key binding；
- GTIN check digit 與 Product ID consistency；
- missing key readiness、malformed JSON、CORS、path traversal；
- atomic no-overwrite storage；
- 兩張 QR PNG 的實際解碼結果。

### 真實 compiled-server HTTP E2E

執行 `node dist/src/server.js` 後，以獨立 PowerShell HTTP client 測得：

```json
{
  "IssueId": "urn:uuid:e18f4258-1911-4727-ac02-f9f83bebdedc",
  "Suite": "eddsa-jcs-2022",
  "Valid": true,
  "Tampered": false,
  "Error": "INVALID_SIGNATURE"
}
```

測試完成後 server 已停止。

### Secret boundary

- `git check-ignore` 證明 `vc-issuer/secrets/issuer-key.json` 被忽略。
- `git ls-files` 找不到 issuer private key 或 `.env`。
- key generation overwrite guard 已測試，既有 key hash 保持不變。
- API、log 與報告均未輸出 `secretKeyMultibase`。

## 7. 已證明、部分證明、未證明

### 已證明

- 本機 service 能產生具有真實 Ed25519 Data Integrity proof 的 VC 2.0。
- 正常 credential 在 HTTP JSON round-trip 後可以驗證。
- 修改已簽商品內容會得到 `INVALID_SIGNATURE`。
- 攻擊者用另一個 issuer/key 自簽不會被視為可信。
- 共用 product fixture、GS1 device URL、QR 圖與 UI mock 使用同一識別碼。

### 部分證明

- Python QR generator 已通過 Python AST syntax parse，並新增鎖版
  `requirements.txt`；目前主機的預設 Python shim 沒有安裝 `qrcode`，所以本輪
  QR 圖改由 npm `qrcode` CLI 產生，再由自動測試解碼驗證。
- README commands 已在目前 workspace 執行，但尚未另外建立全新 clone 做
  clean-checkout rehearsal。

### 尚未證明／不在第一階段

- 遠端 `dev` 尚未由 repository owner 同步至 `main` 的現況。
- `did:web`、公開 HTTPS `did.json` 與第三方網路解析。
- application context 尚未真正發布在 example URL；目前只由 bundled allowlist
  解析。
- Issue endpoint 尚無登入或權限控制，不可直接暴露到不受信任網路。
- Credential revocation/status、key rotation history、Wallet、VP。
- SGS、法規合規、產品真偽或商品聲明內容的獨立查核。

## 8. DPP／GS1／UI 串接方式

1. GS1 QR 只承載 canonical `product.id`。
2. DPP service 將完整 product JSON POST 到 `/api/v1/credentials/issue`。
3. DPP 保存回傳的 credential ID 或 credential URI。
4. UI 將 credential POST 到 `/api/v1/credentials/verify`。
5. UI 只可顯示「Issuer 簽章有效、內容未竄改」，不可轉譯成「商品已合規」。

