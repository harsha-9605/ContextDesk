from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
import fitz # PyMuPDF
import uuid
import os
import shutil
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from supabase import create_client, Client

from ai.engine import SemanticEngine
from database import init_db, pdf_documents, users_collection, collections_collection
from auth_utils import get_current_user
from bson import ObjectId
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
    allow_origins=[
        "https://contextdesk.onrender.com", 
        "http://localhost:5173",
        "http://localhost:3000"
    ],
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
async def get_pdf_count(current_user: str = Depends(get_current_user)):
    """Returns the number of unique PDFs uploaded by the user."""
    distinct_file_ids = await pdf_documents.distinct("file_id", {"user_email": current_user})
    
    # Fetch user's favorites to return the count
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    return {"count": len(distinct_file_ids), "favorite_count": len(favorites)}

@app.get("/api/pdfs")
async def get_pdfs(limit: int = 0, current_user: str = Depends(get_current_user)):
    """
    Returns a list of unique uploaded PDFs for the user,
    sorted by upload date descending.
    """
    pipeline = [
        {"$match": {"user_email": current_user}},
        {"$sort": {"uploaded_at": -1}},
        {"$group": {
            "_id": "$file_id",
            "filename": {"$first": "$filename"},
            "supabase_url": {"$first": "$supabase_url"},
            "uploaded_at": {"$first": "$uploaded_at"},
            "chunk_count": {"$sum": 1},
            "preview": {"$first": "$text"}
        }},
        {"$sort": {"uploaded_at": -1}}
    ]
    if limit > 0:
        pipeline.append({"$limit": limit})
        
    cursor = pdf_documents.aggregate(pipeline)
    
    # Fetch user's favorites
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    results = []
    async for doc in cursor:
        uploaded_at = doc.get("uploaded_at")
        date_str = uploaded_at.strftime("%b %d, %Y") if uploaded_at else "Unknown"
        time_str = uploaded_at.strftime("%I:%M %p") if uploaded_at else ""
        preview_text = doc.get("preview", "")
        preview = (preview_text[:120] + "...") if len(preview_text) > 120 else preview_text
        file_id_str = str(doc["_id"])
        
        results.append({
            "file_id": file_id_str,
            "filename": doc.get("filename", "Untitled.pdf"),
            "supabase_url": doc.get("supabase_url", ""),
            "date": date_str,
            "time": time_str,
            "chunks": doc.get("chunk_count", 0),
            "preview": preview,
            "is_favorite": file_id_str in favorites
        })
    return {"pdfs": results}



# Model for our new AI endpoint
class EmbeddingRequest(BaseModel):
    text: str

class SearchRequest(BaseModel):
    query: str

@app.post("/api/search")
async def search_pdfs(req: SearchRequest, current_user: str = Depends(get_current_user)):
    """
    Perform semantic search across all PDF chunks belonging to the user.
    """
    if not req.query.strip():
        return {"pdfs": []}
        
    # 1. Generate query embedding
    query_vector = engine.generate_embedding(req.query)
    query_vec_np = np.array(query_vector)
    query_norm = np.linalg.norm(query_vec_np)
    if query_norm == 0:
        query_norm = 1e-10
        
    # 2. Iterate through all chunks for the user and calculate cosine similarity
    cursor = pdf_documents.find({"user_email": current_user})
    
    best_chunks = {}
    chunk_counts = {}
    
    async for chunk in cursor:
        file_id = chunk.get("file_id")
        chunk_vec = chunk.get("vector")
        if not file_id or not chunk_vec:
            continue
            
        chunk_counts[file_id] = chunk_counts.get(file_id, 0) + 1
        
        chunk_vec_np = np.array(chunk_vec)
        chunk_norm = np.linalg.norm(chunk_vec_np)
        if chunk_norm == 0:
            continue
            
        similarity = np.dot(query_vec_np, chunk_vec_np) / (query_norm * chunk_norm)
        
        # Keep track of the chunk with highest similarity per file
        if file_id not in best_chunks or similarity > best_chunks[file_id]["similarity"]:
            best_chunks[file_id] = {
                "file_id": file_id,
                "filename": chunk.get("filename", "Untitled.pdf"),
                "supabase_url": chunk.get("supabase_url", ""),
                "uploaded_at": chunk.get("uploaded_at"),
                "preview": chunk.get("text", ""),
                "similarity": similarity
            }
            
    # Fetch user's favorites
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    results = []
    # Sort files by highest similarity
    sorted_files = sorted(best_chunks.values(), key=lambda x: x["similarity"], reverse=True)
    
    for f in sorted_files:
        # Only include if similarity > 0.1 (basic threshold to ignore irrelevant results)
        if f["similarity"] < 0.1:
            continue
            
        uploaded_at = f["uploaded_at"]
        date_str = uploaded_at.strftime("%b %d, %Y") if uploaded_at else "Unknown"
        time_str = uploaded_at.strftime("%I:%M %p") if uploaded_at else ""
        preview_text = f["preview"]
        preview = (preview_text[:120] + "...") if len(preview_text) > 120 else preview_text
        
        results.append({
            "file_id": f["file_id"],
            "filename": f["filename"],
            "supabase_url": f["supabase_url"],
            "date": date_str,
            "time": time_str,
            "chunks": chunk_counts.get(f["file_id"], 0),
            "preview": preview,
            "is_favorite": f["file_id"] in favorites,
            "similarity": float(f["similarity"])
        })
        
    # Return top 10 unique PDFs matching the search
    return {"pdfs": results[:10]}

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
async def upload_pdf(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
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
            
            # Add Supabase URL, upload timestamp, and user email to each chunk
            from datetime import datetime
            now = datetime.utcnow()
            for chunk in chunks:
                chunk["supabase_url"] = public_url
                chunk["uploaded_at"] = now
                chunk["user_email"] = current_user
            
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

class FavoriteToggle(BaseModel):
    file_id: str

@app.post("/api/favorites/toggle")
async def toggle_favorite(req: FavoriteToggle, current_user: str = Depends(get_current_user)):
    user_doc = await users_collection.find_one({"email": current_user})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
        
    favorites = user_doc.get("favorites", [])
    
    if req.file_id in favorites:
        favorites.remove(req.file_id)
        is_favorite = False
    else:
        favorites.append(req.file_id)
        is_favorite = True
        
    await users_collection.update_one(
        {"email": current_user},
        {"$set": {"favorites": favorites}}
    )
    
    return {"message": "Success", "is_favorite": is_favorite}

class CollectionCreate(BaseModel):
    name: str

class AddPdfToCollection(BaseModel):
    file_id: str

@app.get("/api/collections")
async def get_collections(current_user: str = Depends(get_current_user)):
    cursor = collections_collection.find({"user_email": current_user})
    collections = []
    async for doc in cursor:
        collections.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "pdf_count": len(doc.get("pdfs", []))
        })
    return {"collections": collections}

