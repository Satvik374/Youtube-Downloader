import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDownloadHistorySchema } from "@shared/schema";
import { z } from "zod";
import ytdl from "@distube/ytdl-core";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve ads.txt file for Google AdSense with proper content type
  app.get('/ads.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    try {
      res.sendFile(path.join(process.cwd(), 'ads.txt'));
    } catch (error) {
      // Fallback to public directory
      res.sendFile(path.join(process.cwd(), 'public', 'ads.txt'));
    }
  });
  // Get download history
  app.get("/api/downloads", async (req, res) => {
    try {
      const history = await storage.getDownloadHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch download history" });
    }
  });

  // Add download to history
  app.post("/api/downloads", async (req, res) => {
    try {
      const validatedData = insertDownloadHistorySchema.parse(req.body);
      const download = await storage.addDownloadHistory(validatedData);
      res.json(download);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid download data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to add download to history" });
      }
    }
  });

  // Delete specific download from history
  app.delete("/api/downloads/:id", async (req, res) => {
    try {
      await storage.deleteDownloadHistory(req.params.id);
      res.json({ message: "Download removed from history" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete download from history" });
    }
  });

  // Clear all download history
  app.delete("/api/downloads", async (req, res) => {
    try {
      await storage.clearDownloadHistory();
      res.json({ message: "Download history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear download history" });
    }
  });

  // Real YouTube download process
  app.post("/api/download", async (req, res) => {
    try {
      const { url, format, quality } = req.body;
      
      if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Validate YouTube URL
      if (!ytdl.validateURL(url)) {
        return res.status(400).json({ message: "Invalid YouTube URL format" });
      }

      // Set agent to avoid detection issues
      const agent = ytdl.createAgent();
      
      // Get video info with retry mechanism
      let info;
      let videoDetails;
      
      try {
        info = await ytdl.getInfo(url, { agent });
        videoDetails = info.videoDetails;
      } catch (error) {
        console.error('First attempt failed, trying without agent:', error);
        // Fallback without agent
        info = await ytdl.getInfo(url);
        videoDetails = info.videoDetails;
      }
      
      // Generate filename
      const sanitizedTitle = videoDetails.title
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100); // Limit filename length
      const timestamp = Date.now();
      
      let filename: string;
      let downloadUrl: string;
      let fileSize: string = "Calculating...";

      if (format === 'audio') {
        // Download audio
        filename = `${sanitizedTitle}_${timestamp}.mp3`;
        
        // Find best audio format
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const audioFormat = audioFormats.find(f => f.audioBitrate) || audioFormats[0];
        
        if (audioFormat && audioFormat.contentLength) {
          fileSize = (parseInt(audioFormat.contentLength) / (1024 * 1024)).toFixed(1) + ' MB';
        } else if (audioFormat && audioFormat.approxDurationMs) {
          // Estimate size based on duration and bitrate
          const durationMs = parseInt(audioFormat.approxDurationMs);
          const bitrate = audioFormat.audioBitrate || 128;
          const estimatedSize = (durationMs * bitrate * 1000) / (8 * 1024 * 1024);
          fileSize = estimatedSize.toFixed(1) + ' MB (est.)';
        }
        
        downloadUrl = `/api/stream/audio/${encodeURIComponent(url)}/${encodeURIComponent(filename)}`;
      } else {
        // Download video
        filename = `${sanitizedTitle}_${timestamp}.mp4`;
        
        // Map quality to ytdl format with fallbacks
        let qualityFilter: string;
        let fallbackQualities: string[] = [];
        
        switch(quality) {
          case '4k':
            qualityFilter = '2160p';
            fallbackQualities = ['1440p', '1080p', 'highest'];
            break;
          case '1080p':
            qualityFilter = '1080p';
            fallbackQualities = ['720p', 'highest'];
            break;
          case '720p':
            qualityFilter = '720p';
            fallbackQualities = ['480p', 'highest'];
            break;
          case '480p':
            qualityFilter = '480p';
            fallbackQualities = ['360p', 'highest'];
            break;
          case '360p':
            qualityFilter = '360p';
            fallbackQualities = ['lowest'];
            break;
          default:
            qualityFilter = 'highest';
            fallbackQualities = [];
        }

        // Try to find the requested quality, with fallbacks
        let videoFormat = null;
        const videoFormats = ytdl.filterFormats(info.formats, 'videoandaudio');
        
        // First try exact quality match
        videoFormat = videoFormats.find(f => f.qualityLabel === qualityFilter);
        
        // Try fallback qualities
        if (!videoFormat && fallbackQualities.length > 0) {
          for (const fallback of fallbackQualities) {
            if (fallback === 'highest') {
              videoFormat = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
            } else if (fallback === 'lowest') {
              videoFormat = videoFormats.sort((a, b) => (a.height || 0) - (b.height || 0))[0];
            } else {
              videoFormat = videoFormats.find(f => f.qualityLabel === fallback);
            }
            if (videoFormat) break;
          }
        }
        
        // Last resort: get any video format
        if (!videoFormat) {
          videoFormat = videoFormats[0];
        }
        
        if (videoFormat && videoFormat.contentLength) {
          fileSize = (parseInt(videoFormat.contentLength) / (1024 * 1024)).toFixed(1) + ' MB';
        } else if (videoFormat && videoFormat.approxDurationMs) {
          // Estimate size based on duration and quality
          const durationMs = parseInt(videoFormat.approxDurationMs);
          const height = videoFormat.height || 480;
          const estimatedMbps = height >= 1080 ? 8 : height >= 720 ? 5 : height >= 480 ? 2.5 : 1;
          const estimatedSize = (durationMs * estimatedMbps) / (8 * 1000);
          fileSize = estimatedSize.toFixed(1) + ' MB (est.)';
        }
        
        downloadUrl = `/api/stream/video/${encodeURIComponent(url)}/${encodeURIComponent(filename)}?quality=${quality}`;
      }

      const result = {
        success: true,
        title: videoDetails.title,
        fileSize,
        thumbnail: videoDetails.thumbnails[0]?.url || videoDetails.thumbnail?.thumbnails?.[0]?.url,
        downloadUrl,
        filename
      };

      res.json(result);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Download failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Stream audio download
  app.get("/api/stream/audio/:url/:filename", async (req, res) => {
    try {
      const url = decodeURIComponent(req.params.url);
      const filename = decodeURIComponent(req.params.filename);

      if (!ytdl.validateURL(url)) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Set proper headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Create agent and stream with better options
      const agent = ytdl.createAgent();
      
      const audioStream = ytdl(url, { 
        quality: 'highestaudio',
        filter: 'audioonly',
        agent,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
      audioStream.on('error', (error) => {
        console.error('Audio stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Audio streaming failed" });
        }
      });
      
      audioStream.pipe(res);
    } catch (error) {
      console.error('Audio streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Audio streaming failed" });
      }
    }
  });

  // Stream video download
  app.get("/api/stream/video/:url/:filename", async (req, res) => {
    try {
      const url = decodeURIComponent(req.params.url);
      const filename = decodeURIComponent(req.params.filename);
      const quality = req.query.quality as string || 'highest';

      if (!ytdl.validateURL(url)) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Set proper headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Create agent and get video info
      const agent = ytdl.createAgent();
      const info = await ytdl.getInfo(url, { agent });
      
      // Map quality to ytdl format with fallbacks
      let qualityFilter: string;
      let fallbackQualities: string[] = [];
      
      switch(quality) {
        case '4k':
          qualityFilter = '2160p';
          fallbackQualities = ['1440p', '1080p', 'highest'];
          break;
        case '1080p':
          qualityFilter = '1080p';
          fallbackQualities = ['720p', 'highest'];
          break;
        case '720p':
          qualityFilter = '720p';
          fallbackQualities = ['480p', 'highest'];
          break;
        case '480p':
          qualityFilter = '480p';
          fallbackQualities = ['360p', 'highest'];
          break;
        case '360p':
          qualityFilter = '360p';
          fallbackQualities = ['lowest'];
          break;
        default:
          qualityFilter = 'highest';
      }

      // Find the best available format
      const videoFormats = ytdl.filterFormats(info.formats, 'videoandaudio');
      let selectedFormat = videoFormats.find(f => f.qualityLabel === qualityFilter);
      
      // Try fallback qualities if the exact quality isn't available
      if (!selectedFormat && fallbackQualities.length > 0) {
        for (const fallback of fallbackQualities) {
          if (fallback === 'highest') {
            selectedFormat = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
          } else if (fallback === 'lowest') {
            selectedFormat = videoFormats.sort((a, b) => (a.height || 0) - (b.height || 0))[0];
          } else {
            selectedFormat = videoFormats.find(f => f.qualityLabel === fallback);
          }
          if (selectedFormat) break;
        }
      }
      
      // Last resort: get any video format
      if (!selectedFormat) {
        selectedFormat = videoFormats[0];
      }

      const videoStream = ytdl(url, { 
        format: selectedFormat,
        agent,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
      videoStream.on('error', (error) => {
        console.error('Video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Video streaming failed" });
        }
      });
      
      videoStream.pipe(res);
    } catch (error) {
      console.error('Video streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Video streaming failed" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
