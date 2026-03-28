import React, { useState, useEffect } from 'react';
import { X, Sliders, Sun, Contrast, Zap, CheckCircle } from 'lucide-react';
import { processImage, ProcessOptions } from '../services/imageProcessing.ts';

interface Props {
  imageUrl: string;
  onConfirm: (processedUrl: string) => void;
  onCancel: () => void;
}

export const ImageEditor: React.FC<Props> = ({ imageUrl, onConfirm, onCancel }) => {
  const [options, setOptions] = useState<ProcessOptions>({
    contrast: 1.1,
    brightness: 1.0,
    grayscale: false,
    maxWidth: 1200
  });
  const [previewUrl, setPreviewUrl] = useState<string>(imageUrl);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const processed = await processImage(imageUrl, options);
      setPreviewUrl(processed);
    }, 150);
    return () => clearTimeout(timer);
  }, [imageUrl, options]);

  const handleAutoEnhance = () => {
    setOptions({
      ...options,
      contrast: 1.4,
      brightness: 1.1,
      grayscale: true
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Görüntüyü İyileştir</h3>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center overflow-auto min-h-[300px]">
            <img 
              src={previewUrl} 
              alt="Önizleme" 
              className="max-w-full max-h-full rounded shadow-lg object-contain"
            />
          </div>

          <div className="w-full md:w-72 p-6 border-t md:border-t-0 md:border-l border-slate-100 space-y-6">
            <button 
              onClick={handleAutoEnhance}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
              <Zap size={16} />
              Otomatik İyileştir
            </button>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span className="flex items-center gap-1"><Sun size={12} /> Parlaklık</span>
                  <span>{Math.round(options.brightness * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.5" max="1.5" step="0.05"
                  value={options.brightness}
                  onChange={(e) => setOptions({...options, brightness: parseFloat(e.target.value)})}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span className="flex items-center gap-1"><Contrast size={12} /> Kontrast</span>
                  <span>{Math.round(options.contrast * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.0" step="0.05"
                  value={options.contrast}
                  onChange={(e) => setOptions({...options, contrast: parseFloat(e.target.value)})}
                  className="w-full accent-indigo-600"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-flex items-center">
                  <input 
                    type="checkbox" 
                    checked={options.grayscale}
                    onChange={(e) => setOptions({...options, grayscale: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-medium text-slate-700 select-none">Siyah-Beyaz (OCR Modu)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 px-4 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Vazgeç
          </button>
          <button 
            onClick={() => {
              setIsProcessing(true);
              onConfirm(previewUrl);
            }}
            disabled={isProcessing}
            className="flex-[2] py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? 'İşleniyor...' : (
              <>
                <CheckCircle size={18} />
                Analiz Et
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
