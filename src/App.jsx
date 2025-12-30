import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  doc, 
  getDoc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  orderBy, 
  limit, 
  where,
  writeBatch,
  increment 
} from 'firebase/firestore';
import { 
  Scan, 
  Users, 
  Clock, 
  Euro, 
  CalendarOff, 
  BarChart3, 
  Settings, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  AlertTriangle, 
  Menu, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  MessageSquare, 
  Loader2, 
  X, 
  Lock, 
  ArrowRight, 
  TrendingUp, 
  Activity, 
  PieChart, 
  Calendar, 
  QrCode, 
  Sun, 
  Moon, 
  Bell, 
  Smartphone,
  FileText, 
  Save,
  Filter, 
  CheckSquare, 
  Square,
  Tag 
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* CONFIGURATION & FIREBASE SETUP             */
/* -------------------------------------------------------------------------- */

const ADMIN_CONFIG = {
  username: 'admin',
  password: 'AquaMaster2024#',
  sessionDuration: 12 * 60 * 60 * 1000 // 12 hours in ms
};

const firebaseConfig = {
  apiKey: "AIzaSyBuo6fP2vgnRNTXetaeH9Po10545rDbr9s",
  authDomain: "aquascanapp.firebaseapp.com",
  projectId: "aquascanapp",
  storageBucket: "aquascanapp.firebasestorage.app",
  messagingSenderId: "716371620836",
  appId: "1:716371620836:web:038d97ff8ea6e6b03a4df1",
  measurementId: "G-MVLXM5RHWN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'aqua-v1';

/* -------------------------------------------------------------------------- */
/* UTILITIES & CHARTS                         */
/* -------------------------------------------------------------------------- */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IE', { 
    style: 'currency',
    currency: 'EUR',
  }).format(amount || 0);
};

const calculateHours = (ms) => {
  return (ms / (1000 * 60 * 60)).toFixed(2);
};

const formatDuration = (decimalHours) => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return '-';
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (hours === 0 && minutes === 0) return '< 1m';
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const formatDateSafe = (dateString, options = {}) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString(undefined, options);
};

const formatHistoryDate = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${dayName}`;
};

const getSmartDuration = (currentLog, allLogs) => {
  if (currentLog.calculatedHours !== undefined && currentLog.calculatedHours !== null && !isNaN(currentLog.calculatedHours) && currentLog.calculatedHours > 0.001) {
    return Number(currentLog.calculatedHours);
  }
  if (currentLog.action === 'OUT') {
    const outTime = new Date(currentLog.timestamp).getTime();
    if (isNaN(outTime)) return 0;
    const match = allLogs.find(l => 
      l.employeeId === currentLog.employeeId && 
      l.action === 'IN' && 
      new Date(l.timestamp).getTime() < outTime
    );
    if (match) {
      const inTime = new Date(match.timestamp).getTime();
      if (!isNaN(inTime)) {
        const diffMs = outTime - inTime;
        if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
           return diffMs / (1000 * 60 * 60);
        }
      }
    }
  }
  return 0;
};

const LiveDuration = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;
    setElapsed(Date.now() - start);
    const interval = setInterval(() => { setElapsed(Date.now() - start); }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  if (!startTime) return <span className="text-slate-400">-</span>;
  const safeElapsed = Math.max(0, elapsed);
  const totalSeconds = Math.floor(safeElapsed / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </span>
      <span className="font-mono text-lg text-cyan-600 dark:text-cyan-400 font-bold tracking-widest">
        {h.toString().padStart(2,'0')}:{m.toString().padStart(2,'0')}:{s.toString().padStart(2,'0')}
      </span>
    </div>
  );
};

const sendPushoverNotification = async (title, message) => {
  try {
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'pushover');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) return;
    const config = settingsSnap.data();
    if (!config.userKey || !config.apiToken || !config.enabled) return;
    const formData = new FormData();
    formData.append('user', config.userKey);
    formData.append('token', config.apiToken);
    formData.append('title', title);
    formData.append('message', message);
    formData.append('sound', config.sound || 'cashregister');
    await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.pushover.net/1/messages.json'), { method: 'POST', body: formData });
  } catch (error) { console.error("Pushover Error:", error); }
};

const SimpleBarChart = ({ data, labels, color = "#0891b2" }) => {
  const max = Math.max(...data) || 1;
  const isScrollable = data.length > 12;
  return (
    <div className={`w-full ${isScrollable ? 'overflow-x-auto pb-4' : ''}`}>
        <div className={`flex items-end justify-between h-40 gap-2 ${isScrollable ? 'min-w-[1000px]' : 'w-full'}`}>
          {data.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
              <div className="relative w-full bg-slate-100 dark:bg-slate-700 rounded-t-md overflow-hidden flex items-end h-full">
                 <div className="w-full transition-all duration-700 ease-out relative group-hover:opacity-90" style={{ height: `${isNaN(val) ? 0 : (val / max) * 100}%`, backgroundColor: color }}></div>
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-mono">
                   {isNaN(val) ? 0 : val.toFixed(1)} hrs
                 </div>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider truncate w-full text-center">{labels[i]}</span>
            </div>
          ))}
        </div>
    </div>
  );
};

const callGemini = async (prompt) => {
  const apiKey = "AIzaSyBxo61DEjt0WerbLY9_jSW_WhTtpYJ4VJA"; 
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error(`Gemini API Error`);
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  } catch (error) { return "Analysis failed."; }
};

const generateUniqueId = (employees) => {
  const existingCodes = employees.map(e => e.barcode).filter(Boolean);
  let newId = 10001;
  while(existingCodes.includes(String(newId))) newId++;
  return String(newId);
};

const getQrCodeUrl = (code) => `https://quickchart.io/qr?text=${encodeURIComponent(code)}&size=200`;

const QrCodeVisualization = ({ code }) => {
    const url = getQrCodeUrl(code);
    return (
        <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-sm">
            <img src={url} alt={`QR Code`} className="w-full h-auto max-w-xs object-contain p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/200x200/f87171/ffffff?text=QR+CODE+FAILED`; }} />
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 font-mono">ID: <span className="font-bold text-cyan-700">{code}</span></p>
        </div>
    );
};

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/');
  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const navigate = (path) => { window.location.hash = path; };
  return { route, navigate };
}

// --- CONFIRMATION MODAL ---
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" /> {title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm shadow-red-500/30">Delete</button>
            </div>
        </div>
    </div>
  );
}

