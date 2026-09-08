import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  dieToken as d,
  opToken as o,
  parsePower,
} from "../src/math.js";
const E = (dice, t) => evaluate(t, dice);
test("exact arithmetic and duplicate die identities", () => {
  assert.equal(
    E([4, 2, 2], [d(0, 4), o("*"), d(1, 2), o("-"), d(2, 2)]).integer,
    6,
  );
  assert.equal(
    E([4, 2, 2], [d(0, 4), o("*"), d(1, 2), o("-"), d(1, 2)]).ok,
    false,
  );
});
test("free exponents cannot consume missing rolled operands", () => {
  assert.equal(
    E([2, 3, 5], [d(0, 2, "2"), o("+"), d(1, 3, "2"), o("+"), d(2, 5)]).integer,
    18,
  );
  assert.equal(E([2, 3, 5], [d(0, 2, "3"), o("+"), d(2, 5)]).ok, false);
});
test("fractional powers and radical cancellation are exact", () => {
  assert.equal(
    E([4, 2, 5], [d(0, 4, "3/2"), o("+"), d(1, 2), o("+"), d(2, 5)]).integer,
    15,
  );
  assert.equal(
    E([2, 2, 3], [d(0, 2, "1/2"), o("*"), d(1, 2, "1/2"), o("+"), d(2, 3)])
      .integer,
    5,
  );
  assert.equal(
    E(
      [2, 2, 3],
      [o("("), d(0, 2, "1/3"), o("/"), d(1, 2, "1/3"), o(")"), o("+"), d(2, 3)],
    ).integer,
    4,
  );
});
test("rational functions of radicals preserve cancellation", () => {
  assert.equal(
    E(
      [2, 2, 2],
      [
        o("("),
        d(0, 2, "1/2"),
        o("+"),
        d(1, 2, "1/2"),
        o(")"),
        o("/"),
        d(2, 2, "1/2"),
      ],
    ).integer,
    2,
  );
});
test("near integers never round to valid targets", () => {
  const r = E([6, 6, 3], [d(0, 6), o("-"), d(1, 6), o("/"), d(2, 3, "9")]);
  assert.equal(r.ok, false);
  assert.equal(r.integer, null);
  assert.ok(r.approx < 6);
});
test("no concatenation and clear zero-division errors", () => {
  assert.match(
    E([1, 2, 3], [d(0, 1), d(1, 2), o("+"), d(2, 3)]).message,
    /operation/,
  );
  assert.match(
    E([6, 2, 2], [d(0, 6), o("/"), o("("), d(1, 2), o("-"), d(2, 2), o(")")])
      .message,
    /zero/,
  );
});
test("precedence, grouping and negative powers", () => {
  assert.equal(
    E([5, 2, 3], [d(0, 5), o("+"), d(1, 2), o("*"), d(2, 3)]).integer,
    11,
  );
  assert.equal(
    E([5, 2, 3], [o("("), d(0, 5), o("+"), d(1, 2), o(")"), o("*"), d(2, 3)])
      .integer,
    21,
  );
  assert.equal(
    E([2, 4, 3], [d(0, 2, "-1"), o("*"), d(1, 4), o("+"), d(2, 3)]).integer,
    5,
  );
});
test("limits and power input reject executable strings", () => {
  assert.throws(() => parsePower("129"), /verifies/);
  assert.throws(() => parsePower("1/0"));
  assert.throws(() => parsePower("alert(1)"));
});
