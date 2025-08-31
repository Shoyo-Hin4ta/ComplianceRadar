import React, { useEffect, useState } from 'react';
import { ComplianceApp } from './components/ComplianceApp';
import { WarmupNotification } from './components/WarmupNotification';
import { WarmupService } from './services/warmup.service';

function App() {
  const [showWarmupPopup, setShowWarmupPopup] = useState(false);

  useEffect(() => {
    // Popup disabled - using paid instance now
    // if (WarmupService.shouldShowWarmup()) {
    //   setShowWarmupPopup(true);
    // }
    
    // Keep warmup call for faster initial response
    WarmupService.warmupBackend().catch(err => {
      console.log('Backend health check');
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