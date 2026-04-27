from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from database import users_collection
from auth_utils import get_password_hash, verify_password, create_access_token
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
async def signup(user: UserSignup):
    # Check if user exists
    existing_user = await users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Create user dict
    user_dict = {
        "name": user.name,
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    # Insert to DB
    result = await users_collection.insert_one(user_dict)
    
    # Generate Token
    token_data = {"sub": user.email, "name": user.name}
    token = create_access_token(data=token_data)
    
    return {
        "message": "User created successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {"name": user.name, "email": user.email}
    }

@router.post("/login")
async def login(user: UserLogin):
    # Find user
    db_user = await users_collection.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Verify password
    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Generate Token
    token_data = {"sub": db_user["email"], "name": db_user["name"]}
    token = create_access_token(data=token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"name": db_user["name"], "email": db_user["email"]}
    }
