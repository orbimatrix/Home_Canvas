/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateCompositeImage, analyzeImage, editImage } from './services/geminiService';
import { Product } from './types';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ObjectCard from './components/ObjectCard';
import Spinner from './components/Spinner';
import DebugModal from './components/DebugModal';
import TouchGhost from './components/TouchGhost';
import ProductSelector from './components/ProductSelector';
import AddProductModal from './components/AddProductModal';
import AnalysisModal from './components/AnalysisModal';

// Pre-load a transparent image to use for hiding the default drag ghost.
// This prevents a race condition on the first drag.
const transparentDragImage = new Image();
transparentDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

const loadingMessages = [
    "Analyzing your product...",
    "Surveying the scene...",
    "Describing placement location with AI...",
    "Crafting the perfect composition prompt...",
    "Generating photorealistic options...",
    "Assembling the final scene..."
];

const PREDEFINED_PRODUCTS: Product[] = [
  { id: 101, name: 'Comfy Armchair', imageUrl: '/assets/armchair.jpg' },
  { id: 102, name: 'Modern Lamp', imageUrl: '/assets/object.jpeg' },
  { id: 103, name: 'Potted Plant', imageUrl: '/assets/pottedplant.jpg' },
];

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8a5 5 0 015 5v1" />
    </svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 15l3-3m0 0l-3-3m3 3H5a5 5 0 00-5 5v1" />
    </svg>
);

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(PREDEFINED_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [sceneHistory, setSceneHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [persistedOrbPosition, setPersistedOrbPosition] = useState<{x: number, y: number} | null>(null);
  const [debugImageUrl, setDebugImageUrl] = useState<string | null>(null);
  const [debugPrompt, setDebugPrompt] = useState<string | null>(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productScale, setProductScale] = useState<number>(1);

  // State for touch drag & drop
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
  const [touchGhostPosition, setTouchGhostPosition] = useState<{x: number, y: number} | null>(null);
  const [isHoveringDropZone, setIsHoveringDropZone] = useState<boolean>(false);
  const [touchOrbPosition, setTouchOrbPosition] = useState<{x: number, y: number} | null>(null);
  const sceneImgRef = useRef<HTMLImageElement>(null);
  
  // State for new features
  const [editPrompt, setEditPrompt] = useState('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sceneImage = sceneHistory[historyIndex] || null;
  const sceneImageUrl = sceneImage ? URL.createObjectURL(sceneImage) : null;
  const productImageUrl = selectedProduct ? selectedProduct.imageUrl : null;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < sceneHistory.length - 1;

  const handleUndo = () => {
    if (canUndo) {
        setHistoryIndex(prev => prev - 1);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
        setHistoryIndex(prev => prev + 1);
    }
  };

  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
    // Fetch the image data (works for both asset URLs and blob URLs) and create a File object
    // This ensures productImageFile is always set for the composition service.
    fetch(product.imageUrl)
        .then(res => {
            if (!res.ok) throw new Error(`Failed to fetch product image: ${product.imageUrl}`);
            return res.blob();
        })
        .then(blob => {
            const extension = blob.type.split('/')[1] ?? 'jpeg';
            const filename = product.name.replace(/\s+/g, '_').toLowerCase() + `.${extension}`;
            const file = new File([blob], filename, { type: blob.type });
            setProductImageFile(file);
        })
        .catch(err => {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Could not load the selected product image. Details: ${errorMessage}`);
            console.error(err);
        });
  }, []);

  const handleAddCustomProduct = useCallback((file: File) => {
    setError(null);
    try {
        const imageUrl = URL.createObjectURL(file);
        const newProduct: Product = {
            id: Date.now(),
            name: file.name,
            imageUrl: imageUrl,
        };
        setProducts(prev => [...prev, newProduct]);
        setSelectedProduct(newProduct);
        setProductImageFile(file);
        setIsAddProductModalOpen(false); // Close modal on success
    } catch(err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Could not load the product image. Details: ${errorMessage}`);
      console.error(err);
    }
  }, []);
  
  const handleSceneUpload = useCallback((file: File) => {
    setSceneHistory([file]);
    setHistoryIndex(0);
    setPersistedOrbPosition(null);
    setDebugImageUrl(null);
    setDebugPrompt(null);
  }, []);

  const handleInstantStart = useCallback(async () => {
    setError(null);
    try {
      // 1. Select the first predefined product
      const productToSelect = products[0];
      if (productToSelect) {
        handleProductSelect(productToSelect);
      } else {
        throw new Error('No predefined products available for instant start.');
      }

      // 2. Fetch the default scene
      const sceneResponse = await fetch('https://storage.googleapis.com/gemini-ui-workshop-assets/scene.jpeg');
      if (!sceneResponse.ok) {
        throw new Error('Failed to load default scene image');
      }
      const sceneBlob = await sceneResponse.blob();
      const sceneFile = new File([sceneBlob], 'scene.jpeg', { type: 'image/jpeg' });
      handleSceneUpload(sceneFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Could not load default images. Details: ${errorMessage}`);
      console.error(err);
    }
  }, [products, handleProductSelect, handleSceneUpload]);

  const handleProductDrop = useCallback(async (position: {x: number, y: number}, relativePosition: { xPercent: number; yPercent: number; }) => {
    const currentSceneImage = sceneHistory[historyIndex];
    if (!productImageFile || !currentSceneImage || !selectedProduct) {
      setError('An unexpected error occurred. Please try again.');
      return;
    }
    setPersistedOrbPosition(position);
    setIsLoading(true);
    setError(null);
    try {
      const { finalImageUrl, debugImageUrl, finalPrompt } = await generateCompositeImage(
        productImageFile, 
        selectedProduct.name,
        currentSceneImage,
        currentSceneImage.name,
        relativePosition,
        productScale
      );
      setDebugImageUrl(debugImageUrl);
      setDebugPrompt(finalPrompt);
      const newSceneFile = dataURLtoFile(finalImageUrl, `generated-scene-${Date.now()}.jpeg`);
      
      const newHistory = sceneHistory.slice(0, historyIndex + 1); // Discard "redo" states
      newHistory.push(newSceneFile);
      setSceneHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);


    } catch (err)
 {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate the image. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
      setPersistedOrbPosition(null);
    }
  }, [productImageFile, selectedProduct, productScale, sceneHistory, historyIndex]);

  const handleAnalyzeScene = async () => {
    const currentSceneImage = sceneHistory[historyIndex];
    if (!currentSceneImage) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
        const result = await analyzeImage(currentSceneImage);
        setAnalysisResult(result);
        setIsAnalysisModalOpen(true);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to analyze the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleEditImage = async () => {
      if (!editPrompt.trim()) return;
      const currentSceneImage = sceneHistory[historyIndex];
      if (!currentSceneImage) return;

      setIsLoading(true); // use the main loader
      setError(null);

      try {
          const { finalImageUrl } = await editImage(currentSceneImage, editPrompt);
          const newSceneFile = dataURLtoFile(finalImageUrl, `edited-scene-${Date.now()}.jpeg`);

          const newHistory = sceneHistory.slice(0, historyIndex + 1);
          newHistory.push(newSceneFile);
          setSceneHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          setEditPrompt(''); // Clear prompt on success
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
          setError(`Failed to edit the image. ${errorMessage}`);
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleReset = useCallback(() => {
    // Let useEffect handle URL revocation
    setProducts(PREDEFINED_PRODUCTS);
    setSelectedProduct(null);
    setProductImageFile(null);
    setSceneHistory([]);
    setHistoryIndex(-1);
    setError(null);
    setIsLoading(false);
    setPersistedOrbPosition(null);
    setDebugImageUrl(null);
    setDebugPrompt(null);
    setProductScale(1);
  }, []);

  const handleChangeProduct = useCallback(() => {
    setSelectedProduct(null);
    setProductImageFile(null);
    setPersistedOrbPosition(null);
    setProductScale(1);
    // Don't clear scene so user can try another product
  }, []);
  
  const handleChangeScene = useCallback(() => {
    setSceneHistory([]);
    setHistoryIndex(-1);
    setPersistedOrbPosition(null);
    setDebugImageUrl(null);
    setDebugPrompt(null);
  }, []);

  useEffect(() => {
    return () => {
        if (sceneImageUrl) URL.revokeObjectURL(sceneImageUrl);
    };
  }, [sceneImageUrl]);
  
  useEffect(() => {
    // Clean up all blob URLs created for custom products when component unmounts
    return () => {
        products.forEach(product => {
            if (product.imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(product.imageUrl);
            }
        });
    };
  }, [products]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
        setLoadingMessageIndex(0); // Reset on start
        interval = setInterval(() => {
            setLoadingMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
        }, 3000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!selectedProduct) return;
    e.preventDefault();
    setIsTouchDragging(true);
    const touch = e.touches[0];
    setTouchGhostPosition({ x: touch.clientX, y: touch.clientY });
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging) return;
      const touch = e.touches[0];
      setTouchGhostPosition({ x: touch.clientX, y: touch.clientY });
      
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = elementUnderTouch?.closest<HTMLDivElement>('[data-dropzone-id="scene-uploader"]');

      if (dropZone) {
          const rect = dropZone.getBoundingClientRect();
          setTouchOrbPosition({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
          setIsHoveringDropZone(true);
      } else {
          setIsHoveringDropZone(false);
          setTouchOrbPosition(null);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTouchDragging) return;
      
      const touch = e.changedTouches[0];
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = elementUnderTouch?.closest<HTMLDivElement>('[data-dropzone-id="scene-uploader"]');

      if (dropZone && sceneImgRef.current) {
          const img = sceneImgRef.current;
          const containerRect = dropZone.getBoundingClientRect();
          const { naturalWidth, naturalHeight } = img;
          const { width: containerWidth, height: containerHeight } = containerRect;

          const imageAspectRatio = naturalWidth / naturalHeight;
          const containerAspectRatio = containerWidth / containerHeight;

          let renderedWidth, renderedHeight;
          if (imageAspectRatio > containerAspectRatio) {
              renderedWidth = containerWidth;
              renderedHeight = containerWidth / imageAspectRatio;
          } else {
              renderedHeight = containerHeight;
              renderedWidth = containerHeight * imageAspectRatio;
          }
          
          const offsetX = (containerWidth - renderedWidth) / 2;
          const offsetY = (containerHeight - renderedHeight) / 2;

          const dropX = touch.clientX - containerRect.left;
          const dropY = touch.clientY - containerRect.top;

          const imageX = dropX - offsetX;
          const imageY = dropY - offsetY;
          
          if (!(imageX < 0 || imageX > renderedWidth || imageY < 0 || imageY > renderedHeight)) {
            const xPercent = (imageX / renderedWidth) * 100;
            const yPercent = (imageY / renderedHeight) * 100;
            
            handleProductDrop({ x: dropX, y: dropY }, { xPercent, yPercent });
          }
      }

      setIsTouchDragging(false);
      setTouchGhostPosition(null);
      setIsHoveringDropZone(false);
      setTouchOrbPosition(null);
    };

    if (isTouchDragging) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTouchDragging, handleProductDrop]);

  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-50 border border-red-200 p-8 rounded-lg max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold mb-4 text-red-800">An Error Occurred</h2>
            <p className="text-lg text-red-700 mb-6">{error}</p>
            <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }
    
    if (!selectedProduct || !sceneImage) {
      return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col">
              <h2 className="text-2xl font-extrabold text-center mb-5 text-zinc-800">1. Select a Product</h2>
              <ProductSelector
                products={products}
                selectedProduct={selectedProduct}
                onSelect={handleProductSelect}
                onAddOwnProductClick={() => setIsAddProductModalOpen(true)}
              />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-extrabold text-center mb-5 text-zinc-800">2. Upload a Scene</h2>
              <ImageUploader 
                id="scene-uploader"
                onFileSelect={handleSceneUpload}
                imageUrl={sceneImageUrl}
              />
            </div>
          </div>
          <div className="text-center mt-10 min-h-[4rem] flex flex-col justify-center items-center">
             { !selectedProduct && !sceneImage && (
                <>
                    <p className="text-zinc-500 animate-fade-in">
                        Choose a product and upload a scene to begin.
                    </p>
                    <p className="text-zinc-500 animate-fade-in mt-2">
                        Or click{' '}
                        <button
                            onClick={handleInstantStart}
                            className="font-bold text-blue-600 hover:text-blue-800 underline transition-colors"
                        >
                            here
                        </button>
                        {' '}for an instant start.
                    </p>
                </>
             )}
             { (selectedProduct || sceneImage) && (!selectedProduct || !sceneImage) && (
                 <p className="text-zinc-500 animate-fade-in">
                    { !selectedProduct ? "Now, select a product." : "Great! Now upload a background scene."}
                 </p>
             )}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-7xl mx-auto animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Product Column */}
          <div className="md:col-span-1 flex flex-col">
            <h2 className="text-2xl font-extrabold text-center mb-5 text-zinc-800">Product</h2>
            <div className="flex-grow flex flex-col items-center justify-center">
              <div 
                  draggable="true" 
                  onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
                  }}
                  onTouchStart={handleTouchStart}
                  className="cursor-move w-full max-w-xs"
                  style={{ transform: `scale(${productScale})`, transition: 'transform 0.2s ease-out' }}
              >
                  <ObjectCard product={selectedProduct!} isSelected={true} />
              </div>
              <div className="w-full max-w-xs mt-6">
                <label htmlFor="scale-slider" className="block text-sm font-medium text-zinc-600 text-center mb-2">Adjust Scale</label>
                <input
                    id="scale-slider"
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={productScale}
                    onChange={(e) => setProductScale(parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
                    aria-label="Adjust product scale"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
                    <span>Smaller</span>
                    <span>Default</span>
                    <span>Larger</span>
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
               <div className="h-5 flex items-center justify-center">
                <button
                    onClick={handleChangeProduct}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                    Change Product
                </button>
               </div>
            </div>
          </div>
          {/* Scene Column */}
          <div className="md:col-span-2 flex flex-col">
            <div className="flex justify-center items-center mb-5 relative">
              <h2 className="text-2xl font-extrabold text-zinc-800">Scene</h2>
              {sceneHistory.length > 1 && (
                <div className="absolute right-0 flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-2 rounded-md bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Undo last action"
                  >
                    <UndoIcon />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-2 rounded-md bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Redo last action"
                  >
                    <RedoIcon />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-grow flex flex-col items-center justify-center">
              <ImageUploader 
                  ref={sceneImgRef}
                  id="scene-uploader" 
                  onFileSelect={handleSceneUpload} 
                  imageUrl={sceneImageUrl}
                  isDropZone={!!sceneImage && !isLoading}
                  onProductDrop={handleProductDrop}
                  persistedOrbPosition={persistedOrbPosition}
                  showDebugButton={!!debugImageUrl && !isLoading}
                  onDebugClick={() => setIsDebugModalOpen(true)}
                  isTouchHovering={isHoveringDropZone}
                  touchOrbPosition={touchOrbPosition}
              />
               {/* NEW UI: Analysis and Edit controls */}
              {sceneImage && !isLoading && (
                  <div className="w-full max-w-2xl mx-auto mt-6 space-y-4 animate-fade-in">
                      {/* Analysis section */}
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg">
                          <p className="text-sm text-zinc-600 mb-3">Get a detailed description of the current scene using AI.</p>
                          <button
                              onClick={handleAnalyzeScene}
                              disabled={isAnalyzing}
                              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold py-2 px-4 rounded-lg transition-colors border border-zinc-300 shadow-sm disabled:opacity-50 disabled:cursor-wait"
                              aria-label="Analyze scene with AI"
                          >
                              {isAnalyzing ? (
                                  <svg className="animate-spin h-5 w-5 text-zinc-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                              ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                              )}
                              Analyze Scene
                          </button>
                      </div>

                      {/* Edit section */}
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg">
                          <label htmlFor="edit-prompt" className="block text-sm font-medium text-zinc-700 mb-2">
                              Or, edit the scene with a prompt:
                          </label>
                          <div className="flex gap-2">
                              <input
                                  id="edit-prompt"
                                  type="text"
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder="e.g., 'Make the lighting dramatic'"
                                  className="flex-grow block w-full rounded-md border-zinc-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                              />
                              <button
                                  onClick={handleEditImage}
                                  disabled={!editPrompt.trim()}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Apply edit to scene"
                              >
                                  Apply
                              </button>
                          </div>
                      </div>
                  </div>
              )}
            </div>
            <div className="text-center mt-4">
              <div className="h-5 flex items-center justify-center">
                {sceneImage && !isLoading && (
                  <button
                      onClick={handleChangeScene}
                      className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                  >
                      Change Scene
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-10 min-h-[8rem] flex flex-col justify-center items-center">
           {isLoading ? (
             <div className="animate-fade-in">
                <Spinner />
                <p className="text-xl mt-4 text-zinc-600 transition-opacity duration-500">{loadingMessages[loadingMessageIndex]}</p>
             </div>
           ) : (
             <p className="text-zinc-500 animate-fade-in">
                Drag the product onto a location in the scene, or simply click where you want it.
             </p>
           )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-white text-zinc-800 flex items-center justify-center p-4 md:p-8">
      <TouchGhost 
        imageUrl={isTouchDragging ? productImageUrl : null} 
        position={touchGhostPosition}
      />
      <div className="flex flex-col items-center gap-8 w-full">
        <Header />
        <main className="w-full">
          {renderContent()}
        </main>
      </div>
      <DebugModal 
        isOpen={isDebugModalOpen} 
        onClose={() => setIsDebugModalOpen(false)}
        imageUrl={debugImageUrl}
        prompt={debugPrompt}
      />
      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onFileSelect={handleAddCustomProduct}
      />
      <AnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        analysisText={analysisResult}
      />
    </div>
  );
};

export default App;