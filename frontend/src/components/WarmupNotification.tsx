import React from 'react';
import { Info } from 'lucide-react';

interface WarmupNotificationProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const WarmupNotification: React.FC<WarmupNotificationProps> = ({ 
  isVisible, 
  onDismiss 
}) => {
  if (!isVisible) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-200 border border-base-300">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-warning mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-base-content mb-2">
              Welcome to ComplianceIQ!
            </h3>
            <p className="text-base-content/80 mb-4">
              We're using free hosting, so the server may take 15-30 seconds to wake up 
              on your first request. Thank you for your patience!
            </p>
            <div className="modal-action mt-4">
              <button 
                onClick={onDismiss}
                className="btn btn-primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onDismiss}></div>
    </div>
  );
};