import motor.motor_asyncio
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGO_DETAILS = os.getenv("MONGO_DETAILS")
if not MONGO_DETAILS:
    raise ValueError("MONGO_DETAILS environment variable is not set")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)

# Database
database = client.contextdesk

# Collection
pdf_documents = database.get_collection("pdf_documents")

async def init_db():
    try:
        # Check if collection exists
        collections = await database.list_collection_names()
        
        if "pdf_documents" not in collections:
            await pdf_documents.insert_one({"name": "initial_pdf", "status": "initialized", "vector": [], "description": "This is an initial document to create the unified collection."})
            logger.info("Created pdf_documents collection")
            
        logger.info("Successfully connected to MongoDB and initialized collections.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