function GeminiModal({ isOpen, onClose, title, content, isLoading }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2"><Sparkles size={20} className="text-yellow-300" /><h3 className="font-bold text-lg">{title}</h3></div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-indigo-600"><Loader2 size={40} className="animate-spin mb-4" /><p className="font-medium animate-pulse">Consulting Gemini AI...</p></div>
          ) : (
            <div className="prose prose-indigo max-w-none">
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-100 dark:border-slate-600 text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed text-sm max-h-[60vh] overflow-y-auto">{content}</div>
              <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Done</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- EMPLOYEE HISTORY MODAL ---
function EmployeeHistoryModal({ employee, attendance, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState('');
  
  // Filtering States
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(endOfMonth);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

  // Manual Entry States
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState({ date: '', time: '', type: 'IN' });

  // Delete Modal State
  const [deleteData, setDeleteData] = useState(null); // { log, isOpen: false }

  if (!employee) return null;

  // Filter logs for this employee
  let empLogs = attendance.filter(log => log.employeeId === employee.id);

  // Apply Date Filters
  empLogs = empLogs.filter(log => {
      const d = new Date(log.timestamp);
      if (isNaN(d.getTime())) return false;
      const logDate = d.toISOString().slice(0, 10);
      return logDate >= startDate && logDate <= endDate;
  });

  // Group logs by date
  const logsByDate = useMemo(() => {
    const groups = {};
    empLogs.forEach(log => {
      const dateKey = new Date(log.timestamp).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  }, [empLogs]);

  const dailyStats = Object.keys(logsByDate).reduce((acc, dateKey) => {
    const logs = logsByDate[dateKey];
    // Sort logs chronologically within the day
    const sortedLogs = [...logs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let hours = 0;
    let isDayPaid = true; 
    let hasOutLog = false;

    sortedLogs.forEach(log => {
        if(log.action === 'OUT') {
            hasOutLog = true;
            hours += getSmartDuration(log, attendance); 
            if (!log.isPaid) isDayPaid = false;
        }
    });
    
    if (!hasOutLog && logs.length > 0) isDayPaid = false;

    acc[dateKey] = {
        hours: hours,
        pay: hours * (parseFloat(employee.hourlyRate) || 0),
        isPaid: isDayPaid,
        logs: sortedLogs
    };
    return acc;
  }, {});

  let visibleDates = Object.keys(dailyStats);
  if (showUnpaidOnly) {
      visibleDates = visibleDates.filter(date => !dailyStats[date].isPaid && dailyStats[date].hours > 0);
  }

  // Sort dates descending (Newest date first)
  visibleDates.sort((a,b) => {
      const timeA = new Date(dailyStats[a].logs[0].timestamp).getTime();
      const timeB = new Date(dailyStats[b].logs[0].timestamp).getTime();
      return timeB - timeA;
  });

  const handleEditClick = (log) => {
    const date = new Date(log.timestamp);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    setEditTime(localISOTime);
    setEditingId(log.id);
  };

  const handleSaveEdit = async (logId) => {
    try {
        const newDate = new Date(editTime);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendance', logId), {
            timestamp: newDate.toISOString(),
            calculatedHours: 0 
        });
        setEditingId(null);
    } catch (e) { console.error("Update failed", e); alert("Update failed"); }
  };

  const promptDelete = (log) => {
      setDeleteData(log);
  };

  const confirmDelete = async () => {
      if (!deleteData) return;
      try {
          // If deleting OUT log with hours, reverse employee stats
          if (deleteData.action === 'OUT' && deleteData.calculatedHours > 0) {
              const reverseAmount = deleteData.earnedAmount || 0;
              const reverseHours = deleteData.calculatedHours || 0;
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', deleteData.employeeId), {
                  balance: increment(-reverseAmount),
                  totalHours: increment(-reverseHours)
              });
          }
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendance', deleteData.id));
          setDeleteData(null);
      } catch (e) {
          console.error("Delete failed", e);
          alert("Delete failed: " + e.message);
      }
  };

  const toggleDayPaidStatus = async (dateKey) => {
      const dayData = dailyStats[dateKey];
      const newStatus = !dayData.isPaid;
      try {
          const batch = writeBatch(db);
          dayData.logs.filter(l => l.action === 'OUT').forEach(log => {
              const ref = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', log.id);
              batch.update(ref, { isPaid: newStatus });
          });
          await batch.commit();
      } catch(e) { console.error("Error updating paid status", e); }
  };

  const openManualForm = (dateStr) => {
      let defaultDate = new Date().toISOString().slice(0, 10);
      const dayLogs = dailyStats[dateStr]?.logs;
      if (dayLogs && dayLogs.length > 0) {
          try {
              defaultDate = new Date(dayLogs[0].timestamp).toISOString().slice(0, 10);
          } catch(e) { /* fallback */ }
      }
      setManualEntry({ date: defaultDate, time: '09:00', type: 'IN' });
      setShowManualForm(true);
  };

  const submitManualEntry = async (e) => {
      e.preventDefault();
      const { date, time, type } = manualEntry;
      if (!date || !time) return;

      const fullTimestamp = new Date(`${date}T${time}`).toISOString();
      const manualTs = new Date(fullTimestamp).getTime();

      const duplicate = empLogs.find(l => Math.abs(new Date(l.timestamp).getTime() - manualTs) < 60000 && l.action === type);
      if (duplicate) { alert("Duplicate entry detected nearby."); return; }

      let calculatedHours = 0;
      let earnedAmount = 0;
      const batch = writeBatch(db);
      const newDocRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'));

      if (type === 'OUT') {
          const matchingIn = empLogs
              .filter(l => l.action === 'IN' && new Date(l.timestamp).getTime() < manualTs)
              .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          
          if (matchingIn) {
              const diffMs = manualTs - new Date(matchingIn.timestamp).getTime();
              if (diffMs > 0 && diffMs < 86400000) {
                  calculatedHours = diffMs / (1000 * 60 * 60);
                  earnedAmount = calculatedHours * (parseFloat(employee.hourlyRate) || 0);
              }
          }
      } else if (type === 'IN') {
          const matchingOut = empLogs
              .filter(l => l.action === 'OUT' && new Date(l.timestamp).getTime() > manualTs)
              .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
          
          if (matchingOut && (!matchingOut.calculatedHours || matchingOut.calculatedHours === 0)) {
              const diffMs = new Date(matchingOut.timestamp).getTime() - manualTs;
              if (diffMs > 0 && diffMs < 86400000) {
                  const newHours = diffMs / (1000 * 60 * 60);
                  const newEarned = newHours * (parseFloat(employee.hourlyRate) || 0);
                  
                  const outRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', matchingOut.id);
                  batch.update(outRef, { calculatedHours: newHours, earnedAmount: newEarned });
                  
                  const empRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', employee.id);
                  batch.update(empRef, { 
                      balance: increment(newEarned),
                      totalHours: increment(newHours)
                  });
              }
          }
      }

      batch.set(newDocRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          timestamp: fullTimestamp,
          action: type,
          source: 'manual', 
          calculatedHours,
          earnedAmount,
          createdAt: serverTimestamp()
      });

      if (calculatedHours > 0) {
          const empRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', employee.id);
          batch.update(empRef, {
              balance: increment(earnedAmount),
              totalHours: increment(calculatedHours)
          });
      }

      // Check if this manual entry is the newest one to update the main status
      const isNewer = !employee.lastCheckInTime || manualTs > new Date(employee.lastCheckInTime).getTime();
      if (isNewer) {
          const empRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', employee.id);
          batch.update(empRef, {
              isCheckedIn: type === 'IN',
              lastCheckInTime: type === 'IN' ? fullTimestamp : null
          });
      }

      await batch.commit();
      setShowManualForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh] relative">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 flex justify-between items-center text-white shrink-0 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><FileText size={24} /> {employee.name}</h2>
            <p className="text-cyan-100 text-sm mt-1">Rate: {formatCurrency(employee.hourlyRate)}/hr • ID: {employee.barcode}</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
        </div>
        
        <div className="bg-slate-100 dark:bg-slate-900 p-3 flex flex-wrap gap-4 items-center border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">From:</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">To:</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block"></div>
            <button onClick={() => setShowUnpaidOnly(!showUnpaidOnly)} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors ${showUnpaidOnly ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 font-medium' : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'}`}>
                <Filter size={14} />
                {showUnpaidOnly ? 'Showing Unpaid Only' : 'Show All'}
            </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {visibleDates.length === 0 ? (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                    <CalendarOff size={48} className="mb-4 opacity-50"/>
                    <p>No records found for this period.</p>
                    <button onClick={() => { setManualEntry({date: new Date().toISOString().slice(0,10), time: '09:00', type: 'IN'}); setShowManualForm(true); }} className="mt-4 text-cyan-600 hover:underline">Add Entry Manually</button>
                </div>
            ) : (
                <div className="space-y-6">
                    {visibleDates.map(dateKey => {
                        const stats = dailyStats[dateKey];
                        const headerDateStr = stats.logs.length > 0 ? stats.logs[0].timestamp : null;
                        
                        return (
                        <div key={dateKey} className={`border rounded-xl overflow-hidden ${stats.isPaid ? 'border-green-200 dark:border-green-900/50' : 'border-orange-200 dark:border-orange-900/50'}`}>
                            <div className={`p-3 flex justify-between items-center border-b ${stats.isPaid ? 'bg-green-50 dark:bg-green-900/20 border-green-100' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100'}`}>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        {headerDateStr ? formatHistoryDate(headerDateStr) : dateKey}
                                    </span>
                                    <button onClick={() => openManualForm(dateKey)} className="text-xs bg-white/50 hover:bg-white text-slate-600 px-2 py-1 rounded border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600 flex items-center gap-1">
                                        <Plus size={12}/> Add Missing
                                    </button>
                                </div>
                                <div className="flex gap-4 text-sm items-center">
                                    <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">Total: <strong className="text-slate-800 dark:text-white">{formatDuration(stats.hours)}</strong></span>
                                    <button onClick={() => toggleDayPaidStatus(dateKey)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${stats.isPaid ? 'bg-green-200 text-green-800 hover:bg-green-300' : 'bg-white border border-orange-300 text-orange-600 hover:bg-orange-100'}`} title={stats.isPaid ? "Mark as Unpaid" : "Mark as Paid"}>
                                        {stats.isPaid ? <CheckSquare size={14}/> : <Square size={14}/>} {stats.isPaid ? 'PAID' : 'UNPAID'}
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
                                {stats.logs.map(log => {
                                    const duration = log.action === 'OUT' ? getSmartDuration(log, attendance) : 0;
                                    const isEditing = editingId === log.id;
                                    
                                    return (
                                        <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold w-12 text-center mb-1 ${log.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {log.action}
                                                    </span>
                                                    {log.source === 'manual' && (
                                                        <span className="text-[10px] text-orange-600 border border-orange-200 bg-orange-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="Manually Added">
                                                            <Tag size={8}/>
                                                        </span>
                                                    )}
                                                </div>
                                                {isEditing ? (
                                                    <input type="datetime-local" value={editTime} onChange={e => setEditTime(e.target.value)} className="border rounded p-1 text-sm dark:bg-slate-600 dark:text-white" />
                                                ) : (
                                                    <span className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </span>
                                                )}
                                                {log.action === 'OUT' && !isEditing && (
                                                    <span className="text-xs text-slate-400">({formatDuration(duration)})</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {isEditing ? (
                                                    <button onClick={() => handleSaveEdit(log.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save size={14}/></button>
                                                ) : (
                                                    <button onClick={() => handleEditClick(log)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded"><Edit size={14}/></button>
                                                )}
                                                <button onClick={() => promptDelete(log)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )})}
                </div>
            )}
        </div>

        {showManualForm && (
            <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center rounded-2xl animate-in fade-in zoom-in duration-200">
                <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Add Missing Entry</h3>
                    <form onSubmit={submitManualEntry} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                            <input type="date" required value={manualEntry.date} onChange={e => setManualEntry({...manualEntry, date: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Time</label>
                                <input type="time" required value={manualEntry.time} onChange={e => setManualEntry({...manualEntry, time: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
                                <select value={manualEntry.type} onChange={e => setManualEntry({...manualEntry, type: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                    <option value="IN">Check In</option>
                                    <option value="OUT">Check Out</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setShowManualForm(false)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                            <button type="submit" className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700">Add Entry</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        <ConfirmModal 
            isOpen={!!deleteData}
            title="Delete Log Entry"
            message="Are you sure you want to delete this entry? If this was a manual entry that added hours, the employee's balance and hours will be reversed."
            onConfirm={confirmDelete}
            onCancel={() => setDeleteData(null)}
        />
      </div>
    </div>
  );
}

// --- QrCodeDisplayModal ---
function QrCodeDisplayModal({ employee, onClose }) {
    if (!employee) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><QrCode size={24} className="text-cyan-600"/> Employee QR: {employee.name}</h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><X size={20} className="text-slate-500 dark:text-slate-400" /></button>
                    </div>
                    <div className="flex justify-center mb-6"><QrCodeVisualization code={employee.barcode} /></div>
                    <div className="mt-6 flex justify-end"><button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Close</button></div>
                </div>
            </div>
        </div>
    );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { route, navigate } = useHashRoute();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { if (!auth.currentUser) await signInAnonymously(auth); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('aqua_admin_session');
    if (session) {
      const { timestamp } = JSON.parse(session);
      if (Date.now() - timestamp < ADMIN_CONFIG.sessionDuration) setIsAdminAuthenticated(true);
      else { localStorage.removeItem('aqua_admin_session'); setIsAdminAuthenticated(false); }
    }
    const storedMode = localStorage.getItem('aqua_dark_mode');
    if (storedMode) setIsDarkMode(storedMode === 'true');
  }, [route]); 

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) { root.classList.add('dark'); localStorage.setItem('aqua_dark_mode', 'true'); } 
    else { root.classList.remove('dark'); localStorage.setItem('aqua_dark_mode', 'false'); }
  }, [isDarkMode]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400"><div className="animate-spin mr-3"><Loader2 size={32} /></div><span className="text-xl font-mono">Initializing AQUA...</span></div>;
  if (route === '/scan') return <ScannerMode user={user} />;
  if (route.startsWith('/admin')) {
    if (!isAdminAuthenticated) return <AdminLogin navigate={navigate} />;
    return <AdminDashboard user={user} navigate={navigate} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }
  if (route === '/login') return <AdminLogin navigate={navigate} />;
  return <LandingScreen navigate={navigate} />;
}

function AdminLogin({ navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setIsLoading(true); setError('');
    
    try {
        let currentPassword = ADMIN_CONFIG.password;
        const securityDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'security'));
        if (securityDoc.exists() && securityDoc.data().password) {
            currentPassword = securityDoc.data().password;
        }

        if (username === ADMIN_CONFIG.username && password === currentPassword) {
            localStorage.setItem('aqua_admin_session', JSON.stringify({ timestamp: Date.now(), user: username }));
            navigate('/admin');
        } else {
            setError('Invalid credentials.');
            setIsLoading(false);
        }
    } catch (err) {
        console.error(err);
        setError('Login error.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 border rounded dark:bg-slate-700 dark:text-white" placeholder="Username" />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border rounded dark:bg-slate-700 dark:text-white" placeholder="Password" />
          <button type="submit" disabled={isLoading} className="w-full bg-cyan-600 text-white p-3 rounded font-bold hover:bg-cyan-700">{isLoading ? 'Logging in...' : 'Login'}</button>
        </form>
        <button onClick={()=>navigate('/')} className="block w-full text-center mt-4 text-sm text-slate-500">Back</button>
      </div>
    </div>
  );
}

function LandingScreen({ navigate }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="mb-12 text-center"><Clock size={64} className="mx-auto mb-4 text-cyan-400" /><h1 className="text-5xl font-bold mb-2">AQUA</h1><p className="text-slate-400">Workforce System</p></div>
      <div className="flex gap-6">
        <button onClick={()=>navigate('/scan')} className="bg-slate-800 p-8 rounded-2xl hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 transition-all text-left w-64">
            <Scan size={32} className="text-cyan-400 mb-4" /><h2 className="text-xl font-bold">Scanner</h2><p className="text-xs text-green-400 mt-2">Open Kiosk</p>
        </button>
        <button onClick={()=>navigate('/login')} className="bg-slate-800 p-8 rounded-2xl hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 transition-all text-left w-64">
            <Settings size={32} className="text-indigo-400 mb-4" /><h2 className="text-xl font-bold">Admin</h2><p className="text-xs text-indigo-400 mt-2">Secure Dashboard</p>
        </button>
      </div>
    </div>
  );
}

function ScannerMode({ user }) {
  const [code, setCode] = useState('');
  const [lastScans, setLastScans] = useState({});
  const [scanResult, setScanResult] = useState(null); 
  const inputRef = useRef(null);
  
  useEffect(() => {
    const focusInterval = setInterval(() => { if (inputRef.current) inputRef.current.focus(); }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    const scannedCode = code.trim();
    setCode('');
    
    if (scannedCode.length !== 5) { showFeedback('error', 'Invalid code length.'); return; }
    
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'employees'), where('barcode', '==', scannedCode), limit(1));
      const querySnapshot = await new Promise(resolve => { const unsub = onSnapshot(q, (snap) => { unsub(); resolve(snap); }); });

      if (querySnapshot.empty) { showFeedback('error', 'Employee not found.'); return; }
      const empDoc = querySnapshot.docs[0];
      const employee = { id: empDoc.id, ...empDoc.data() };

      if (employee.status !== 'Active') { showFeedback('error', 'Employee inactive.'); return; }

      const now = Date.now();
      if (lastScans[employee.id] && (now - lastScans[employee.id] < 10000)) { showFeedback('warning', 'Please wait.'); return; }
      setLastScans(prev => ({ ...prev, [employee.id]: now }));

      const isCheckIn = !employee.isCheckedIn;
      const timestamp = new Date().toISOString();
      let hoursWorked = 0;
      let earnedAmount = 0;
      let feedbackMsg = isCheckIn ? 'Checked In' : 'Checked Out';

      if (!isCheckIn && employee.lastCheckInTime) {
          const startTime = new Date(employee.lastCheckInTime).getTime();
          if (!isNaN(startTime)) {
              const durationMs = now - startTime;
              if (durationMs > 0) {
                  hoursWorked = durationMs / (1000 * 60 * 60);
                  earnedAmount = hoursWorked * (parseFloat(employee.hourlyRate) || 0);
                  const h = Math.floor(durationMs / (1000 * 60 * 60));
                  const m = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                  feedbackMsg = `Checked Out (${h}h ${m}m)`;
              }
          }
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), { 
          employeeId: employee.id, 
          employeeName: employee.name, 
          timestamp, 
          action: isCheckIn ? 'IN' : 'OUT', 
          source: 'scan', 
          calculatedHours: isCheckIn ? 0 : hoursWorked, 
          earnedAmount: isCheckIn ? 0 : earnedAmount 
      });
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', employee.id), { 
          isCheckedIn: isCheckIn, 
          lastCheckInTime: isCheckIn ? timestamp : null, 
          balance: (parseFloat(employee.balance) || 0) + earnedAmount, 
          totalHours: (parseFloat(employee.totalHours) || 0) + hoursWorked 
      });

      showFeedback('success', feedbackMsg, employee);
      sendPushoverNotification("Aqua Scan", `${employee.name} ${feedbackMsg}`);

    } catch (error) { console.error(error); showFeedback('error', 'System Error'); }
  };

  const showFeedback = (status, message, employee = null) => {
    setScanResult({ status, message, employee, timestamp: new Date() });
    setTimeout(() => setScanResult(null), 4000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative cursor-none">
        <div className="z-10 w-full max-w-4xl px-6 flex flex-col items-center">
            <h1 className="text-slate-500 text-2xl font-bold tracking-[0.2em] mb-12">AQUA SCAN</h1>
            <div className={`w-full h-96 rounded-3xl flex flex-col items-center justify-center border-4 ${scanResult?.status === 'success' ? 'bg-green-900/20 border-green-500' : scanResult?.status === 'error' ? 'bg-red-900/20 border-red-500' : 'bg-slate-900/50 border-slate-800'}`}>
                {!scanResult ? (<div className="animate-pulse text-slate-600 flex flex-col items-center"><Scan size={120} /><span className="mt-8 text-3xl font-light tracking-widest">READY</span></div>) : (
                    <div className="text-center">
                        <h2 className={`text-5xl font-bold mb-4 ${scanResult.status === 'success' ? 'text-white' : 'text-red-400'}`}>{scanResult.message}</h2>
                        {scanResult.employee && <p className="text-3xl text-cyan-400">{scanResult.employee.name}</p>}
                    </div>
                )}
            </div>
            <form onSubmit={handleScan} className="w-full mt-12"><input ref={inputRef} type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-slate-900/30 text-center text-slate-700 text-xl py-4 rounded-xl border border-slate-800" autoFocus /></form>
        </div>
        <div className="absolute bottom-6 text-slate-800 text-xs font-mono">SECURE KIOSK MODE • NO ADMIN ACCESS</div>
    </div>
  );
}

function AdminDashboard({ user, navigate, isDarkMode, setIsDarkMode }) {
  const [activeTab, setActiveTab] = useState('analytics'); 
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  useEffect(() => {
    if (!user) return;
    const empUnsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'employees'), (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const attQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), orderBy('timestamp', 'desc'), limit(5000));
    const attUnsub = onSnapshot(attQuery, (snap) => setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { empUnsub(); attUnsub(); };
  }, [user?.uid]);

  const MenuItem = ({ id, icon: Icon, label }) => ( <button onClick={() => setActiveTab(id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === id ? 'bg-cyan-500/10 text-cyan-500 dark:bg-cyan-600/20' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400'}`}><Icon size={20} /><span className="font-medium">{label}</span></button> );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-900 overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col z-20`}>
        <div className="p-6 flex justify-between">{isSidebarOpen && <span className="text-xl font-bold text-slate-800 dark:text-white">AQUA</span>}<button onClick={() => setSidebarOpen(!isSidebarOpen)}><Menu size={20} className="text-slate-400" /></button></div>
        <nav className="flex-1 px-4 space-y-2 mt-4"><MenuItem id="analytics" icon={BarChart3} label={isSidebarOpen ? "Analytics" : ""} /><MenuItem id="overview" icon={Activity} label={isSidebarOpen ? "Live View" : ""} /><MenuItem id="employees" icon={Users} label={isSidebarOpen ? "Employees" : ""} /><MenuItem id="attendance" icon={Clock} label={isSidebarOpen ? "Attendance" : ""} /><MenuItem id="payroll" icon={Euro} label={isSidebarOpen ? "Payroll" : ""} /><MenuItem id="absences" icon={CalendarOff} label={isSidebarOpen ? "Absences" : ""} /><MenuItem id="settings" icon={Settings} label={isSidebarOpen ? "Settings" : ""} /></nav>
        <div className="p-4"><button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center space-x-3 px-4 py-3 w-full text-slate-500 hover:bg-slate-100 rounded-lg">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}{isSidebarOpen && <span>Theme</span>}</button><button onClick={() => {localStorage.removeItem('aqua_admin_session'); navigate('/');}} className="flex items-center space-x-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={20} />{isSidebarOpen && <span>Logout</span>}</button></div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <header className="flex justify-between items-center mb-8"><h1 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">{activeTab}</h1><div className="text-sm text-slate-500 dark:text-slate-400">Welcome, Master Admin</div></header>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'analytics' && <AnalyticsTab employees={employees} attendance={attendance} />}
            {activeTab === 'overview' && <OverviewTab employees={employees} attendance={attendance} user={user} />}
            {activeTab === 'employees' && <EmployeesTab employees={employees} attendance={attendance} user={user} />}
            {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}
            {activeTab === 'payroll' && <PayrollTab employees={employees} attendance={attendance} />}
            {activeTab === 'absences' && <AbsencesTab employees={employees} user={user} />}
            {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

function SettingsTab() {
  const [config, setConfig] = useState({ userKey: '', apiToken: '', enabled: false, sound: 'cashregister' });
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [passForm, setPassForm] = useState({ newPass: '', confirmPass: '' });
  const [isPassSaved, setIsPassSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'pushover');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        }
      } catch (e) { console.error("Error fetching settings:", e); } finally { setIsLoading(false); }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'pushover'), config);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) { alert("Failed to save settings."); }
  };

  const handleUpdatePassword = async (e) => {
      e.preventDefault();
      if (passForm.newPass !== passForm.confirmPass) { alert("Passwords do not match!"); return; }
      if (!passForm.newPass) return;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'security'), { password: passForm.newPass });
          setPassForm({ newPass: '', confirmPass: '' });
          setIsPassSaved(true);
          setTimeout(() => setIsPassSaved(false), 2000);
      } catch (e) { alert("Failed to update password"); }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Pushover Notifications</h2>
            <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={config.enabled} onChange={e=>setConfig({...config, enabled: e.target.checked})} /> <span>Enable Notifications</span></div>
                <input className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="User Key" value={config.userKey} onChange={e=>setConfig({...config, userKey: e.target.value})} />
                <input className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" type="password" placeholder="API Token" value={config.apiToken} onChange={e=>setConfig({...config, apiToken: e.target.value})} />
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notification Sound</label>
                    <select className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={config.sound} onChange={e=>setConfig({...config, sound: e.target.value})}>
                        <option value="pushover">Pushover (Default)</option>
                        <option value="cashregister">Cash Register</option>
                        <option value="bike">Bike</option>
                        <option value="bugle">Bugle</option>
                        <option value="classical">Classical</option>
                        <option value="cosmic">Cosmic</option>
                        <option value="falling">Falling</option>
                        <option value="gamelan">Gamelan</option>
                        <option value="incoming">Incoming</option>
                        <option value="intermission">Intermission</option>
                        <option value="magic">Magic</option>
                        <option value="mechanical">Mechanical</option>
                        <option value="pianobar">Piano Bar</option>
                        <option value="siren">Siren</option>
                        <option value="spacealarm">Space Alarm</option>
                        <option value="tugboat">Tugboat</option>
                        <option value="alien">Alien Alarm</option>
                        <option value="climb">Climb</option>
                        <option value="persistent">Persistent</option>
                        <option value="echo">Echo</option>
                        <option value="updown">Up Down</option>
                        <option value="none">None (Silent)</option>
                    </select>
                </div>
                <button className="bg-cyan-600 text-white px-4 py-2 rounded w-full hover:bg-cyan-700 transition-colors">{isSaved ? 'Saved!' : 'Save Notifications'}</button>
            </form>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-2"><Lock size={20} className="text-orange-500"/> Admin Security</h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label><input type="password" className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={passForm.newPass} onChange={e => setPassForm({...passForm, newPass: e.target.value})} placeholder="Enter new password" /></div>
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label><input type="password" className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={passForm.confirmPass} onChange={e => setPassForm({...passForm, confirmPass: e.target.value})} placeholder="Confirm new password" /></div>
                <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded w-full hover:bg-orange-700 transition-colors font-medium">{isPassSaved ? 'Password Updated!' : 'Update Password'}</button>
            </form>
        </div>
    </div>
  );
}

function AnalyticsTab({ employees, attendance }) {
  const [range, setRange] = useState('Month');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all'); 
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (range === 'Day') newDate.setDate(newDate.getDate() + direction);
    else if (range === 'Week') newDate.setDate(newDate.getDate() + (direction * 7));
    else if (range === 'Month') newDate.setMonth(newDate.getMonth() + direction);
    else if (range === 'Year') newDate.setFullYear(newDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };
  
  const metrics = useMemo(() => {
    const endWindow = new Date(currentDate);
    const startWindow = new Date(currentDate);

    if (range === 'Day') {
        startWindow.setHours(0,0,0,0);
        endWindow.setHours(23,59,59,999);
    } else if (range === 'Week') {
        const day = endWindow.getDay();
        const diff = endWindow.getDate() - day + (day === 0 ? -6 : 1); 
        startWindow.setDate(diff);
        startWindow.setHours(0,0,0,0);
        endWindow.setDate(diff + 6);
        endWindow.setHours(23,59,59,999);
    } else if (range === 'Month') {
        startWindow.setDate(1);
        startWindow.setHours(0,0,0,0);
        endWindow.setMonth(endWindow.getMonth() + 1);
        endWindow.setDate(0);
        endWindow.setHours(23,59,59,999);
    } else if (range === 'Year') {
        startWindow.setMonth(0, 1);
        startWindow.setHours(0,0,0,0);
        endWindow.setMonth(11, 31);
        endWindow.setHours(23,59,59,999);
    }

    const rangeFilter = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d >= startWindow && d <= endWindow;
    };

    let filteredLogs = attendance.filter(log => rangeFilter(log.timestamp));
    if (selectedEmployeeId !== 'all') filteredLogs = filteredLogs.filter(log => log.employeeId === selectedEmployeeId);
    
    const outs = filteredLogs.filter(log => log.action === 'OUT');
    const empStats = {}; 

    let totalH = 0, totalE = 0;
    
    outs.forEach(log => {
        const duration = getSmartDuration(log, attendance);
        totalH += duration;
        const emp = employees.find(e => e.id === log.employeeId);
        const rate = emp ? parseFloat(emp.hourlyRate||0) : 0;
        totalE += (duration * rate);
        if (!empStats[log.employeeId]) empStats[log.employeeId] = 0;
        empStats[log.employeeId] += duration;
    });

    const avgShift = outs.length ? (totalH/outs.length) : 0;
    
    let chartData, labels;
    if (range === 'Day') {
        chartData = new Array(24).fill(0);
        labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2,'0')}:00`);
    } else if (range === 'Month') {
        chartData = [0,0,0,0,0];
        labels = ['W1','W2','W3','W4','W5'];
    } else if (range === 'Week') {
        chartData = [0,0,0,0,0,0,0];
        labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    } else { 
        chartData = new Array(12).fill(0);
        labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    }

    outs.forEach(log => {
        const d = new Date(log.timestamp);
        if (isNaN(d.getTime())) return;
        const dur = getSmartDuration(log, attendance);
        if (range === 'Day') { const hour = d.getHours(); chartData[hour] += dur; }
        else if (range === 'Week') { const day = d.getDay(); chartData[day===0?6:day-1] += dur; }
        else if (range === 'Month') { const wk = Math.min(4, Math.floor((d.getDate()-1)/7)); chartData[wk] += dur; }
        else { chartData[d.getMonth()] += dur; }
    });

    let displayTitle = "";
    if (range === 'Day') displayTitle = formatDateSafe(startWindow, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    else if (range === 'Week') displayTitle = `${formatDateSafe(startWindow)} - ${formatDateSafe(endWindow)}`;
    else if (range === 'Month') displayTitle = startWindow.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    else displayTitle = startWindow.getFullYear();

    return { totalH, totalE, avgShift, chartData, labels, displayTitle, empStats };
  }, [attendance, employees, range, selectedEmployeeId, currentDate]);

  const handleExportCSV = () => { window.alert("Exporting CSV..."); };

  const topEmployees = employees
    .map(e => ({...e, calculatedPeriodHours: metrics.empStats[e.id] || 0 }))
    .sort((a,b) => b.calculatedPeriodHours - a.calculatedPeriodHours)
    .slice(0,3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
         <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
             <div className="flex items-center gap-2 w-full sm:w-auto"><Users size={16} className="text-slate-400 dark:text-slate-500" /><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 outline-none w-full sm:w-48 font-medium"><option value="all">All Employees</option>{employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}</select></div>
             <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg w-full sm:w-auto">{['Day', 'Week', 'Month', 'Year'].map(r => (<button key={r} onClick={() => { setRange(r); setCurrentDate(new Date()); }} className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md transition-all ${range === r ? 'bg-white shadow text-cyan-600 dark:bg-slate-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}>{r}</button>))}</div>
         </div>
         <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600"><button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-500 dark:text-slate-400 transition-colors"><ChevronLeft size={20} /></button><span className="font-bold text-slate-700 dark:text-white w-40 text-center text-sm">{metrics.displayTitle}</span><button onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-500 dark:text-slate-400 transition-colors"><ChevronRight size={20} /></button></div>
         <button onClick={handleExportCSV} className="flex items-center gap-2 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 w-full xl:w-auto justify-center"><Download size={16} /> Export CSV</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label: 'Total Hours', val: formatDuration(metrics.totalH), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Worked this period' }, { label: 'Total Earnings', val: formatCurrency(metrics.totalE), icon: Euro, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Base + Overtime' }, { label: 'Avg Shift', val: formatDuration(metrics.avgShift), icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Per employee' }, { label: 'Efficiency Score', val: '100%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'Based on 8h target' }].map((k, i) => (<div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:border-cyan-200 transition-colors"><div className="flex justify-between items-start mb-2"><div><p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{k.label}</p><h3 className={`text-2xl font-bold ${k.color} mt-1`}>{k.val}</h3></div><div className={`p-2 rounded-lg ${k.bg} ${k.color}`}><k.icon size={20} /></div></div><p className="text-xs text-slate-400">{k.sub}</p></div>))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex items-center justify-between mb-6"><h3 className="font-bold text-slate-800 dark:text-white">Hours Trend ({range})</h3><div className="flex gap-2 text-xs text-slate-500"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-600"></div> Regular</span></div></div><SimpleBarChart data={metrics.chartData} labels={metrics.labels} color="#0891b2" /></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-slate-800 dark:text-white mb-4">Shift Types</h3>
           <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clock size={16} /></div><div><p className="font-medium text-sm text-slate-700 dark:text-white">Regular Shifts</p><p className="text-xs text-slate-500 dark:text-slate-400">Recorded shifts</p></div></div><span className="font-bold text-slate-700 dark:text-white">{formatDuration(metrics.totalH)}</span></div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700"><h4 className="text-sm font-medium mb-3 text-slate-700 dark:text-white">Top Performers ({range})</h4>{topEmployees.map(e => (<div key={e.id} className="flex justify-between items-center text-sm py-1"><span className="text-slate-600 dark:text-slate-300">{e.name}</span><span className="font-mono font-medium text-cyan-600 dark:text-cyan-400">{formatDuration(e.calculatedPeriodHours)}</span></div>))}</div>
           </div>
        </div>
      </div>
    </div>
  );
}

