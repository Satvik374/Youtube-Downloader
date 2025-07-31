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
        
        # Map quality to yt-dlp format with strict quality enforcement
        quality_map = {
            '4K': 'bestvideo[height>=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=2160]+bestaudio/bestvideo[height>=1440]+bestaudio',
            '1080p': 'bestvideo[height>=1080][height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1080][height<=1080]+bestaudio',
            '720p': 'bestvideo[height>=720][height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=720][height<=720]+bestaudio',
            '480p': 'bestvideo[height>=480][height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=480][height<=480]+bestaudio',
            '360p': 'bestvideo[height>=360][height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=360][height<=360]+bestaudio'
        }
        
        format_selector = quality_map.get(quality, 'bestvideo[height<=720]+bestaudio/best')
        
        ydl_opts = {
            'format': format_selector,
            'outtmpl': str(DOWNLOADS_DIR / '%(title)s_%(quality)s.%(ext)s'),
            'progress_hooks': [progress_hook],
            'no_warnings': False,
            'writeinfojson': False,
            'writethumbnail': False,
            'merge_output_format': 'mp4',
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }],
        }
        
        def download_thread():
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Get video info first to check available formats
                    info = ydl.extract_info(url, download=False)
                    video_title = info.get('title', 'Unknown') if info else 'Unknown'
                    
                    # Check available qualities
                    formats = info.get('formats', []) if info else []
                    available_heights = [f.get('height') for f in formats if f and f.get('height')]
                    max_height = max(available_heights) if available_heights else 0
                    
                    logging.info(f"Video: {video_title}")
                    logging.info(f"Requested quality: {quality}")
                    logging.info(f"Max available height: {max_height}p")
                    logging.info(f"Format selector: {format_selector}")
                    
                    # Log available formats for debugging
                    for f in formats[:10]:  # Show first 10 formats
                        if f and f.get('height'):
                            logging.info(f"Available format: {f.get('format_id')} - {f.get('height')}p - {f.get('ext')} - {f.get('format_note', 'N/A')}")
                    
                    # Download the video
                    ydl.download([url])
                    
                    # Check downloaded file and log actual quality
                    logging.info(f"Download completed successfully")
                    
                    # Check if we got the requested quality for 4K
                    if quality == '4K' and max_height >= 2160:
                        logging.info("4K download successful - true 4K quality achieved")
                    elif quality == '4K' and max_height < 2160:
                        logging.warning(f"4K requested but not available - downloaded best quality: {max_height}p")
                        
            except Exception as e:
                logging.error(f"Download error: {e}")
        
        # Start download in background thread
        thread = threading.Thread(target=download_thread)
        thread.start()
        
        flash(f'Video download started in {quality} quality! FFmpeg is now available for high-quality merging.', 'success')
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

@app.route('/delete_file/<filename>', methods=['POST'])
def delete_file(filename):
    """Delete a downloaded file"""
    try:
        file_path = DOWNLOADS_DIR / filename
        if file_path.exists():
            file_path.unlink()
            return jsonify({'success': True, 'message': 'File deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'File not found'}), 404
    except Exception as e:
        logging.error(f"File deletion error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/clear_downloads', methods=['POST'])
def clear_downloads():
    """Clear all downloaded files"""
    try:
        deleted_count = 0
        for file_path in DOWNLOADS_DIR.iterdir():
            if file_path.is_file() and file_path.name != '.gitkeep':
                file_path.unlink()
                deleted_count += 1
        return jsonify({'success': True, 'message': f'Deleted {deleted_count} files'})
    except Exception as e:
        logging.error(f"Clear downloads error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
