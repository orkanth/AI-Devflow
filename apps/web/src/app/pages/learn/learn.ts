import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'df-learn',
  imports: [MatCardModule],
  templateUrl: './learn.html',
  styleUrl: './learn.css',
})
export class LearnPage {
  protected readonly diagram = `DevFlow AI
    │
    ▼
Angular  --REST/WS-->  NestJS (Users / Projects / Tasks)
                         │
                    PostgreSQL + pgvector
                         ▲
FastAPI  --LangGraph supervisor--  Task | RAG | Analytics
                         │
                   Tool calling → NestJS`;

  protected readonly cards = [
    {
      title: 'Why Nx?',
      body: 'One repo, many apps, shared commands. nx serve web / api / ai-service. Affected builds and a single CI graph.',
    },
    {
      title: 'Why NestJS owns writes?',
      body: 'Authorization, validation, and transactions belong in the business API. Agents call tools; they do not become a second database.',
    },
    {
      title: 'Why FastAPI for agents?',
      body: 'Python is the ecosystem for LangChain, LangGraph, embeddings, and eval. Keep that isolated so Node stays the product API.',
    },
    {
      title: 'LangChain vs LangGraph',
      body: 'LangChain is prompts, ChatOpenAI, parsers, and tools. LangGraph is the supervisor graph: START → route → task | rag | analytics → END. Read docs/LANGCHAIN_LANGGRAPH.md.',
    },
    {
      title: 'RAG in this repo',
      body: 'Split → embed → store. On ask: retrieve top-k Documents, then LCEL prompt | GPT | parser. Without a key, return the top chunk.',
    },
    {
      title: 'MCP',
      body: 'Tools are described with JSON Schema. The model chooses a tool instead of free-form side effects. Same idea as function calling.',
    },
  ];
}
