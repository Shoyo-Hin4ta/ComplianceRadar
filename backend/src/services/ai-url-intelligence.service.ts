import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { SearchResult, BusinessProfile } from "../types/compliance.types";

const UrlScoringSchema = z.object({
  scoredUrls: z.array(z.object({
    url: z.string(),
    relevanceScore: z.number().min(0).max(100),
    reasoning: z.string(),
    category: z.enum(['critical', 'important', 'helpful', 'skip']),
    expectedContent: z.string()
  }))
});

export class AIUrlIntelligenceService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature: 0.2,
    });
  }

  /**
   * Use AI to intelligently score and filter URLs based on business context
   */
  async intelligentlyFilterUrls(
    searchResults: SearchResult[],
    businessProfile: BusinessProfile,
    maxUrls: number = 20
  ): Promise<SearchResult[]> {
    if (searchResults.length === 0) return [];

    // Group URLs by intent for better context
    const urlsByIntent = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      const intent = result.intent || 'general';
      if (!urlsByIntent.has(intent)) {
        urlsByIntent.set(intent, []);
      }
      urlsByIntent.get(intent)!.push(result);
    }

    const scoredResults: Array<{result: SearchResult, score: number, reasoning: string}> = [];

    // Process each intent group
    for (const [intent, results] of urlsByIntent) {
      const scored = await this.scoreUrlsWithAI(results, businessProfile, intent);
      scoredResults.push(...scored);
    }

    // Sort by score and take top URLs
    scoredResults.sort((a, b) => b.score - a.score);
    
    // Log AI's reasoning
    console.log('\n🤖 AI URL Selection Reasoning:');
    scoredResults.slice(0, maxUrls).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.result.url.substring(0, 80)}...`);
      console.log(`   Score: ${item.score} | Reason: ${item.reasoning}`);
    });

    return scoredResults.slice(0, maxUrls).map(item => item.result);
  }

  private async scoreUrlsWithAI(
    results: SearchResult[],
    businessProfile: BusinessProfile,
    intent: string
  ): Promise<Array<{result: SearchResult, score: number, reasoning: string}>> {
    // Prepare URL data for AI
    const urlData = results.map(r => ({
      url: r.url,
      title: r.title || '',
      snippet: r.snippet || '',
      domain: new URL(r.url).hostname
    }));

    const prompt = `You are an expert at identifying the MOST RELEVANT government compliance URLs for a business.

Business Context:
- Type: ${businessProfile.industry} in ${businessProfile.state}${businessProfile.city ? `, ${businessProfile.city}` : ''}
- Size: ${businessProfile.employeeCount} employees
- Revenue: ${businessProfile.annualRevenue ? `$${businessProfile.annualRevenue.toLocaleString()}` : 'Not specified'}
- Looking for: ${intent}

Score each URL from 0-100 based on:
1. Direct relevance to the compliance need (not general info pages)
2. Likelihood of containing specific requirements, forms, or deadlines
3. Official source authority (IRS.gov for taxes, OSHA.gov for safety, etc.)
4. Specificity (prefer specific compliance pages over general business guides)

URLs to evaluate:
${JSON.stringify(urlData, null, 2)}

For each URL, provide:
- relevanceScore: 0-100 (100 = perfect match, must-have URL)
- reasoning: Why this score? What compliance info do you expect to find?
- category: "critical" (must have), "important" (very relevant), "helpful" (good to have), or "skip" (not relevant)
- expectedContent: What specific compliance information this URL likely contains

Return JSON with scoredUrls array.`;

    try {
      const response = await this.model.invoke(prompt);
      const content = response.content as string;
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON in AI response');
        return this.fallbackScoring(results);
      }

      const parsed = UrlScoringSchema.parse(JSON.parse(jsonMatch[0]));
      
      // Map scores back to results
      const scored = results.map(result => {
        const scoreData = parsed.scoredUrls.find(s => s.url === result.url);
        if (scoreData && scoreData.category !== 'skip') {
          return {
            result,
            score: scoreData.relevanceScore,
            reasoning: scoreData.reasoning
          };
        }
        return null;
      }).filter(Boolean) as Array<{result: SearchResult, score: number, reasoning: string}>;

      return scored;
    } catch (error) {
      console.error('Error in AI URL scoring:', error);
      return this.fallbackScoring(results);
    }
  }

  private fallbackScoring(results: SearchResult[]): Array<{result: SearchResult, score: number, reasoning: string}> {
    // Simple fallback - prefer URLs with titles and snippets
    return results.map((result, idx) => ({
      result,
      score: 50 - idx * 2, // Decreasing score by position
      reasoning: 'Fallback scoring based on search position'
    }));
  }

  /**
   * AI-powered check if we have good coverage
   */
  async assessUrlCoverage(
    selectedUrls: SearchResult[],
    businessProfile: BusinessProfile
  ): Promise<{
    hasSufficientCoverage: boolean;
    missingAreas: string[];
    confidence: number;
  }> {
    const prompt = `Assess if these URLs provide sufficient compliance coverage for a ${businessProfile.industry} business in ${businessProfile.state} with ${businessProfile.employeeCount} employees.

Selected URLs:
${selectedUrls.map(u => `- ${u.url} (for: ${u.intent})`).join('\n')}

Do these URLs cover:
1. Federal tax requirements (EIN, Form 941, etc.)?
2. State business registration and licenses?
3. Employment law (if they have employees)?
4. Industry-specific requirements?
5. Local/city requirements (if applicable)?

Return JSON with:
- hasSufficientCoverage: boolean
- missingAreas: array of missing compliance areas
- confidence: 0-100 (how confident are you in this assessment?)`;

    try {
      const response = await this.model.invoke(prompt);
      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error assessing coverage:', error);
    }

    return {
      hasSufficientCoverage: false,
      missingAreas: ['Unable to assess'],
      confidence: 0
    };
  }
}