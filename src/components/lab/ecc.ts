// Elliptic curves y² = x³ + ax + b over a small prime field F_p, for the Lab.
// p stays small (≤ 251), so plain numbers are exact: products stay < 2^53.

export type Point = { x: number; y: number } | null; // null = point at infinity (O)

export interface Curve {
  p: number;
  a: number;
  b: number;
}

export const mod = (n: number, p: number) => ((n % p) + p) % p;

export const isPrime = (n: number) => {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
  return true;
};

// Modular inverse via the extended Euclidean algorithm.
export const inverse = (n: number, p: number) => {
  let [oldR, r] = [mod(n, p), p];
  let [oldS, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1) throw new Error(`${n} has no inverse mod ${p}`);
  return mod(oldS, p);
};

// 4a³ + 27b² ≠ 0 (mod p) means the curve has no cusps or self-crossings.
export const isSmooth = ({ p, a, b }: Curve) => mod(4 * a * a * a + 27 * b * b, p) !== 0;

export const onCurve = ({ p, a, b }: Curve, pt: Point) =>
  pt === null || mod(pt.y * pt.y - (pt.x * pt.x * pt.x + a * pt.x + b), p) === 0;

export const points = ({ p, a, b }: Curve): { x: number; y: number }[] => {
  const roots = new Map<number, number[]>();
  for (let y = 0; y < p; y += 1) {
    const sq = (y * y) % p;
    roots.set(sq, [...(roots.get(sq) ?? []), y]);
  }
  const out: { x: number; y: number }[] = [];
  for (let x = 0; x < p; x += 1) {
    const rhs = mod(x * x * x + a * x + b, p);
    for (const y of roots.get(rhs) ?? []) out.push({ x, y });
  }
  return out;
};

export const negate = (pt: Point, p: number): Point => (pt === null ? null : { x: pt.x, y: mod(-pt.y, p) });

export const same = (P: Point, Q: Point) =>
  P === Q || (P !== null && Q !== null && P.x === Q.x && P.y === Q.y);

export type AddCase = "identity" | "inverse" | "double" | "add";

export interface AddResult {
  result: Point;
  kind: AddCase;
  // Slope and intercept of the (wrapped) line through P and Q, when there is one.
  lambda?: number;
  nu?: number;
  // Human-readable working, one line per step.
  steps: string[];
}

const sub = (n: number) => (n < 0 ? `(${n})` : String(n));

export const add = (curve: Curve, P: Point, Q: Point): AddResult => {
  const { p, a } = curve;
  if (P === null) return { result: Q, kind: "identity", steps: ["O + Q = Q (O is the identity)"] };
  if (Q === null) return { result: P, kind: "identity", steps: ["P + O = P (O is the identity)"] };

  if (P.x === Q.x && mod(P.y + Q.y, p) === 0) {
    return {
      result: null,
      kind: "inverse",
      steps: [
        `x₁ = x₂ and y₁ = −y₂ (mod ${p}), so Q = −P.`,
        "The line through them is vertical and meets the curve again only at O.",
        "P + Q = O",
      ],
    };
  }

  let lambda: number;
  const steps: string[] = [];
  const kind: AddCase = same(P, Q) ? "double" : "add";
  if (kind === "double") {
    const num = mod(3 * P.x * P.x + a, p);
    const den = mod(2 * P.y, p);
    const inv = inverse(den, p);
    lambda = mod(num * inv, p);
    steps.push(
      `λ = (3x₁² + a) / (2y₁) = (3·${P.x}² + ${a}) / (2·${P.y}) = ${3 * P.x * P.x + a} / ${2 * P.y} ≡ ${num} / ${den}`,
      `${den}⁻¹ ≡ ${inv} (mod ${p}), so λ = ${num}·${inv} ≡ ${lambda}`,
    );
  } else {
    const num = mod(Q.y - P.y, p);
    const den = mod(Q.x - P.x, p);
    const inv = inverse(den, p);
    lambda = mod(num * inv, p);
    steps.push(
      `λ = (y₂ − y₁) / (x₂ − x₁) = (${Q.y} − ${P.y}) / (${Q.x} − ${P.x}) ≡ ${num} / ${den}`,
      `${den}⁻¹ ≡ ${inv} (mod ${p}), so λ = ${num}·${inv} ≡ ${lambda}`,
    );
  }

  const x3raw = lambda * lambda - P.x - Q.x;
  const x3 = mod(x3raw, p);
  const y3raw = lambda * (P.x - x3) - P.y;
  const y3 = mod(y3raw, p);
  steps.push(
    `x₃ = λ² − x₁ − x₂ = ${lambda}² − ${P.x} − ${Q.x} = ${x3raw} ≡ ${x3}`,
    `y₃ = λ(x₁ − x₃) − y₁ = ${lambda}·${sub(P.x - x3)} − ${P.y} = ${y3raw} ≡ ${y3}`,
  );
  const nu = mod(P.y - lambda * P.x, p);
  return { result: { x: x3, y: y3 }, kind, lambda, nu, steps };
};

// k·P by repeated addition (fine for the small groups shown here), returning
// every multiple so the orbit can be drawn.
export const multiples = (curve: Curve, P: Point, limit: number): Point[] => {
  const out: Point[] = [];
  let acc: Point = null;
  for (let k = 1; k <= limit; k += 1) {
    acc = add(curve, acc, P).result;
    out.push(acc);
    if (acc === null) break;
  }
  return out;
};

// Smallest n ≥ 1 with n·P = O.
export const order = (curve: Curve, P: Point, groupSize: number) => multiples(curve, P, groupSize + 1).length;