@app.post("/api/collections")
async def create_collection(req: CollectionCreate, current_user: str = Depends(get_current_user)):
    new_col = {
        "name": req.name,
        "user_email": current_user,
        "pdfs": []
    }
    result = await collections_collection.insert_one(new_col)
    return {"id": str(result.inserted_id), "name": req.name, "pdf_count": 0}

@app.get("/api/collections/{collection_id}")
async def get_collection_details(collection_id: str, current_user: str = Depends(get_current_user)):
    try:
        col_id = ObjectId(collection_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid collection ID format")
        
    collection = await collections_collection.find_one({"_id": col_id, "user_email": current_user})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    # Get all PDFs for this user
    pipeline = [
        {"$match": {"user_email": current_user}},
        {"$sort": {"uploaded_at": -1}},
        {"$group": {
            "_id": "$file_id",
            "filename": {"$first": "$filename"},
            "supabase_url": {"$first": "$supabase_url"},
            "uploaded_at": {"$first": "$uploaded_at"},
            "chunk_count": {"$sum": 1},
            "preview": {"$first": "$text"}
        }}
    ]
    cursor = pdf_documents.aggregate(pipeline)
    
    # Fetch user's favorites
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    collection_pdfs = collection.get("pdfs", [])
    results = []
    async for doc in cursor:
        file_id_str = str(doc["_id"])
        if file_id_str in collection_pdfs:
            uploaded_at = doc.get("uploaded_at")
            date_str = uploaded_at.strftime("%b %d, %Y") if uploaded_at else "Unknown"
            time_str = uploaded_at.strftime("%I:%M %p") if uploaded_at else ""
            preview_text = doc.get("preview", "")
            preview = (preview_text[:120] + "...") if len(preview_text) > 120 else preview_text
            
            results.append({
                "file_id": file_id_str,
                "filename": doc.get("filename", "Untitled.pdf"),
                "supabase_url": doc.get("supabase_url", ""),
                "date": date_str,
                "time": time_str,
                "chunks": doc.get("chunk_count", 0),
                "preview": preview,
                "is_favorite": file_id_str in favorites
            })
            
    return {
        "id": str(collection["_id"]),
        "name": collection.get("name", ""),
        "pdfs": results
    }

@app.post("/api/collections/{collection_id}/add")
async def add_pdf_to_collection(collection_id: str, req: AddPdfToCollection, current_user: str = Depends(get_current_user)):
    try:
        col_id = ObjectId(collection_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid collection ID format")
        
    collection = await collections_collection.find_one({"_id": col_id, "user_email": current_user})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    pdfs = collection.get("pdfs", [])
    if req.file_id not in pdfs:
        pdfs.append(req.file_id)
        await collections_collection.update_one({"_id": col_id}, {"$set": {"pdfs": pdfs}})
        
    return {"message": "PDF added to collection"}
