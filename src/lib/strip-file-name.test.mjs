import assert from "node:assert/strict";
import test from "node:test";

test("datedStripFileName uses png or jpg with timestamp", async () => {
  const { datedStripFileName } = await import("./strip-file-name.ts");
  const png = datedStripFileName("png");
  const jpg = datedStripFileName("jpeg");
  assert.match(png, /^kixclicks-photo-strip-\d{8}-\d{6}\.png$/);
  assert.match(jpg, /^kixclicks-photo-strip-\d{8}-\d{6}\.jpg$/);
});