// --- Overview (With Live Clocks) ---
function OverviewTab({ employees, attendance, user }) {
  const activeEmployees = employees.filter(e => e.isCheckedIn);
  const totalEmployees = employees.length;
  const today = new Date().toLocaleDateString();
  const todayScans = attendance.filter(a => { const d = new Date(a.timestamp); return !isNaN(d.getTime()) && d.toLocaleDateString() === today; });

  const handleQuickCheckout = async (emp) => {
    if (!window.confirm(`Force checkout for ${emp.name}?`)) return;
    try {
          const timestamp = new Date().toISOString();
          let hours = 0;
          if (emp.lastCheckInTime) {
              const start = new Date(emp.lastCheckInTime).getTime();
              if (!isNaN(start)) hours = (new Date().getTime() - start) / (1000 * 60 * 60);
          }
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), { employeeId: emp.id, employeeName: emp.name, timestamp, action: 'OUT', calculatedHours: hours, earnedAmount: hours * (emp.hourlyRate || 0), note: 'Admin Forced' });
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', emp.id), { isCheckedIn: false, lastCheckInTime: null, balance: (emp.balance || 0) + (hours * (emp.hourlyRate || 0)), totalHours: (emp.totalHours || 0) + hours });
    } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Currently On-Site</p><p className="text-3xl font-bold text-cyan-600">{activeEmployees.length}</p></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Employees</p><p className="text-3xl font-bold text-slate-800 dark:text-white">{totalEmployees}</p></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Scans Today</p><p className="text-3xl font-bold text-indigo-600">{todayScans.length}</p></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-sm mb-1">System Status</p><div className="flex items-center mt-1 text-green-600 font-medium"><CheckCircle2 size={20} className="mr-2" /> Operational</div></div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50"><h3 className="font-semibold text-slate-800 dark:text-white">Currently Checked In</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium text-xs"><tr><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Checked In At</th><th className="px-6 py-3">Current Session</th><th className="px-6 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {activeEmployees.length === 0 ? (<tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">No one is currently active</td></tr>) : activeEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{emp.name}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDateSafe(emp.lastCheckInTime, {hour:'2-digit', minute:'2-digit'})}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400"><LiveDuration startTime={emp.lastCheckInTime} /></td>
                    <td className="px-6 py-4"><button onClick={() => handleQuickCheckout(emp)} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 font-medium">Force Out</button></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Employees Management ---
function EmployeesTab({ employees, attendance, user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', barcode: '', hourlyRate: 0, status: 'Active' });
  const [search, setSearch] = useState('');
  const [showBarcode, setShowBarcode] = useState(null); 
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);
  
  // State for the new history modal
  const [historyEmp, setHistoryEmp] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'employees', formData.id);
        const finalFormData = { ...formData };
        if (!finalFormData.barcode || finalFormData.barcode === 0) finalFormData.barcode = generateUniqueId(employees);
        await updateDoc(ref, finalFormData);
      } else {
        const newBarcode = formData.barcode || generateUniqueId(employees);
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'employees'), { ...formData, barcode: newBarcode, balance: 0, totalHours: 0, isCheckedIn: false, hourlyRate: Number(formData.hourlyRate) });
      }
      setIsEditing(false);
      setFormData({ name: '', barcode: '', hourlyRate: 0, status: 'Active' });
    } catch(err) { console.error(err); window.alert(err.message); }
  };

  const handleGeminiAnalysis = async (emp) => {
    setGeminiLoading(true); setGeminiResult(null);
    const empLogs = attendance.filter(a => a.employeeId === emp.id).slice(0, 20); 
    const context = `Employee: ${emp.name}, Hours: ${emp.totalHours?.toFixed(2)||0}, Rate: ${emp.hourlyRate}, Bal: ${emp.balance||0}. Logs: ${empLogs.map(l => `${l.action} ${l.timestamp}`).join(', ')}`;
    const text = await callGemini(`Act as HR Analyst. Analyze employee ${emp.name}. Summarize punctuality and consistency in 3 sentences. Data: ${context}`);
    setGeminiResult({ title: `Review: ${emp.name}`, content: text }); setGeminiLoading(false);
  };

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.barcode?.includes(search));

  return (
    <div className="space-y-6">
      <GeminiModal isOpen={!!geminiResult || geminiLoading} onClose={() => { setGeminiResult(null); setGeminiLoading(false); }} title={geminiResult?.title || "Analyzing..."} content={geminiResult?.content} isLoading={geminiLoading} />
      {showBarcode && (<QrCodeDisplayModal employee={showBarcode} onClose={() => setShowBarcode(null)} />)}
      
      {/* RENDER NEW HISTORY MODAL */}
      {historyEmp && (
        <EmployeeHistoryModal 
            employee={historyEmp} 
            attendance={attendance} 
            onClose={() => setHistoryEmp(null)} 
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-4"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-full sm:w-64 text-slate-800 dark:text-white" /></div><button onClick={() => { setFormData({ name: '', barcode: '', hourlyRate: 0, status: 'Active' }); setIsEditing(true); }} className="bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-cyan-700"><Plus size={18} /> Add Employee</button></div>
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{formData.id ? 'Edit' : 'New'} Employee</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label><input required className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300">QR Code ID (5 Digits)</label><input required type="number" className="w-full p-2 border rounded font-mono bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value.slice(0, 5) })} placeholder="e.g. 10001" /><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This 5-digit code is the key for the scanner. It is encoded directly in the QR code.</p></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rate (€)</label><input required type="number" className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={formData.hourlyRate} onChange={e=>setFormData({...formData, hourlyRate: e.target.value})} /></div><div><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label><select className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}><option>Active</option><option>Inactive</option></select></div></div>
              <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">Save</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{filtered.map(emp => (<div key={emp.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center group hover:border-cyan-300 transition-colors">
        <div><h4 className="font-bold text-lg text-slate-800 dark:text-white">{emp.name}</h4><p className="text-sm text-slate-500 dark:text-slate-400">ID: {emp.barcode}</p><p className="text-sm text-slate-500 dark:text-slate-400">Bal: {formatCurrency(emp.balance || 0)}</p></div>
        <div className="flex gap-2">
            {/* Added History Button */}
            <button onClick={() => setHistoryEmp(emp)} className="p-2 bg-blue-50 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" title="View History"><FileText size={16} /></button>
            {emp.barcode && (<button onClick={() => setShowBarcode(emp)} className="p-2 bg-green-50 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" title="Generate QR Code"><QrCode size={16} /></button>)}
            <button onClick={() => handleGeminiAnalysis(emp)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400"><Sparkles size={16} /></button>
            <button onClick={() => { setFormData(emp); setIsEditing(true); }} className="p-2 bg-slate-100 rounded-lg text-slate-500 dark:bg-slate-700 dark:text-slate-400"><Edit size={16} /></button>
            <button onClick={() => { if(window.confirm('Delete?')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', emp.id)) }} className="p-2 bg-slate-100 text-red-600 rounded-lg dark:bg-slate-700 dark:text-red-400"><Trash2 size={16} /></button>
        </div></div>))}</div>
    </div>
  );
}

