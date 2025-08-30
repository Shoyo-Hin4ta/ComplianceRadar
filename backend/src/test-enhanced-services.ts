import { FirecrawlService } from "./services/firecrawl.service";
import { PerplexityService } from "./services/perplexity.service";
import { config } from "dotenv";

// Load environment variables
config();

async function testEnhancedServices() {
  console.log("🚀 Testing Enhanced Firecrawl and Perplexity Services\n");
  
  const firecrawl = new FirecrawlService();
  const perplexity = new PerplexityService();
  
  // Test 1: Perplexity with search context optimization
  console.log("📍 Test 1: Perplexity Search with Context Optimization");
  console.log("=" .repeat(50));
  
  const testIntents = [
    "California sales tax permit requirements", // Simple query - should use 'low' context
    "comprehensive federal and state tax requirements for restaurants with 25 employees", // Complex - should use 'high' context
    "how to calculate overtime pay requirements" // Reasoning query - should use sonar-reasoning
  ];
  
  for (const intent of testIntents) {
    console.log(`\n🔍 Searching: ${intent}`);
    const results = await perplexity.searchWithSonar(intent, "California");
    console.log(`   Model selected: Check logs above`);
    console.log(`   Results found: ${results.length}`);
    if (results.length > 0) {
      console.log(`   First result: ${results[0].url}`);
    }
  }
  
  // Test 2: Firecrawl with schema-based extraction
  console.log("\n\n📍 Test 2: Firecrawl Schema-Based Extraction");
  console.log("=" .repeat(50));
  
  const testUrl = "https://www.irs.gov/forms-pubs/about-form-941";
  console.log(`\n🔍 Extracting from: ${testUrl}`);
  
  const extractedData = await firecrawl.extractWithStructure(
    testUrl, 
    undefined, // Let it auto-select schema
    "Form 941 quarterly tax requirements"
  );
  
  if (extractedData) {
    console.log(`   Schema used: ${extractedData.schemaUsed}`);
    console.log(`   Structured data keys: ${Object.keys(extractedData.structured).join(", ")}`);
    console.log(`   Markdown length: ${extractedData.markdown.length} characters`);
  }
  
  // Test 3: Batch scraping with Firecrawl
  console.log("\n\n📍 Test 3: Firecrawl Batch Scraping");
  console.log("=" .repeat(50));
  
  const batchUrls = [
    "https://www.irs.gov/businesses/small-businesses-self-employed/business-taxes",
    "https://www.dol.gov/agencies/whd/minimum-wage",
    "https://www.osha.gov/workers/employer-responsibilities"
  ];
  
  console.log(`\n🔍 Batch scraping ${batchUrls.length} URLs...`);
  const batchResults = await firecrawl.batchScrapeUrls(batchUrls, {
    intent: "federal compliance requirements for small businesses"
  });
  
  console.log(`   Successfully scraped: ${batchResults.filter(r => r.success).length}/${batchUrls.length}`);
  for (const result of batchResults) {
    if (result.success) {
      console.log(`   ✅ ${new URL(result.url).hostname}: ${Object.keys(result.data).length} fields extracted`);
    } else {
      console.log(`   ❌ ${new URL(result.url).hostname}: ${result.error || "Failed"}`);
    }
  }
  
  // Test 4: Combined workflow - Search with Perplexity, Extract with Firecrawl
  console.log("\n\n📍 Test 4: Combined Workflow (Search + Extract)");
  console.log("=" .repeat(50));
  
  const searchQuery = "California business license requirements for restaurants";
  console.log(`\n🔍 Step 1: Searching with Perplexity: "${searchQuery}"`);
  
  const searchResults = await perplexity.searchWithSonar(searchQuery, "California", {
    searchContextSize: "medium",
    topK: 3
  });
  
  console.log(`   Found ${searchResults.length} relevant URLs`);
  
  if (searchResults.length > 0) {
    console.log(`\n🔍 Step 2: Extracting structured data from search results...`);
    
    const urlsToExtract = searchResults.map(r => r.url);
    const extractedResults = await firecrawl.batchScrapeUrls(urlsToExtract, {
      intent: searchQuery
    });
    
    console.log(`   Extraction complete!`);
    for (const result of extractedResults) {
      if (result.success && result.data) {
        const domain = new URL(result.url).hostname;
        console.log(`   📄 ${domain}:`);
        
        // Show what was extracted
        if (result.data.requirements && Array.isArray(result.data.requirements)) {
          console.log(`      - Requirements found: ${result.data.requirements.length}`);
        }
        if (result.data.contactInfo) {
          console.log(`      - Contact info: ✓`);
        }
        if (result.data.fees) {
          console.log(`      - Fee information: ✓`);
        }
      }
    }
  }
  
  // Test 5: Perplexity structured output
  console.log("\n\n📍 Test 5: Perplexity with Structured Output");
  console.log("=" .repeat(50));
  
  const structuredSchema = {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            source: { type: "string" }
          }
        }
      },
      summary: { type: "string" }
    }
  };
  
  console.log(`\n🔍 Getting structured output for: "Federal tax requirements for businesses"`);
  const structuredResult = await perplexity.searchWithStructuredOutput(
    "What are the main federal tax requirements for small businesses?",
    "California",
    structuredSchema
  );
  
  if (structuredResult) {
    console.log(`   Structured response received`);
    if (structuredResult.choices?.[0]?.message?.content) {
      try {
        const parsed = JSON.parse(structuredResult.choices[0].message.content);
        console.log(`   Requirements found: ${parsed.requirements?.length || 0}`);
      } catch {
        console.log(`   Response format: Text (not JSON)`);
      }
    }
  }
  
  console.log("\n\n✅ All tests completed!");
  console.log("=" .repeat(50));
  console.log("\nSummary of Enhancements:");
  console.log("1. ✅ Firecrawl: Schema-based extraction with auto-selection");
  console.log("2. ✅ Firecrawl: Batch scraping API implementation");
  console.log("3. ✅ Perplexity: Dynamic search context sizing");
  console.log("4. ✅ Perplexity: Intelligent model selection");
  console.log("5. ✅ Perplexity: Structured output support");
  console.log("6. ✅ Combined workflow: Search + Extract pipeline");
}

// Run tests
testEnhancedServices().catch(console.error);