import os
import google.generativeai as genai
from dotenv import load_dotenv

def test_gemini():
    load_dotenv()
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY is missing from .env file or environment variables.")
        return
        
    print(f"🔑 Found GEMINI_API_KEY: {api_key[:10]}...{api_key[-4:]}")
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        print("🤖 Sending test prompt to Gemini...")
        response = model.generate_content("Hello! Are you working?")
        
        print("\n✅ Success! Gemini responded with:")
        print("-" * 40)
        print(response.text)
        print("-" * 40)
        
    except Exception as e:
        print("\n❌ Failed to connect to Gemini API.")
        print(f"Error details: {str(e)}")
        print("\nPlease check if your API key is valid, has billing enabled, and is active.")

if __name__ == "__main__":
    test_gemini()
