import axios from 'axios';
import dotenv from 'dotenv';
import { io, Socket } from 'socket.io-client';

dotenv.config();

const API_BASE_URL = 'http://localhost:3001';

// Test payload - exactly what frontend sends
const testPayload = {
  businessProfile: {
    state: "California",
    city: "San Francisco",
    industry: "Restaurant",
    naicsCode: "722511", // Full-Service Restaurants
    employeeCount: 15,
    annualRevenue: 1500000,
    specialFactors: [
      "Has physical location",
      "Sells products",
      "Sells services",
      "Handles food/beverage",
      "Stores personal data",
      "Accepts online payments",
      "Business structure: LLC"
    ]
  },
  sessionId: "test-session-" + Date.now()
};

async function testComplianceFlow() {
  console.log("🚀 Testing Complete Compliance Check Flow");
  console.log("==========================================\n");
  
  console.log("📋 Test Business Profile:");
  console.log(`   Location: ${testPayload.businessProfile.city}, ${testPayload.businessProfile.state}`);
  console.log(`   Industry: ${testPayload.businessProfile.industry} (NAICS: ${testPayload.businessProfile.naicsCode})`);
  console.log(`   Employees: ${testPayload.businessProfile.employeeCount}`);
  console.log(`   Revenue: $${testPayload.businessProfile.annualRevenue.toLocaleString()}`);
  console.log(`   Special Factors: ${testPayload.businessProfile.specialFactors.length} factors`);
  console.log("");

  // Connect to WebSocket for real-time updates
  console.log("🔌 Connecting to WebSocket...");
  const socket: Socket = io(API_BASE_URL, {
    transports: ['polling', 'websocket'],
    reconnection: false
  });

  let checkId: string | null = null;
  const events: any[] = [];

  // Set up WebSocket listeners
  socket.on('connect', () => {
    console.log("✅ WebSocket connected (ID: " + socket.id + ")\n");
    testPayload.sessionId = socket.id!;
  });

  socket.on('compliance-update', (event: any) => {
    events.push(event);
    
    // Log different event types
    if (event.type === 'query-building') {
      console.log(`🔨 ${event.message}`);
    } else if (event.type === 'sonar-searching') {
      console.log(`🔍 ${event.message}`);
    } else if (event.type === 'urls-discovered') {
      console.log(`📍 ${event.message} (${event.count} sources)`);
    } else if (event.type === 'urls-filtered') {
      console.log(`✂️ ${event.message}`);
      if (event.breakdown) {
        console.log(`   - Federal: ${event.breakdown.federal}`);
        console.log(`   - State: ${event.breakdown.state}`);
        console.log(`   - Local: ${event.breakdown.local}`);
        console.log(`   - Industry: ${event.breakdown.industry}`);
      }
    } else if (event.type === 'batch-starting') {
      console.log(`🌐 ${event.message}`);
    } else if (event.type === 'scraping-site') {
      console.log(`   📄 [${event.index}/${event.total}] Scraping ${event.message}`);
    } else if (event.type === 'site-complete') {
      console.log(`   ✅ Found ${event.rulesFound} requirements from site ${event.index}/${event.total}`);
    } else if (event.type === 'scraping-complete') {
      console.log(`📊 ${event.message}`);
    } else if (event.type === 'complete') {
      console.log(`\n🎉 ${event.message}`);
      if (event.stats) {
        console.log("\n📈 Final Statistics:");
        console.log(`   Total Requirements: ${event.stats.total}`);
        console.log(`   Federal: ${event.stats.federal}`);
        console.log(`   State: ${event.stats.state}`);
        console.log(`   Local: ${event.stats.local}`);
        console.log(`   Industry: ${event.stats.industry}`);
        console.log(`   High Confidence: ${event.stats.highConfidence}`);
        console.log(`   Medium Confidence: ${event.stats.mediumConfidence}`);
        console.log(`   Low Confidence: ${event.stats.lowConfidence}`);
      }
    } else if (event.type === 'error') {
      console.error(`❌ Error: ${event.error}`);
    } else if (event.progress) {
      // Show progress bar
      const progressBar = '█'.repeat(Math.floor(event.progress / 5)) + '░'.repeat(20 - Math.floor(event.progress / 5));
      process.stdout.write(`\r   Progress: [${progressBar}] ${event.progress}%`);
      if (event.progress === 100) {
        console.log(""); // New line after progress completes
      }
    }
  });

  // Wait for connection
  await new Promise(resolve => {
    if (socket.connected) resolve(true);
    else socket.on('connect', resolve);
  });

  try {
    // Step 1: Submit compliance check
    console.log("📤 Submitting compliance check request...\n");
    
    const response = await axios.post(
      `${API_BASE_URL}/api/compliance/check`,
      testPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    checkId = response.data.id;
    console.log(`✅ Check initiated with ID: ${checkId}\n`);
    console.log("⏳ Processing compliance check...\n");

    // Subscribe to check updates
    socket.emit('compliance:subscribe', { checkId });

    // Wait for completion (with timeout)
    const completionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for completion'));
      }, 180000); // 3 minute timeout

      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_BASE_URL}/api/compliance/status/${checkId}`);
          
          if (statusResponse.data.status === 'completed') {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve(statusResponse.data);
          } else if (statusResponse.data.status === 'failed') {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            reject(new Error('Check failed: ' + statusResponse.data.error));
          }
        } catch (error) {
          // Continue checking
        }
      }, 2000); // Check every 2 seconds
    });

    const finalResult = await completionPromise;

    // Step 2: Get detailed results
    console.log("\n📥 Fetching detailed results...\n");
    
    const resultsResponse = await axios.get(`${API_BASE_URL}/api/compliance/results/${checkId}`);
    const results = resultsResponse.data;

    console.log("=" .repeat(50));
    console.log("📋 COMPLIANCE CHECK RESULTS");
    console.log("=" .repeat(50));
    console.log(`\nCheck ID: ${results.id}`);
    console.log(`Status: ${results.status}`);
    console.log(`Total Requirements Found: ${results.totalRequirements}`);
    
    if (results.groupedRequirements) {
      console.log("\n📂 Requirements by Jurisdiction:");
      console.log(`   Federal: ${results.groupedRequirements.federal.length}`);
      console.log(`   State: ${results.groupedRequirements.state.length}`);
      console.log(`   Local: ${results.groupedRequirements.local.length}`);
      console.log(`   Industry: ${results.groupedRequirements.industry.length}`);
      
      console.log("\n🎯 Requirements by Confidence:");
      console.log(`   High: ${results.groupedRequirements.high.length}`);
      console.log(`   Medium: ${results.groupedRequirements.medium.length}`);
      console.log(`   Low: ${results.groupedRequirements.low.length}`);
    }

    // Show sample requirements
    if (results.requirements && results.requirements.length > 0) {
      console.log("\n📌 Sample Requirements (First 5):");
      results.requirements.slice(0, 5).forEach((req: any, index: number) => {
        console.log(`\n   ${index + 1}. ${req.name}`);
        console.log(`      Category: ${req.sourceType}`);
        console.log(`      Agency: ${req.source}`);
        console.log(`      Confidence: ${req.confidenceLevel}`);
        if (req.formNumber) {
          console.log(`      Form: ${req.formNumber}`);
        }
        if (req.deadline) {
          console.log(`      Deadline: ${req.deadline}`);
        }
      });
    }

    console.log("\n✅ Test completed successfully!");
    
    // Show event summary
    console.log("\n📊 WebSocket Events Summary:");
    const eventTypes = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} events`);
    });

  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(error.response?.data || error.message);
  } finally {
    socket.disconnect();
    console.log("\n🔌 WebSocket disconnected");
    process.exit(0);
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    await axios.get(`${API_BASE_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

// Main
async function main() {
  console.log("🏁 Starting Compliance Flow Test");
  console.log("================================\n");
  
  // Check server health
  console.log("🔍 Checking if backend server is running...");
  const isHealthy = await checkServerHealth();
  
  if (!isHealthy) {
    console.error("❌ Backend server is not running!");
    console.error("   Please start the server with: npm run dev");
    process.exit(1);
  }
  
  console.log("✅ Backend server is running\n");
  
  // Run test
  await testComplianceFlow();
}

main().catch(console.error);