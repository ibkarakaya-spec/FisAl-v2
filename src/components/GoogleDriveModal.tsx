import React, { useState, useEffect } from 'react';
import { X, Cloud, Database, FileText, CheckCircle2, AlertCircle, RefreshCw, LogOut, Upload, Download, ArrowRight, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  listBackups, 
  listReceiptFiles, 
  getBackupContent, 
  uploadBackup, 
  downloadFileAsBase64, 
  DriveFile 
} from '../services/googleDriveService';
import { ReceiptData } from '../types';
import { User } from 'firebase/auth';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: ReceiptData[];
  onImportReceipts: (imported: ReceiptData[]) => void;
  onProcessDriveFile: (base64Data: string, mimeType: string, fileName: string) => Promise<void>;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  receipts,
  onImportReceipts,
  onProcessDriveFile
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'backup' | 'import'>('backup');
  
  // Backups and Files States
  const [backups, setBackups] = useState<DriveFile[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setIsAuthChecking(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Backups and Files once Authed
  useEffect(() => {
    if (token) {
      loadDriveData();
    }
  }, [token, activeTab]);

  const loadDriveData = async () => {
    if (!token) return;
    setIsActionLoading(true);
    setStatusMessage(null);
    try {
      if (activeTab === 'backup') {
        const files = await listBackups(token);
        setBackups(files);
      } else {
        const files = await listReceiptFiles(token);
        setReceiptFiles(files);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Drive verileri yüklenemedi.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Giriş yapılamadı veya yetki reddedildi.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setBackups([]);
      setReceiptFiles([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackup = async () => {
    if (!token) return;
    if (receipts.length === 0) {
      setStatusMessage({ type: 'error', text: 'Yedeklenecek fiş bulunmuyor.' });
      return;
    }
    setIsActionLoading(true);
    setStatusMessage(null);
    try {
      await uploadBackup(token, receipts);
      setStatusMessage({ type: 'success', text: 'Fişleriniz başarıyla Google Drive\'a yedeklendi.' });
      // Reload backups
      const files = await listBackups(token);
      setBackups(files);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Yedekleme sırasında hata oluştu.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestore = async (backupFile: DriveFile) => {
    if (!token) return;
    const confirmRestore = window.confirm(
      `"${backupFile.name}" yedeğini geri yüklemek istiyor musunuz? Bu işlem mevcut tüm fiş listenizin yerine geçecektir!`
    );
    if (!confirmRestore) return;

    setIsActionLoading(true);
    setStatusMessage(null);
    try {
      const content = await getBackupContent(token, backupFile.id);
      if (Array.isArray(content)) {
        onImportReceipts(content);
        setStatusMessage({ type: 'success', text: 'Yedek başarıyla geri yüklendi!' });
      } else {
        throw new Error('Geçersiz yedek dosyası formatı.');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Yedek yüklenirken hata oluştu.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleProcessFile = async (driveFile: DriveFile) => {
    if (!token) return;
    const confirmOcr = window.confirm(
      `"${driveFile.name}" belgesini indirmek ve Gemini yapay zekasıyla taramak istiyor musunuz?`
    );
    if (!confirmOcr) return;

    onClose(); // Close modal first
    try {
      const base64Data = await downloadFileAsBase64(token, driveFile.id);
      await onProcessDriveFile(base64Data, driveFile.mimeType, driveFile.name);
    } catch (err: any) {
      console.error(err);
      alert(`Dosya işlenirken hata oluştu: ${err.message || err}`);
    }
  };

  // Helper formats
  const formatSize = (bytes?: string) => {
    if (!bytes) return '-';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '-';
    if (num < 1024) return `${num} B`;
    if (num < 1048576) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredReceiptFiles = receiptFiles.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-900 rounded-[30px] border border-slate-100 dark:border-slate-800 shadow-2xl relative w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <Cloud size={24} className="text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-md font-bold tracking-tight">Google Drive</h3>
              <p className="text-[10px] text-indigo-100/80 uppercase font-medium tracking-wider">Bulut Yedekleme & Akıllı OCR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        {/* Auth Loading State */}
        {isAuthChecking ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-500">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-xs font-medium">Google Drive yükleniyor...</span>
          </div>
        ) : !user ? (
          /* Sign-In UI */
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
            <div className="p-5 bg-indigo-50 dark:bg-slate-800 rounded-full text-indigo-600 dark:text-indigo-400">
              <Cloud size={48} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Google Drive Hesabınızı Bağlayın</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                Harcama verilerinizi güvenli bir şekilde yedekleyin, dilediğiniz zaman geri yükleyin veya Drive'daki fatura/fiş görsellerinizi Gemini AI ile taratın.
              </p>
            </div>

            {/* Google Styled Button as required by guidelines */}
            <button 
              onClick={handleSignIn}
              disabled={isActionLoading}
              className="gsi-material-button w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm font-medium text-xs transition-colors cursor-pointer"
            >
              <div className="gsi-material-button-icon flex items-center">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "18px", height: "18px" }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-black uppercase tracking-wider text-[11px] ml-1">Google ile Giriş Yap</span>
            </button>
            
            {statusMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-rose-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl w-full">
                <AlertCircle size={16} />
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>
        ) : (
          /* Logged In Workspace UI */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950/40">
            {/* User Profile bar */}
            <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-800" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.displayName || 'Kullanıcı'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleSignOut} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                title="Çıkış Yap"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Tab selection */}
            <div className="px-6 pt-3 bg-white dark:bg-slate-900 flex gap-2 border-b border-slate-100 dark:border-slate-800/80">
              <button 
                onClick={() => { setActiveTab('backup'); setStatusMessage(null); }}
                className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'backup' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <Database size={13} />
                Yedekle & Geri Yükle
              </button>
              <button 
                onClick={() => { setActiveTab('import'); setStatusMessage(null); }}
                className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'import' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <FileText size={13} />
                Drive'dan Belge Yükle
              </button>
            </div>

            {/* Status alerts */}
            {statusMessage && (
              <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 text-xs ${statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-rose-950/20 text-red-600 dark:text-red-400'}`}>
                {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* List area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {activeTab === 'backup' ? (
                /* Backup Tab content */
                <div className="space-y-4">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Mevcut Verileriniz</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Cihazınızda kayıtlı <strong>{receipts.length} adet</strong> fiş bulunuyor.</p>
                    </div>
                    <button 
                      onClick={handleBackup}
                      disabled={isActionLoading}
                      className="w-full md:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload size={14} />
                      Yedekle (Drive'a Yükle)
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Önceki Yedekler</h5>
                      <button onClick={loadDriveData} disabled={isActionLoading} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                        <RefreshCw size={13} className={isActionLoading ? 'animate-spin text-indigo-500' : ''} />
                      </button>
                    </div>

                    {isActionLoading && backups.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-indigo-500" size={16} />
                        Loading Backups...
                      </div>
                    ) : backups.length === 0 ? (
                      <div className="bg-white dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 text-xs">
                        Drive hesabınızda henüz FişAI yedeği bulunmuyor.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {backups.map(b => (
                          <div 
                            key={b.id} 
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate" title={b.name}>{b.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(b.createdTime)} • {formatSize(b.size)}</p>
                            </div>
                            <button 
                              onClick={() => handleRestore(b)}
                              disabled={isActionLoading}
                              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1 border border-slate-100 dark:border-slate-800 shrink-0 transition-colors disabled:opacity-50"
                            >
                              <Download size={11} />
                              Geri Yükle
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Import Files Tab content */
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Belge ismiyle ara..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taranabilir Fatura & Fişler</h5>
                      <button onClick={loadDriveData} disabled={isActionLoading} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                        <RefreshCw size={13} className={isActionLoading ? 'animate-spin text-indigo-500' : ''} />
                      </button>
                    </div>

                    {isActionLoading && receiptFiles.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-indigo-500" size={16} />
                        Belgeler yükleniyor...
                      </div>
                    ) : filteredReceiptFiles.length === 0 ? (
                      <div className="bg-white dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 text-xs">
                        {searchQuery ? 'Aramanıza uygun fatura/fiş bulunamadı.' : 'Drive hesabınızda taranabilir belge (Görsel veya PDF) bulunamadı.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredReceiptFiles.map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => handleProcessFile(f)}
                            disabled={isActionLoading}
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-3 transition-all hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 hover:-translate-y-0.5 text-left w-full group overflow-hidden disabled:opacity-50"
                          >
                            {/* Thumbnail / Icon */}
                            {f.thumbnailLink && f.mimeType.startsWith('image/') ? (
                              <img src={f.thumbnailLink} alt="" className="w-10 h-10 object-cover rounded-xl border border-slate-100 dark:border-slate-800 shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.mimeType === 'application/pdf' ? 'bg-red-50 text-red-500 dark:bg-red-950/20' : 'bg-slate-50 text-slate-500 dark:bg-slate-800'}`}>
                                <FileText size={18} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={f.name}>{f.name}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">{formatSize(f.size)} • {formatDate(f.createdTime)}</p>
                            </div>
                            <ArrowRight size={13} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
