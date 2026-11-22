export function datedStripFileName(format: "png" | "jpeg" = "png") {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `kixclicks-photo-strip-${stamp}.${format === "png" ? "png" : "jpg"}`;
}
