from __future__ import annotations

import hashlib
import math
import re

EMBEDDING_DIM = 64


def tokenize(text: str) -> list[str]:
    return [token for token in re.sub(r"[^a-z0-9\s]", " ", text.lower()).split() if len(token) > 1]


def _bucket(token: str, dim: int) -> int:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16) % dim


def _sign(token: str) -> int:
    digest = hashlib.sha256(f"sign:{token}".encode("utf-8")).hexdigest()[:2]
    return 1 if int(digest, 16) % 2 == 0 else -1


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def embed(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Hashing-trick embedding — same algorithm as NestJS so vectors are compatible.

    Swap this function for OpenAI / sentence-transformers without changing RAG.
    """
    vector = [0.0] * dim
    tokens = tokenize(text)
    if not tokens:
        return vector
    for token in tokens:
        vector[_bucket(token, dim)] += _sign(token)
    return l2_normalize(vector)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    size = min(len(left), len(right))
    dot = sum(left[i] * right[i] for i in range(size))
    na = math.sqrt(sum(left[i] * left[i] for i in range(size)))
    nb = math.sqrt(sum(right[i] * right[i] for i in range(size)))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
