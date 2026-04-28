import motor.motor_asyncio
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGO_DETAILS = os.getenv("MONGO_DETAILS")
if not MONGO_DETAILS:
    raise ValueError("MONGO_DETAILS environment variable is not set")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS, serverSelectionTimeoutMS=5000)

# Database
database = client.contextdesk

# Collections
pdf_documents = database.get_collection("pdf_documents")
users_collection = database.get_collection("users")
collections_collection = database.get_collection("collections")

async def init_db():
    try:
        # Explicitly ping the database to ensure connection is established eagerly
        await client.admin.command('ping')
        logger.info("Pinged your deployment. You successfully connected to MongoDB!")
        
        # Check if collection exists
        collections = await database.list_collection_names()
        
        if "pdf_documents" not in collections:
            await pdf_documents.insert_one({"name": "initial_pdf", "status": "initialized", "vector": [], "description": "This is an initial document to create the unified collection."})
            logger.info("Created pdf_documents collection")
            
        if "users" not in collections:
            await users_collection.insert_one({"email": "system@contextdesk.local", "name": "System", "password": "none", "role": "system_init"})
            logger.info("Created users collection")

        if "collections" not in collections:
            await collections_collection.insert_one({"name": "Initial Collection", "user_email": "system@contextdesk.local", "pdfs": []})
            logger.info("Created collections collection")
            
        logger.info("Successfully connected to MongoDB and initialized collections.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
