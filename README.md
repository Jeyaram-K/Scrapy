# CineScraper - Premium Movie Finder & Real-Time Scraper

CineScraper is a modern web application and Scrapy-based crawling engine that searches, crawls, and extracts high-speed movie download links and metadata across target websites (Moviesda and Isaidub). 

It features a lightweight **FastAPI** backend and a stunning, responsive **glassmorphic Web User Interface** featuring real-time terminal logs, source categories selection, and dynamic resolution filtering.

---

## 🎨 UI Showcase

![CineScraper Web User Interface](C:/Users/Jeyaram/.gemini/antigravity-ide/brain/2e7c12e4-e35c-44ed-8436-02b570e5049e/.tempmediaStorage/media_2e7c12e4-e35c-44ed-8436-02b570e5049e_1782046537862.png)

---

## 🚀 Key Features

- **Stunning Web UI**: Designed with rich aesthetics (dark mode, glassmorphism, responsive cards, neon gradients, and custom scrollbars).
- **Live Terminal Logs**: Integrates a live, scrollable Scrapy console/terminal viewer directly in the browser to monitor crawling in real time.
- **Source Selection**: Choose search scope (e.g. *Tamil Movies Only*, *Tamil Dubbed Only*, or *All Sources*) before initiating a crawl to save time and system resources.
- **Dynamic Resolution Badges**: Automatically detects and groups scraped resolutions (supporting both standard notations like `1080p` and dimensions like `640x360` mapped to standard p-badges). Clickable badges filter mirror links instantly.
- **Unified Movie Cards**: Groups duplicate crawl links under single movie cards, showing a clean layout of all details (poster, rating, director, cast, synopsis) and individual mirror server buttons.
- **Environmental Configuration**: Supports `.env` loading to easily configure target domain URLs (`MOVIESDA_URL`, `ISAIDUB_URL`) without modifying spider code.
- **Multi-domain Scrapy Engine**: Traverses deep subfolder structures, quality settings, and follows HTTP redirects (301/302) to uncover final `.mp4` server paths.

---

## ⚙️ System Architecture

```mermaid
graph TD
    UI[Web Frontend (HTML, CSS, JS)] -- POST /api/search --> FastAPI[FastAPI Server]
    FastAPI -- Popen Subprocess --> Scrapy[Scrapy Crawler]
    Scrapy -- Crawl requests --> Targets[Target Sites (.env)]
    Scrapy -- Write stdout/stderr --> LogFile[debug.log]
    Scrapy -- Write results --> ResultsFile[result.json]
    UI -- GET /api/logs (Interval) --> FastAPI
    FastAPI -- Read logs --> LogFile
    UI -- GET /api/results (Polling) --> FastAPI
    FastAPI -- Read results --> ResultsFile
```

---

## 🔍 How Under-The-Hood Logic Works

### 1. Dynamic Resolution Parsing & Badges
Target websites often represent resolutions in folder structures using standard labels (e.g. `1080p`) or dimension formats (e.g. `640x360`, `480x320`). CineScraper handles this automatically via the frontend helper function `extractResolution`:
- Matches standard `\d+p` first (e.g., `720p` -> `720p`).
- Matches the width x height pattern (e.g., `640x360` -> extracts vertical height `360` -> `360p`).
- Matches other configurations to an `Other` badge.
Clicking these dynamically-generated resolution badges filters mirror download links instantly in the browser.

### 2. Optimized Source Selection
To prevent timeouts, long queues, and resource wastage:
- **All Sources**: Crawls both Tamil Movies and Tamil Dubbed movies.
- **Tamil Movies Only**: Crawls `MOVIESDA_URL` (usually Moviesda target).
- **Tamil Dubbed Only**: Crawls `ISAIDUB_URL` (usually Isaidub target).

### 3. Unified Movie Grouping
CineScraper extracts metadata including the cover image/poster URL, director, starring cast, genres, language, movie rating, and synopsis. It automatically groups duplicate crawl results for the same movie under a single visually rich unified card displaying all mirrors, rather than listing separate records.

---

## 📋 Requirements

- **Python 3.14+**
- **uv** (Fast Python package installer and manager)

---

## 🛠️ Installation & Setup

1. Clone or download the repository into your workspace.
2. Install the dependencies using `uv`:
   ```bash
   uv add scrapy fastapi uvicorn python-dotenv
   ```
   *(Or let `uv` automatically handle virtual environments via `uv run`.)*

3. Configure target domains by creating a `.env` file in the root directory (already added to `.gitignore`):
   ```env
   MOVIESDA_URL=https://moviesda32.com/
   ISAIDUB_URL=https://isaidub.guru/
   ```

---

## 🚦 Usage Guide

### 1. Run the Web Interface (Recommended)
Start the FastAPI server:
```bash
uv run uvicorn app:app --port 8000
```
Open your browser and navigate to:
👉 **[http://localhost:8000/](http://localhost:8000/)**

Enter a movie name (e.g. `"29 (2026)"` or `"Nanban"`), select your target category, and hit **Initiate Crawl**.

### 2. Run via Command Line (CLI)
You can run the Scrapy spider directly from the terminal. Pass the movie name and optionally the source type (`all`, `moviesda`, `isaidub`):
```bash
uv run main.py "Movie Name" [source_type]
```

**Example:**
```bash
uv run main.py "Nanban" moviesda
```
The CLI saves crawl results directly to [result.json](file:///c:/Users/Jeyaram/Documents/Scrapy/result.json) and details execution warnings to [debug.log](file:///c:/Users/Jeyaram/Documents/Scrapy/debug.log).

---

## ☁️ Deployment to Render.com

You can host CineScraper on Render as a **Web Service**. There are two options:

### Option A: Docker Deployment (Recommended)
This is the most reliable method, as it automatically builds the environment using the provided [Dockerfile](file:///c:/Users/Jeyaram/Documents/Scrapy/Dockerfile) and compiles Scrapy's binary dependencies (like Twisted) inside a Linux container.

1. Connect your GitHub repository containing this project to Render.
2. Click **New +** -> **Web Service**.
3. Select your repository.
4. Render will automatically detect the [Dockerfile](file:///c:/Users/Jeyaram/Documents/Scrapy/Dockerfile) and configure the service environment to **Docker**.
5. In the **Environment Variables** section, add your custom parameters:
   - `MOVIESDA_URL` (e.g., `https://moviesda32.com/`)
   - `ISAIDUB_URL` (e.g., `https://isaidub.love/`)
6. Choose the **Free** instance type and click **Deploy Web Service**.

### Option B: Native Python Deployment (Alternative)
If you prefer to run it using Render's native Python runtime:

1. Click **New +** -> **Web Service** and select your repository.
2. Set the runtime environment to **Python**.
3. Configure the following parameters:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Add the environment variables `MOVIESDA_URL` and `ISAIDUB_URL` in the environment settings.
5. Deploy!

> [!NOTE]
> Render's Free tier spins down web services after 15 minutes of inactivity. When a new request arrives, the server may take a few seconds to spin back up.

