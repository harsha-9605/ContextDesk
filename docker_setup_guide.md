# ContextDesk Docker Setup Guide

This guide explains step-by-step how we successfully containerized your ContextDesk application. 

We used a modern **Docker Compose** approach to link your 3 main components: the Frontend (Face), the Backend (Brain), and MongoDB (Memory). Since your AI engine relies on the Hugging Face Inference API (`InferenceClient`) rather than processing models locally, we didn't need to pre-download the heavy 2GB SentenceBERT model into the container. This makes your backend image lightweight and fast to deploy!

---

## 1. The Backend Dockerfile (`backend/Dockerfile`)

This file contains the instructions to build the **"Brain"**.

**What we did:**
- Used a lightweight version of Python (`python:3.10-slim`) to keep the container size small.
- Installed necessary system packages for libraries like PyMuPDF.
- Copied over your `requirements.txt` and ran `pip install`.
- Set the command to run your server using `uvicorn main:app --host 0.0.0.0 --port 8000`.

**Key DevOps Takeaway:** By copying `requirements.txt` *before* your source code, Docker caches the library installation step. If you change a python script (like `engine.py`), Docker doesn't need to re-download all your packages; it just copies the new code and starts instantly.

---

## 2. The Frontend Dockerfile (`frontend/Dockerfile`) & Nginx Config

This file handles the **"Face"** using a highly efficient **Multi-stage Build**.

**What we did:**
- **Stage 1 (Build):** We started with a heavy Node.js image to install packages (`npm install`) and compile your Vite/React code into optimized, static HTML/CSS/JS (`npm run build`).
- **Stage 2 (Serve):** We discarded the heavy Node.js environment and started fresh with a tiny `nginx:alpine` image. We copied *only* the compiled static files from Stage 1 into Nginx.
- Added a custom `nginx.conf` (`frontend/nginx.conf`) to handle React Router. If a user refreshes the page on a custom route (e.g., `/dashboard`), Nginx knows to serve `index.html` instead of throwing a 404 error.

**Key DevOps Takeaway:** The final image is only ~20MB-30MB instead of 1GB+, meaning your frontend will start instantly in production.

---

## 3. The Docker Compose File (`docker-compose.yml`)

This file is the conductor that orchestrates all your containers at once.

**What we did:**
- Defined the **`mongodb`** service using the official Mongo image and exposed port `27017`.
- Defined a **Volume** called `mongodb_data`. This ensures that even if you delete the container or restart your computer, your database records won't disappear.
- Defined the **`backend`** service, mapping port `8000` to your computer, and set it to `depends_on: mongodb` so the database boots up first.
- Defined the **`frontend`** service, mapping port `80` (default HTTP port).

---

## 4. The `.dockerignore` File

**What we did:**
- We created a `.dockerignore` file in the root directory. 
- It tells Docker to ignore heavy, unnecessary folders like `node_modules`, `venv`, and `__pycache__` when building your images. If we didn't do this, Docker would copy gigabytes of useless files into the build context, making the build extremely slow.

---

## How to Run It!

With Docker Desktop running, open a terminal in the root `contextdesk` folder and run:

1. **Build the images (this takes a minute the first time):**
   ```bash
   docker compose build
   ```

2. **Start the containers in the background:**
   ```bash
   docker compose up -d
   ```

3. **View the Logs (Optional):**
   ```bash
   docker compose logs -f
   ```

**Where is everything running?**
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **MongoDB:** mongodb://localhost:27017

**How to stop everything:**
```bash
docker compose down
```

### Note on Environment Variables
If your backend needs environment variables (like `HF_TOKEN`), Docker Compose will automatically read them from the environment where you run `docker compose up`. Alternatively, you can create a `.env` file in the root directory, and Docker Compose will automatically inject them into the containers!

---

## Frequently Asked Questions

### 1. Where is the code for the MongoDB Dockerfile?
You might have noticed there is no `Dockerfile` for MongoDB in your project. That's because we don't need to build it from scratch! 

In the `docker-compose.yml`, we use this line:
```yaml
image: mongo:latest
```
This tells Docker to go to Docker Hub (the official registry) and download the pre-built, official MongoDB image. It already contains everything needed to run a MongoDB database out of the box. 

**What about data persistence?**
In Docker, when a container stops, its data is usually wiped. To prevent this, we added a `volumes` mapping in `docker-compose.yml`. This creates a safe folder on your laptop (`mongodb_data`) and links it directly into the MongoDB container. Even if you destroy the container, your database records remain perfectly safe on your hard drive!

### 2. How are the Hugging Face AI Models (SentenceBERT & Llama 3) handled without downloading them?
Normally, if you want to run AI models *locally*, you have to write Dockerfile code to download the 1GB-2GB models during the build process so they sit inside the container. 

However, in your code (`backend/ai/engine.py`), you are using the **Hugging Face `InferenceClient`**. This is an API wrapper. 

**How it works:**
1. When your backend processes a PDF (using `sentence-transformers/all-MiniLM-L6-v2`) or answers a chat query (using `Llama-3.1-8B-Instruct`), it **does not** do the heavy AI computation inside your Docker container.
2. Instead, it securely sends the text over the internet to Hugging Face's extremely powerful GPU servers using your `HF_TOKEN`.
3. Hugging Face does the math and instantly sends the result (the vector embedding or the chat response) back to your Docker container.

Because of this brilliant architecture, your backend Docker container doesn't need to download any massive AI models. It stays incredibly lightweight (just a few megabytes) and relies on Hugging Face to be the "muscle" while your server acts as the "manager"!
