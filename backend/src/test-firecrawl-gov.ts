import FirecrawlApp from "@mendable/firecrawl-js";
import dotenv from "dotenv";

dotenv.config();

async function testGovSiteScraping() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    console.error("❌ FIRECRAWL_API_KEY is missing in .env file");
    process.exit(1);
  }

  console.log("🚀 Starting Firecrawl test for .gov sites");
  console.log("================================================\n");

  const firecrawl = new FirecrawlApp({ apiKey });

  // Test URLs - mix of .gov sites to test different scenarios
  const testUrls = [
    {
      url: "https://www.irs.gov/businesses/small-businesses-self-employed/business-taxes",
      description: "IRS Small Business Taxes"
    },
    {
      url: "https://www.dol.gov/agencies/whd/minimum-wage",
      description: "DOL Minimum Wage Requirements"
    },
    {
      url: "https://www.osha.gov/small-business/requirements",
      description: "OSHA Small Business Requirements"
    }
  ];

  const results = [];

  for (const testCase of testUrls) {
    console.log(`📍 Testing: ${testCase.description}`);
    console.log(`   URL: ${testCase.url}`);
    console.log("   ----------------------------------------");

    try {
      const startTime = Date.now();

      // Test basic scraping first
      console.log("   🔄 Attempting basic scrape...");
      
      const basicResult = await firecrawl.scrape(testCase.url, {
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 30000,
        waitFor: 2000
      });

      const basicTime = Date.now() - startTime;

      if (basicResult && basicResult.markdown) {
        console.log(`   ✅ Basic scrape successful (${basicTime}ms)`);
        console.log(`   📄 Content length: ${basicResult.markdown?.length || 0} chars`);
      } else {
        console.log(`   ❌ Basic scrape failed`);
      }

      // Test with structured extraction
      console.log("   🔄 Attempting structured extraction...");
      const extractStartTime = Date.now();

      const extractionSchema = {
        type: "object",
        properties: {
          requirements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { 
                  type: "string",
                  description: "Name of the requirement or form"
                },
                description: { 
                  type: "string",
                  description: "What needs to be done"
                },
                agency: { 
                  type: "string",
                  description: "Government agency"
                },
                formNumber: { 
                  type: "string",
                  description: "Form number if applicable"
                },
                deadline: { 
                  type: "string",
                  description: "Filing deadline or due date"
                }
              },
              required: ["name", "description", "agency"]
            }
          }
        },
        required: ["requirements"]
      };

      // Using Firecrawl SDK v3 with json format
      const extractResult = await firecrawl.scrape(testCase.url, {
        formats: [
          "markdown",
          {
            type: "json",
            schema: extractionSchema,
            prompt: "Extract all compliance requirements, forms, and deadlines from this page."
          }
        ],
        onlyMainContent: true,
        timeout: 30000,
        waitFor: 2000
      });

      const extractTime = Date.now() - extractStartTime;

      if (extractResult && extractResult.json) {
        console.log(`   ✅ Extraction successful (${extractTime}ms)`);
        const requirements = extractResult.json?.requirements || [];
        console.log(`   📋 Requirements found: ${requirements.length}`);
        
        if (requirements.length > 0) {
          console.log("   📌 Sample requirements:");
          requirements.slice(0, 3).forEach((req, i) => {
            console.log(`      ${i + 1}. ${req.name}`);
            if (req.formNumber) {
              console.log(`         Form: ${req.formNumber}`);
            }
          });
        }
      } else {
        console.log(`   ❌ Extraction failed`);
      }

      // Test with location settings (for geo-specific content)
      console.log("   🔄 Testing with location settings...");
      const locationStartTime = Date.now();

      const locationResult = await firecrawl.scrape(testCase.url, {
        formats: ["markdown"],
        location: {
          country: "US",
          languages: ["en"]
        },
        onlyMainContent: true,
        timeout: 30000
      });

      const locationTime = Date.now() - locationStartTime;

      if (locationResult && locationResult.markdown) {
        console.log(`   ✅ Location-based scrape successful (${locationTime}ms)`);
      } else {
        console.log(`   ❌ Location-based scrape failed`);
      }

      // Store results
      results.push({
        url: testCase.url,
        description: testCase.description,
        basicSuccess: !!(basicResult && basicResult.markdown),
        extractSuccess: !!(extractResult && extractResult.json),
        locationSuccess: !!(locationResult && locationResult.markdown),
        requirementsFound: extractResult.json?.requirements?.length || 0,
        timings: {
          basic: basicTime,
          extract: extractTime,
          location: locationTime
        }
      });

    } catch (error: any) {
      console.error(`   ⚠️ Error: ${error.message}`);
      
      if (error.statusCode === 429) {
        console.log("   ⏸️ Rate limit hit, waiting 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      results.push({
        url: testCase.url,
        description: testCase.description,
        error: error.message,
        statusCode: error.statusCode
      });
    }

    console.log("");
  }

  // Summary
  console.log("\n================================================");
  console.log("📊 TEST SUMMARY");
  console.log("================================================\n");

  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log("\n📈 Performance Metrics:");
    successful.forEach(r => {
      console.log(`\n   ${r.description}:`);
      console.log(`   - Basic scrape: ${r.basicSuccess ? '✅' : '❌'} (${r.timings?.basic}ms)`);
      console.log(`   - Extraction: ${r.extractSuccess ? '✅' : '❌'} (${r.timings?.extract}ms)`);
      console.log(`   - Requirements found: ${r.requirementsFound}`);
    });
  }

  if (failed.length > 0) {
    console.log("\n⚠️ Failed URLs:");
    failed.forEach(r => {
      console.log(`   - ${r.description}: ${r.error}`);
    });
  }

  // Test recommendations
  console.log("\n💡 RECOMMENDATIONS:");
  console.log("================================================");
  
  if (successful.length === results.length) {
    console.log("✅ All .gov sites scraped successfully!");
    console.log("   - Basic scraping works well");
    console.log("   - Consider using structured extraction for better data quality");
  } else if (successful.length > 0) {
    console.log("⚠️ Mixed results - some sites failed");
    console.log("   - Check if failed sites have anti-bot protection");
    console.log("   - Consider using stealth mode or proxies");
    console.log("   - Implement retry logic with exponential backoff");
  } else {
    console.log("❌ All scrapes failed");
    console.log("   - Verify FIRECRAWL_API_KEY is valid");
    console.log("   - Check rate limits on your plan");
    console.log("   - Consider upgrading to a plan with stealth proxies");
  }

  console.log("\n🔧 Implementation suggestions:");
  console.log("   1. Use waitFor parameter for JS-heavy sites");
  console.log("   2. Implement retry logic for failed scrapes");
  console.log("   3. Use structured extraction for better data quality");
  console.log("   4. Monitor rate limits and implement queuing");
  console.log("   5. Cache results to avoid redundant scrapes");
}

// Run the test
testGovSiteScraping().catch(console.error);