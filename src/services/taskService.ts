import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, 
  getDocFromServer, onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Task, Group, OperationType } from '../types';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const taskService = {
  // OFFLINE METHODS (Local Storage)
  getOfflineTasks(): Task[] {
    const saved = localStorage.getItem('bizim_planlar_tasks');
    return saved ? JSON.parse(saved) : [];
  },

  saveOfflineTasks(tasks: Task[]) {
    localStorage.setItem('bizim_planlar_tasks', JSON.stringify(tasks));
  },

  // GOOGLE METHODS (Firestore)
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
       if(error instanceof Error && error.message.includes('the client is offline')) {
         console.error("Please check your Firebase configuration.");
       }
    }
  },

  async getGroups(): Promise<Group[]> {
    if (!auth.currentUser) return [];
    const q = query(collection(db, 'groups'), where('members', 'array-contains', auth.currentUser.uid));
    try {
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Group);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'groups');
      return [];
    }
  },

  async createGroup(name: string): Promise<Group> {
    if (!auth.currentUser) throw new Error("Not authenticated");
    const groupId = Math.random().toString(36).substr(2, 9);
    const newGroup: Group = {
      id: groupId,
      name,
      members: [auth.currentUser.uid],
      ownerId: auth.currentUser.uid,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'groups', groupId), newGroup);
      return newGroup;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `groups/${groupId}`);
      throw e;
    }
  },

  async getTasks(groupId: string): Promise<Task[]> {
    if (!auth.currentUser) return [];
    const q = query(collection(db, 'tasks'), where('memberUids', 'array-contains', auth.currentUser.uid));
    try {
      const snap = await getDocs(q);
      const allTasks = snap.docs.map(d => d.data() as Task);
      return allTasks.filter(t => t.groupId === groupId);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'tasks');
      return [];
    }
  },

  async syncTask(task: Task) {
    try {
      await setDoc(doc(db, 'tasks', task.id), task);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `tasks/${task.id}`);
    }
  },

  async deleteTask(taskId: string) {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tasks/${taskId}`);
    }
  }
};
