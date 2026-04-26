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

@app.get("/")
def read_root():
    return {"message": "Welcome to ContextDesk API"}

@app.get("/api/health")
def get_health():
    return {"status": "ok"}

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
            
            # Add Supabase URL to each chunk
            for chunk in chunks:
                chunk["supabase_url"] = public_url
            
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
