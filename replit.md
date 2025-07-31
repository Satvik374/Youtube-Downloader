# YouTube Downloader

## Overview

This is a Flask-based web application for downloading YouTube videos and audio files. The application provides a clean, modern interface with support for both video and audio downloads, real-time progress tracking, and file management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a traditional web application architecture with a Flask backend serving both API endpoints and static content. The frontend uses vanilla JavaScript with Bootstrap for styling, creating a responsive single-page application experience.

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Media Processing**: yt-dlp library for YouTube content extraction and downloading
- **File Management**: Local file system storage in a `downloads` directory
- **Session Management**: Flask sessions with configurable secret key
- **Logging**: Python's built-in logging module for debugging and monitoring

### Frontend Architecture
- **UI Framework**: Bootstrap 5 with dark theme
- **JavaScript**: Vanilla ES6+ with modern DOM manipulation
- **Styling**: Custom CSS with glassmorphism effects and gradient backgrounds
- **Icons**: Font Awesome for visual elements
- **Real-time Updates**: JavaScript-based progress monitoring with periodic polling

## Key Components

### 1. Download Engine (`app.py`)
- **YouTube URL Validation**: Regex-based validation for various YouTube URL formats
- **Progress Tracking**: Global dictionary storing download progress with hooks
- **File Management**: Automatic creation and management of downloads directory
- **Error Handling**: Comprehensive logging and error management

### 2. Web Interface (`templates/index.html`)
- **Tabbed Interface**: Separate tabs for video and audio downloads
- **Form Validation**: Client-side URL validation with user feedback
- **Progress Display**: Real-time progress bars and status updates
- **Flash Messages**: Server-side message display system

### 3. Client-Side Logic (`static/script.js`)
- **Form Validation**: Duplicate YouTube URL validation on the frontend
- **Progress Monitoring**: Periodic AJAX polling for download status
- **User Experience**: Dynamic UI updates and alert system

### 4. Styling (`static/style.css`)
- **Dark Theme**: Modern dark interface with glassmorphism effects
- **Responsive Design**: Mobile-friendly layout with Bootstrap integration
- **Custom Components**: Enhanced form controls and card designs

## Data Flow

1. **User Input**: User enters YouTube URL and selects download type (video/audio)
2. **Validation**: Both client-side and server-side URL validation
3. **Download Initiation**: Flask route processes request and starts yt-dlp download
4. **Progress Updates**: Progress hook updates global progress dictionary
5. **Client Polling**: JavaScript periodically checks progress via AJAX
6. **File Delivery**: Completed files served through Flask's send_file functionality
7. **Cleanup**: Downloaded files managed in local downloads directory

## External Dependencies

### Python Packages
- **Flask**: Web framework for routing and templating
- **yt-dlp**: YouTube content extraction and downloading
- **pathlib**: Modern file path handling

### Frontend Libraries
- **Bootstrap 5**: CSS framework with dark theme variant
- **Font Awesome**: Icon library for UI elements

### Runtime Dependencies
- **Python 3.x**: Core runtime environment
- **FFmpeg**: Required by yt-dlp for media processing (implicit dependency)

## Deployment Strategy

The application is designed for simple deployment with minimal configuration:

### Environment Configuration
- **SESSION_SECRET**: Configurable via environment variable for production security
- **Port Configuration**: Standard Flask development server setup

### File Storage
- **Local Storage**: Downloads stored in local `downloads` directory
- **Auto-creation**: Directory created automatically on startup
- **No Database**: Stateless design with in-memory progress tracking

### Scaling Considerations
- **Single Instance**: Current design optimized for single-instance deployment
- **Memory Usage**: Progress tracking stored in application memory
- **File Cleanup**: Manual file management required for long-term deployment

### Security Features
- **URL Validation**: Multiple layers of YouTube URL validation
- **File Path Security**: Automatic directory creation with safe paths
- **Session Security**: Configurable secret key for production environments

The application prioritizes simplicity and ease of use while providing a robust YouTube downloading experience with modern web technologies.