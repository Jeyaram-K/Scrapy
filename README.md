# Movie Script Scraper

A web scraper built with Python and [Scrapy](https://scrapy.org/) that searches for and extracts movie download links and metadata from multiple sources, specifically `moviesda17.com` and `isaidub.love`.

## Features
- **Multi-domain search**: Concurrently searches across multiple target websites for a specific movie title.
- **Deep folder traversal**: Automatically navigates through website categories, quality options, and resolution folders to find the actual download pages.
- **Redirect resolution**: Handles 301/302 HTTP redirects to uncover the final `.mp4` download links. 
- **Metadata Extraction**: Gathers detailed movie metadata including:
  - Director
  - Starring actors
  - Genres
  - Quality and Resolution
  - Language
  - Movie Rating
  - Synopsis
  - Poster Image URL
- **JSON Output**: Exports all findings, metadata, and direct download links to a structured `result.json` file.

## Requirements
- Python 3.14+ (or compatible version)
- [uv](https://github.com/astral-sh/uv) (Package manager)
- Scrapy

## Installation

1. Make sure you have `uv` installed.
2. Install the project dependencies (Scrapy):
```bash
uv pip install scrapy
```
*(Note: If you are using a virtual environment, ensure it is activated before installing.)*

## Usage

To run the scraper and search for a specific movie, simply run `main.py` and pass the movie name as an argument.

```bash
python main.py "Movie Name"
```

### Example

```bash
python main.py "Nanban"
```

### Output
The scraper will compile all found download links and metadata and save them to `result.json` in the same directory. The script uses Scrapy's logging, which is configured to write debug information to `debug.log`.
