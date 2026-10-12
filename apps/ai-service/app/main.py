import os
import math
from pathlib import Path
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import (
    FastAPI,
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from docx import Document as DocxDocument
from pypdf import PdfReader
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from app.schemas import ChatRequest, ChatResultResponse, TraceEntry, ToolCallRecord
from app.graph.supervisor import app_graph

app = FastAPI(title="DevFlow AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root and v1 health checks
@app.get("/health")
@app.get("/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-service",
        "llm": {
            "enabled": True,
            "model": os.getenv("OPENAI_MODEL", "gpt-5.6-luna")
        }
    }

v1_router = APIRouter(prefix="/v1")
 
# apps/ai-service/app/main.py

def parse_chat_response(
    result: dict,
    user_prompt: str,
) -> ChatResultResponse:

    messages = result.get("messages", [])

    # ---------------------------------------------------------
    # 1. Final assistant response
    # ---------------------------------------------------------
    last_text = "No response generated."

    for msg in reversed(messages):
        content = getattr(msg, "content", "")

        if isinstance(content, str) and content.strip():
            last_text = content
            break

        if isinstance(msg, dict) and msg.get("content"):
            last_text = msg["content"]
            break

    text_lower = last_text.lower()

    # ---------------------------------------------------------
    # 2. State values
    # ---------------------------------------------------------
    active_agent = result.get("next_node") or "UserAgent"
    status = result.get("status", "completed")

    action_type = result.get("action_type") or "none"

    crud_payload: Optional[Dict[str, Any]] = result.get(
        "crud_payload"
    )

    missing_fields: List[str] = (
        result.get("missing_fields") or []
    )

    requires_confirmation = result.get(
        "requires_confirmation",
        False,
    )

    # ---------------------------------------------------------
    # 3. Extract actual LangChain tool calls
    # ---------------------------------------------------------
    executed_tool_calls: List[ToolCallRecord] = []

    action_map = {
        "create_task_tool": "create_task",
        "update_task_tool": "update_task",
        "delete_task_tool": "delete_task",
        "lookup_task_tool": "lookup_task",
        "reassign_user_tasks_tool": "reassign_tasks",
        "list_tasks_by_user_tool": "list_tasks",
        "lookup_user_tool": "lookup_user",

        "create_project_tool": "create_project",
        "update_project_tool": "update_project",
        "delete_project_tool": "delete_project",

        "create_user_tool": "create_user",
        "update_user_tool": "update_user",
        "delete_user_tool": "delete_user",
    }

    for msg in messages:

        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            continue

        for tc in tool_calls:

            name = tc.get("name", "")
            args = tc.get("args", {})

            # IMPORTANT:
            # ToolCallRecord expects "tool", not "name"
            executed_tool_calls.append(
                ToolCallRecord(
                    tool=name,
                    args=args,
                )
            )

            # Extract CRUD payload
            if crud_payload is None:
                crud_payload = args

            # Extract action type
            if name in action_map:
                action_type = action_map[name]

    # ---------------------------------------------------------
    # 4. Fallback status / confirmation rules
    # ---------------------------------------------------------
    if "already exists" in text_lower or "conflict" in text_lower:
        status = "error"
        action_type = "duplicate"

    elif (
        "are you sure you want to permanently delete task"
        in text_lower
        or "are you sure you want to delete"
        in text_lower
    ):
        status = "requires_action"
        action_type = "confirmation"
        requires_confirmation = True

    elif (
        "information is required" in text_lower
        or "following information" in text_lower
    ):
        status = "requires_action"
        action_type = "missing_info"

        for field in [
            "name",
            "email",
            "role",
            "title",
            "project_identifier",
            "description",
        ]:
            if field in text_lower and field not in missing_fields:
                missing_fields.append(field)

    # ---------------------------------------------------------
    # 5. Trace
    # ---------------------------------------------------------
    trace_list = [
        TraceEntry(
            agent=active_agent,
            reason=(
                f"Processed user intent for: "
                f"'{user_prompt[:40]}...'"
            ),
            toolCalls=executed_tool_calls,
        )
    ]

    # ---------------------------------------------------------
    # 6. Final API response
    # ---------------------------------------------------------
    return ChatResultResponse(
        answer=last_text,
        route=active_agent,
        source="langgraph",
        llm=True,
        model=os.getenv(
            "OPENAI_MODEL",
            "gpt-5.6-luna",
        ),
        engine="langgraph-supervisor",
        trace=trace_list,
        contexts=[],
        status=status,
        action_type=action_type,
        crud_payload=crud_payload,
        missing_fields=missing_fields or None,
        requires_confirmation=requires_confirmation,
    )


@v1_router.post("/chat", response_model=ChatResultResponse)
async def chat_endpoint(req: ChatRequest):
    user_prompt = req.get_text()
    inputs = {"messages": [HumanMessage(content=user_prompt)]}
    config = {"configurable": {"thread_id": req.thread_id or "default"}}
    result = await app_graph.ainvoke(inputs, config=config)
    return parse_chat_response(result, user_prompt)

 



@v1_router.post("/knowledge/ingest")
async def ingest_knowledge(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    project_id: str = Form(...),
):
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    file_bytes = await file.read()

    # 1. Validate the uploaded file
    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty",
        )

    if len(file_bytes) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 25 MB limit",
        )

    # 2. Extract document text
    try:
        if extension == ".pdf":
            pdf = PdfReader(BytesIO(file_bytes))
            text = "\n".join(
                page.extract_text() or ""
                for page in pdf.pages
            )

        elif extension == ".docx":
            document = DocxDocument(BytesIO(file_bytes))
            text = "\n".join(
                paragraph.text
                for paragraph in document.paragraphs
            )

        elif extension in {".txt", ".md"}:
            text = file_bytes.decode(
                "utf-8-sig",
                errors="replace",
            )

        else:
            raise HTTPException(
                status_code=415,
                detail="Supported formats: PDF, DOCX, TXT and MD",
            )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Document text extraction failed: {type(exc).__name__}",
        ) from exc

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text was found in the document",
        )

    # 3. Split text into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, #1,000 characters
        chunk_overlap=100, #150 characters
    )

    chunks = splitter.split_text(text)

    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="No text chunks could be generated",
        )

    # 4. Generate 1536-dimensional embeddings
    try:
        embeddings_model = OpenAIEmbeddings(
            model=os.getenv(
                "OPENAI_EMBEDDING_MODEL",
                "text-embedding-3-small",
            ),
            dimensions=1536,
        )

        vectors = await embeddings_model.aembed_documents(chunks)

    except Exception as exc:
        # Log the exception on the server without returning
        # credentials or internal error details to the client.
        print(f"Embedding generation failed: {type(exc).__name__}")

        raise HTTPException(
            status_code=502,
            detail="Embedding generation failed. Check AI service configuration.",
        ) from exc

    if len(vectors) != len(chunks):
        raise HTTPException(
            status_code=502,
            detail="Embedding count does not match chunk count",
        )

    if any(
        len(vector) != 1536
        or not all(map(__import__("math").isfinite, vector))
        for vector in vectors
    ):
        raise HTTPException(
            status_code=502,
            detail="Embedding dimensions or values are invalid",
        )

    # 5. Return the chunks to NestJS for PostgreSQL storage
    return {
        "documentId": document_id,
        "projectId": project_id,
        "chunkCount": len(chunks),
        "chunks": [
            {
                "content": content,
                "chunkIndex": index,
                "embedding": vector,
            }
            for index, (content, vector) in enumerate(
                zip(chunks, vectors)
            )
        ],
    }



