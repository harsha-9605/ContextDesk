from __future__ import annotations

import os
from huggingface_hub import InferenceClient
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai


# Single shared client — created once at import time, costs ~0 RAM
_client: InferenceClient | None = None

def _get_client() -> InferenceClient:
    global _client
    if _client is None:
        token = os.getenv("HF_TOKEN")
        if not token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is not set. "
                "Add it to your .env file or Render environment."
            )
        _client = InferenceClient(token=token)
        
        # Also configure Gemini here lazily
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
        
    return _client


class SemanticEngine:
    MODEL = "sentence-transformers/all-MiniLM-L6-v2"

    def __init__(self, chunk_size: int = 200, chunk_overlap: int = 40):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size * 5,
            chunk_overlap=chunk_overlap * 5,
            separators=["\n\n", "\n", " ", ""]
        )

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------

    def generate_embedding(self, text: str) -> list[float]:
        """Returns a 384-dim embedding vector via the HF Inference API."""
        response = _get_client().feature_extraction(text, model=self.MODEL)
        # HF can return [[...]] or [...] — always flatten to 1-D
        # float() converts numpy.float32 → Python float so MongoDB can store it
        flat = response[0] if isinstance(response[0], list) else response
        return [float(x) for x in flat]

    # ------------------------------------------------------------------
    # Text chunking
    # ------------------------------------------------------------------

    def chunk_text(self, text: str) -> list[str]:
        """Splits a large block of text into smaller overlapping chunks."""
        return self.text_splitter.split_text(text)

    # ------------------------------------------------------------------
    # Full document pipeline
    # ------------------------------------------------------------------

    def process_document(self, text: str, filename: str, file_id: str) -> list[dict]:
        """
        Chunks text, encodes each chunk via the HF API, and returns
        a list of dicts ready for MongoDB storage.
        """
        chunks = self.chunk_text(text)
        print(f"[SemanticEngine] Encoding {len(chunks)} chunks via HF API...")

        client = _get_client()
        processed_chunks = []

        for index, chunk in enumerate(chunks):
            response = client.feature_extraction(chunk, model=self.MODEL)
            flat = response[0] if isinstance(response[0], list) else response
            vector = [float(x) for x in flat]
            processed_chunks.append({
                "file_id": file_id,
                "filename": filename,
                "chunk_index": index,
                "text": chunk,
                "vector": vector,
            })

        print(f"[SemanticEngine] Done — {len(chunks)} chunks encoded.")
        return processed_chunks

    # ------------------------------------------------------------------
    # Chat / RAG
    # ------------------------------------------------------------------

    def generate_answer(self, query: str, context_chunks: list[str]) -> str:
        """
        Uses Google Gemini to answer the user's query based ONLY on the provided context.
        Forces the answer to be brief (no large paragraphs).
        """
        # Ensure Gemini is configured
        _get_client() 
        
        if not context_chunks:
            return "I couldn't find any relevant information in your uploaded PDFs to answer that."

        context_text = "\n\n---\n\n".join(context_chunks)
        
        prompt = f"""You are a helpful AI assistant for a document management app called ContextDesk.
Your task is to answer the user's question based strictly on the provided context from their uploaded PDFs.

CRITICAL INSTRUCTIONS:
1. Answer strictly using ONLY the provided context. If the answer is not in the context, say "I don't have enough information in your PDFs to answer that."
2. Keep your answer brief, concise, and straight to the point.
3. DO NOT use large paragraphs. Use a maximum of 2-3 short sentences.
4. If relevant, you may use brief bullet points instead of sentences.

CONTEXT:
{context_text}

USER QUESTION: {query}
"""
        
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"[SemanticEngine] Error generating answer: {e}")
            return "I encountered an error while trying to generate an answer. Please try again."
