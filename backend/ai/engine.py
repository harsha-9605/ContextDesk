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
        # HF can return [[...]] or [...] — always flatten to 1-D
        return list(response[0] if isinstance(response[0], list) else response)

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
            vector = list(response[0] if isinstance(response[0], list) else response)
            processed_chunks.append({
                "file_id": file_id,
                "filename": filename,
                "chunk_index": index,
                "text": chunk,
                "vector": vector,
            })

        print(f"[SemanticEngine] Done — {len(chunks)} chunks encoded.")
        return processed_chunks