@v1_router.post("/knowledge/ingest")
async def ingest_knowledge(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    project_id: str = Form(...),
):
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    file_bytes = await file.read()

    # 1. Validate the uploaded file
    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty",
        )

    if len(file_bytes) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 25 MB limit",
        )

    # 2. Extract document text
    try:
        if extension == ".pdf":
            pdf = PdfReader(BytesIO(file_bytes))
            text = "\n".join(
                page.extract_text() or ""
                for page in pdf.pages
            )

        elif extension == ".docx":
            document = DocxDocument(BytesIO(file_bytes))
            text = "\n".join(
                paragraph.text
                for paragraph in document.paragraphs
            )

        elif extension in {".txt", ".md"}:
            text = file_bytes.decode(
                "utf-8-sig",
                errors="replace",
            )

        else:
            raise HTTPException(
                status_code=415,
                detail="Supported formats: PDF, DOCX, TXT and MD",
            )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Document text extraction failed: {type(exc).__name__}",
        ) from exc

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text was found in the document",
        )

    # 3. Split text into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
    )

    chunks = splitter.split_text(text)

    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="No text chunks could be generated",
        )

    # 4. Generate 1536-dimensional embeddings
    try:
        embeddings_model = OpenAIEmbeddings(
            model=os.getenv(
                "OPENAI_EMBEDDING_MODEL",
                "text-embedding-3-small",
            ),
            dimensions=1536,
        )

        vectors = await embeddings_model.aembed_documents(chunks)

    except Exception as exc:
        # Log the exception on the server without returning
        # credentials or internal error details to the client.
        print(f"Embedding generation failed: {type(exc).__name__}")

        raise HTTPException(
            status_code=502,
            detail="Embedding generation failed. Check AI service configuration.",
        ) from exc

    if len(vectors) != len(chunks):
        raise HTTPException(
            status_code=502,
            detail="Embedding count does not match chunk count",
        )

    if any(
        len(vector) != 1536
        or not all(map(__import__("math").isfinite, vector))
        for vector in vectors
    ):
        raise HTTPException(
            status_code=502,
            detail="Embedding dimensions or values are invalid",
        )

    # 5. Return the chunks to NestJS for PostgreSQL storage
    return {
        "documentId": document_id,
        "projectId": project_id,
        "chunkCount": len(chunks),
        "chunks": [
            {
                "content": content,
                "chunkIndex": index,
                "embedding": vector,
            }
            for index, (content, vector) in enumerate(
                zip(chunks, vectors)
            )
        ],
    }


app.include_router(v1_router)
 