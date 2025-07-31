// YouTube Downloader JavaScript

let progressInterval;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load downloads list on page load
    refreshDownloads();
    
    // Add form validation
    setupFormValidation();
    
    // Setup progress monitoring
    setupProgressMonitoring();
});

// Setup form validation
function setupFormValidation() {
    const videoForm = document.getElementById('videoForm');
    const audioForm = document.getElementById('audioForm');
    
    videoForm.addEventListener('submit', function(e) {
        const url = document.getElementById('videoUrl').value.trim();
        if (!isValidYouTubeUrl(url)) {
            e.preventDefault();
            showAlert('Please enter a valid YouTube URL', 'error');
            return false;
        }
        showProgressSection();
    });
    
    audioForm.addEventListener('submit', function(e) {
        const url = document.getElementById('audioUrl').value.trim();
        if (!isValidYouTubeUrl(url)) {
            e.preventDefault();
            showAlert('Please enter a valid YouTube URL', 'error');
            return false;
        }
        showProgressSection();
    });
}

// Validate YouTube URL
function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
    return youtubeRegex.test(url);
}

// Show alert message
function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container');
    const firstRow = container.querySelector('.row');
    container.insertBefore(alertDiv, firstRow.nextSibling);
}

// Show progress section
function showProgressSection() {
    const progressSection = document.getElementById('progressSection');
    progressSection.style.display = 'block';
    
    // Reset progress
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressInfo.textContent = 'Preparing download...';
    
    // Start monitoring progress
    startProgressMonitoring();
}

// Setup progress monitoring
function setupProgressMonitoring() {
    // This would typically connect to a WebSocket or polling endpoint
    // For now, we'll simulate progress updates
}

// Start progress monitoring
function startProgressMonitoring() {
    let progress = 0;
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    
    progressInterval = setInterval(() => {
        // Fetch actual progress from server
        fetch('/progress')
            .then(response => response.json())
            .then(data => {
                // Update progress based on server response
                const latestProgress = Object.values(data)[0];
                if (latestProgress) {
                    const percentage = Math.round(latestProgress.percentage || 0);
                    progressBar.style.width = percentage + '%';
                    progressBar.textContent = percentage + '%';
                    
                    if (latestProgress.status === 'downloading') {
                        const speed = formatSpeed(latestProgress.speed || 0);
                        const eta = latestProgress.eta ? formatTime(latestProgress.eta) : 'Unknown';
                        progressInfo.textContent = `Downloading... Speed: ${speed}, ETA: ${eta}`;
                    } else if (latestProgress.status === 'finished') {
                        progressInfo.textContent = 'Download completed!';
                        progressBar.classList.remove('progress-bar-animated');
                        progressBar.classList.add('bg-success');
                        
                        // Stop monitoring and refresh downloads
                        setTimeout(() => {
                            stopProgressMonitoring();
                            refreshDownloads();
                        }, 2000);
                    }
                } else {
                    // Simulate progress for better UX
                    progress += Math.random() * 10;
                    if (progress > 90) progress = 90;
                    
                    progressBar.style.width = Math.round(progress) + '%';
                    progressBar.textContent = Math.round(progress) + '%';
                    progressInfo.textContent = 'Processing...';
                }
            })
            .catch(error => {
                console.error('Progress fetch error:', error);
            });
    }, 1000);
    
    // Auto-stop after 5 minutes
    setTimeout(() => {
        stopProgressMonitoring();
    }, 300000);
}

// Stop progress monitoring
function stopProgressMonitoring() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // Hide progress section after a delay
    setTimeout(() => {
        const progressSection = document.getElementById('progressSection');
        progressSection.style.display = 'none';
    }, 3000);
}

