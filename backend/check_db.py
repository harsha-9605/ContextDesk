import asyncio
from database import pdf_documents, init_db

async def check_db():
    await init_db()
    # Find the document we just uploaded via test_client.py
    doc = await pdf_documents.find_one({"filename": "dummy_test.pdf"})
    if doc:
        print("\n--- FOUND DOCUMENT IN MONGODB ---")
        print(f"File ID: {doc.get('file_id')}")
        print(f"Filename: {doc.get('filename')}")
        print(f"Text Chunk: {doc.get('text')}")
        print(f"Vector length: {len(doc.get('vector', []))} (Should be 384)")
        print(f"Supabase URL: {doc.get('supabase_url')}")
        print("---------------------------------")
    else:
        print("Document not found in DB!")

if __name__ == "__main__":
    asyncio.run(check_db())
