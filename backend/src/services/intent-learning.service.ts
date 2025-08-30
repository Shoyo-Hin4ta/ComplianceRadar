import { PrismaClient } from "@prisma/client";
import { BusinessProfile } from "../types/compliance.types";

interface IntentPerformance {
  intent: string;
  category: string;
  resultsCount: number;
  confidenceScore: number;
  businessType: string;
  employeeRange: string;
  state: string;
  timestamp: Date;
}

interface SimilarBusinessCriteria {
  industry?: string;
  state?: string;
  employeeRange?: string;
  minSimilarity?: number;
}

interface IntentRefinementSuggestion {
  originalIntent: string;
  suggestedIntent: string;
  reason: string;
  confidence: number;
}

export class IntentLearningService {
  private prisma: PrismaClient;
  
  // Cache successful intent patterns
  private successfulPatterns: Map<string, IntentPerformance[]> = new Map();
  
  // Track intent performance over time
  private performanceHistory: IntentPerformance[] = [];
  
  constructor() {
    this.prisma = new PrismaClient();
    this.loadHistoricalData();
  }
  
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load successful patterns from database
      // This would be implemented when the database schema is updated
      console.log("Loading historical intent performance data...");
    } catch (error) {
      console.error("Error loading historical data:", error);
    }
  }
  
  // Record how well an intent performed
  async recordIntentPerformance(
    intent: string,
    category: string,
    resultsCount: number,
    businessProfile: BusinessProfile,
    confidenceScore: number = 0.5
  ): Promise<void> {
    try {
      const performance: IntentPerformance = {
        intent,
        category,
        resultsCount,
        confidenceScore,
        businessType: businessProfile.industry,
        employeeRange: this.getEmployeeRange(businessProfile.employeeCount),
        state: businessProfile.state,
        timestamp: new Date()
      };
      
      // Add to in-memory history
      this.performanceHistory.push(performance);
      
      // Update successful patterns cache
      if (resultsCount > 0 && confidenceScore > 0.7) {
        const key = this.getPatternKey(businessProfile);
        if (!this.successfulPatterns.has(key)) {
          this.successfulPatterns.set(key, []);
        }
        this.successfulPatterns.get(key)?.push(performance);
      }
      
      // TODO: Persist to database when schema is updated
      // await this.prisma.intentPerformance.create({
      //   data: {
      //     intent,
      //     category,
      //     results: resultsCount,
      //     profile: businessProfile as any,
      //     confidence: confidenceScore
      //   }
      // });
      
      console.log(`Recorded performance: ${intent} -> ${resultsCount} results (confidence: ${confidenceScore})`);
    } catch (error) {
      console.error("Error recording intent performance:", error);
    }
  }
  
  // Get successful intents from similar businesses
  async getSimilarBusinessIntents(
    profile: BusinessProfile,
    criteria?: SimilarBusinessCriteria
  ): Promise<string[]> {
    const similarIntents: Map<string, number> = new Map();
    
    // Define similarity criteria
    const industry = criteria?.industry || profile.industry;
    const state = criteria?.state || profile.state;
    const employeeRange = criteria?.employeeRange || this.getEmployeeRange(profile.employeeCount);
    const minSimilarity = criteria?.minSimilarity || 0.7;
    
    // Search through successful patterns
    for (const [key, performances] of this.successfulPatterns.entries()) {
      const similarity = this.calculateSimilarity(key, profile, criteria);
      
      if (similarity >= minSimilarity) {
        for (const perf of performances) {
          const score = perf.confidenceScore * similarity;
          similarIntents.set(
            perf.intent,
            Math.max(similarIntents.get(perf.intent) || 0, score)
          );
        }
      }
    }
    
    // Sort by score and return top intents
    return Array.from(similarIntents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent]) => intent);
  }
  
  // Refine intent based on search results
  async refineIntent(
    originalIntent: string,
    searchResults: any,
    businessProfile: BusinessProfile
  ): Promise<IntentRefinementSuggestion> {
    const resultsCount = searchResults?.length || 0;
    
    // Analyze the results
    if (resultsCount === 0) {
      // No results - intent too specific, broaden it
      return this.broadenIntent(originalIntent, businessProfile);
    } else if (resultsCount > 20) {
      // Too many results - intent too broad, narrow it
      return this.narrowIntent(originalIntent, businessProfile);
    } else if (resultsCount < 3) {
      // Few results - might need adjustment
      return this.adjustIntent(originalIntent, businessProfile, searchResults);
    }
    
    // Intent seems good
    return {
      originalIntent,
      suggestedIntent: originalIntent,
      reason: "Intent is performing well",
      confidence: 0.9
    };
  }
  
  private broadenIntent(intent: string, profile: BusinessProfile): IntentRefinementSuggestion {
    let suggestedIntent = intent;
    let reason = "Broadening search to find more results";
    
    // Remove specific numbers or thresholds
    suggestedIntent = suggestedIntent.replace(/\d+\s*employees?/i, "employees");
    suggestedIntent = suggestedIntent.replace(/\$[\d,]+/g, "");
    
    // Remove city if present, keep state
    if (profile.city && intent.includes(profile.city)) {
      suggestedIntent = suggestedIntent.replace(profile.city, "").trim();
      reason = "Removing city to broaden to state level";
    }
    
    // Generalize specific terms
    const specificToGeneral: Record<string, string> = {
      "restaurant": "food service",
      "construction": "contractor",
      "retail store": "retail",
      "tech startup": "technology business"
    };
    
    for (const [specific, general] of Object.entries(specificToGeneral)) {
      if (suggestedIntent.toLowerCase().includes(specific)) {
        suggestedIntent = suggestedIntent.replace(new RegExp(specific, 'gi'), general);
        reason = `Generalizing "${specific}" to "${general}"`;
        break;
      }
    }
    
    return {
      originalIntent: intent,
      suggestedIntent,
      reason,
      confidence: 0.7
    };
  }
  
  private narrowIntent(intent: string, profile: BusinessProfile): IntentRefinementSuggestion {
    let suggestedIntent = intent;
    let reason = "Narrowing search to find more specific results";
    
    // Add state if not present
    if (!intent.toLowerCase().includes(profile.state.toLowerCase())) {
      suggestedIntent = `${profile.state} ${suggestedIntent}`;
      reason = "Adding state to narrow results";
    }
    
    // Add employee count for threshold-based requirements
    if (profile.employeeCount > 0 && !intent.match(/\d+\s*employees?/i)) {
      const thresholdKeywords = ['compliance', 'requirements', 'regulations'];
      if (thresholdKeywords.some(kw => intent.toLowerCase().includes(kw))) {
        suggestedIntent += ` ${profile.employeeCount} employees`;
        reason = "Adding employee count for specific thresholds";
      }
    }
    
    // Add industry if not present
    if (!intent.toLowerCase().includes(profile.industry.toLowerCase())) {
      suggestedIntent += ` for ${profile.industry}`;
      reason = "Adding industry for specific requirements";
    }
    
    return {
      originalIntent: intent,
      suggestedIntent,
      reason,
      confidence: 0.75
    };
  }
  
  private adjustIntent(
    intent: string,
    profile: BusinessProfile,
    searchResults: any
  ): IntentRefinementSuggestion {
    // Analyze the few results we got to understand what worked
    let suggestedIntent = intent;
    let reason = "Adjusting based on partial results";
    
    // Look for common terms in successful results
    if (searchResults && searchResults.length > 0) {
      const successfulTerms = this.extractCommonTerms(searchResults);
      
      // Add successful terms if not present
      for (const term of successfulTerms.slice(0, 2)) {
        if (!intent.toLowerCase().includes(term.toLowerCase())) {
          suggestedIntent += ` ${term}`;
          reason = `Adding relevant term "${term}" found in results`;
          break;
        }
      }
    }
    
    // Try alternative phrasing
    const alternativePhrases: Record<string, string> = {
      "requirements": "regulations",
      "compliance": "requirements",
      "permit": "license",
      "license": "permit registration",
      "tax": "tax filing requirements"
    };
    
    for (const [original, alternative] of Object.entries(alternativePhrases)) {
      if (intent.toLowerCase().includes(original)) {
        suggestedIntent = suggestedIntent.replace(
          new RegExp(original, 'gi'),
          alternative
        );
        reason = `Trying alternative phrasing: "${original}" → "${alternative}"`;
        break;
      }
    }
    
    return {
      originalIntent: intent,
      suggestedIntent,
      reason,
      confidence: 0.6
    };
  }
  
  // Analyze which intents consistently perform well
  async getTopPerformingIntents(
    category?: string,
    limit: number = 20
  ): Promise<Array<{ intent: string; avgResults: number; confidence: number }>> {
    const intentStats: Map<string, { total: number; count: number; confidence: number }> = new Map();
    
    for (const perf of this.performanceHistory) {
      if (!category || perf.category === category) {
        const current = intentStats.get(perf.intent) || { total: 0, count: 0, confidence: 0 };
        intentStats.set(perf.intent, {
          total: current.total + perf.resultsCount,
          count: current.count + 1,
          confidence: Math.max(current.confidence, perf.confidenceScore)
        });
      }
    }
    
    return Array.from(intentStats.entries())
      .map(([intent, stats]) => ({
        intent,
        avgResults: stats.total / stats.count,
        confidence: stats.confidence
      }))
      .sort((a, b) => b.avgResults - a.avgResults)
      .slice(0, limit);
  }
  
  // Predict intent success probability
  predictIntentSuccess(intent: string, profile: BusinessProfile): number {
    // Check if we've seen this exact intent before
    const exactMatch = this.performanceHistory.find(
      p => p.intent.toLowerCase() === intent.toLowerCase() &&
           p.state === profile.state &&
           p.businessType === profile.industry
    );
    
    if (exactMatch && exactMatch.resultsCount > 0) {
      return exactMatch.confidenceScore;
    }
    
    // Check similar intents
    const similarIntents = this.performanceHistory.filter(p => {
      const similarity = this.calculateIntentSimilarity(p.intent, intent);
      return similarity > 0.6 && p.state === profile.state;
    });
    
    if (similarIntents.length > 0) {
      const avgConfidence = similarIntents.reduce((sum, p) => sum + p.confidenceScore, 0) / similarIntents.length;
      return avgConfidence * 0.8; // Reduce confidence for similar but not exact matches
    }
    
    // Default confidence for new intents
    return 0.5;
  }
  
  // Helper methods
  private getEmployeeRange(count: number): string {
    if (count === 0) return "0";
    if (count <= 10) return "1-10";
    if (count <= 25) return "11-25";
    if (count <= 50) return "26-50";
    if (count <= 100) return "51-100";
    if (count <= 500) return "101-500";
    return "500+";
  }
  
  private getPatternKey(profile: BusinessProfile): string {
    return `${profile.industry}_${profile.state}_${this.getEmployeeRange(profile.employeeCount)}`;
  }
  
  private calculateSimilarity(
    key: string,
    profile: BusinessProfile,
    criteria?: SimilarBusinessCriteria
  ): number {
    const targetKey = this.getPatternKey(profile);
    const [industry1, state1, range1] = key.split('_');
    const [industry2, state2, range2] = targetKey.split('_');
    
    let similarity = 0;
    
    // Industry similarity (40% weight)
    if (industry1 === industry2) similarity += 0.4;
    else if (this.areIndustriesRelated(industry1, industry2)) similarity += 0.2;
    
    // State similarity (30% weight)
    if (state1 === state2) similarity += 0.3;
    else if (this.areStatesNearby(state1, state2)) similarity += 0.15;
    
    // Employee range similarity (30% weight)
    if (range1 === range2) similarity += 0.3;
    else if (this.areRangesAdjacent(range1, range2)) similarity += 0.15;
    
    return similarity;
  }
  
  private calculateIntentSimilarity(intent1: string, intent2: string): number {
    const words1 = new Set(intent1.toLowerCase().split(/\s+/));
    const words2 = new Set(intent2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  private areIndustriesRelated(industry1: string, industry2: string): boolean {
    const relatedGroups = [
      ['restaurant', 'food', 'catering', 'hospitality'],
      ['construction', 'contractor', 'building'],
      ['retail', 'store', 'shop', 'ecommerce'],
      ['technology', 'software', 'it', 'tech'],
      ['healthcare', 'medical', 'health', 'clinic']
    ];
    
    for (const group of relatedGroups) {
      if (group.includes(industry1.toLowerCase()) && group.includes(industry2.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  private areStatesNearby(state1: string, state2: string): boolean {
    // Simplified - would need a proper geographic adjacency map
    const regions: Record<string, string[]> = {
      northeast: ['NY', 'NJ', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME', 'PA'],
      southeast: ['FL', 'GA', 'SC', 'NC', 'VA', 'TN', 'KY', 'AL', 'MS', 'LA'],
      midwest: ['IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO'],
      west: ['CA', 'OR', 'WA', 'NV', 'AZ', 'UT', 'CO'],
      texas: ['TX', 'OK', 'NM', 'AR']
    };
    
    for (const region of Object.values(regions)) {
      if (region.includes(state1) && region.includes(state2)) {
        return true;
      }
    }
    
    return false;
  }
  
  private areRangesAdjacent(range1: string, range2: string): boolean {
    const ranges = ["0", "1-10", "11-25", "26-50", "51-100", "101-500", "500+"];
    const idx1 = ranges.indexOf(range1);
    const idx2 = ranges.indexOf(range2);
    
    return Math.abs(idx1 - idx2) === 1;
  }
  
  private extractCommonTerms(searchResults: any[]): string[] {
    const termFrequency: Map<string, number> = new Map();
    
    // Extract terms from search results (titles, snippets, etc.)
    for (const result of searchResults) {
      const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
      const words = text.match(/\b[a-z]{4,}\b/g) || [];
      
      for (const word of words) {
        termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
      }
    }
    
    // Filter out common words and return top terms
    const commonWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'about']);
    
    return Array.from(termFrequency.entries())
      .filter(([word]) => !commonWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
}