// --- Attendance Logs ---
function AttendanceTab({ attendance }) {
  const [deleteData, setDeleteData] = useState(null);

  const confirmDelete = async () => {
    if (!deleteData) return;
    try { 
        if (deleteData.action === 'OUT' && deleteData.calculatedHours > 0) {
            const reverseAmount = deleteData.earnedAmount || 0;
            const reverseHours = deleteData.calculatedHours || 0;
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', deleteData.employeeId), {
                balance: increment(-reverseAmount),
                totalHours: increment(-reverseHours)
            });
        }
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendance', deleteData.id));
        setDeleteData(null);
    } 
    catch (error) { console.error("Error deleting log:", error); alert("Failed to delete log."); }
  };

  const getSmartDuration = (currentLog, allLogs) => {
    if (currentLog.calculatedHours !== undefined && currentLog.calculatedHours !== null && currentLog.calculatedHours > 0.001) return currentLog.calculatedHours;
    if (currentLog.action === 'OUT') {
      const outTime = new Date(currentLog.timestamp).getTime();
      if(isNaN(outTime)) return 0;
      const match = allLogs.find(l => l.employeeId === currentLog.employeeId && l.action === 'IN' && new Date(l.timestamp).getTime() < outTime);
      if (match) {
        const inTime = new Date(match.timestamp).getTime();
        if(isNaN(inTime)) return 0;
        const diffMs = outTime - inTime;
        if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) return diffMs / (1000 * 60 * 60);
      }
    }
    return 0;
  };

  // Client-side sort to fix optimistic updates appearing at top
  const sortedAttendance = [...attendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50"><h3 className="font-semibold text-slate-800 dark:text-white">Attendance Log</h3></div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium text-xs sticky top-0"><tr><th className="px-6 py-3">Time</th><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Duration</th><th className="px-6 py-3 text-right">Manage</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {sortedAttendance.map(log => {
              const duration = getSmartDuration(log, attendance);
              return (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{formatDateSafe(log.timestamp)}</td>
                <td className="px-6 py-3 font-medium text-slate-800 dark:text-white">{log.employeeName}</td>
                <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.action === 'IN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>{log.action}</span>
                        {log.source === 'manual' && (
                            <span className="text-[10px] text-orange-600 border border-orange-200 bg-orange-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="Manually Added">
                                <Tag size={8}/>
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                  {log.action === 'OUT' && duration > 0 ? (<div className="flex flex-col"><span className="font-medium text-slate-800 dark:text-slate-200">{formatDuration(duration)}</span><span className="text-xs text-slate-400">({Number(duration).toFixed(2)} hrs)</span></div>) : (<span className="text-slate-300 dark:text-slate-600">-</span>)}
                </td>
                <td className="px-6 py-3 text-right"><button onClick={() => setDeleteData(log)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Entry"><Trash2 size={16} /></button></td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      <ConfirmModal 
        isOpen={!!deleteData}
        title="Delete Entry"
        message="Are you sure you want to delete this log? If this is an OUT log, any calculations will be reversed."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteData(null)}
      />
    </div>
  );
}

// --- Payroll System ---
function PayrollTab({ employees, attendance }) {
  const stats = useMemo(() => {
    const s = {};
    employees.forEach(e => s[e.id] = { earned: 0, hours: 0 });
    
    attendance.forEach(log => {
        if (log.action === 'OUT') {
            const dur = getSmartDuration(log, attendance); 
            if (s[log.employeeId] && dur > 0) {
                const emp = employees.find(e => e.id === log.employeeId);
                const rate = emp ? parseFloat(emp.hourlyRate||0) : 0;
                s[log.employeeId].hours += dur;
                s[log.employeeId].earned += (dur * rate);
            }
        }
    });
    return s;
  }, [employees, attendance]);

  const handlePayment = async (e, selectedEmp, amount, note, setIsPaying) => {
    e.preventDefault();
    if (!selectedEmp) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), { 
        employeeId: selectedEmp.id, 
        employeeName: selectedEmp.name, 
        amount: parseFloat(amount), 
        date: new Date().toISOString(), 
        note: note 
    });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', selectedEmp.id), { 
        balance: (selectedEmp.balance || 0) - parseFloat(amount) 
    });
    setIsPaying(false);
  };

  const [isPaying, setIsPaying] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, note: '' });
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), orderBy('date', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Balances (Based on Logs)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500">
                        <tr>
                            <th className="p-2">Employee</th>
                            <th className="p-2">Total Time</th>
                            <th className="p-2">Owed</th>
                            <th className="p-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td className="p-2 font-medium dark:text-slate-200">{emp.name}</td>
                                <td className="p-2 text-slate-500 dark:text-slate-400">
                                    {formatDuration(stats[emp.id]?.hours || 0)}
                                </td>
                                <td className="p-2 font-bold text-green-600">
                                    {formatCurrency(stats[emp.id]?.earned)}
                                </td>
                                <td className="p-2 text-right">
                                    <button 
                                        onClick={() => { setSelectedEmp(emp); setPayForm({amount: stats[emp.id]?.earned || 0, note: ''}); setIsPaying(true); }} 
                                        className="text-xs text-white bg-indigo-600 px-3 py-1 rounded hover:bg-indigo-700"
                                    >
                                        Pay
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Recent Payments</h3>
            {payments.map(pay => (
                <div key={pay.id} className="flex justify-between p-2 text-sm border-b border-slate-50 dark:border-slate-700">
                   <span className="text-slate-600 dark:text-slate-300">{pay.employeeName}</span>
                   <span className="text-green-600 font-bold">{formatCurrency(pay.amount)}</span>
                </div>
            ))}
         </div>
      </div>

      {isPaying && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-sm">
                <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Pay {selectedEmp?.name}</h3>
                <form onSubmit={(e) => handlePayment(e, selectedEmp, payForm.amount, payForm.note, setIsPaying)} className="space-y-4">
                    <input 
                        type="number" 
                        className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                        value={payForm.amount} 
                        onChange={e=>setPayForm({...payForm, amount: e.target.value})} 
                    />
                    <input 
                        type="text" 
                        placeholder="Notes" 
                        className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                        value={payForm.note} 
                        onChange={e=>setPayForm({...payForm, note: e.target.value})} 
                    />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={()=>setIsPaying(false)} className="px-3 py-2 text-slate-500 dark:text-slate-400">Cancel</button>
                        <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">Confirm Payment</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

// --- Absences ---
function AbsencesTab({ employees, user }) {
  const [absences, setAbsences] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: '', date: '', type: 'Sick', paid: false, notes: '' });
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'absences'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => setAbsences(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, [user?.uid]);

  const handleAddAbsence = async (e) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === form.employeeId);
    if (!emp) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absences'), { ...form, employeeName: emp.name });
    setShowModal(false);
  };
  
  const handleDraftEmail = async (ab) => {
    setGeminiLoading(true); setGeminiResult(null);
    const text = await callGemini(`Draft email to ${ab.employeeName} about ${ab.type} absence on ${ab.date}. Status: ${ab.paid?'Paid':'Unpaid'}. Notes: ${ab.notes}. Be professional.`);
    setGeminiResult({ title: `Draft: ${ab.employeeName}`, content: text }); setGeminiLoading(false);
  };

  return (
    <div className="space-y-6">
      <GeminiModal isOpen={!!geminiResult || geminiLoading} onClose={() => { setGeminiResult(null); setGeminiLoading(false); }} title={geminiResult?.title} content={geminiResult?.content} isLoading={geminiLoading} />
      <div className="flex justify-between"><h2 className="font-bold text-slate-800 dark:text-white">Leave Management</h2><button onClick={()=>setShowModal(true)} className="bg-cyan-600 text-white px-3 py-1 rounded text-sm hover:bg-cyan-700">+ Record</button></div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium text-xs"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{absences.map(ab => (<tr key={ab.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-6 py-3 text-slate-500 dark:text-slate-400">{ab.date}</td><td className="px-6 py-3 font-medium text-slate-800 dark:text-white">{ab.employeeName}</td><td className="px-6 py-3 text-slate-600 dark:text-slate-300">{ab.type}</td><td className="px-6 py-3"><button onClick={()=>handleDraftEmail(ab)} className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Sparkles size={12}/> Email</button></td></tr>))}</tbody></table></div>
      {showModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md"><h3 className="font-bold mb-4 text-slate-800 dark:text-white">Record Absence</h3><form onSubmit={handleAddAbsence} className="space-y-4"><select required className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={form.employeeId} onChange={e=>setForm({...form, employeeId: e.target.value})}><option value="">Select Employee...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><input required type="date" className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} /><select className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}><option>Sick</option><option>Vacation</option><option>Personal</option></select><div className="flex justify-end gap-3"><button type="button" onClick={()=>setShowModal(false)} className="px-3 py-2 text-slate-500 dark:text-slate-400">Cancel</button><button type="submit" className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700">Save</button></div></form></div></div>)}
    </div>
  );
}