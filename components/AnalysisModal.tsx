/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisText: string | null;
}

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, analysisText }) => {
  if (!isOpen) {
    return null;
  }

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 md:p-8 relative transform transition-all flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={handleModalContentClick}
        role="document"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 transition-colors z-10"
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
        <div className="text-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-extrabold text-zinc-800">AI Image Analysis</h2>
        </div>
        
        <div className="overflow-y-auto">
          {analysisText ? (
            <p className="bg-zinc-100 text-zinc-800 p-4 rounded-lg whitespace-pre-wrap">
                {analysisText}
            </p>
          ) : (
             <p className="text-zinc-500 text-center">No analysis result available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
