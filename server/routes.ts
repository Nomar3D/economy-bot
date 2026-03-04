import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupBot } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start the Discord Bot
  if (process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID) {
    setupBot().catch(console.error);
  }

  app.get(api.leaderboard.list.path, async (req, res) => {
    const topUsers = await storage.getTopUsers(10);
    res.json(topUsers);
  });

  return httpServer;
}
