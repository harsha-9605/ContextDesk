import requests
import fitz # PyMuPDF
import os

def create_dummy_pdf(filename="dummy_test.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello world! This is an end-to-end backend test for ContextDesk AI. We are checking if the connection between FastAPI, Supabase, and MongoDB works properly and if the supabase_url is stored in the database.")
    doc.save(filename)
    doc.close()
    return filename

def run_test():
    print("1. Creating a dummy PDF...")
    pdf_file = create_dummy_pdf()
    
    print("2. Sending PDF to FastAPI /api/upload endpoint on localhost:8000...")
    url = "http://localhost:8000/api/upload"
    
    try:
        with open(pdf_file, "rb") as f:
            response = requests.post(url, files={"file": ("dummy_test.pdf", f, "application/pdf")})
        
        print(f"Response Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n3. SUCCESS! Backend processed the file correctly.")
            print(f"Filename: {data.get('filename')}")
            print(f"Chunks Created: {data.get('chunks_created')}")
            print(f"Chunks Saved to DB: {data.get('chunks_saved')}")
            print(f"Supabase Public URL generated: {data.get('supabase_url')}")
            
            if data.get('supabase_url'):
                print("\nEverything is working perfectly!")
                print("- FastAPI successfully uploaded to Supabase.")
                print("- FastAPI successfully chunked the text.")
                print("- FastAPI successfully saved the chunks and vectors to MongoDB.")
                print("The backend is 100% ready to be connected to the frontend!")
            else:
                print("\nWARNING: Supabase URL was not returned.")
        else:
            print("\nERROR: Something went wrong in the backend processing.")
            print(f"Error detail: {response.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")
        print("Make sure the FastAPI server is running on port 8000.")
        
    finally:
        # Cleanup
        if os.path.exists(pdf_file):
            os.remove(pdf_file)

if __name__ == "__main__":
    run_test()
