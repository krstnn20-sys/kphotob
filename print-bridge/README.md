# RP30 USB/LAN print bridge

Vercel cannot access printer hardware directly. The browser connects to this local bridge, and the bridge sends ESC/POS data to the RP30 over USB or LAN.

## 1. Configure Vercel

In Vercel project settings, add this **production** environment variable and redeploy:

```text
NEXT_PUBLIC_PRINT_BRIDGE_URL=http://127.0.0.1:4173
```

The value is intentionally `127.0.0.1`: in each browser, it means the computer using the website, where the bridge must be running.

## 2. Install the bridge computer requirements

On the Windows computer that will use the photobooth:

```powershell
cd C:\path\to\photobooth
npm install
```

For USB, install the RP30 Windows printer driver and confirm the exact printer queue name in **Settings > Bluetooth & devices > Printers & scanners**.

## 3. Configure the RP30 connection

For USB:

```powershell
$env:RP30_CONNECTION="usb"
$env:RP30_PRINTER_NAME="RP30"
$env:RP30_ALLOWED_ORIGINS="https://your-app.vercel.app"
node print-bridge/server.mjs
```

For LAN:

```powershell
$env:RP30_CONNECTION="lan"
$env:RP30_HOST="192.168.1.50"
$env:RP30_PORT="9100"
$env:RP30_ALLOWED_ORIGINS="https://your-app.vercel.app"
node print-bridge/server.mjs
```

Replace the Vercel origin with the exact URL users open, without a trailing slash. Multiple origins may be separated by commas.

## 4. Print

Open the deployed Vercel site on the same computer running the bridge. In the print dialog:

1. Select **Local print bridge**.
2. Select **80 mm** paper.
3. Select the number of copies.
4. Click **Print**.

The bridge must remain running while printing. It listens only on `127.0.0.1:4173` and rejects non-local host requests. Do not expose it to the public internet.
