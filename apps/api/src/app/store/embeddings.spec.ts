import { cosineSimilarity, embed } from './embeddings';

describe('hashing-trick embeddings', () => {
  it('is deterministic', () => {
    expect(embed('pgvector cosine search')).toEqual(
      embed('pgvector cosine search')
    );
  });

  it('ranks overlapping tokens higher than unrelated text', () => {
    const query = embed('langgraph supervisor routes rag agent');
    const related = embed(
      'A supervisor graph routes each request to the RAG agent'
    );
    const unrelated = embed('the cafeteria serves tomato soup at noon');
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated)
    );
  });
});
