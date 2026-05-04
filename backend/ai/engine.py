from langchain_text_splitters import RecursiveCharacterTextSplitter

class SemanticEngine:
    def __init__(self, model_name='all-MiniLM-L6-v2', chunk_size=200, chunk_overlap=40):
        # 1. Store the config, but keep the model empty (Zero RAM usage at boot)
        self.model_name = model_name
        self.model = None 
        
        # Initialize text splitter (This is lightweight and can stay in __init__)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size * 5, 
            chunk_overlap=chunk_overlap * 5,
            separators=["\n\n", "\n", " ", ""]
        )

    def get_model(self):
        """
        The 'Lazy Loader': This function ensures the model is only loaded
        when someone actually tries to generate an embedding.
        """
        if self.model is None:
            print(f"🕒 RAM check: Loading {self.model_name} on demand...")
            # Load only on CPU to stay under Render's 512MB limit
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name, device='cpu')
            self.model.eval()
            print("✅ Model loaded successfully. RAM spike managed.")
        return self.model

    def generate_embedding(self, text: str):
        """
        Uses the lazy-loaded model to create vectors.
        """
        # Call the loader before encoding
        engine = self.get_model()
        return engine.encode(text).tolist()

    def chunk_text(self, text: str):
        """
        Splits a large block of text into smaller overlapping chunks.
        """
        return self.text_splitter.split_text(text)

    def process_document(self, text: str, filename: str, file_id: str):
        """
        Chunks text, batch-encodes ALL chunks in a single model call,
        and prepares them for MongoDB. Much faster than encoding one by one.
        """
        chunks = self.chunk_text(text)
        print(f"⚙️  Encoding {len(chunks)} chunks in one batch call...")

        # ✅ Batch encode: send all chunks to the model AT ONCE instead of
        # one-by-one. This is 5–10x faster on CPU.
        model = self.get_model()
        vectors = model.encode(
            chunks,
            batch_size=32,          # process 32 chunks per GPU/CPU pass
            show_progress_bar=False,
            convert_to_numpy=True
        ).tolist()

        print(f"✅ Batch encoding done for {len(chunks)} chunks.")

        processed_chunks = []
        for index, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
            processed_chunks.append({
                "file_id": file_id,
                "filename": filename,
                "chunk_index": index,
                "text": chunk_text,
                "vector": vector
            })
            
        return processed_chunks
