import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, Check, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<Props> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameRef = useRef<ImageData | null>(null);
  const stillnessCountRef = useRef(0);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [showFlash, setShowFlash] = useState(false);
  
  // Detection logic every 300ms
  const detectionInterval = 300;

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const constraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // We need to wait for the video element to be available in the DOM
      // Since it's only rendered when !isInitializing, we have a problem.
      // Let's change the rendering logic to always have the video element but hide it if initializing.
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Kameraya erişilemedi. Lütfen izinleri kontrol edin.");
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const handleVideoReady = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    setIsInitializing(false);
  };

  const capture = useCallback(() => {
    if (!videoRef.current || isCapturing) return;
    
    setIsCapturing(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          onCapture(blob);
        }
        setIsCapturing(false);
      }, 'image/jpeg', 0.85);
    }
  }, [isCapturing, onCapture]);

  // Stillness detection loop
  useEffect(() => {
    if (!autoCaptureEnabled || isInitializing || error || isCapturing) return;

    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw low-res for comparison
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (lastFrameRef.current) {
        let diff = 0;
        const data1 = lastFrameRef.current.data;
        const data2 = currentFrame.data;
        
        // Sample pixels for speed
        for (let i = 0; i < data1.length; i += 16) {
          diff += Math.abs(data1[i] - data2[i]);
        }
        
        const avgDiff = diff / (data1.length / 16);
        
        // If difference is very low, camera is being held still
        if (avgDiff < 8) {
          stillnessCountRef.current++;
          if (stillnessCountRef.current >= 4) { // ~1.2 seconds of stillness
            stillnessCountRef.current = 0;
            capture();
          }
        } else {
          stillnessCountRef.current = 0;
        }
      }
      
      lastFrameRef.current = currentFrame;
    }, detectionInterval);

    return () => clearInterval(interval);
  }, [autoCaptureEnabled, isInitializing, error, isCapturing, capture]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Video is always in DOM but hidden by loader if initializing */}
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleVideoReady}
        className={`h-full w-full object-cover transition-opacity duration-500 ${isInitializing || error ? 'opacity-0' : 'opacity-100'}`}
      />

      <AnimatePresence>
        {isInitializing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black gap-4 text-white"
          >
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p className="text-xs uppercase tracking-widest font-bold">Kamera Hazırlanıyor...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-6 p-10 text-center text-white">
          <p className="text-sm font-bold text-rose-500">{error}</p>
          <button 
            onClick={startCamera}
            className="px-6 py-3 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <RefreshCw size={14} /> Tekrar Dene
          </button>
          <button onClick={onClose} className="text-slate-400 text-xs font-bold uppercase underline">Kapat</button>
        </div>
      )}

      {!isInitializing && !error && (
        <>
          <canvas ref={canvasRef} width={100} height={100} className="hidden" />

          {/* Overlay UI */}
          <div className="absolute inset-x-0 top-0 p-6 flex items-center justify-between pointer-events-none">
            <button 
              onClick={onClose}
              className="p-3 bg-black/40 backdrop-blur-md text-white rounded-full pointer-events-auto active:scale-95"
            >
              <X size={20} />
            </button>
            
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto">
              <div className={`w-2 h-2 rounded-full ${autoCaptureEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-[10px] text-white font-bold uppercase tracking-widest">
                {autoCaptureEnabled ? 'Otomatik Algılama Açık' : 'Manuel Mod'}
              </span>
              <button 
                onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                className={`ml-1 text-[9px] px-2 py-0.5 rounded-md ${autoCaptureEnabled ? 'bg-white/10 text-white' : 'bg-indigo-600 text-white'}`}
              >
                {autoCaptureEnabled ? 'Kapat' : 'Aç'}
              </button>
            </div>

            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Guide Frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-[80vw] h-[60vh] border-2 rounded-3xl transition-all duration-300 ${stillnessCountRef.current > 0 ? 'border-emerald-500 scale-105 shadow-[0_0_50px_rgba(16,185,129,0.3)]' : 'border-white/30'}`}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                Fişi Çerçeveye Odaklayın
              </div>
              
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
            </div>
          </div>

          {/* Capture Controls */}
          <div className="absolute inset-x-0 bottom-0 p-10 flex items-center justify-center gap-12">
            <div className="w-12 h-12" /> {/* Layout balancer */}
            
            <button 
              onClick={capture}
              disabled={isCapturing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isCapturing ? 'scale-90 opacity-50' : 'active:scale-90 scale-105'}`}
            >
              <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent">
                 <div className="w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center">
                    <Camera size={24} className="text-slate-900" />
                 </div>
              </div>
            </button>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Sabitleyin</div>
              {stillnessCountRef.current > 0 && (
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`w-3 h-1.5 rounded-full ${i < stillnessCountRef.current ? 'bg-emerald-500' : 'bg-white/20'}`} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showFlash && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white z-[110]"
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
