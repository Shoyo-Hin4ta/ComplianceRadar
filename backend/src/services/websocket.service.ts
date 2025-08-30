import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface ComplianceEvent {
  type: string;
  message?: string;
  progress?: number;
  data?: any;
  timestamp?: string;
  [key: string]: any;
}

export class WebSocketService {
  private io: SocketIOServer;
  private checkSessions: Map<string, Set<string>> = new Map(); // checkId -> Set of socketIds
  private socketToCheck: Map<string, string> = new Map(); // socketId -> checkId

  constructor(io: SocketIOServer) {
    this.io = io;
    console.log('WebSocket service initialized (using existing Socket.IO instance)');
  }


  /**
   * Emit event to all clients in a check session
   */
  emitToCheck(checkId: string, event: ComplianceEvent) {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Emit to room (using checkId directly to match frontend subscription)
    this.io.to(checkId).emit('compliance-update', {
      checkId,
      ...event
    });

    // Log significant events
    if (event.type.includes('complete') || event.type.includes('error')) {
      // Handle different event types with appropriate logging
      let logMessage = '';
      if (event.message) {
        logMessage = event.message;
      } else if (event.totalRequirements !== undefined) {
        logMessage = `Total requirements: ${event.totalRequirements}`;
      } else if (event.error) {
        logMessage = event.error;
      }
      console.log(`Emitted to check ${checkId}:`, event.type, logMessage);
    }
  }

  /**
   * Emit event to all connected clients
   */
  broadcast(event: ComplianceEvent) {
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }
    
    this.io.emit('global-update', event);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      activeSessions: this.checkSessions.size,
      connectedClients: this.io.sockets.sockets.size,
      sessions: Array.from(this.checkSessions.entries()).map(([checkId, sockets]) => ({
        checkId,
        clientCount: sockets.size
      }))
    };
  }

  /**
   * Emit granular progress events for better UX
   */
  emitProgressEvent(checkId: string, step: string, details: any) {
    const progressEvents: { [key: string]: ComplianceEvent } = {
      'query-building': {
        type: 'query-building',
        message: 'Building comprehensive compliance query...',
        progress: 2,
        ...details
      },
      'searching': {
        type: 'sonar-searching',
        message: 'Searching 40+ government databases...',
        progress: 10,
        ...details
      },
      'url-found': {
        type: 'url-found',
        message: `Found source: ${details.title}`,
        progress: details.progress || 15,
        ...details
      },
      'filtering': {
        type: 'filtering-urls',
        message: `Analyzing ${details.total} URLs for relevance...`,
        progress: 22,
        ...details
      },
      'filtered': {
        type: 'urls-filtered',
        message: `Selected ${details.selected} most authoritative sources`,
        progress: 25,
        ...details
      },
      'scraping': {
        type: 'scraping-site',
        message: `Scraping ${details.url}...`,
        progress: details.progress || 30,
        ...details
      },
      'site-complete': {
        type: 'site-complete',
        message: `Found ${details.rulesFound} rules from ${details.url}`,
        progress: details.progress || 40,
        ...details
      },
      'processing': {
        type: 'processing-data',
        message: details.message || 'Processing extracted data...',
        progress: details.progress || 87,
        ...details
      },
      'complete': {
        type: 'complete',
        message: `Complete! Found ${details.totalRules} requirements from ${details.sources} sources`,
        progress: 100,
        ...details
      },
      'error': {
        type: 'error',
        message: details.message || 'An error occurred',
        progress: details.progress,
        ...details
      }
    };

    const event = progressEvents[step] || {
      type: step,
      ...details
    };

    this.emitToCheck(checkId, event);
  }
}

// Singleton instance
let websocketServiceInstance: WebSocketService | null = null;

export function initializeWebSocketService(io: SocketIOServer): WebSocketService {
  if (!websocketServiceInstance) {
    websocketServiceInstance = new WebSocketService(io);
  }
  return websocketServiceInstance;
}

export function getWebSocketService(): WebSocketService | null {
  return websocketServiceInstance;
}