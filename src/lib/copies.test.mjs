import assert from "node:assert/strict";
import test from "node:test";
import { clampCopies, parseCopies } from "./copies.ts";

test("parseCopies accepts whole numbers in range", () => {
  assert.equal(parseCopies("1"), 1);
  assert.equal(parseCopies("10"), 10);
  assert.equal(parseCopies(4), 4);
});

test("parseCopies rejects invalid values", () => {
  assert.equal(parseCopies(""), null);
  assert.equal(parseCopies("0"), null);
  assert.equal(parseCopies("-1"), null);
  assert.equal(parseCopies("1.5"), null);
  assert.equal(parseCopies("11"), null);
  assert.equal(parseCopies("abc"), null);
  assert.equal(parseCopies("01"), 1);
});

test("clampCopies stays within bounds", () => {
  assert.equal(clampCopies(0), 1);
  assert.equal(clampCopies(99), 10);
  assert.equal(clampCopies(3.7), 4);
});
