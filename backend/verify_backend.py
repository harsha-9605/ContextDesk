import asyncio
import os
import fitz # PyMuPDF
from fastapi.testclient import TestClient
from main import app, init_db, supabase
from database import pdf_documents

# Create a test client
client = TestClient(app)

def create_dummy_pdf(filename="dummy_test.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello world! This is a backend test for ContextDesk AI. We are checking if the connection between FastAPI, Supabase, and MongoDB works properly and if the supabase_url is stored in the database.")
    doc.save(filename)
    doc.close()
    return filename

async def verify():
    print("1. Initializing DB Connection...")
    await init_db()
    
    print("2. Creating a dummy PDF...")
    pdf_file = create_dummy_pdf()
    
    print("3. Sending PDF to FastAPI /api/upload endpoint...")
    with open(pdf_file, "rb") as f:
        # We need to test the app via TestClient, but lifespan events (init_db) might not run automatically depending on how TestClient is used in this version.
        # We already called init_db() manually above.
        response = client.post("/api/upload", files={"file": ("dummy_test.pdf", f, "application/pdf")})
    
    print(f"Response Status Code: {response.status_code}")
    print(f"Response JSON: {response.json()}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n4. Verification Success on FastAPI side! ✅")
        print(f"Supabase Public URL received: {data.get('supabase_url')}")
        
        print("\n5. Verifying MongoDB Storage...")
        # Check if the chunks exist in the DB and have the supabase_url
        chunks_in_db = await pdf_documents.find({"filename": "dummy_test.pdf"}).to_list(length=10)
        
        print(f"Found {len(chunks_in_db)} chunks in MongoDB for this file.")
        
        if len(chunks_in_db) > 0:
            sample_chunk = chunks_in_db[0]
            print("\nSample Chunk stored in MongoDB:")
            print(f"- Text: {sample_chunk.get('text')[:50]}...")
            print(f"- Has Vector?: {'Yes' if 'vector' in sample_chunk else 'No'}")
            print(f"- Vector Length: {len(sample_chunk.get('vector', []))}")
            print(f"- Supabase URL stored in DB?: {sample_chunk.get('supabase_url')}")
            
            if sample_chunk.get('supabase_url') == data.get('supabase_url'):
                print("\n✅ PERFECT MATCH! The Supabase URL is correctly saved in MongoDB!")
            else:
                print("\n❌ MISMATCH! The Supabase URL in MongoDB doesn't match the one returned!")
        else:
            print("❌ ERROR: No chunks were found in the database!")
            
    else:
        print("❌ ERROR during upload!")
        
    # Cleanup
    if os.path.exists(pdf_file):
        os.remove(pdf_file)
    
if __name__ == "__main__":
    asyncio.run(verify())
