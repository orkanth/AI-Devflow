# app/embeddings.py
import os
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
    api_key=os.getenv("OPENAI_API_KEY"),
)

def get_embeddings() -> OpenAIEmbeddings:
    return embeddings