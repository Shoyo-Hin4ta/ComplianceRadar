import { z } from "zod";
import { withLangGraph } from "@langchain/langgraph/zod";

export const BusinessProfileSchema = z.object({
  state: z.string(),
  city: z.string().optional(),
  industry: z.string(),
  naicsCode: z.string().optional(),
  employeeCount: z.number().optional(),
  annualRevenue: z.number().optional(),
  specialFactors: z.array(z.string()).default([])
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export const SearchResultSchema = z.object({
  url: z.string(),
  source: z.string(),
  intent: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional()
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const ExtractedContentSchema = z.object({
  url: z.string(),
  content: z.string(),
  metadata: z.any().optional()
});

export type ExtractedContent = z.infer<typeof ExtractedContentSchema>;

export const RequirementSchema = z.object({
  id: z.string().optional(),
  category: z.string().optional(),
  name: z.string(),
  description: z.string(),
  source: z.string(),
  sourceUrl: z.string().optional(),
  sourceType: z.enum(["federal", "state", "city", "industry"]),
  citation: z.string().optional(),
  relevanceScore: z.number().optional(),
  actionRequired: z.string().optional(),
  verified: z.boolean().default(false),
  deadline: z.string().optional(),
  penalty: z.string().optional(),
  formNumber: z.string().optional(),
  frequency: z.string().optional(),
  appliesTo: z.string().optional(),
  metadata: z.any().optional()
});

export type Requirement = z.infer<typeof RequirementSchema>;

export const ComplianceStateSchema = z.object({
  businessProfile: BusinessProfileSchema,
  
  intents: z.array(z.any()).optional(), // Can be strings or CategorizedIntent objects
  
  searchQueries: z.array(z.object({
    intent: z.string(),
    query: z.string(),
    domain: z.string()
  })).optional(),
  
  discoveredUrls: withLangGraph(z.array(SearchResultSchema), {
    reducer: { 
      fn: (x, y) => {
        const urls = new Set(x.map(item => item.url));
        const newItems = y.filter(item => !urls.has(item.url));
        return [...x, ...newItems];
      }
    },
    default: () => []
  }),
  
  extractedContent: withLangGraph(z.array(ExtractedContentSchema), {
    reducer: { fn: (x, y) => x.concat(y) },
    default: () => []
  }),
  
  requirements: withLangGraph(z.array(RequirementSchema), {
    reducer: { fn: (x, y) => x.concat(y) },
    default: () => []
  }),
  
  // Deep Research fields
  researchContent: z.string().optional(),
  citations: z.array(z.string()).optional(),
  perplexityRequestId: z.string().optional(),
  sourcesAnalyzed: z.number().optional(),
  
  // Categorization and analysis fields
  categorizedRequirements: z.any().optional(),
  requirementStatistics: z.any().optional(),
  gaps: z.any().optional(),
  coverage: z.any().optional(),
  recommendations: z.any().optional(),
  
  statusMessage: z.string().optional(),
  currentNode: z.string().optional(),
  progress: z.number().default(0),
  error: z.string().optional()
});

export type ComplianceState = z.infer<typeof ComplianceStateSchema>;

export interface ComplianceCheckRequest {
  businessProfile: BusinessProfile;
  sessionId?: string;
}

export interface ComplianceCheckResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  requirements?: Requirement[];
  coverageReport?: {
    federal: number;
    state: number;
    city: number;
    industry: number;
  };
  businessProfile?: BusinessProfile;
  version?: "v1" | "v2";
  error?: string;
}

export interface StatusUpdate {
  message: string;
  node: string;
  progress: number;
  timestamp: Date;
}