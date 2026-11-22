import { datedStripFileName } from "./strip-file-name";

export type ComposeLayout = "four" | "three" | "double" | "grid" | "single" | "horizontal";
export type ComposeFilter = "original" | "mono" | "sepia" | "warm" | "vintage";
export type ComposeTheme = { color: string; paper: string; ink: string };
export type ComposeSticker = { mark: string; x: number; y: number };

export const filterCss: Record<ComposeFilter, string> = {
  original: "none",
  mono: "grayscale(1)",
  sepia: "sepia(.72)",
  warm: "sepia(.2) saturate(1.35)",
  vintage: "sepia(.35) contrast(.9) brightness(1.05)",
};

export type ComposeStripInput = {
  photos: string[];
  needed: number;
  layout: ComposeLayout;
  theme: ComposeTheme;
  filter: ComposeFilter;
  caption: string;
  showDate: boolean;
  stickers?: ComposeSticker[];
  format?: "png" | "jpeg";
};

export type ComposedStrip = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  fileName: string;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A photo could not be loaded for export."));
    image.src = src;
  });
}

export async function composePhotoStrip(input: ComposeStripInput): Promise<ComposedStrip> {
  const format = input.format ?? "png";
  const items = input.photos.length || input.needed;
  const width = input.layout === "horizontal" ? 1600 : input.layout === "grid" ? 1200 : 800;
  const pad = 58;
  const gap = input.layout === "grid" ? 29 : 18;
  const isGrid = input.layout === "grid";
  const isHorizontal = input.layout === "horizontal";
  const columns = isGrid ? 2 : isHorizontal ? Math.min(items, 4) : 1;
  const rows = Math.ceil(items / columns);
  const photoWidth = isGrid
    ? (width - pad * 2 - gap) / 2
    : isHorizontal
      ? (width - pad * 2 - gap * (columns - 1)) / columns
      : width - pad * 2;
  const footerHeight = 84;
  const fixedHeight = input.layout === "horizontal" ? 620 : input.layout === "grid" ? 1200 : 1320;
  const photoHeight =
    input.layout === "four" || input.layout === "three"
      ? photoWidth * 0.838
      : input.layout === "single"
        ? photoWidth * 1
        : isGrid
          ? (fixedHeight - pad * 2 - gap * (rows - 1) - footerHeight) / rows
          : (fixedHeight - pad * 2 - gap * (rows - 1) - 120) / rows;
  const height =
    input.layout === "four" || input.layout === "three" || input.layout === "single"
      ? pad * 2 + photoHeight * rows + gap * (rows - 1) + footerHeight
      : fixedHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create the photo strip canvas.");

  context.fillStyle = input.theme.paper;
  context.fillRect(0, 0, width, height);
  const frameWidth = 20;
  context.strokeStyle = input.theme.color;
  context.lineWidth = frameWidth;
  context.strokeRect(frameWidth / 2, frameWidth / 2, width - frameWidth, height - frameWidth);

  for (let i = 0; i < items; i++) {
    const x = pad + (i % columns) * (photoWidth + gap);
    const y = pad + Math.floor(i / columns) * (photoHeight + gap);
    const src = input.photos[i] ?? "";
    context.save();
    context.filter = filterCss[input.filter];
    if (src) {
      const image = await loadImage(src);
      const sourceRatio = image.width / image.height;
      const targetRatio = photoWidth / photoHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.width;
      let sourceHeight = image.height;
      if (sourceRatio > targetRatio) {
        sourceWidth = image.height * targetRatio;
        sourceX = (image.width - sourceWidth) / 2;
      } else {
        sourceHeight = image.width / targetRatio;
        sourceY = (image.height - sourceHeight) / 2;
      }
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, photoWidth, photoHeight);
    } else {
      context.fillStyle = input.theme.color;
      context.fillRect(x, y, photoWidth, photoHeight);
    }
    context.filter = "none";
    context.fillStyle = input.theme.ink;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = "bold 18px sans-serif";
    context.fillText(String(i + 1).padStart(2, "0"), x + 16, y + 28);
    context.restore();
  }

  context.fillStyle = input.theme.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "24px Georgia";
  context.fillText(input.caption || "", width / 2, height - 76);
  if (input.showDate) {
    context.font = "12px sans-serif";
    context.fillText(new Date().toLocaleDateString("en-GB").replaceAll("/", "."), width / 2, height - 49);
  }

  for (const sticker of input.stickers ?? []) {
    context.save();
    context.fillStyle = input.theme.ink;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${Math.round(width * 0.045)}px Georgia, serif`;
    context.fillText(sticker.mark, (sticker.x / 100) * width, (sticker.y / 100) * height);
    context.restore();
  }

  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, format === "jpeg" ? 0.92 : undefined),
  );
  if (!blob) throw new Error("The photo strip could not be turned into an image file.");

  return {
    blob,
    mimeType,
    width,
    height,
    fileName: datedStripFileName(format),
  };
}

export async function preparePrintRaster(
  source: Blob,
  options: { maxWidth: number; grayscale?: boolean; brightness?: number; contrast?: number },
) {
  const objectUrl = URL.createObjectURL(source);
  let image: HTMLImageElement;
  try {
    image = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  const scale = Math.min(1, options.maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Print preview could not be prepared.");
  context.drawImage(image, 0, 0, width, height);

  const brightness = options.brightness ?? 0;
  const contrast = options.contrast ?? 0;
  if (options.grayscale || brightness !== 0 || contrast !== 0) {
    const frame = context.getImageData(0, 0, width, height);
    const data = frame.data;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      if (options.grayscale) {
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = g = b = gray;
      }
      r = contrastFactor * (r - 128) + 128 + brightness;
      g = contrastFactor * (g - 128) + 128 + brightness;
      b = contrastFactor * (b - 128) + 128 + brightness;
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
    context.putImageData(frame, 0, 0);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Print raster could not be created.");
  return { blob, width, height };
}
