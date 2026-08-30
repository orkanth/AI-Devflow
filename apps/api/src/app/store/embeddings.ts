import { createHash } from 'crypto';

export const EMBEDDING_DIM = 64;

/**
 * Deterministic hashing-trick embeddings.
 *
 * Why this exists: interviews often ask how embeddings work. Real models
 * (OpenAI text-embedding-3-small, sentence-transformers) learn a continuous
 * space where similar meaning is nearby. For a local prototype we still need
 * a vector so cosine search works — we hash tokens into a fixed-size bag.
 *
 * Properties you can explain:
 * - Same text always yields the same vector (deterministic, good for tests)
 * - Shared tokens increase cosine similarity
 * - Not semantically deep (synonyms will not match) — that is the gap a
 *   real embedding model fills
 */
export function embed(text: string, dim = EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return vector;
  }
  for (const token of tokens) {
    const bucket = hashToBucket(token, dim);
    const sign = hashToSign(token);
    vector[bucket] += sign;
  }
  return l2Normalize(vector);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToBucket(token: string, dim: number): number {
  const hex = createHash('sha256').update(token).digest('hex').slice(0, 8);
  return parseInt(hex, 16) % dim;
}

function hashToSign(token: string): number {
  const hex = createHash('sha256').update(`sign:${token}`).digest('hex').slice(0, 2);
  return parseInt(hex, 16) % 2 === 0 ? 1 : -1;
}

function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((v) => v / norm);
}
