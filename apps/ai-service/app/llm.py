# app/llm.py
import os
from langchain_openai import ChatOpenAI

def get_llm(temperature: float = 0.0):
    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", os.getenv("OPENAI_MODEL")),
        temperature=temperature,
        api_key=os.getenv("OPENAI_API_KEY"),
    )