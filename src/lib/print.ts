import { MAX_COPIES, MIN_COPIES, parseCopies } from "./copies";

const PRINT_BRIDGE_URL = process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL || "http://127.0.0.1:4173";

export type PrintMethod = "browser" | "bridge" | "direct";

export type PrinterStatus = {
  method: PrintMethod;
  label: string;
  available: boolean;
  detail: string;
};

export type PaperPreset = "fit" | "photo" | "letter" | "thermal-54" | "thermal-80";

export type PrintJob = {
  imageUrl: string;
  copies: number;
  paperWidthMm: number;
  grayscale: boolean;
  paperPreset?: PaperPreset;
};

export const PAPER_PRESETS: { id: PaperPreset; label: string; widthMm: number }[] = [
  { id: "fit", label: "Fit page", widthMm: 0 },
  { id: "photo", label: "4×6 in", widthMm: 102 },
  { id: "letter", label: "Letter", widthMm: 216 },
  { id: "thermal-54", label: "54 mm", widthMm: 54 },
  { id: "thermal-80", label: "80 mm", widthMm: 80 },
];

function pageRule(preset: PaperPreset) {
  if (preset === "photo") return "@page { size: 4in 6in; margin: 5mm; }";
  if (preset === "letter") return "@page { size: letter portrait; margin: 12mm; }";
  if (preset === "thermal-54") return "@page { size: 54mm auto; margin: 2mm; }";
  if (preset === "thermal-80") return "@page { size: 80mm auto; margin: 3mm; }";
  return "@page { size: auto; margin: 10mm; }";
}

async function asPrintableSrc(imageUrl: string) {
  if (imageUrl.startsWith("data:")) return imageUrl;
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("The print image could not be read.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The print image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

export interface PrinterAdapter {
  id: PrintMethod;
  inspect(): Promise<PrinterStatus>;
  print(job: PrintJob): Promise<{ submitted: boolean; message: string }>;
}

export function validatePrintCopies(value: string | number) {
  const copies = parseCopies(value);
  if (copies === null) {
    return { ok: false as const, error: `Enter a whole number from ${MIN_COPIES} to ${MAX_COPIES}.` };
  }
  return { ok: true as const, copies };
}

export async function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return;
  if (image.complete) throw new Error("The print preview image failed to load.");
  await new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("The print preview image failed to load.")), { once: true });
  });
}

function loadPrintImage(image: HTMLImageElement, src: string) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const succeed = () => {
      if (settled) return;
      if (image.naturalWidth <= 0) return;
      settled = true;
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error("The print preview image failed to load."));
    };
    image.addEventListener("load", succeed, { once: true });
    image.addEventListener("error", fail, { once: true });
    image.src = src;
    if (image.complete) {
      if (image.naturalWidth > 0) succeed();
      else fail();
    }
  });
}

async function openPrintFrame() {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "KixClicks print preview");
  frame.style.position = "fixed";
  frame.style.left = "0";
  frame.style.top = "0";
  frame.style.width = "800px";
  frame.style.height = "1200px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  frame.style.zIndex = "-1";

  document.body.appendChild(frame);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const doc = frame.contentDocument;
  if (!doc?.documentElement) {
    frame.remove();
    throw new Error("The print frame could not be created.");
  }
  if (!doc.head) doc.documentElement.appendChild(doc.createElement("head"));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement("body"));
  return { frame, doc };
}

