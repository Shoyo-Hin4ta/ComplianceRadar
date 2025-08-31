import { Request, Response } from "express";
import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { ComplianceV2Service } from "../services/compliance-v2.service";
import {
  BusinessProfileSchema,
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  Requirement
} from "../types/compliance.types";
import { CoverageVisualizationService } from "../services/coverage-visualization.service";
import { getWebSocketService } from "../services/websocket.service";

export class ComplianceController {
  private complianceService: ComplianceV2Service;
  private prisma: PrismaClient;
  private io?: SocketIOServer;
  private visualizationService: CoverageVisualizationService;

  constructor(io?: SocketIOServer) {
    this.prisma = new PrismaClient();
    this.io = io;
    this.visualizationService = new CoverageVisualizationService();
    this.complianceService = new ComplianceV2Service();
  }

  /**
   * Main compliance check endpoint using Perplexity Sonar + Firecrawl
   */
  checkCompliance = async (req: Request, res: Response) => {
    try {
      const { businessProfile, sessionId } = req.body as ComplianceCheckRequest;
      
      const validatedProfile = BusinessProfileSchema.parse(businessProfile);
      
      // Create database records
      const dbProfile = await this.prisma.businessProfile.create({
        data: {
          state: validatedProfile.state,
          city: validatedProfile.city,
          industry: validatedProfile.industry,
          naicsCode: validatedProfile.naicsCode,
          employeeCount: validatedProfile.employeeCount || 0,
          annualRevenue: validatedProfile.annualRevenue,
          specialCircumstances: validatedProfile.specialFactors
        }
      });

      const complianceCheck = await this.prisma.complianceCheck.create({
        data: {
          businessId: dbProfile.id,
          status: "processing"
        }
      });

      // Process compliance check asynchronously
      this.processComplianceCheck(complianceCheck.id, validatedProfile, sessionId);

      const response: ComplianceCheckResponse = {
        id: complianceCheck.id,
        status: "processing",
        businessProfile: validatedProfile
      };

      res.status(202).json(response);
    } catch (error) {
      console.error("Error in checkCompliance:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  };

  private async processComplianceCheck(
    checkId: string,
    businessProfile: any,
    sessionId?: string
  ) {
    try {
      const websocketService = getWebSocketService();
      
      // Create event emitter for WebSocket updates
      const emitEvent = (event: any) => {
        if (websocketService) {
          websocketService.emitToCheck(checkId, {
            checkId,
            ...event
          });
        }
      };

      // Run the compliance check using Perplexity + Firecrawl
      console.log(`Starting compliance check for checkId: ${checkId}`);
      const result = await this.complianceService.runComplianceCheck(
        businessProfile,
        checkId,
        emitEvent
      );
      console.log(`Compliance check completed, received result with ${result?.requirements?.length || 0} requirements`);

      const requirements = result.requirements || [];
      
      console.log(`Attempting to save ${requirements.length} requirements to database for check ${checkId}`);
      
      // Save requirements to database
      await this.prisma.$transaction(async (tx) => {
        for (const req of requirements) {
          await tx.complianceRule.create({
            data: {
              checkId,
              name: req.name,
              description: req.description,
              source: req.source, // Save agency name in source field
              sourceUrl: req.sourceUrl, // Save the actual URL
              sourceType: req.sourceType,
              citation: req.citation,
              actionRequired: req.actionRequired,
              deadline: req.deadline,
              penalty: req.penalty,
              formNumber: req.formNumber,
              agency: req.source, // Use source as agency name
              appliesCondition: req.appliesTo,
              verified: false
            }
          });
        }

        await tx.complianceCheck.update({
          where: { id: checkId },
          data: {
            status: "completed",
            coverageReport: this.calculateCoverageReport(requirements)
          }
        });
      });
      
      console.log(`Successfully saved ${requirements.length} requirements to database`);

      // Emit completion event
      if (websocketService) {
        websocketService.emitToCheck(checkId, {
          type: "analysis-complete",
          checkId,
          totalRequirements: requirements.length,
          statistics: result.statistics,
          organized: result.organized
        });
      }

    } catch (error) {
      console.error("Error processing compliance check:", error);
      
      // Update database with error status
      await this.prisma.complianceCheck.update({
        where: { id: checkId },
        data: {
          status: "failed",
          results: { error: error instanceof Error ? error.message : "Unknown error" }
        }
      });

      // Emit error event
      const websocketService = getWebSocketService();
      if (websocketService) {
        websocketService.emitToCheck(checkId, {
          type: "error",
          checkId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }

  getStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const check = await this.prisma.complianceCheck.findUnique({
        where: { id },
        include: {
          business: true,
          rules: true,
          coverage: true
        }
      });

      if (!check) {
        return res.status(404).json({ error: "Check not found" });
      }

      const response: ComplianceCheckResponse = {
        id: check.id,
        status: check.status as any,
        requirements: check.rules.map(rule => ({
          id: rule.id,  // Add the missing id field
          name: rule.name,
          requirement: rule.name,  // Add duplicate as "requirement" for frontend compatibility
          description: rule.description || "",
          source: rule.source,
          sourceType: rule.sourceType as any,
          category: rule.sourceType as any,  // Keep the same value - both should use 'city'
          sourceUrl: rule.sourceUrl || rule.source, // Use actual sourceUrl, fallback to source for old data
          citation: rule.citation || undefined,
          actionRequired: rule.actionRequired || undefined,
          deadline: rule.deadline || undefined,
          penalty: rule.penalty || undefined,
          formNumber: rule.formNumber || undefined,
          verified: rule.verified,
          agency: rule.agency || undefined
        })),
        coverageReport: check.coverageReport as any
      };

      res.json(response);
    } catch (error) {
      console.error("Error in getStatus:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };


  private calculateCoverageReport(requirements: Requirement[]) {
    const federal = requirements.filter(r => r.sourceType === "federal").length;
    const state = requirements.filter(r => r.sourceType === "state").length;
    const city = requirements.filter(r => r.sourceType === "city").length;
    const industry = requirements.filter(r => r.sourceType === "industry").length;
    
    const total = requirements.length || 1;
    
    return {
      federal: Math.round((federal / total) * 100),
      state: Math.round((state / total) * 100),
      city: Math.round((city / total) * 100),
      industry: Math.round((industry / total) * 100),
      total: requirements.length
    };
  }
}