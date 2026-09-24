from __future__ import annotations

from app.embeddings import tokenize
from app.schemas import EvalRequest, EvalResponse


def evaluate(payload: EvalRequest) -> EvalResponse:
    """Lightweight RAG evaluation you can explain in interviews.

    Production stacks use RAGAS / TruLens with an LLM-as-judge. The metrics
    below are lexical stand-ins so the pipeline is testable without API keys.
    """
    answer_tokens = set(tokenize(payload.answer))
    question_tokens = set(tokenize(payload.question))
    context_tokens = set(tokenize(" ".join(payload.contexts)))

    overlap_answer_context = _jaccard(answer_tokens, context_tokens)
    overlap_question_context = _jaccard(question_tokens, context_tokens)
    overlap_question_answer = _jaccard(question_tokens, answer_tokens)

    notes = (
        "Faithfulness approximates 'did the answer stay inside retrieved context'. "
        "Context precision approximates 'did retrieval overlap the question'. "
        "Answer relevance approximates 'did the answer overlap the question'. "
        "Replace with RAGAS when an LLM judge is available."
    )
    return EvalResponse(
        faithfulness=round(overlap_answer_context, 4),
        context_precision=round(overlap_question_context, 4),
        answer_relevance=round(overlap_question_answer, 4),
        notes=notes,
    )


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)
