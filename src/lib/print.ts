
import { MAX_COPIES, MIN_COPIES, parseCopies } from "./copies";

export type PrintMethod = "browser" | "share";

export type PrinterStatus = {
  method: PrintMethod;
  label: string;
  available: boolean;
  detail: string;
};

export type PaperPreset =
  | "fit"
  | "photo"
  | "letter"
  | "thermal-54"
  | "thermal-80";

export type PrintJob = {
  imageUrl: string;
  copies: number;
  paperWidthMm: number;
  grayscale: boolean;
  paperPreset?: PaperPreset;
  shareFile?: File;
};

export const PAPER_PRESETS: {
  id: PaperPreset;
  label: string;
  widthMm: number;
}[] = [
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
    return {
      ok: false as const,
      error: `Enter a whole number from ${MIN_COPIES} to ${MAX_COPIES}.`,
    };
  }
  return { ok: true as const, copies };
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
  await new Promise<void>((resolve) => setTimeout(resolve, 50));

  const doc = frame.contentDocument;
  if (!doc?.documentElement) {
    frame.remove();
    throw new Error("The print frame could not be created.");
  }
  if (!doc.head) doc.documentElement.appendChild(doc.createElement("head"));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement("body"));
  return { frame, doc };
}

function loadPrintImage(image: HTMLImageElement, src: string) {
  return new Promise<void>((resolve, reject) => {
    const succeed = () => {
      if (image.naturalWidth > 0) resolve();
    };
    image.addEventListener("load", succeed, { once: true });
    image.addEventListener("error", () => reject(new Error("The print preview image failed to load.")), { once: true });
    image.src = src;
    if (image.complete && image.naturalWidth > 0) resolve();
  });
}

export const browserPrintAdapter: PrinterAdapter = {
  id: "browser",
  async inspect() {
    return {
      method: "browser",
      label: "Browser / system printer",
      available: typeof window !== "undefined" && typeof window.print === "function",
      detail: "Opens your system print dialog.",
    };
  },
  async print(job) {
    const copies = validatePrintCopies(job.copies);
    if (!copies.ok) return { submitted: false, message: copies.error };

    try {
      const src = await asPrintableSrc(job.imageUrl);
      const { frame, doc } = await openPrintFrame();

      doc.title = "KixClicks print";
      const style = doc.createElement("style");
      style.textContent = `${pageRule(job.paperPreset ?? "fit")} html,body{margin:0;padding:0;background:#fff}.print-copy{page-break-after:always;display:flex;justify-content:center}img{max-width:100%;max-height:calc(100vh - 16mm);object-fit:contain;display:block}`;
      doc.head.appendChild(style);

      const images: HTMLImageElement[] = [];
      for (let i = 0; i < copies.copies; i++) {
        const wrap = doc.createElement("div");
        wrap.className = "print-copy";
        const img = doc.createElement("img");
        img.alt = "KixClicks photo strip";
        wrap.appendChild(img);
        doc.body.appendChild(wrap);
        images.push(img);
      }

      await Promise.all(images.map((img) => loadPrintImage(img, src)));
      frame.contentWindow?.focus();
      frame.contentWindow?.print();

      return {
        submitted: true,
        message: `Print dialog opened for ${copies.copies} cop${copies.copies === 1 ? "y" : "ies"}.`,
      };
    } catch (error) {
      return {
        submitted: false,
        message: error instanceof Error ? error.message : "Printing failed.",
      };
    }
  },
};

export const sharePrintAdapter: PrinterAdapter = {
  id: "share",
  async inspect() {
    const available = typeof navigator !== "undefined" && typeof navigator.share === "function";
    return {
      method: "share",
      label: "iPad / BR RawPrinter",
      available,
      detail: available
        ? "Shares the prepared photo strip. Choose BR RawPrinter from the Share Sheet."
        : "File sharing is not available in this browser.",
    };
  },
  async print(job) {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return { submitted: false, message: "Sharing is not supported in this browser." };
    }
    if (!job.shareFile) {
      return { submitted: false, message: "The photo strip is still preparing. Please wait." };
    }
    try {
      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [job.shareFile] })) {
        return { submitted: false, message: "This browser cannot share the prepared image file." };
      }
      await navigator.share({ files: [job.shareFile], title: "KixClicks photo strip" });
      return {
        submitted: true,
        message: "Photo strip shared. Select BR RawPrinter and confirm printing in the app.",
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { submitted: false, message: "Sharing was cancelled." };
      }
      return {
        submitted: false,
        message: error instanceof Error ? error.message : "Could not share the photo strip.",
      };
    }
  },
};

export async function inspectPrinters(): Promise<PrinterStatus[]> {
  return Promise.all([
    browserPrintAdapter.inspect(),
    sharePrintAdapter.inspect(),
  ]);
}

export function adapterFor(method: PrintMethod): PrinterAdapter {
  return method === "share" ? sharePrintAdapter : browserPrintAdapter;
}
