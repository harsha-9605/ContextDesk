from fastapi import FastAPI, UploadFile, File, HTTPException
import fitz # PyMuPDF
import uuid
import os
import shutil
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from supabase import create_client, Client

from ai.engine import SemanticEngine
from database import init_db, pdf_documents
import auth

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are not set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database on startup
    await init_db()
    
    # Try to create the 'pdfs' bucket in Supabase (will fail silently if it already exists)
    try:
        supabase.storage.create_bucket("pdfs")
    except Exception:
        pass
        
    yield

app = FastAPI(title="ContextDesk API", lifespan=lifespan)

# Initialize the AI Engine once on startup
engine = SemanticEngine()

# Configure CORS to allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to ContextDesk API"}

@app.get("/api/health")
def get_health():
    return {"status": "ok"}

@app.get("/api/pdf-count")
async def get_pdf_count():
    """Returns the number of unique PDFs uploaded."""
    distinct_file_ids = await pdf_documents.distinct("file_id")
    return {"count": len(distinct_file_ids)}

@app.get("/api/pdfs")
async def get_pdfs():
    """
    Returns a list of unique uploaded PDFs (one entry per file),
    sorted by upload date descending (most recent first).
    """
    pipeline = [
        {"$sort": {"uploaded_at": -1}},
        {"$group": {
            "_id": "$file_id",
            "filename": {"$first": "$filename"},
            "supabase_url": {"$first": "$supabase_url"},
            "uploaded_at": {"$first": "$uploaded_at"},
            "chunk_count": {"$sum": 1},
            # grab a short text snippet from first chunk for preview
            "preview": {"$first": "$text"}
        }},
        {"$sort": {"uploaded_at": -1}}
    ]
    cursor = pdf_documents.aggregate(pipeline)
    results = []
    async for doc in cursor:
        uploaded_at = doc.get("uploaded_at")
        date_str = uploaded_at.strftime("%b %d, %Y") if uploaded_at else "Unknown"
        time_str = uploaded_at.strftime("%I:%M %p") if uploaded_at else ""
        preview_text = doc.get("preview", "")
        # trim preview to ~120 chars
        preview = (preview_text[:120] + "...") if len(preview_text) > 120 else preview_text
        results.append({
            "file_id": str(doc["_id"]),
            "filename": doc.get("filename", "Untitled.pdf"),
            "supabase_url": doc.get("supabase_url", ""),
            "date": date_str,
            "time": time_str,
            "chunks": doc.get("chunk_count", 0),
            "preview": preview,
        })
    return {"pdfs": results}

@app.get("/api/topics")
async def get_topics():
    """
    Derives top topics by extracting keywords from filenames of uploaded PDFs.
    Returns up to 6 topics with relative percentage weights.
    """
    import re
    # Collect all filenames
    filenames = await pdf_documents.distinct("filename")
    
    # Common stop words to ignore
    stop_words = {"the", "a", "an", "in", "of", "and", "for", "to", "with", "by", "on", "is", "pdf"}
    
    word_counts: dict = {}
    for name in filenames:
        # strip extension and split on separators
        base = re.sub(r'\.pdf$', '', name, flags=re.IGNORECASE)
        words = re.split(r'[\s_\-]+', base)
        for w in words:
            w_clean = w.strip().lower()
            if len(w_clean) > 2 and w_clean not in stop_words:
                word_counts[w_clean] = word_counts.get(w_clean, 0) + 1
    
    if not word_counts:
        return {"topics": []}
    
    # Sort by frequency and take top 6
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    total = sum(count for _, count in sorted_words)
    
    topics = [
        {"name": word.title(), "val": round((count / total) * 100)}
        for word, count in sorted_words
    ]
    return {"topics": topics}


# Model for our new AI endpoint
class EmbeddingRequest(BaseModel):
    text: str

@app.post("/api/embed")
def generate_embedding(request: EmbeddingRequest):
    """
    Generate a vector embedding using the AI module.
    """
    vector = engine.generate_embedding(request.text)
    return {
        "text": request.text,
        "length": len(vector),
        "vector": vector
}

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Endpoint to receive a PDF file, extract its text, chunk it using the AI engine,
    and save the chunks to MongoDB.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        file_id = str(uuid.uuid4())
        temp_file_path = f"temp_{file_id}_{file.filename}"
        
        try:
            # 1. Stream the PDF file into a temporary disk file (RAM friendly)
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # 2. Upload to Supabase Storage
            file_extension = file.filename.split('.')[-1]
            storage_path = f"{file_id}.{file_extension}"
            
            with open(temp_file_path, "rb") as f:
                supabase.storage.from_("pdfs").upload(
                    file=f, 
                    path=storage_path, 
                    file_options={"content-type": "application/pdf"}
                )
                
            # Get public URL
            public_url = supabase.storage.from_("pdfs").get_public_url(storage_path)
            
            # 3. Extract text using PyMuPDF (fitz) directly from the disk file
            pdf_document = fitz.open(temp_file_path)
            
            extracted_text = ""
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                extracted_text += page.get_text()
                
            pdf_document.close()
            
            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from the PDF. It might be scanned or empty.")
                
            # 4. Process with AI Engine
            chunks = engine.process_document(extracted_text, filename=file.filename, file_id=file_id)
            
            # Add Supabase URL and upload timestamp to each chunk
            from datetime import datetime
            now = datetime.utcnow()
            for chunk in chunks:
                chunk["supabase_url"] = public_url
                chunk["uploaded_at"] = now
            
            # 5. Save to Database
            if chunks:
                result = await pdf_documents.insert_many(chunks)
                inserted_count = len(result.inserted_ids)
            else:
                inserted_count = 0
                
            return {
                "message": "File processed successfully",
                "filename": file.filename,
                "supabase_url": public_url,
                "chunks_created": len(chunks),
                "chunks_saved": inserted_count
            }
            
        finally:
            # 6. Cleanup Disk
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
