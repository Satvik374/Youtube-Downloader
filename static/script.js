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
        <div class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading downloads...</p>
        </div>
    `;
    
    fetch('/list_downloads')
        .then(response => response.json())
        .then(files => {
            if (files.length === 0) {
                downloadsList.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-folder-open fa-2x mb-2"></i>
                        <p>No downloads yet. Start by downloading a video or audio file above.</p>
                    </div>
                `;
            } else {
                downloadsList.innerHTML = files.map(file => `
                    <div class="download-item d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(file.name)}</h6>
                            <small class="file-size">${formatFileSize(file.size)}</small>
                        </div>
                        <div>
                            <a href="/download_file/${encodeURIComponent(file.name)}" 
                               class="btn btn-outline-primary btn-sm">
                                <i class="fas fa-download me-1"></i>Download
                            </a>
                        </div>
                    </div>
                `).join('');
            }
        })
        .catch(error => {
            console.error('Error loading downloads:', error);
            downloadsList.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p>Error loading downloads. Please try again.</p>
                    <button class="btn btn-outline-secondary btn-sm" onclick="refreshDownloads()">
                        <i class="fas fa-refresh me-1"></i>Retry
                    </button>
                </div>
            `;
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
