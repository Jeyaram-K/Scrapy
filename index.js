document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchSubmitBtn = document.getElementById('search-submit-btn');
    const btnLoader = document.getElementById('btn-loader');
    
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    const consoleSection = document.getElementById('console-section');
    const consoleBody = document.getElementById('console-body');
    const consoleLogPre = document.getElementById('console-log-pre');
    const toggleConsoleBtn = document.getElementById('toggle-console-btn');
    
    const resultsSection = document.getElementById('results-section');
    const resultsHeader = document.getElementById('results-header');
    const resultsCount = document.getElementById('results-count');
    const resultsGrid = document.getElementById('results-grid');
    const emptyState = document.getElementById('empty-state');
    const shimmerLoading = document.getElementById('shimmer-loading');
    const sourceSelect = document.getElementById('source-select');
    
    const filterContainer = document.getElementById('filter-container');
    const resolutionFilters = document.getElementById('resolution-filters');

    let pollInterval = null;
    let currentResultsData = [];
    let activeFilter = 'All';

    // Toggle Console display height/collapsing
    toggleConsoleBtn.addEventListener('click', () => {
        if (consoleBody.classList.contains('collapsed')) {
            consoleBody.classList.remove('collapsed');
            consoleBody.style.display = 'block';
            toggleConsoleBtn.textContent = 'Collapse';
        } else {
            consoleBody.classList.add('collapsed');
            consoleBody.style.display = 'none';
            toggleConsoleBtn.textContent = 'Expand';
        }
    });

    // Check system status on page load
    checkCurrentStatus();

    async function checkCurrentStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            updateStatusUI(data.status, data.movie_name);
            
            if (data.status === 'running') {
                // Resume polling if a crawl is already running in background
                startPolling();
                consoleSection.classList.remove('hidden');
                emptyState.classList.add('hidden');
                shimmerLoading.classList.remove('hidden');
            } else if (data.status === 'completed') {
                fetchResults();
            }
        } catch (err) {
            console.error('Failed to get status:', err);
        }
    }

    // Submit search to start scraping
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        const source = sourceSelect.value;

        // Reset UI state
        resultsGrid.innerHTML = '';
        resultsHeader.classList.add('hidden');
        emptyState.classList.add('hidden');
        shimmerLoading.classList.remove('hidden');
        consoleLogPre.textContent = 'Connecting to Scrapy process...\n';
        consoleSection.classList.remove('hidden');
        
        // Disable search controls
        searchSubmitBtn.disabled = true;
        sourceSelect.disabled = true;
        btnLoader.classList.remove('hidden');
        
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movie_name: query, source: source })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to start crawl.');
            }

            updateStatusUI('running', query);
            startPolling();
        } catch (err) {
            consoleLogPre.textContent += `[ERROR] ${err.message}\n`;
            updateStatusUI('failed');
            stopPolling();
            searchSubmitBtn.disabled = false;
            sourceSelect.disabled = false;
            btnLoader.classList.add('hidden');
            shimmerLoading.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
    });

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        
        // Poll status and logs every 1 second
        pollInterval = setInterval(async () => {
            try {
                // Poll status
                const statusRes = await fetch('/api/status');
                const statusData = await statusRes.json();
                
                // Poll logs
                const logsRes = await fetch('/api/logs');
                const logsData = await logsRes.json();
                
                // Update log viewer
                if (logsData.logs) {
                    consoleLogPre.textContent = logsData.logs;
                    // Auto-scroll logs terminal
                    consoleBody.scrollTop = consoleBody.scrollHeight;
                }

                updateStatusUI(statusData.status, statusData.movie_name);

                if (statusData.status === 'completed') {
                    stopPolling();
                    fetchResults();
                    resetControls();
                } else if (statusData.status === 'failed') {
                    stopPolling();
                    resetControls();
                    shimmerLoading.classList.add('hidden');
                    consoleLogPre.textContent += `\n[CRITICAL ERROR] The crawl process exited unexpectedly with code ${statusData.exit_code || 'unknown'}.\n`;
                }
            } catch (err) {
                console.error('Error polling crawl state:', err);
            }
        }, 1000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function resetControls() {
        searchSubmitBtn.disabled = false;
        sourceSelect.disabled = false;
        btnLoader.classList.add('hidden');
    }
    function updateStatusUI(status, movieName = '') {
        // Reset classes
        statusDot.className = 'status-dot';
        statusDot.classList.add(`id-${status}`);
        
        if (status === 'running') {
            statusText.textContent = `Crawling: "${movieName}"`;
        } else if (status === 'completed') {
            statusText.textContent = `Completed Crawl: "${movieName}"`;
        } else if (status === 'failed') {
            statusText.textContent = `Crawl Failed: "${movieName}"`;
        } else {
            statusText.textContent = `Ready to Crawl`;
        }
    }

    async function fetchResults() {
        shimmerLoading.classList.remove('hidden');
        try {
            const res = await fetch('/api/results');
            const data = await res.json();
            
            shimmerLoading.classList.add('hidden');
            
            if (!data || data.length === 0) {
                resultsGrid.innerHTML = '';
                resultsHeader.classList.add('hidden');
                filterContainer.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            currentResultsData = data;
            renderFilters(data);
            renderResults(data, activeFilter);
        } catch (err) {
            console.error('Error fetching results:', err);
            shimmerLoading.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
    }

    function extractResolution(folderPath) {
        // Try matching standard \d+p first (e.g., 1080p)
        let match = folderPath.match(/(\d+p)/i);
        if (match) {
            return match[1].toLowerCase();
        }
        
        // Try matching width x height pattern (e.g., 640x360 or 640 x 360)
        match = folderPath.match(/(\d+)\s*[xX]\s*(\d+)/);
        if (match) {
            // The height (second number) represents the vertical resolution (e.g., 360p)
            return `${match[2]}p`;
        }
        
        return 'other';
    }

    function renderFilters(results) {
        // Collect all unique resolutions from results
        const resolutions = new Set();
        results.forEach(item => {
            if (item.folder_path) {
                const res = extractResolution(item.folder_path);
                resolutions.add(res);
            }
        });

        // Hide filter container if there are no resolutions or only 1
        if (resolutions.size <= 1) {
            filterContainer.classList.add('hidden');
            return;
        }

        // Sort resolutions descending (e.g. 1080p, 720p, 360p, other)
        const sortedRes = Array.from(resolutions).sort((a, b) => {
            if (a === 'other') return 1;
            if (b === 'other') return -1;
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numB - numA;
            }
            return a.localeCompare(b);
        });

        // Build filter buttons HTML
        resolutionFilters.innerHTML = '';
        
        // Add "All" badge
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = `filter-badge ${activeFilter === 'All' ? 'active' : ''}`;
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
            activeFilter = 'All';
            updateActiveFilterBadge();
            renderResults(currentResultsData, 'All');
        });
        resolutionFilters.appendChild(allBtn);

        // Add dynamic resolution badges
        sortedRes.forEach(res => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `filter-badge ${activeFilter === res ? 'active' : ''}`;
            // Capitalize resolution tags nicely (e.g., 1080p, Other)
            btn.textContent = res === 'other' ? 'Other' : res.toUpperCase();
            btn.addEventListener('click', () => {
                activeFilter = res;
                updateActiveFilterBadge();
                renderResults(currentResultsData, res);
            });
            resolutionFilters.appendChild(btn);
        });

        filterContainer.classList.remove('hidden');
    }

    function updateActiveFilterBadge() {
        const badges = resolutionFilters.querySelectorAll('.filter-badge');
        badges.forEach(badge => {
            const text = badge.textContent.toLowerCase();
            if (activeFilter === 'All' && text === 'all') {
                badge.classList.add('active');
            } else if (activeFilter === 'other' && text === 'other') {
                badge.classList.add('active');
            } else if (text === activeFilter) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        });
    }

    function renderResults(results, filterVal = 'All') {
        const groupedMovies = {};
        let totalMirrorsCount = 0;

        results.forEach(item => {
            // Apply resolution filter
            const res = extractResolution(item.folder_path || '');
            if (filterVal !== 'All' && res !== filterVal) {
                return;
            }

            const title = item.movie_name || 'Unknown Movie';
            if (!groupedMovies[title]) {
                groupedMovies[title] = {
                    title: title,
                    image_url: item.image_url || '',
                    director: item.director || 'N/A',
                    starring: item.starring || 'N/A',
                    genres: item.genres ? item.genres.split(',').map(g => g.trim()) : [],
                    quality: item.quality || 'N/A',
                    language: item.language || 'N/A',
                    movie_rating: item.movie_rating || 'N/A',
                    last_updated: item.last_updated || 'N/A',
                    synopsis: item.synopsis || 'No synopsis details are available.',
                    mirrors: []
                };
            }
            
            groupedMovies[title].mirrors.push({
                server: item.server || 'Unknown Mirror',
                folder_path: item.folder_path || 'Direct Link',
                mp4_link: item.mp4_link
            });
            totalMirrorsCount++;
        });

        const movieKeys = Object.keys(groupedMovies);
        
        if (movieKeys.length === 0) {
            resultsGrid.innerHTML = '';
            resultsCount.textContent = `0 movies found`;
            // Show empty state inside grid
            resultsGrid.innerHTML = `
                <div class="empty-state" style="margin-top: 20px; max-width: 100%;">
                    <div class="empty-icon">📂</div>
                    <h3>No links match this resolution</h3>
                    <p>Try switching the filter badge back to 'All' or select another resolution.</p>
                </div>
            `;
            return;
        }

        resultsCount.textContent = `${movieKeys.length} movie${movieKeys.length > 1 ? 's' : ''} found (${totalMirrorsCount} download links)`;
        resultsHeader.classList.remove('hidden');
        emptyState.classList.add('hidden');

        resultsGrid.innerHTML = '';
        
        movieKeys.forEach(key => {
            const movie = groupedMovies[key];
            const card = document.createElement('div');
            card.className = 'movie-card';

            const genreTags = movie.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
            
            // Build mirrors list
            const mirrorsListHtml = movie.mirrors.map(m => `
                <div class="mirror-link-row">
                    <div class="mirror-info">
                        <span class="mirror-server">${m.server}</span>
                        <span class="mirror-path">${m.folder_path}</span>
                    </div>
                    <a href="${m.mp4_link}" class="btn btn-download" target="_blank" rel="noopener noreferrer">
                        Download Stream
                    </a>
                </div>
            `).join('');

            // Fallback for image loading error
            const posterHtml = movie.image_url 
                ? `<img src="${movie.image_url}" class="movie-poster" alt="${movie.title} Poster" onerror="this.src='https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&q=80&w=400';">`
                : `<div class="movie-poster-placeholder" style="display:flex;align-items:center;justify-content:center;height:100%;background:rgba(255,255,255,0.02);color:var(--text-muted);font-size:40px;">🎬</div>`;

            card.innerHTML = `
                <div class="movie-poster-wrapper">
                    ${posterHtml}
                    ${movie.movie_rating !== 'N/A' ? `<span class="movie-rating-badge">★ ${movie.movie_rating}</span>` : ''}
                </div>
                <div class="movie-details-content">
                    <div class="movie-title-area">
                        <h3 class="movie-title">${movie.title}</h3>
                        <div class="movie-genres-row">
                            ${genreTags}
                        </div>
                    </div>
                    
                    <div class="movie-specs">
                        <div class="spec-item">
                            <span class="spec-label">Director</span>
                            <span class="spec-value" title="${movie.director}">${movie.director}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Language</span>
                            <span class="spec-value">${movie.language}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Updated</span>
                            <span class="spec-value">${movie.last_updated}</span>
                        </div>
                    </div>

                    <div class="spec-item">
                        <span class="spec-label">Starring</span>
                        <span class="spec-value" title="${movie.starring}" style="white-space:normal;text-overflow:unset;">${movie.starring}</span>
                    </div>
                    
                    <div class="movie-synopsis-area">
                        <span class="synopsis-title">Synopsis</span>
                        <p class="synopsis-text">${movie.synopsis}</p>
                    </div>

                    <div class="mirrors-area">
                        <h4 class="mirrors-title">High Speed Mirrors</h4>
                        <div class="mirrors-list">
                            ${mirrorsListHtml}
                        </div>
                    </div>
                </div>
            `;
            resultsGrid.appendChild(card);
        });
    }
});


