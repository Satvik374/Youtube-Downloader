import os
import logging
import re
import yt_dlp
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for
from urllib.parse import urlparse, parse_qs
import threading
import time
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")

# Create downloads directory
DOWNLOADS_DIR = Path("downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)

# Global variable to store download progress
download_progress = {}

def is_valid_youtube_url(url):
    """Validate if the URL is a valid YouTube URL"""
    youtube_regex = re.compile(
        r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
        r'(watch\?v=|embed/|v/|.+\?v=)?([^&=%\?]{11})'
    )
    return youtube_regex.match(url) is not None

def progress_hook(d):
    """Progress hook for yt-dlp"""
    if d['status'] == 'downloading':
        try:
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            if total > 0:
                percentage = (downloaded / total) * 100
                download_progress[d.get('filename', 'unknown')] = {
                    'percentage': percentage,
                    'status': 'downloading',
                    'speed': d.get('speed', 0),
                    'eta': d.get('eta', 0)
                }
        except Exception as e:
            logging.error(f"Progress hook error: {e}")
    elif d['status'] == 'finished':
        download_progress[d.get('filename', 'unknown')] = {
            'percentage': 100,
            'status': 'finished',
            'filepath': d.get('filename', '')
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download_video', methods=['POST'])
def download_video():
    try:
        url = request.form.get('url', '').strip()
        quality = request.form.get('quality', '720p')
        
        if not url:
            flash('Please enter a YouTube URL', 'error')
            return redirect(url_for('index'))
        
        if not is_valid_youtube_url(url):
            flash('Please enter a valid YouTube URL', 'error')
            return redirect(url_for('index'))
        
        # Map quality to yt-dlp format
        quality_map = {
            '4K': 'best[height<=2160]',
            '1080p': 'best[height<=1080]',
            '720p': 'best[height<=720]',
            '480p': 'best[height<=480]',
            '360p': 'best[height<=360]'
        }
        
        format_selector = quality_map.get(quality, 'best[height<=720]')
        
        ydl_opts = {
            'format': format_selector,
            'outtmpl': str(DOWNLOADS_DIR / '%(title)s.%(ext)s'),
            'progress_hooks': [progress_hook],
            'no_warnings': False,
        }
        
        def download_thread():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
            except Exception as e:
                logging.error(f"Download error: {e}")
                flash(f'Download failed: {str(e)}', 'error')
        
        # Start download in background thread
        thread = threading.Thread(target=download_thread)
        thread.start()
        
        flash(f'Video download started in {quality} quality!', 'success')
        return redirect(url_for('index'))
        
    except Exception as e:
        logging.error(f"Video download error: {e}")
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/download_audio', methods=['POST'])
def download_audio():
    try:
        url = request.form.get('url', '').strip()
        
        if not url:
            flash('Please enter a YouTube URL', 'error')
            return redirect(url_for('index'))
        
        if not is_valid_youtube_url(url):
            flash('Please enter a valid YouTube URL', 'error')
            return redirect(url_for('index'))
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(DOWNLOADS_DIR / '%(title)s.%(ext)s'),
            'progress_hooks': [progress_hook],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'no_warnings': False,
        }
        
        def download_thread():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
            except Exception as e:
                logging.error(f"Audio download error: {e}")
                flash(f'Audio download failed: {str(e)}', 'error')
        
        # Start download in background thread
        thread = threading.Thread(target=download_thread)
        thread.start()
        
        flash('Audio download started in best quality!', 'success')
        return redirect(url_for('index'))
        
    except Exception as e:
        logging.error(f"Audio download error: {e}")
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/progress')
def get_progress():
    """Get download progress"""
    return jsonify(download_progress)

@app.route('/list_downloads')
def list_downloads():
    """List available downloads"""
    try:
        files = []
        for file_path in DOWNLOADS_DIR.iterdir():
            if file_path.is_file() and file_path.name != '.gitkeep':
                files.append({
                    'name': file_path.name,
                    'size': file_path.stat().st_size,
                    'path': str(file_path)
                })
        return jsonify(files)
    except Exception as e:
        logging.error(f"List downloads error: {e}")
        return jsonify([])

@app.route('/download_file/<filename>')
def download_file(filename):
    """Serve downloaded files"""
    try:
        file_path = DOWNLOADS_DIR / filename
        if file_path.exists():
            return send_file(file_path, as_attachment=True)
        else:
            flash('File not found', 'error')
            return redirect(url_for('index'))
    except Exception as e:
        logging.error(f"File download error: {e}")
        flash(f'Error downloading file: {str(e)}', 'error')
        return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
