import os
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("HF_TOKEN")
if not token:
    print("No token")
else:
    client = InferenceClient(token=token)
    try:
        response = client.feature_extraction("hello", model="sentence-transformers/all-MiniLM-L6-v2")
        print("Type:", type(response))
        if hasattr(response, "shape"):
            print("Shape:", response.shape)
        if isinstance(response, list):
            print("List len:", len(response))
            if len(response) > 0:
                print("First element type:", type(response[0]))
    except Exception as e:
        print("Error:", e)
