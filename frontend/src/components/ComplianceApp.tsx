import React, { useEffect, useState } from 'react';
import { useComplianceStore } from '../store/compliance.store';
import { ComplianceForm } from './ComplianceForm';
import { ProcessingScreen } from './ProcessingScreen';
import { ResultsView } from './ResultsView';
import { FileCheck } from 'lucide-react';

export const ComplianceApp: React.FC = () => {
  const {
    businessProfile,
    currentCheck,
    v2Progress,
    isSubmitting,
    error,
    isConnected,
    submitComplianceCheck,
    connectWebSocket,
    clearError
  } = useComplianceStore();

  const [appState, setAppState] = useState<'form' | 'processing' | 'results'>('form');

  useEffect(() => {
    // Connect WebSocket on mount
    if (!isConnected) {
      connectWebSocket();
    }
  }, [connectWebSocket, isConnected]);

  // Update app state based on progress
  useEffect(() => {
    if (v2Progress.currentPhase === 'complete' && currentCheck?.requirements) {
      setAppState('results');
    } else if (v2Progress.overallProgress > 0 && v2Progress.overallProgress < 100) {
      setAppState('processing');
    }
  }, [v2Progress, currentCheck]);

  const handleFormSubmit = async (profile: any) => {
    clearError();
    
    // Transform the form data to match backend expectations
    const backendPayload = {
      businessProfile: {
        state: profile.state,
        city: profile.city,
        industry: profile.industry,
        naicsCode: profile.naicsCode,
        employeeCount: profile.employeeCount,
        annualRevenue: profile.annualRevenue,
        specialFactors: profile.specialFactors
      },
      sessionId: useComplianceStore.getState().isConnected ? 'socket-connected' : undefined
    };

    await submitComplianceCheck(backendPayload.businessProfile);
    setAppState('processing');
  };

  const handleStartOver = () => {
    useComplianceStore.getState().reset();
    setAppState('form');
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Connection Status Bar */}
      <div className="bg-base-300 border-b border-base-content/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-base-content">
                US Business Compliance Checker
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'} animate-pulse`} />
              <span className="text-xs text-base-content/60">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="alert alert-error">
            <span>{error}</span>
            <button className="btn btn-sm btn-ghost" onClick={clearError}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {appState === 'form' && (
        <ComplianceForm onSubmit={handleFormSubmit} isLoading={isSubmitting} />
      )}

      {appState === 'processing' && currentCheck?.id && (
        <ProcessingScreen checkId={currentCheck.id} />
      )}

      {appState === 'results' && currentCheck?.requirements && businessProfile && (
        <>
          <ResultsView 
            requirements={currentCheck.requirements} 
            businessProfile={{
              city: businessProfile.city,
              state: businessProfile.state,
              industry: businessProfile.industry,
              naicsCode: businessProfile.naicsCode,
              employeeCount: businessProfile.employeeCount
            }}
          />
          
          {/* Start Over Button */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <button 
                className="btn btn-primary btn-lg"
                onClick={handleStartOver}
              >
                Check Another Business
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};