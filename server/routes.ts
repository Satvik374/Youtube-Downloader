import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDownloadHistorySchema } from "@shared/schema";
import { z } from "zod";
import ytdl from "ytdl-core";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Get video info
      const info = await ytdl.getInfo(url);
      const videoDetails = info.videoDetails;
      
      // Create downloads directory if it doesn't exist
      const downloadsDir = path.join(process.cwd(), 'downloads');
      try {
        await access(downloadsDir);
      } catch {
        await mkdir(downloadsDir, { recursive: true });
      }

      // Generate filename
      const sanitizedTitle = videoDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const timestamp = Date.now();
      
      let filename: string;
      let downloadUrl: string;
      let fileSize: string = "Unknown";

      if (format === 'audio') {
        // Download audio
        filename = `${sanitizedTitle}_${timestamp}.mp3`;
        const audioFormat = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly'
        });
        
        if (audioFormat && audioFormat.contentLength) {
          fileSize = (parseInt(audioFormat.contentLength) / (1024 * 1024)).toFixed(1) + ' MB';
        }
        
        downloadUrl = `/api/stream/audio/${encodeURIComponent(url)}/${encodeURIComponent(filename)}`;
      } else {
        // Download video
        filename = `${sanitizedTitle}_${timestamp}.mp4`;
        
        // Map quality to ytdl format
        let qualityFilter: string;
        switch(quality) {
          case '4k':
            qualityFilter = '2160p';
            break;
          case '1080p':
            qualityFilter = '1080p';
            break;
          case '720p':
            qualityFilter = '720p';
            break;
          case '480p':
            qualityFilter = '480p';
            break;
          case '360p':
            qualityFilter = '360p';
            break;
          default:
            qualityFilter = 'highest';
        }

        const videoFormat = ytdl.chooseFormat(info.formats, { 
          quality: qualityFilter,
          filter: 'videoandaudio'
        }) || ytdl.chooseFormat(info.formats, { 
          quality: 'highest',
          filter: 'videoandaudio'
        });
        
        if (videoFormat && videoFormat.contentLength) {
          fileSize = (parseInt(videoFormat.contentLength) / (1024 * 1024)).toFixed(1) + ' MB';
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

      const info = await ytdl.getInfo(url);
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      
      const audioStream = ytdl(url, { 
        quality: 'highestaudio',
        filter: 'audioonly'
      });
      
      audioStream.pipe(res);
    } catch (error) {
      console.error('Audio streaming error:', error);
      res.status(500).json({ message: "Audio streaming failed" });
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

      const info = await ytdl.getInfo(url);
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'video/mp4');
      
      // Map quality to ytdl format
      let qualityFilter: string;
      switch(quality) {
        case '4k':
          qualityFilter = '2160p';
          break;
        case '1080p':
          qualityFilter = '1080p';
          break;
        case '720p':
          qualityFilter = '720p';
          break;
        case '480p':
          qualityFilter = '480p';
          break;
        case '360p':
          qualityFilter = '360p';
          break;
        default:
          qualityFilter = 'highest';
      }

      const videoStream = ytdl(url, { 
        quality: qualityFilter,
        filter: 'videoandaudio'
      });
      
      videoStream.pipe(res);
    } catch (error) {
      console.error('Video streaming error:', error);
      res.status(500).json({ message: "Video streaming failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
