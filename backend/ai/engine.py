from __future__ import annotations

import os
from huggingface_hub import InferenceClient
from langchain_text_splitters import RecursiveCharacterTextSplitter


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
        import numpy as np
        # HF can return [[...]] or [...] — always flatten to 1-D using numpy
        flat = np.array(response).flatten()
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

    def generate_answer(self, query: str, context_chunks: list[str], user_metadata: str = "") -> str:
        """
        Uses Hugging Face Llama 3.1 to answer the user's query based ONLY on the provided context.
        Forces the answer to be brief (no large paragraphs).
        """
        client = _get_client() 
        
        context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else "No document context provided or found."
        
        system_prompt = f"""You are the ContextDesk Assistant. 
1. If the user greets you (e.g., 'hi', 'hello', 'hey', 'yo'—including variations like 'hiiii'), respond warmly and ask how you can help with their documents.
2. If the user asks about their account details (e.g., number of PDFs, favorites), use the provided USER ACCOUNT METADATA to answer.
3. Only use the provided PDF context if the user asks a specific question about their data. If the answer is not in the context or metadata, say "I don't have enough information in your PDFs to answer that."
4. Keep your tone helpful and professional but friendly.
5. Keep your answer brief, concise, and straight to the point (maximum 2-3 short sentences).

USER ACCOUNT METADATA:
{user_metadata}

CONTEXT:
{context_text}"""
        
        # Using Llama 3.1 Instruct format natively via chat_completion
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]
        
        try:
            response = client.chat_completion(
                model="meta-llama/Llama-3.1-8B-Instruct",
                messages=messages,
                max_tokens=250
            )
            return response.choices[0].message.content
        except Exception as e:
            error_msg = str(e)
            print(f"[SemanticEngine] Error generating answer: {error_msg}")
            return f"I encountered an error while trying to generate an answer: {error_msg}"
