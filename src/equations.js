import { normalizePower, validTokenShape } from "./math.js";

// Compare methods, not numerical answers. Keep every rolled operand and power,
// while normalizing order, grouping, and equivalent subtraction/division order.
// In particular, do not cancel terms: a-a+b and a/a*b are different methods.
export function equationKey(tokens) {
  if (
    !Array.isArray(tokens) ||
    !tokens.length ||
    tokens.length > 64 ||
    !tokens.every(validTokenShape)
  )
    throw Error("Cannot compare this expression.");
  let i = 0;
  function atom() {
    const t = tokens[i++];
    if (t?.kind === "die") {
      const power = normalizePower(t.power);
      return { op: "die", value: t.value, power: t.value === 1 ? "1" : power };
    }
    if (t?.value === "-") return { op: "neg", child: atom() };
    if (t?.value === "(") {
      const node = sum();
      if (tokens[i++]?.value !== ")") throw Error("Unclosed expression.");
      return node;
    }
    throw Error("Incomplete expression.");
  }
  function product() {
    let node = atom();
    while (["*", "/"].includes(tokens[i]?.value))
      node = { op: tokens[i++].value, left: node, right: atom() };
    return node;
  }
  function sum() {
    let node = product();
    while (["+", "-"].includes(tokens[i]?.value))
      node = { op: tokens[i++].value, left: node, right: product() };
    return node;
  }
  const tree = sum();
  if (i !== tokens.length) throw Error("Unexpected expression piece.");
  const sorted = (parts) =>
    JSON.stringify(parts.map((p) => JSON.stringify(p)).sort());
  function canonical(node) {
    if (node.op === "die")
      return { sign: 1, key: JSON.stringify([node.value, node.power]) };
    if (node.op === "neg") {
      const c = canonical(node.child);
      return { ...c, sign: -c.sign };
    }
    const parts = [];
    if (["+", "-"].includes(node.op)) {
      function add(n, sign) {
        if (n.op === "neg") return add(n.child, -sign);
        if (["+", "-"].includes(n.op)) {
          add(n.left, sign);
          add(n.right, n.op === "-" ? -sign : sign);
        } else {
          const c = canonical(n);
          parts.push([sign * c.sign, c.key]);
        }
      }
      add(node, 1);
      const forward = sorted(parts),
        reverse = sorted(parts.map(([s, k]) => [-s, k]));
      return {
        sign: forward <= reverse ? 1 : -1,
        key: "sum" + (forward <= reverse ? forward : reverse),
      };
    }
    let sign = 1;
    function multiply(n, direction) {
      if (n.op === "neg") {
        sign *= -1;
        return multiply(n.child, direction);
      }
      if (["*", "/"].includes(n.op)) {
        multiply(n.left, direction);
        multiply(n.right, n.op === "/" ? -direction : direction);
      } else {
        const c = canonical(n);
        sign *= c.sign;
        parts.push([direction, c.key]);
      }
    }
    multiply(node, 1);
    return { sign, key: "product" + sorted(parts) };
  }
  return JSON.stringify(canonical(tree));
}
