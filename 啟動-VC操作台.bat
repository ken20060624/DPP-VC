@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title DPP-VC 憑證操作台

cd /d "%~dp0vc-issuer"
if errorlevel 1 goto :workspace_error

echo.
echo ============================================================
echo   DPP-VC 憑證操作台
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :node_missing

where npm >nul 2>nul
if errorlevel 1 goto :npm_missing

for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not "%NODE_MAJOR%"=="22" goto :node_version

if not exist "node_modules\fastify\package.json" (
  echo [1/4] 第一次啟動：正在安裝相依套件...
  call npm ci
  if errorlevel 1 goto :failed
) else (
  echo [1/4] 相依套件已就緒。
)

if not exist "secrets\issuer-key.json" (
  echo [2/4] 正在產生本機 Ed25519 Issuer 金鑰...
  call npm run generate-key
  if errorlevel 1 goto :failed
) else (
  echo [2/4] Issuer 金鑰已存在，不會覆蓋。
)

echo [3/4] 正在準備本機 Operator API Key...
set "OPERATOR_API_KEY_SHA256="
for /f "usebackq delims=" %%H in (`node scripts\setup-local-operator-key.mjs`) do set "OPERATOR_API_KEY_SHA256=%%H"
if not defined OPERATOR_API_KEY_SHA256 goto :operator_key_failed

set "OPERATOR_UI_KEY="
set /p "OPERATOR_UI_KEY="<"secrets\operator-api-key.txt"
if not defined OPERATOR_UI_KEY goto :operator_key_failed
<nul set /p "=%OPERATOR_UI_KEY%" | clip >nul 2>nul

echo [4/4] 正在編譯並啟動服務...
call npm run build
if errorlevel 1 goto :failed

set "PORT=3000"
set "HOST=127.0.0.1"
set "PUBLIC_BASE_URL=http://127.0.0.1:3000"
set "ISSUER_DID_METHOD=key"
set "ISSUER_PRIVATE_KEY_PATH=./secrets/issuer-key.json"
set "CREDENTIAL_STORE_ENABLED=true"
set "CREDENTIAL_STORE_PATH=./data/credentials"
set "STATUS_LIST_STORE_PATH=./data/status"
set "CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000,http://localhost:5173"

echo.
echo 操作台網址：http://127.0.0.1:3000/operator/
echo Operator API Key 已複製到剪貼簿，請在網頁欄位按 Ctrl+V 貼上。
echo 若剪貼簿無法使用，可開啟：vc-issuer\secrets\operator-api-key.txt
echo.
echo 關閉這個視窗或按 Ctrl+C 即可停止服務。
echo.

if /i not "%DPP_VC_NO_BROWSER%"=="1" (
  start "" /b powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "$url='http://127.0.0.1:3000/operator/'; for($i=0; $i -lt 40; $i++){ try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if($response.StatusCode -eq 200){ Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
)

call npm start
set "SERVER_EXIT=%ERRORLEVEL%"
if "%SERVER_EXIT%"=="0" goto :done
echo.
echo 服務已停止，錯誤碼：%SERVER_EXIT%
goto :pause_error

:workspace_error
echo 找不到 vc-issuer 目錄，請確認此檔案位於 DPP-VC 專案根目錄。
goto :pause_error

:node_missing
echo 找不到 Node.js。請先安裝 Node.js 22 LTS，再重新雙擊此檔案。
goto :pause_error

:npm_missing
echo 找不到 npm。請重新安裝包含 npm 的 Node.js 22 LTS。
goto :pause_error

:node_version
echo 偵測到 Node.js major version %NODE_MAJOR%，本專案需要 Node.js 22.x。
goto :pause_error

:operator_key_failed
echo 無法建立或讀取本機 Operator API Key。
echo 請檢查 vc-issuer\secrets 目錄是否可寫入。
goto :pause_error

:failed
echo.
echo 啟動失敗，請保留上方錯誤訊息。

:pause_error
echo.
pause
exit /b 1

:done
endlocal
exit /b 0
