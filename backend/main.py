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

    print("Server ready. Embeddings will be generated via HuggingFace Inference API.")
        
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
    pipeline = [
        {"$match": {"user_email": current_user}},
        {"$group": {"_id": "$file_id"}}
    ]
    cursor = pdf_documents.aggregate(pipeline)
    active_file_ids = set()
    async for doc in cursor:
        active_file_ids.add(doc["_id"])
        
    count = len(active_file_ids)
    
    # Fetch user's favorites to return the count
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    # Filter favorites to only include active file_ids
    valid_favorites = [fid for fid in favorites if fid in active_file_ids]
    
    return {"count": count, "favorite_count": len(valid_favorites)}

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



@app.delete("/api/pdfs/{file_id}")
async def delete_pdf(file_id: str, current_user: str = Depends(get_current_user)):
    """
    Deletes a PDF and its associated chunks from MongoDB, and the physical file from Supabase.
    """
    # 1. Verify ownership and get supabase URL
    # We only need to check one chunk since all chunks for a file_id share the same supabase_url and user_email
    chunk = await pdf_documents.find_one({"file_id": file_id, "user_email": current_user})
    if not chunk:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have permission to delete it.")

    supabase_url = chunk.get("supabase_url")
    
    # 2. Delete from Supabase Storage
    if supabase_url:
        try:
            # Extract storage path from the URL
            storage_path = supabase_url.split("/pdfs/")[-1]
            supabase.storage.from_("pdfs").remove([storage_path])
        except Exception as e:
            print(f"Failed to delete from Supabase: {e}")
            # We don't raise here; if Supabase deletion fails (e.g. file already gone), we still want to clean MongoDB

    # 3. Delete chunks from MongoDB
    await pdf_documents.delete_many({"file_id": file_id, "user_email": current_user})

    # 4. Remove from user's favorites
    await users_collection.update_one(
        {"email": current_user},
        {"$pull": {"favorites": file_id}}
    )

    # 5. Remove from any collections
    await collections_collection.update_many(
        {"user_email": current_user},
        {"$pull": {"pdfs": file_id}}
    )

    return {"message": "PDF successfully deleted"}

# Model for our new AI endpoint
class EmbeddingRequest(BaseModel):
    text: str

class SearchRequest(BaseModel):
    query: str

@app.post("/api/search")
async def search_pdfs(req: SearchRequest, current_user: str = Depends(get_current_user)):
    """
    Perform semantic search across all PDF chunks belonging to the user using MongoDB Atlas Vector Search.
    """
    if not req.query.strip():
        return {"pdfs": []}
        
    # 1. Generate query embedding
    query_vector = engine.generate_embedding(req.query)
        
    # 2. Use MongoDB Atlas Vector Search
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "vector",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": 50,
                "filter": {"user_email": {"$eq": current_user}}
            }
        },
        {
            "$project": {
                "file_id": 1,
                "filename": 1,
                "supabase_url": 1,
                "uploaded_at": 1,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]
    
    cursor = pdf_documents.aggregate(pipeline)
    
    best_chunks = {}
    
    async for chunk in cursor:
        file_id = chunk.get("file_id")
        score = chunk.get("score", 0)
        
        if not file_id:
            continue
            
        # Keep track of the chunk with highest similarity per file
        if file_id not in best_chunks or score > best_chunks[file_id]["similarity"]:
            best_chunks[file_id] = {
                "file_id": file_id,
                "filename": chunk.get("filename", "Untitled.pdf"),
                "supabase_url": chunk.get("supabase_url", ""),
                "uploaded_at": chunk.get("uploaded_at"),
                "preview": chunk.get("text", ""),
                "similarity": score
            }
            
    # Fetch user's favorites
    user_doc = await users_collection.find_one({"email": current_user})
    favorites = user_doc.get("favorites", []) if user_doc else []
    
    results = []
    sorted_files = sorted(best_chunks.values(), key=lambda x: x["similarity"], reverse=True)
    
    for f in sorted_files:
        # Ignore irrelevant results based on Atlas Vector Search score
        if f["similarity"] < 0.6: # Atlas cosine similarity score threshold might need tuning
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
            "chunks": 0, # Chunk count omitted for speed
            "preview": preview,
            "is_favorite": f["file_id"] in favorites,
            "similarity": float(f["similarity"])
        })
        
    return {"pdfs": results[:10]}

class ChatRequest(BaseModel):
    query: str

@app.post("/api/chat")
async def chat_with_pdfs(req: ChatRequest, current_user: str = Depends(get_current_user)):
    """
    RAG endpoint: Search PDFs and generate an answer using Google Gemini.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    # Check for general greetings to bypass vector search
    query_lower = req.query.strip().lower()
    greetings = ["hello", "hi", "hey", "hii", "how are you", "good morning", "good evening"]
    is_greeting = any(query_lower == g or query_lower.startswith(g + " ") for g in greetings)
    
    if is_greeting:
        answer = engine.generate_answer(req.query, [])
        return {"answer": answer, "sources_used": 0}
        
    # 1. Embed query
    try:
        query_vector = engine.generate_embedding(req.query)
    except Exception as e:
        print(f"[SemanticEngine] Embedding failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Hugging Face API Error: Your HF_TOKEN is unauthorized, missing, or expired. Please check your Render environment variables."
        )
    
    # 2. Vector search to find relevant chunks
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "vector",
                "queryVector": query_vector,
                "numCandidates": 50,
                "limit": 5, # Only need top 5 chunks for context
                "filter": {"user_email": {"$eq": current_user}}
            }
        },
        {
            "$project": {
                "text": 1,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]
    
    cursor = pdf_documents.aggregate(pipeline)
    
    context_chunks = []
    async for chunk in cursor:
        if chunk.get("score", 0) > 0.5: # Only include relevant context
            context_chunks.append(chunk.get("text", ""))
            
    # 3. Generate answer
    answer = engine.generate_answer(req.query, context_chunks)
    
    return {"answer": answer, "sources_used": len(context_chunks)}


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
    # Get active file_ids to filter out manually deleted orphaned IDs
    pipeline = [
        {"$match": {"user_email": current_user}},
        {"$group": {"_id": "$file_id"}}
    ]
    cursor = pdf_documents.aggregate(pipeline)
    active_file_ids = set()
    async for doc in cursor:
        active_file_ids.add(doc["_id"])

    cursor = collections_collection.find({"user_email": current_user})
    collections = []
    async for doc in cursor:
        valid_pdfs = [fid for fid in doc.get("pdfs", []) if fid in active_file_ids]
        collections.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "pdf_count": len(valid_pdfs)
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
