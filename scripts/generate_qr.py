import json
import os
import qrcode

# 基礎網址設定（展示時可改為 ngrok 或真實部署網址）
BASE_URL = "https://dpp-demo.example.com"

# 載入設備清單
devices_file = os.path.join(os.path.dirname(__file__), "devices.json")
output_dir = os.path.join(os.path.dirname(__file__), "../public/qrcodes")

os.makedirs(output_dir, exist_ok=True)

with open(devices_file, "r", encoding="utf-8") as f:
    devices = json.load(f)

print("=== 開始產出手持電風扇 GS1 Digital Link QR Code ===")

for fan in devices:
    gtin = fan["gtin"]
    serial = fan["serialNumber"]
    
    # 組合 GS1 Digital Link 標準 URL
    # 格式：https://domain/01/{GTIN}/21/{Serial}
    gs1_url = f"{BASE_URL}/01/{gtin}/21/{serial}"
    fan["targetUrl"] = gs1_url
    
    # 建立 QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(gs1_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    output_filename = f"{fan['id']}_{serial}.png"
    img_path = os.path.join(output_dir, output_filename)
    img.save(img_path)
    
    fan["qrImagePath"] = f"/public/qrcodes/{output_filename}"
    print(f"[{fan['id']}] 已產出: {output_filename} -> {gs1_url}")

# 更新寫回 devices.json
with open(devices_file, "w", encoding="utf-8") as f:
    json.dump(devices, f, indent=2, ensure_ascii=False)

print("=== 全部 QR Code 產出完畢，已更新 devices.json ===")
