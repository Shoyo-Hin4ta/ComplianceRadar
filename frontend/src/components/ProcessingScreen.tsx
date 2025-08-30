import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Globe, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database,
  TrendingUp
} from 'lucide-react';
import { useComplianceStore } from '../store/compliance.store';

interface ProcessingScreenProps {
  checkId: string;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ checkId }) => {
  const { v2Progress } = useComplianceStore();

  useEffect(() => {
    // Subscribe to WebSocket events through the store
    const { subscribeToCheckUpdates } = useComplianceStore.getState();
    subscribeToCheckUpdates(checkId);
  }, [checkId]);

  // Define getEventMessage function BEFORE using it
  const getEventMessage = (event: any) => {
    switch(event.type) {
      // Query phase
      case 'query-building': return '🔨 Building comprehensive compliance query...';
      case 'fetching-urls': return '🔍 Searching for compliance information...';
      case 'url-found': return `📌 Found: ${event.title || 'source'} (${event.url?.split('/')[2] || event.url})`;
      case 'urls-received': return `📚 Found ${event.count} information sources`;
      
      // Filtering phase
      case 'filtering-urls': return '🎯 Analyzing relevance of sources...';
      case 'categorizing-urls': return '📊 Categorizing by jurisdiction...';
      case 'urls-filtered': return `✅ Selected ${event.selected} of ${event.total} sources`;
      
      // Scraping phase  
      case 'batch-starting': return '⚙️ Starting to scrape compliance data...';
      case 'batch-started': return `📥 Processing ${event.count} sources...`;
      case 'scraping-site': return `🌐 Scraping ${event.url?.split('/')[2]} (${event.index}/${event.total})...`;
      case 'site-complete': return `✓ Found ${event.rulesFound} requirements from site ${event.index}/${event.total}`;
      case 'site-failed': return `⚠️ Failed to scrape: ${event.error}`;
      case 'batch-complete': return `📊 Processed ${event.successful}/${event.urlsProcessed} sources`;
      case 'scraping-complete': return `✅ Scraped ${event.successCount} sources, found ${event.totalRequirements} requirements`;
      
      // Processing phase
      case 'processing-data': return '📋 Extracting and organizing requirements...';
      case 'aggregation-complete': return `🔍 Processed ${event.afterDedup} unique requirements (removed ${event.totalFound - event.afterDedup} duplicates)`;
      case 'processing-requirements': return '🔄 Processing extracted requirements...';
      case 'starting-extraction': return '⚙️ Beginning requirement extraction...';
      
      // Complete
      case 'complete': return `✅ Complete! Found ${event.totalRules} requirements from ${event.sources} sources`;
      case 'error': return `❌ Error: ${event.error || event.message}`;
      
      // Webhook events
      case 'webhook-page-complete': return `📄 Processed page: found ${event.rulesFound} requirements`;
      
      default: return event.message || `📌 ${event.type}`;
    }
  };

  // Build event log from raw events using getEventMessage for formatting
  const eventLog = v2Progress.rawEvents.map((event, idx) => ({
    id: idx,
    type: event.type,
    message: getEventMessage(event),
    timestamp: new Date() // Could store timestamp in event if needed
  })); // Show all events - no slicing

  // Define all phases with their metadata
  const phases = [
    {
      id: 'query',
      label: 'Building Query',
      description: 'Creating targeted search queries based on your business profile',
      icon: Search
    },
    {
      id: 'discovery',
      label: 'Discovering Sources',
      description: 'Searching federal, state, and local compliance databases',
      icon: Globe
    },
    {
      id: 'filtering',
      label: 'Filtering & Categorizing',
      description: 'AI analyzing relevance and categorizing by jurisdiction',
      icon: Database
    },
    {
      id: 'scraping',
      label: 'Extracting Requirements',
      description: 'Reading and extracting compliance rules from authoritative sources',
      icon: FileText
    },
    {
      id: 'processing',
      label: 'Processing & Deduplication',
      description: 'Organizing requirements and removing duplicates',
      icon: TrendingUp
    }
  ];

  const getPhaseIcon = (phase: string) => {
    const phaseData = phases.find(p => p.id === phase);
    if (phase === 'complete') return <CheckCircle className="w-5 h-5" />;
    if (phaseData) {
      const Icon = phaseData.icon;
      return <Icon className="w-5 h-5" />;
    }
    return <Loader2 className="w-5 h-5 animate-spin" />;
  };

  const getPhaseLabel = (phase: string) => {
    if (phase === 'complete') return 'Complete';
    const phaseData = phases.find(p => p.id === phase);
    return phaseData?.label || 'Initializing';
  };

  const getPhaseDescription = (phase: string) => {
    const phaseData = phases.find(p => p.id === phase);
    return phaseData?.description || '';
  };

  // Get current phase details for display
  const getCurrentPhaseDetails = () => {
    switch (v2Progress.currentPhase) {
      case 'query':
        return 'Analyzing your business profile to build comprehensive search queries...';
      case 'discovery':
        const discovered = v2Progress.stats.urlsDiscovered;
        return discovered > 0 
          ? `Found ${discovered} potential compliance sources so far...`
          : 'Searching across government and industry databases...';
      case 'filtering':
        return 'Using AI to identify the most relevant sources for your business...';
      case 'scraping':
        const scraped = v2Progress.stats.sitesScraped;
        const total = v2Progress.stats.sitesTotal;
        if (scraped > 0 && total > 0) {
          return `Extracting requirements from source ${scraped} of ${total}...`;
        }
        return 'Starting to extract compliance requirements...';
      case 'processing':
        const reqs = v2Progress.stats.totalRequirements;
        return reqs > 0
          ? `Processing ${reqs} requirements, removing duplicates...`
          : 'Organizing and validating extracted requirements...';
      case 'complete':
        return `Found ${v2Progress.stats.totalRequirements} compliance requirements!`;
      default:
        return 'Initializing compliance check...';
    }
  };

  return (
    <div className="h-[calc(100vh-3rem)] bg-base-100 overflow-hidden flex flex-col">
      {/* Header - 10% of available height */}
      <div className="h-[10%] flex items-center justify-center border-b border-base-300">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-base-content">
            Finding compliance requirements...
          </h1>
          <p className="text-base-content/70 text-sm">
            {v2Progress.currentPhase === 'complete' 
              ? 'Analysis complete!' 
              : 'Checking the internet for you'}
          </p>
        </div>
      </div>

      {/* Main Content Area - 90% of available height */}
      <div className="h-[90%] px-6 py-3 overflow-hidden">
        <div className="h-full grid grid-cols-[40%_60%] gap-6">
          {/* Live Backend Feed - Left Panel */}
          <div className="card bg-base-200 shadow-xl h-full flex flex-col overflow-hidden">
            <div className="card-body flex flex-col h-full p-4 min-h-0">
              <h2 className="card-title text-error mb-2 flex-shrink-0">
                <div className="badge badge-error badge-sm mr-2 animate-pulse">LIVE</div>
                Backend Feed
              </h2>
              
              <div 
                className="bg-base-300 rounded-lg p-4 flex-1 overflow-y-auto min-h-0 space-y-2 font-mono text-sm overscroll-contain"
                onWheel={(e) => e.stopPropagation()}
              >
                {eventLog.map((event) => (
                  <div key={event.id} className="flex items-start space-x-2 text-base-content/80">
                    <span className="text-success">✓</span>
                    <div className="flex-1">
                      <span className="ml-2">{event.message}</span>
                    </div>
                  </div>
                ))}
                
                {/* Current activity indicator */}
                {v2Progress.currentPhase !== 'complete' && (
                  <div className="flex items-center space-x-2 text-warning">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Requirements Discovery Progress - Right Panel */}
          <div className="card bg-base-200 shadow-xl h-full flex flex-col overflow-hidden">
            <div className="card-body flex flex-col h-full p-6 overflow-hidden">
              <h2 className="card-title mb-2 flex-shrink-0">Requirements Discovery Progress</h2>
              
              <div className="flex flex-col h-full gap-3 overflow-hidden">
                {/* Current Phase Status */}
                {v2Progress.currentPhase === 'complete' ? (
                  <div className="bg-success/10 rounded-lg p-4 border border-success/20">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-8 h-8 text-success flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-semibold text-success mb-1">Analysis Complete!</div>
                        <div className="text-sm text-base-content/80">
                          {getCurrentPhaseDetails()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-primary">Current Phase</span>
                    </div>
                    <div className="text-sm text-base-content/80">
                      {getCurrentPhaseDetails()}
                    </div>
                  </div>
                )}

                {/* Horizontal Progress Timeline */}
                <div className="bg-base-300 rounded-lg p-4 h-24 flex-shrink-0">
                  <div className="relative flex items-center justify-between h-full px-6">
                    {/* Progress line background - positioned behind circles */}
                    <div className="absolute left-6 right-6 h-1 bg-base-content/20 z-0"></div>
                    
                    {/* Progress line filled */}
                    <div 
                      className="absolute left-6 h-1 bg-primary transition-all duration-500 z-0"
                      style={{ 
                        width: v2Progress.currentPhase === 'complete' 
                          ? 'calc(100% - 48px)'
                          : phases.findIndex(p => p.id === v2Progress.currentPhase) === -1
                          ? '0%'
                          : `calc((100% - 48px) * ${phases.findIndex(p => p.id === v2Progress.currentPhase) / (phases.length - 1)})`
                      }}
                    ></div>
                    
                    {/* Phase circles - positioned in front */}
                    {phases.map((phase, index) => {
                      const isActive = v2Progress.currentPhase === phase.id;
                      const phaseOrder = ['query', 'discovery', 'filtering', 'scraping', 'processing'];
                      const isComplete = phaseOrder.indexOf(v2Progress.currentPhase) > phaseOrder.indexOf(phase.id);
                      const Icon = phase.icon;
                      
                      return (
                        <div key={phase.id} className="relative z-10 flex flex-col items-center">
                          {/* Phase circle */}
                          <div className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                            isComplete ? 'bg-success text-base-100' : 
                            isActive ? 'bg-primary text-base-100' : 
                            'bg-base-100 border-2 border-base-content/20'
                          }`}>
                            {isComplete ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : (
                              <Icon className={`w-6 h-6 ${isActive ? '' : 'text-base-content/40'}`} />
                            )}
                            {isActive && (
                              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75"></div>
                            )}
                          </div>
                          
                          {/* Phase label */}
                          <span className={`absolute top-14 text-xs font-medium whitespace-nowrap ${
                            isActive ? 'text-primary' : 
                            isComplete ? 'text-success' : 
                            'text-base-content/50'
                          }`}>
                            {phase.label.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Statistics Grid */}
                <div className="flex-1 space-y-3 overflow-auto min-h-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="stats bg-base-300 shadow">
                      <div className="stat p-3">
                        <div className="stat-title text-xs mb-1">Sources Found</div>
                        <div className="stat-value text-primary text-3xl">
                          {v2Progress.stats.urlsDiscovered}
                        </div>
                        <div className="stat-desc text-xs mt-1">Compliance websites discovered</div>
                      </div>
                    </div>
                    
                    <div className="stats bg-base-300 shadow">
                      <div className="stat p-3">
                        <div className="stat-title text-xs mb-1">Sites Scraped</div>
                        <div className="stat-value text-success text-3xl">
                          {v2Progress.stats.sitesScraped}/{v2Progress.stats.sitesTotal || '?'}
                        </div>
                        <div className="stat-desc text-xs mt-1">Processing compliance data</div>
                      </div>
                    </div>
                  </div>

                  <div className="stats bg-gradient-to-r from-primary/10 to-secondary/10 shadow-lg w-full">
                    <div className="stat p-4">
                      <div className="stat-title text-sm">Total Requirements Found</div>
                      <div className="stat-value text-5xl text-primary">
                        {v2Progress.stats.totalRequirements}
                      </div>
                      <div className="stat-desc text-sm mt-2">
                        {v2Progress.stats.duplicatesRemoved > 0 
                          ? `${v2Progress.stats.duplicatesRemoved} duplicates removed` 
                          : 'Unique compliance requirements'}
                      </div>
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="bg-base-300 rounded-lg p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Overall Progress</span>
                      <span className="font-bold text-primary">{v2Progress.overallProgress}%</span>
                    </div>
                    <div className="relative">
                      <progress 
                        className="progress progress-primary w-full h-3 transition-all duration-500 ease-out" 
                        value={v2Progress.overallProgress} 
                        max="100"
                      ></progress>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};