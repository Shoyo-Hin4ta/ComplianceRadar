import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

import { createComplianceRoutes } from "./routes/compliance.routes";
import webhookRoutes, { setWebSocketService } from "./routes/webhook.routes";
import { initializeWebSocketService, getWebSocketService } from "./services/websocket.service";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Initialize the new WebSocket service with existing Socket.IO instance
const websocketService = initializeWebSocketService(io);
setWebSocketService(websocketService);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "US Business Compliance Checker API",
    version: "1.0.0",
    endpoints: {
      compliance: {
        check: "POST /api/compliance/check",
        status: "GET /api/compliance/status/:id",
        results: "GET /api/compliance/results/:id"
      },
      health: "GET /health"
    }
  });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const wsStats = websocketService.getSessionStats();
    res.json({
      status: "healthy",
      database: "connected",
      websocket: {
        legacy: io.engine.clientsCount,
        v2: wsStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.use("/api/compliance", createComplianceRoutes(io));
app.use("/api", webhookRoutes);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Handle compliance-specific room joins
  socket.on("compliance:subscribe", (data: { checkId: string }) => {
    if (data.checkId) {
      socket.join(data.checkId);
      console.log(`Socket ${socket.id} subscribed to compliance check ${data.checkId}`);
    }
  });
  
  socket.on("compliance:unsubscribe", (data: { checkId: string }) => {
    if (data.checkId) {
      socket.leave(data.checkId);
      console.log(`Socket ${socket.id} unsubscribed from compliance check ${data.checkId}`);
    }
  });
  
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ WebSocket server ready`);
      console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down gracefully...");
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

startServer();