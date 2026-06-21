from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import subprocess
import os
import json
import sys
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

app = FastAPI(title="Scrapy Movie Search UI Backend")

# Track the active crawler process
crawl_process = None
current_movie_name = None

class SearchRequest(BaseModel):
    movie_name: str
    source: str = "all"

@app.post("/api/search")
async def start_search(req: SearchRequest):
    global crawl_process, current_movie_name
    
    # Check if a crawl is already running
    if crawl_process is not None and crawl_process.poll() is None:
        raise HTTPException(status_code=400, detail="A search is already in progress.")
        
    movie_name = req.movie_name.strip()
    if not movie_name:
        raise HTTPException(status_code=400, detail="Movie name cannot be empty.")
        
    # Clear result file if it exists, so old results aren't shown
    if os.path.exists("result.json"):
        try:
            os.remove("result.json")
        except Exception:
            pass
            
    # Clear debug log file if it exists
    if os.path.exists("debug.log"):
        try:
            os.remove("debug.log")
        except Exception:
            pass
            
    # Start the scraper in a subprocess using the current Python environment
    try:
        current_movie_name = movie_name
        source = req.source.strip().lower()
        if source not in ("all", "moviesda", "isaidub"):
            source = "all"
        # Use sys.executable to run main.py inside the correct virtual environment
        crawl_process = subprocess.Popen([sys.executable, "main.py", movie_name, source])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start search process: {str(e)}")
        
    return {"status": "started", "movie_name": movie_name}

@app.get("/api/status")
async def get_status():
    global crawl_process, current_movie_name
    
    if crawl_process is None:
        return {"status": "idle", "movie_name": None}
        
    exit_code = crawl_process.poll()
    if exit_code is None:
        return {"status": "running", "movie_name": current_movie_name}
    elif exit_code == 0:
        return {"status": "completed", "movie_name": current_movie_name}
    else:
        return {"status": "failed", "exit_code": exit_code, "movie_name": current_movie_name}

@app.get("/api/results")
async def get_results():
    if not os.path.exists("result.json"):
        return JSONResponse(content=[])
        
    try:
        with open("result.json", "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return JSONResponse(content=[])
            data = json.loads(content)
            return JSONResponse(content=data)
    except json.JSONDecodeError:
        # If the file is still being written or is incomplete, return empty list or partial list
        return JSONResponse(content=[])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading results: {str(e)}")

@app.get("/api/logs")
async def get_logs():
    if not os.path.exists("debug.log"):
        return {"logs": "Logs not available yet..."}
        
    try:
        with open("debug.log", "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            # Return last 80 lines of logs
            last_lines = lines[-80:]
            return {"logs": "".join(last_lines)}
    except Exception as e:
        return {"logs": f"Error reading logs: {str(e)}"}

# Serve Frontend static assets
@app.get("/")
async def serve_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    raise HTTPException(status_code=404, detail="index.html not found")

@app.get("/index.css")
async def serve_css():
    if os.path.exists("index.css"):
        return FileResponse("index.css")
    raise HTTPException(status_code=404, detail="index.css not found")

@app.get("/index.js")
async def serve_js():
    if os.path.exists("index.js"):
        return FileResponse("index.js")
    raise HTTPException(status_code=404, detail="index.js not found")