export const browserPrintAdapter: PrinterAdapter = {
  id: "browser",
  async inspect() {
    return {
      method: "browser",
      label: "Browser / system printer",
      available: typeof window !== "undefined" && typeof window.print === "function",
      detail: "Opens your operating system print dialog. Choose the printer and confirm copies there.",
    };
  },
  async print(job) {
    const copies = validatePrintCopies(job.copies);
    if (!copies.ok) return { submitted: false, message: copies.error };
    if (typeof window.print !== "function") {
      return {
        submitted: false,
        message: "This browser does not provide a print dialog. Download the strip and print it from another device, or from your phone’s Share / Print menu.",
      };
    }

    let src: string;
    try {
      src = await asPrintableSrc(job.imageUrl);
    } catch (error) {
      return { submitted: false, message: error instanceof Error ? error.message : "The print image could not be prepared." };
    }

    const preset = job.paperPreset ?? "fit";
    let frame: HTMLIFrameElement;
    let doc: Document;
    try {
      ({ frame, doc } = await openPrintFrame());
    } catch (error) {
      return { submitted: false, message: error instanceof Error ? error.message : "The print frame could not be created." };
    }

    try {
      doc.title = "KixClicks print";
      const style = doc.createElement("style");
      style.textContent = `
        ${pageRule(preset)}
        html, body { margin: 0; padding: 0; background: #fff; }
        .print-copy { page-break-after: always; break-after: page; display: flex; justify-content: center; align-items: flex-start; }
        .print-copy:last-child { page-break-after: auto; break-after: auto; }
        img {
          max-width: 100%;
          max-height: calc(100vh - 16mm);
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        }
      `;
      doc.head.appendChild(style);

      const images: HTMLImageElement[] = [];
      for (let index = 0; index < copies.copies; index += 1) {
        const wrap = doc.createElement("div");
        wrap.className = "print-copy";
        const image = doc.createElement("img");
        image.alt = "KixClicks photo strip";
        wrap.appendChild(image);
        doc.body.appendChild(wrap);
        images.push(image);
      }

      const first = images[0];
      if (!first) {
        frame.remove();
        return { submitted: false, message: "The print preview image was missing." };
      }

      await Promise.all(images.map((image) => loadPrintImage(image, src)));

      await new Promise<void>((resolve) => {
        const finish = () => {
          window.removeEventListener("focus", finish);
          frame.contentWindow?.removeEventListener("afterprint", finish);
          frame.remove();
          resolve();
        };
        window.addEventListener("focus", finish, { once: true });
        frame.contentWindow?.addEventListener("afterprint", finish, { once: true });
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(finish, 120_000);
      });
      return {
        submitted: true,
        message: `Print dialog opened for ${copies.copies} cop${copies.copies === 1 ? "y" : "ies"}. Choose a printer in the browser dialog. Websites cannot print silently, and opening the dialog does not confirm that paper came out.`,
      };
    } catch (error) {
      frame.remove();
      return { submitted: false, message: error instanceof Error ? error.message : "Printing failed." };
    }
  },
};

export const directPrintAdapter: PrinterAdapter = {
  id: "direct",
  async inspect() {
    const usb = "usb" in navigator;
    const serial = "serial" in navigator;
    if (!usb && !serial) {
      return {
        method: "direct",
        label: "Direct USB / serial",
        available: false,
        detail: "This browser does not expose WebUSB or Web Serial, so a thermal printer cannot be addressed from the page.",
      };
    }
    return {
      method: "direct",
      label: "Direct USB / serial",
      available: true,
      detail: "A device picker can be shown, but no printer model is configured. KixClicks will not send unknown ESC/POS or vendor commands.",
    };
  },
  async print() {
    return {
      submitted: false,
      message: "Direct thermal printing is not configured for a specific printer model. Use browser printing, or add a local print bridge on the computer attached to the printer.",
    };
  },
};

export const localBridgeAdapter: PrinterAdapter = {
  id: "bridge",
  async inspect() {
    try {
      const response = await fetch(`${PRINT_BRIDGE_URL}/health`, { method: "GET", cache: "no-store" });
      if (!response.ok) {
        return {
          method: "bridge",
          label: "Local print bridge",
          available: false,
          detail: "A local bridge responded, but it is not ready to print.",
        };
      }
      const payload = (await response.json()) as { ok?: boolean; printer?: string };
      return {
        method: "bridge",
        label: "Local print bridge",
        available: Boolean(payload.ok),
        detail: payload.printer
          ? `Bridge online for ${payload.printer}.`
          : "RP30 bridge online. Select 80 mm paper, then send the job.",
      };
    } catch {
      return {
        method: "bridge",
        label: "Local print bridge",
        available: false,
        detail: `No local bridge at ${PRINT_BRIDGE_URL}. Start the RP30 print bridge on this computer.`,
      };
    }
  },
  async print(job) {
    const copies = validatePrintCopies(job.copies);
    if (!copies.ok) return { submitted: false, message: copies.error };
    try {
      const response = await fetch(`${PRINT_BRIDGE_URL}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: job.imageUrl,
          copies: copies.copies,
          paperWidthMm: job.paperWidthMm,
          grayscale: job.grayscale,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        return { submitted: false, message: payload.message || "The local print bridge rejected the job." };
      }
      return { submitted: true, message: payload.message || "The bridge accepted the job. Check the printer for physical output." };
    } catch {
      return { submitted: false, message: "Could not reach the local print bridge." };
    }
  },
};

export async function inspectPrinters(): Promise<PrinterStatus[]> {
  return Promise.all([browserPrintAdapter.inspect(), localBridgeAdapter.inspect(), directPrintAdapter.inspect()]);
}

export function adapterFor(method: PrintMethod): PrinterAdapter {
  if (method === "bridge") return localBridgeAdapter;
  if (method === "direct") return directPrintAdapter;
  return browserPrintAdapter;
}
