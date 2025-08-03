import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDownloadHistorySchema } from "@shared/schema";
import { z } from "zod";

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

  // Simulate download process
  app.post("/api/download", async (req, res) => {
    try {
      const { url, format, quality } = req.body;
      
      if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock download result
      const result = {
        success: true,
        title: `Downloaded ${format === 'audio' ? 'Audio' : 'Video'}`,
        fileSize: format === 'audio' ? '8.5 MB' : '45.2 MB',
        thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
      };

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Download failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
