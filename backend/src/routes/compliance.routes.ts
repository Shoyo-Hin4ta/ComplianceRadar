import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { ComplianceController } from "../controllers/compliance.controller";

export function createComplianceRoutes(io?: SocketIOServer): Router {
  const router = Router();
  const controller = new ComplianceController(io);

  // Main endpoint with Perplexity Sonar + Firecrawl
  router.post("/check", controller.checkCompliance);
  
  router.get("/status/:id", controller.getStatus);

  return router;
}