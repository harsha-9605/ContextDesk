from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

class SemanticEngine:
    def __init__(self, model_name='all-MiniLM-L6-v2', chunk_size=500, chunk_overlap=50):
        # Initialize the SentenceTransformer model
        # all-MiniLM-L6-v2 produces vectors of length 384
        self.model = SentenceTransformer(model_name)
        
        # Initialize the text splitter
        # We use a space separator primarily for words, but RecursiveCharacterTextSplitter
        # smartly falls back to other separators to avoid cutting words/sentences.
        # However, RecursiveCharacterTextSplitter natively works on characters. 
        # For ~500 words, assuming ~5 chars per word, we use size 2500 chars and overlap 250 chars.
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size * 5, 
            chunk_overlap=chunk_overlap * 5,
            separators=["\n\n", "\n", " ", ""]
        )
        
    def generate_embedding(self, text: str):
        # Generate the embedding and convert to list
        return self.model.encode(text).tolist()

    def chunk_text(self, text: str):
        """
        Splits a large block of text into smaller overlapping chunks.
        """
        chunks = self.text_splitter.split_text(text)
        return chunks

    def process_document(self, text: str, filename: str, file_id: str):
        """
        Chunks the text, embeds each chunk, and returns a list of dictionaries 
        ready for insertion into the MongoDB pdf_documents collection.
        """
        chunks = self.chunk_text(text)
        
        processed_chunks = []
        for index, chunk_text in enumerate(chunks):
            vector = self.generate_embedding(chunk_text)
            processed_chunks.append({
                "file_id": file_id,
                "filename": filename,
                "chunk_index": index,
                "text": chunk_text,
                "vector": vector
            })
            
        return processed_chunks
