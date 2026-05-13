import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, CheckCircle2, Circle, Clock, Trash2, Settings, 
  Cloud, CloudOff, LogIn, LogOut, Share2, AlertCircle,
  Calendar, Flag, ChevronRight, User, Users, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { taskService } from './services/taskService';
import { Task, Group, Priority, StorageMode } from './types';

const BizimPlanlar: React.FC = () => {
  const [mode, setMode] = useState<StorageMode>(() => 
    (localStorage.getItem('app_storage_mode') as StorageMode) || 'offline'
  );
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsLoading(true);
        loadGoogleData();
      } else {
        if (mode === 'google') setMode('offline');
        loadOfflineData();
      }
    });
    return () => unsubscribe();
  }, []);

  // Mode change listener
  useEffect(() => {
    localStorage.setItem('app_storage_mode', mode);
    if (mode === 'offline') {
      loadOfflineData();
    } else if (user) {
      loadGoogleData();
    }
  }, [mode, user]);

  const loadOfflineData = () => {
    const offlineTasks = taskService.getOfflineTasks();
    setTasks(offlineTasks);
    setIsLoading(false);
  };

  const loadGoogleData = async () => {
    try {
      const userGroups = await taskService.getGroups();
      setGroups(userGroups);
      if (userGroups.length > 0) {
        const lastGroupId = localStorage.getItem('last_group_id');
        const activeGroup = userGroups.find(g => g.id === lastGroupId) || userGroups[0];
        setSelectedGroupId(activeGroup.id);
        const googleTasks = await taskService.getTasks(activeGroup.id);
        setTasks(googleTasks);
      } else {
        setTasks([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      groupId: mode === 'google' ? selectedGroupId || 'default' : 'offline',
      memberUids: user ? [user.uid] : [],
      title: newTaskTitle,
      description: '',
      completed: false,
      category: 'Genel',
      priority: Priority.MEDIUM,
      createdBy: user?.uid || 'anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (mode === 'offline') {
      const updated = [newTask, ...tasks];
      setTasks(updated);
      taskService.saveOfflineTasks(updated);
    } else {
      if (!selectedGroupId) {
        alert("Lütfen önce bir grup seçin veya oluşturun.");
        return;
      }
      newTask.groupId = selectedGroupId;
      // Add all group members to task memberUids
      const group = groups.find(g => g.id === selectedGroupId);
      if (group) newTask.memberUids = group.members;
      
      await taskService.syncTask(newTask);
      setTasks(prev => [newTask, ...prev]);
    }

    setNewTaskTitle('');
    setShowAddModal(false);
  };

  const toggleTask = async (task: Task) => {
    const updatedTask = { ...task, completed: !task.completed, updatedAt: new Date().toISOString() };
    if (mode === 'offline') {
      const updated = tasks.map(t => t.id === task.id ? updatedTask : t);
      setTasks(updated);
      taskService.saveOfflineTasks(updated);
    } else {
      await taskService.syncTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (mode === 'offline') {
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      taskService.saveOfflineTasks(updated);
    } else {
      await taskService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleCreateGroup = async () => {
    const name = prompt("Grup ismi girin (Örn: Aile, İş):");
    if (name) {
      const newGroup = await taskService.createGroup(name);
      setGroups(prev => [...prev, newGroup]);
      setSelectedGroupId(newGroup.id);
      loadGoogleData();
    }
  };

  const migrateToGoogle = async () => {
    if (!user || !selectedGroupId) return;
    const offlineTasks = taskService.getOfflineTasks();
    if (offlineTasks.length === 0) {
      alert("Aktarılacak offline veri bulunamadı.");
      return;
    }

    if (confirm(`${offlineTasks.length} adet görevi Google Sync moduna aktarmak istiyor musunuz?`)) {
      setIsLoading(true);
      const group = groups.find(g => g.id === selectedGroupId);
      for (const task of offlineTasks) {
        const syncedTask = { 
          ...task, 
          groupId: selectedGroupId, 
          memberUids: group?.members || [user.uid],
          createdBy: user.uid 
        };
        await taskService.syncTask(syncedTask);
      }
      // Clear offline data after migration if user wants? Or keep it?
      // For safety, let's just keep it but inform user.
      alert("Veriler başarıyla aktarıldı!");
      loadGoogleData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Bizim Planlar</h1>
              <div className="flex items-center gap-1.5 opacity-60">
                {mode === 'google' ? (
                  <><Cloud size={12} className="text-emerald-500" /> <span className="text-[10px] uppercase font-bold tracking-wider">Google Sync</span></>
                ) : (
                  <><CloudOff size={12} className="text-amber-500" /> <span className="text-[10px] uppercase font-bold tracking-wider">Offline Mod</span></>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
             >
               <Settings size={20} />
             </button>
             {user ? (
               <button onClick={() => signOut()} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
                 <LogOut size={20} />
               </button>
             ) : (
               <button onClick={() => signIn()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
                 <LogIn size={18} />
                 <span className="text-sm">Giriş Yap</span>
               </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Mode Selector / Sync Info */}
        {user && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${mode === 'google' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-sm font-semibold">{mode === 'google' ? 'Google Üzerinden Paylaşılıyor' : 'Cihazda Kaydediliyor'}</span>
              </div>
              <button 
                onClick={() => setMode(mode === 'google' ? 'offline' : 'google')}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {mode === 'google' ? 'Offline Mod' : 'Google Sync Mod'}
              </button>
            </div>

            {mode === 'google' && groups.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                {groups.map(g => (
                  <button 
                    key={g.id}
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      localStorage.setItem('last_group_id', g.id);
                      taskService.getTasks(g.id).then(setTasks);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      selectedGroupId === g.id 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
                <button onClick={handleCreateGroup} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
                  <Plus size={14} className="inline mr-1" /> Yeni Grup
                </button>
              </div>
            )}

            {mode === 'google' && groups.length === 0 && (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-500">Paylaşmak için bir grup oluşturun.</p>
                <button onClick={handleCreateGroup} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-xl shadow-indigo-500/20">
                  Grup Oluştur
                </button>
              </div>
            )}
          </div>
        )}

        {/* Task List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Görevler</h2>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="bg-white dark:bg-slate-900 px-2 py-1 rounded-md border dark:border-slate-800">{tasks.filter(t => !t.completed).length} Bekleyen</span>
              <span className="bg-white dark:bg-slate-900 px-2 py-1 rounded-md border dark:border-slate-800">{tasks.filter(t => t.completed).length} Tamamlandı</span>
            </div>
          </div>

          {isLoading ? (
             <div className="flex justify-center py-12">
                <RefreshCw className="animate-spin text-indigo-600" />
             </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
               <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-700">
                 <CheckCircle2 size={32} />
               </div>
               <h3 className="text-lg font-bold mb-1">Henüz plan yok</h3>
               <p className="text-sm text-slate-500 mb-6 font-medium">Birlikte yapacağınız işleri buraya eklemeye başlayın.</p>
               <button 
                onClick={() => setShowAddModal(true)}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
               >
                 İlk Görevi Ekle
               </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {tasks.map(task => (
                  <motion.div 
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`shrink-0 transition-colors ${task.completed ? 'text-indigo-600' : 'text-slate-300'}`}
                    >
                      {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    <div className="flex-1">
                      <h4 className={`text-sm font-semibold ${task.completed ? 'line-through text-slate-500' : ''}`}>{task.title}</h4>
                      {task.dueDate && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-500 font-bold">
                           <Calendar size={10} />
                           <span>{new Date(task.dueDate).toLocaleDateString('tr-TR')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                       <div className={`p-1 rounded-md ${
                         task.priority === Priority.HIGH ? 'bg-rose-100 text-rose-600' : 
                         task.priority === Priority.MEDIUM ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                       }`}>
                          <Flag size={14} />
                       </div>
                       <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={18} />
                       </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-30"
      >
        <Plus size={32} />
      </button>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight">Yeni Görev</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500"><Plus className="rotate-45" size={24} /></button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Görev İsmi</label>
                  <input 
                    type="text"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Örn: Market alışverişi, Kira öde..."
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-indigo-600 outline-none font-medium"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  />
                </div>
                
                <button 
                  onClick={handleAddTask}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Listeye Ekle
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl h-[80vh] overflow-y-auto space-y-8"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight">Ayarlar</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500"><Plus className="rotate-45" size={24} /></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Veri Yönetimi</h4>
                  {user && (
                    <button 
                      onClick={migrateToGoogle}
                      className="w-full flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl group active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw size={20} />
                        <div className="text-left">
                          <span className="block text-sm font-bold">Offline Verileri Aktar</span>
                          <span className="text-[10px] opacity-70">Cihazdaki işleri Google Sync'e taşı.</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (confirm("Tüm yerel veriler silinsin mi? (Google Sync verileri etkilenmez)")) {
                        localStorage.removeItem('bizim_planlar_tasks');
                        if (mode === 'offline') setTasks([]);
                        alert("Yerel görevler silindi.");
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl group active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 size={20} />
                      <div className="text-left">
                        <span className="block text-sm font-bold">Yerel Veriyi Temizle</span>
                        <span className="text-[10px] opacity-70">Sadece bu cihazdaki veriler.</span>
                      </div>
                    </div>
                  </button>
                </div>

                {user && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Hesap</h4>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <User size={20} className="text-indigo-600" />
                      <div className="flex-1">
                        <span className="block text-sm font-bold truncate">{user.email}</span>
                        <span className="text-[10px] opacity-60">Google ile bağlandı</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 text-center">
                  <p className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-widest">Bizim Planlar v1.0</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BizimPlanlar;
