import { type DownloadHistory, type InsertDownloadHistory } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Download History methods
  getDownloadHistory(): Promise<DownloadHistory[]>;
  addDownloadHistory(download: InsertDownloadHistory): Promise<DownloadHistory>;
  deleteDownloadHistory(id: string): Promise<void>;
  clearDownloadHistory(): Promise<void>;
}

export class MemStorage implements IStorage {
  private downloadHistory: Map<string, DownloadHistory>;

  constructor() {
    this.downloadHistory = new Map();
  }

  async getDownloadHistory(): Promise<DownloadHistory[]> {
    return Array.from(this.downloadHistory.values()).sort(
      (a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime()
    );
  }

  async addDownloadHistory(insertDownload: InsertDownloadHistory): Promise<DownloadHistory> {
    const id = randomUUID();
    const download: DownloadHistory = {
      ...insertDownload,
      id,
      downloadedAt: new Date(),
    };
    this.downloadHistory.set(id, download);
    return download;
  }

  async deleteDownloadHistory(id: string): Promise<void> {
    this.downloadHistory.delete(id);
  }

  async clearDownloadHistory(): Promise<void> {
    this.downloadHistory.clear();
  }
}

export const storage = new MemStorage();