// Format download speed
function formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Format time (seconds to mm:ss)
function formatTime(seconds) {
    if (!seconds || seconds < 0) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Refresh downloads list
function refreshDownloads() {
    const downloadsList = document.getElementById('downloadsList');
    
    // Show loading state
    downloadsList.innerHTML = `
        <div class="text-center p-4">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted">Loading downloads...</p>
        </div>
    `;
    
    fetch('/list_downloads')
        .then(response => response.json())
        .then(files => {
            if (files.length === 0) {
                downloadsList.innerHTML = `
                    <div class="empty-state text-center p-4">
                        <div class="empty-icon">
                            <i class="fas fa-cloud-download-alt fa-3x text-muted mb-3"></i>
                        </div>
                        <h6 class="text-muted mb-2">No downloads yet</h6>
                        <p class="text-muted small">Start by downloading a video or audio file above</p>
                    </div>
                `;
            } else {
                // Sort files by size (largest first - typically newest and highest quality)
                files.sort((a, b) => b.size - a.size);
                
                downloadsList.innerHTML = files.slice(0, 5).map(file => {
                    const fileName = escapeHtml(file.name);
                    const isVideo = fileName.includes('.mp4') || fileName.includes('.webm') || fileName.includes('.mkv');
                    const isAudio = fileName.includes('.mp3') || fileName.includes('.m4a');
                    const quality = extractQuality(fileName);
                    const fileExt = fileName.split('.').pop().toUpperCase();
                    
                    return `
                        <div class="download-item d-flex align-items-center">
                            <div class="file-info">
                                <div class="file-name">${truncateFileName(fileName)}</div>
                                <div class="file-meta">
                                    <span class="file-size">${formatFileSize(file.size)}</span>
                                    <span class="file-type">${fileExt}</span>
                                    ${quality ? `<span class="file-quality">${quality}</span>` : ''}
                                </div>
                            </div>
                            <div class="ms-3">
                                <a href="/download_file/${encodeURIComponent(file.name)}" 
                                   class="btn download-btn">
                                    <i class="fas fa-download me-2"></i>Download
                                </a>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Add "Show More" button if there are more files
                if (files.length > 5) {
                    downloadsList.innerHTML += `
                        <div class="text-center p-3 border-top" style="border-color: rgba(255,255,255,0.1) !important;">
                            <button class="btn btn-outline-secondary btn-sm" onclick="showAllDownloads()">
                                <i class="fas fa-chevron-down me-1"></i>Show ${files.length - 5} More Files
                            </button>
                        </div>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error loading downloads:', error);
            downloadsList.innerHTML = `
                <div class="text-center text-danger p-4">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <h6 class="text-danger mb-2">Error loading downloads</h6>
                    <p class="text-muted small mb-3">Please try again</p>
                    <button class="btn btn-outline-secondary btn-sm" onclick="refreshDownloads()">
                        <i class="fas fa-sync-alt me-1"></i>Retry
                    </button>
                </div>
            `;
        });
}

// Extract quality from filename
function extractQuality(fileName) {
    if (fileName.includes('4K') || fileName.includes('2160')) return '4K';
    if (fileName.includes('1080')) return '1080p';
    if (fileName.includes('720')) return '720p';
    if (fileName.includes('480')) return '480p';
    if (fileName.includes('360')) return '360p';
    return null;
}

// Truncate long file names
function truncateFileName(fileName) {
    if (fileName.length <= 50) return fileName;
    const ext = fileName.split('.').pop();
    const name = fileName.replace(`.${ext}`, '');
    return name.substring(0, 45) + '...' + ext;
}

// Clear all downloads
function clearDownloads() {
    if (confirm('Are you sure you want to clear all downloaded files? This action cannot be undone.')) {
        fetch('/clear_downloads', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                refreshDownloads();
            } else {
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error clearing downloads:', error);
            showAlert('Error clearing downloads', 'error');
        });
    }
}

// Delete individual file
function deleteFile(filename) {
    if (confirm('Are you sure you want to delete this file?')) {
        fetch(`/delete_file/${encodeURIComponent(filename)}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                refreshDownloads();
            } else {
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            showAlert('Error deleting file', 'error');
        });
    }
}

// Show all downloads
function showAllDownloads() {
    fetch('/list_downloads')
        .then(response => response.json())
        .then(files => {
            const downloadsList = document.getElementById('downloadsList');
            files.sort((a, b) => b.size - a.size);
            
            downloadsList.innerHTML = files.map(file => {
                const fileName = escapeHtml(file.name);
                const quality = extractQuality(fileName);
                const fileExt = fileName.split('.').pop().toUpperCase();
                
                return `
                    <div class="download-item d-flex align-items-center">
                        <div class="file-info">
                            <div class="file-name">${truncateFileName(fileName)}</div>
                            <div class="file-meta">
                                <span class="file-size">${formatFileSize(file.size)}</span>
                                <span class="file-type">${fileExt}</span>
                                ${quality ? `<span class="file-quality">${quality}</span>` : ''}
                            </div>
                        </div>
                        <div class="ms-3">
                            <a href="/download_file/${encodeURIComponent(file.name)}" 
                               class="btn download-btn">
                                <i class="fas fa-download me-2"></i>Download
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Tab switching enhancement
document.addEventListener('shown.bs.tab', function (event) {
    // Clear form fields when switching tabs
    if (event.target.id === 'video-tab') {
        document.getElementById('audioUrl').value = '';
    } else if (event.target.id === 'audio-tab') {
        document.getElementById('videoUrl').value = '';
    }
});
