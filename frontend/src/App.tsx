import React, { useEffect, useState } from 'react';
import { ComplianceApp } from './components/ComplianceApp';
import { WarmupNotification } from './components/WarmupNotification';
import { WarmupService } from './services/warmup.service';

function App() {
  const [showWarmupPopup, setShowWarmupPopup] = useState(false);

  useEffect(() => {
    // Check if we need to show warmup popup (first visit in session)
    if (WarmupService.shouldShowWarmup()) {
      setShowWarmupPopup(true);
    }
    
    // Always call warmup on page load to spin up the backend
    // This happens silently in the background
    WarmupService.warmupBackend().catch(err => {
      console.log('Backend warmup call initiated (may take 15-30s if cold start)');
    });
  }, []);

  const handleDismissPopup = () => {
    setShowWarmupPopup(false);
    WarmupService.markWarmupComplete();
  };

  return (
    <>
      <WarmupNotification 
        isVisible={showWarmupPopup} 
        onDismiss={handleDismissPopup}
      />
      <ComplianceApp />
    </>
  );
}

export default App;