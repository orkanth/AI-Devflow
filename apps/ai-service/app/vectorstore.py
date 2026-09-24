# app/vectorstore.py
import os
from langchain_postgres import PGVector
from app.embeddings import embeddings  # <-- Import the existing variable

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+psycopg://postgres:postgres@localhost:5432/devflow"
)

def get_vector_store() -> PGVector:
    return PGVector(
        embeddings=embeddings,
        collection_name="devflow_knowledge",
        connection=DATABASE_URL,
        use_jsonb=True,
    )