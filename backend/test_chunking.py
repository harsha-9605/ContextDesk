import asyncio
import uuid
from ai.engine import SemanticEngine
from database import pdf_documents

async def test_chunking():
    # Simulated Long PDF String (approx 150 words repeated 10 times to make ~1500 words)
    long_text = ("This is a simulated sentence representing content extracted from a PDF. "
                 "We want to ensure that extremely long strings are divided correctly without "
                 "losing semantics. " * 50) # 3 sentences per iteration, approx ~1500 words total

    print(f"Original Text Length: {len(long_text)} characters")

    engine = SemanticEngine()
    
    # 1. Process document
    file_id = str(uuid.uuid4())
    filename = "test_document.pdf"
    
    print("Processing document into chunks & generating embeddings...")
    chunks = engine.process_document(long_text, filename, file_id)
    
    print(f"Total Chunks Created: {len(chunks)}")
    
    # 2. Insert into DB
    print("Inserting chunks into MongoDB `pdf_documents` collection...")
    if chunks:
        result = await pdf_documents.insert_many(chunks)
        print(f"Successfully inserted {len(result.inserted_ids)} chunks into the database.")
    else:
        print("No chunks generated!")
        
if __name__ == "__main__":
    asyncio.run(test_chunking())
