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
    
    let pollInterval = null;
    let currentResultsData = [];

    // Video Player Modal
    const videoModal = document.getElementById('video-modal');
    const videoModalBackdrop = document.getElementById('video-modal-backdrop');
    const videoModalClose = document.getElementById('video-modal-close');
    const videoModalTitle = document.getElementById('video-modal-title');
    const videoPlayer = document.getElementById('video-player');
    const videoCopyBtn = document.getElementById('video-copy-btn');
    const videoDownloadBtn = document.getElementById('video-download-btn');

    window.openVideoModal = function(mp4Link, title) {
        videoPlayer.src = mp4Link;
        videoPlayer.load();
        videoModalTitle.textContent = title || 'Now Playing';
        videoDownloadBtn.href = mp4Link;
        videoCopyBtn.onclick = () => {
            navigator.clipboard.writeText(mp4Link);
            const oldHTML = videoCopyBtn.innerHTML;
            videoCopyBtn.innerHTML = '<span class="btn-icon-text">✅</span> Copied!';
            videoCopyBtn.classList.add('copied');
            setTimeout(() => {
                videoCopyBtn.innerHTML = oldHTML;
                videoCopyBtn.classList.remove('copied');
            }, 2000);
        };
        videoModal.classList.remove('hidden');
        videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        videoPlayer.play().catch(() => {});
    };

    function closeVideoModal() {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        videoModal.classList.remove('active');
        videoModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    videoModalClose.addEventListener('click', closeVideoModal);
    videoModalBackdrop.addEventListener('click', closeVideoModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && videoModal.classList.contains('active')) {
            closeVideoModal();
        }
    });


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
                emptyState.classList.remove('hidden');
                return;
            }

            currentResultsData = data;
            renderResults(data);
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

    function renderResults(results) {
        const groupedMovies = {};
        let totalMirrorsCount = 0;

        results.forEach(item => {
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
            resultsGrid.innerHTML = `
                <div class="empty-state" style="margin-top: 20px; max-width: 100%;">
                    <div class="empty-icon">📂</div>
                    <h3>No crawl records to show</h3>
                    <p>Type a movie title in the search box above to initiate a real-time Scrapy crawl across high-speed servers.</p>
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
            
            // Collect unique resolutions for this movie
            const resolutions = new Set();
            movie.mirrors.forEach(m => {
                if (m.folder_path) {
                    const r = extractResolution(m.folder_path);
                    resolutions.add(r);
                }
            });

            // Sort resolutions descending
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

            let cardActiveFilter = 'All';

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

                    <!-- Dynamic Resolution Filters in Card -->
                    <div class="filter-container ${resolutions.size <= 1 ? 'hidden' : ''}" style="margin: 0; padding: 10px 14px; border-radius: var(--radius-sm);">
                        <span class="filter-label">Resolution:</span>
                        <div class="filter-badges card-filters-container"></div>
                    </div>

                    <div class="mirrors-area">
                        <h4 class="mirrors-title">High Speed Mirrors</h4>
                        <div class="mirrors-list"></div>
                    </div>
                </div>
            `;
            
            resultsGrid.appendChild(card);

            const cardFiltersContainer = card.querySelector('.card-filters-container');
            const mirrorsListContainer = card.querySelector('.mirrors-list');

            // Render mirrors helper
            function updateMirrors(activeRes) {
                const filteredMirrors = movie.mirrors.filter(m => {
                    if (activeRes === 'All') return true;
                    return extractResolution(m.folder_path || '') === activeRes;
                });
                
                const groupedByEpisode = {};
                filteredMirrors.forEach(m => {
                    const mp4 = m.mp4_link || '';
                    const epMatch = mp4.match(/Epi[_-]?(\d+)/i);
                    const episode = epMatch ? `Ep ${epMatch[1].padStart(2, '0')}` : 'Other';
                    if (!groupedByEpisode[episode]) {
                        groupedByEpisode[episode] = [];
                    }
                    groupedByEpisode[episode].push(m);
                });
                
                const sortedEpisodes = Object.keys(groupedByEpisode).sort((a, b) => {
                    const numA = a.match(/\d+/);
                    const numB = b.match(/\d+/);
                    if (numA && numB) return parseInt(numA[0]) - parseInt(numB[0]);
                    return a.localeCompare(b);
                });
                
                let html = '';
                sortedEpisodes.forEach(episode => {
                    const mirrors = groupedByEpisode[episode];
                    html += `
                        <div class="server-group">
                            <div class="server-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
                                <span class="server-group-name">${episode}</span>
                                <span class="server-group-count">${mirrors.length} mirror${mirrors.length > 1 ? 's' : ''}</span>
                                <span class="server-group-toggle">▾</span>
                            </div>
                            <div class="server-group-mirrors">
                                ${mirrors.map(m => `
                                    <div class="mirror-link-row">
                                        <div class="mirror-info">
                                            <span class="mirror-server">${m.server}</span>
                                        </div>
                                        <div class="mirror-actions">
                                            <button class="btn btn-play" onclick="openVideoModal('${m.mp4_link}', '${episode} - ${m.server}')" title="Play Stream">
                                                ▶
                                            </button>
                                            <button class="btn btn-copy" onclick="navigator.clipboard.writeText('${m.mp4_link}'); const oldHTML = this.innerHTML; this.innerHTML = '✅'; this.classList.add('copied'); setTimeout(() => { this.innerHTML = oldHTML; this.classList.remove('copied'); }, 2000);" title="Copy Stream Link">
                                                📋
                                            </button>
                                            <a href="${m.mp4_link}" class="btn btn-download" target="_blank" rel="noopener noreferrer" title="Download Stream">
                                                📥
                                            </a>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });
                
                mirrorsListContainer.innerHTML = html;
            }

            // Populate filter badges if more than 1 resolution is available
            if (resolutions.size > 1) {
                const createBadge = (val, label) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `filter-badge ${cardActiveFilter === val ? 'active' : ''}`;
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        cardActiveFilter = val;
                        cardFiltersContainer.querySelectorAll('.filter-badge').forEach(b => {
                            b.classList.toggle('active', b.dataset.val === val);
                        });
                        updateMirrors(val);
                    });
                    btn.dataset.val = val;
                    return btn;
                };

                cardFiltersContainer.appendChild(createBadge('All', 'All'));
                sortedRes.forEach(r => {
                    cardFiltersContainer.appendChild(createBadge(r, r === 'other' ? 'Other' : r.toUpperCase()));
                });
            }

            // Initial mirrors render
            updateMirrors('All');
        });
    }
});


