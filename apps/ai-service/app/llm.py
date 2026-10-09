# app/llm.py
import os
from langchain_openai import ChatOpenAI

def get_llm(temperature: float = 0.0):
    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-5.6-luna"),
        temperature=temperature,
        reasoning_effort="none",
        api_key=os.getenv("OPENAI_API_KEY"),
    )