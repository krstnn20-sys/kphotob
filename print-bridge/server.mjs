/**
 * Local ESC/POS bridge for the RP30 USB/LAN 80 mm thermal printer.
 *
 * Configuration:
 *   RP30_CONNECTION=usb|lan (default: usb)
 *   RP30_PRINTER_NAME=RP30 (Windows printer queue name, USB mode)
 *   RP30_HOST=192.168.1.50 (LAN printer address, LAN mode)
 *   RP30_PORT=9100 (LAN raw printing port)
 *   RP30_ALLOWED_ORIGINS=https://your-app.vercel.app (comma-separated browser origins)
 *
 * Run only on the computer that is connected to the printer:
 *   node print-bridge/server.mjs
 */
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import sharp from "sharp";

const PORT = 4173;
const MAX_BYTES = 5_000_000;
const PAPER_DOTS = 576;
const connection = (process.env.RP30_CONNECTION || "usb").toLowerCase();
const printerName = process.env.RP30_PRINTER_NAME || "RP30";
const printerHost = process.env.RP30_HOST || "";
const printerPort = Number(process.env.RP30_PORT || 9100);
const allowedOrigins = new Set(
  (process.env.RP30_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function json(response, status, payload, requestOrigin = "") {
  const body = JSON.stringify(payload);
  const allowedOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : "null";
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Vary": "Origin",
  });
  response.end(body);
}

function escPosRaster(image) {
  const widthBytes = Math.ceil(PAPER_DOTS / 8);
  const height = image.info.height;
  const raster = Buffer.alloc(widthBytes * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < PAPER_DOTS; x += 1) {
      if (image.data[y * PAPER_DOTS + x] < 180) {
        raster[y * widthBytes + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = Buffer.from([
    0x1b, 0x40, // initialize
    0x1b, 0x61, 0x01, // center
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const footer = Buffer.from([
    0x1b, 0x64, 0x03, // feed
    0x1d, 0x56, 0x00, // full cut
  ]);
  return Buffer.concat([header, raster, footer]);
}

async function createJob(imageUrl, copies) {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    throw new Error("The print image is missing.");
  }
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("The print image could not be downloaded.");
  const source = Buffer.from(await response.arrayBuffer());
  const image = await sharp(source)
    .resize({ width: PAPER_DOTS, withoutEnlargement: false, fit: "contain", background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const receipt = escPosRaster(image);
  return Buffer.concat(Array.from({ length: copies }, () => receipt));
}

function sendToLan(payload) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: printerHost, port: printerPort });
    socket.once("connect", () => socket.end(payload, resolve));
    socket.once("error", reject);
    socket.setTimeout(15_000, () => {
      socket.destroy();
      reject(new Error(`The RP30 LAN printer did not respond at ${printerHost}:${printerPort}.`));
    });
  });
}

function sendToUsb(payload) {
  if (process.platform !== "win32") {
    throw new Error("RP30 USB mode requires Windows with the RP30 installed as a printer queue.");
  }

  return new Promise((resolve, reject) => {
    const encoded = payload.toString("base64");
    const script = `
$ErrorActionPreference = 'Stop'
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(printerName).toString("base64")}'))
$data = [Convert]::FromBase64String('${encoded}')
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int StartDocPrinter(IntPtr handle, int level, DOCINFO docInfo);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern int StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
}
'@
$handle = [IntPtr]::Zero
if (-not [RawPrinter]::OpenPrinter($name, [ref]$handle, [IntPtr]::Zero)) { throw "Could not open Windows printer queue '$name'." }
try {
  $doc = [RawPrinter+DOCINFO]::new()
  $doc.pDocName = 'KixClicks RP30 photo strip'
  $doc.pDataType = 'RAW'
  if ([RawPrinter]::StartDocPrinter($handle, 1, $doc) -eq 0) { throw 'Could not start the RP30 print job.' }
  try {
    [RawPrinter]::StartPagePrinter($handle) | Out-Null
    $written = 0
    if (-not [RawPrinter]::WritePrinter($handle, $data, $data.Length, [ref]$written) -or $written -ne $data.Length) { throw 'Windows did not accept the complete RP30 print job.' }
    [RawPrinter]::EndPagePrinter($handle) | Out-Null
  } finally { [RawPrinter]::EndDocPrinter($handle) | Out-Null }
} finally { [RawPrinter]::ClosePrinter($handle) | Out-Null }
`;
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.trim() || "Windows rejected the RP30 print job.")));
  });
}

async function printJob(payload) {
  if (connection !== "usb" && connection !== "lan") {
    throw new Error("RP30_CONNECTION must be 'usb' or 'lan'.");
  }
  if (connection === "lan" && !printerHost) {
    throw new Error("Set RP30_HOST to the RP30 LAN printer IP address.");
  }
  const copies = Number(payload.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > 10) {
    throw new Error("Copies must be a whole number from 1 to 10.");
  }
  const job = await createJob(payload.imageUrl, copies);
  if (connection === "lan") await sendToLan(job);
  else await sendToUsb(job);
}

const server = http.createServer(async (request, response) => {
  const requestOrigin = request.headers.origin || "";
  if (request.method === "OPTIONS") {
    json(response, 204, { ok: true }, requestOrigin);
    return;
  }
  const host = request.headers.host || "";
  if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
    json(response, 403, { ok: false, message: "The print bridge only accepts local requests." }, requestOrigin);
    return;
  }
  if (request.url === "/health" && request.method === "GET") {
    const configured = connection === "usb" ? Boolean(printerName) : Boolean(printerHost);
    json(response, 200, {
      ok: configured,
      printer: configured ? `RP30 ${connection.toUpperCase()} (${connection === "usb" ? printerName : `${printerHost}:${printerPort}`})` : null,
    }, requestOrigin);
    return;
  }
  if (request.url !== "/print" || request.method !== "POST") {
    json(response, 404, { ok: false, message: "Unknown bridge route." }, requestOrigin);
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      json(response, 413, { ok: false, message: "Print payload is too large." }, requestOrigin);
      return;
    }
    chunks.push(chunk);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    await printJob(payload);
    json(response, 200, { ok: true, message: `RP30 ${connection.toUpperCase()} print job sent successfully.` }, requestOrigin);
  } catch (error) {
    json(response, 500, { ok: false, message: error instanceof Error ? error.message : "The RP30 print job failed." }, requestOrigin);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`KixClicks RP30 print bridge listening on http://127.0.0.1:${PORT} (${connection})`);
});
