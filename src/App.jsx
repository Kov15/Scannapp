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
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Scan, 
  Users, 
  Clock, 
  DollarSign, 
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
  Sparkles,
  MessageSquare,
  Loader2,
  X,
  Lock,
  ArrowRight
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* CONFIGURATION & FIREBASE SETUP              */
/* -------------------------------------------------------------------------- */

// --- ADMIN CREDENTIALS ---
// In a real production app, these should be environment variables or strict auth rules.
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
/* UTILITIES & GEMINI API                      */
/* -------------------------------------------------------------------------- */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

const calculateHours = (ms) => {
  return (ms / (1000 * 60 * 60)).toFixed(2);
};

// Gemini API Integration
const callGemini = async (prompt) => {
  const apiKey = "AIzaSyBxo61DEjt0WerbLY9_jSW_WhTtpYJ4VJA"; // Runtime environment provides key
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    
    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate content. Please try again.";
  }
};

/* -------------------------------------------------------------------------- */
/* ROUTER & AUTH HOOKS                         */
/* -------------------------------------------------------------------------- */

// Simple Hash Router Hook
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.replace('#', '') || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
  };

  return { route, navigate };
}

/* -------------------------------------------------------------------------- */
/* SHARED COMPONENTS                           */
/* -------------------------------------------------------------------------- */

function GeminiModal({ isOpen, onClose, title, content, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-300" />
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-indigo-600">
              <Loader2 size={40} className="animate-spin mb-4" />
              <p className="font-medium animate-pulse">Consulting Gemini AI...</p>
            </div>
          ) : (
            <div className="prose prose-indigo max-w-none">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                {content}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                 <button 
                   onClick={() => { navigator.clipboard.writeText(content); }}
                   className="text-xs text-slate-500 hover:text-indigo-600 font-medium px-3 py-2"
                 >
                   Copy to Clipboard
                 </button>
                 <button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                   Done
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

export default function AquaTimeControl() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { route, navigate } = useHashRoute();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // 1. Firebase Auth (Background Connection)
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Admin Session Check
  useEffect(() => {
    const checkSession = () => {
      const session = localStorage.getItem('aqua_admin_session');
      if (session) {
        const { timestamp } = JSON.parse(session);
        const now = Date.now();
        if (now - timestamp < ADMIN_CONFIG.sessionDuration) {
          setIsAdminAuthenticated(true);
        } else {
          // Expired
          localStorage.removeItem('aqua_admin_session');
          setIsAdminAuthenticated(false);
        }
      }
    };
    checkSession();
  }, [route]); // Re-check on route change

  // 3. Routing Logic
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400">
        <div className="animate-spin mr-3"><Loader2 size={32} /></div>
        <span className="text-xl font-mono">Initializing AQUA System...</span>
      </div>
    );
  }

  // Route: /scan (Public Kiosk)
  if (route === '/scan') {
    return <ScannerMode user={user} />;
  }

  // Route: /admin/* (Protected)
  if (route.startsWith('/admin')) {
    if (!isAdminAuthenticated) {
       // Redirect to login if trying to access admin without auth
       return <AdminLogin navigate={navigate} />;
    }
    return <AdminDashboard user={user} navigate={navigate} />;
  }

  // Route: /login (Admin Login Page)
  if (route === '/login') {
    return <AdminLogin navigate={navigate} />;
  }

  // Route: / (Landing Page)
  return <LandingScreen navigate={navigate} />;
}

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION SCREENS                      */
/* -------------------------------------------------------------------------- */

function AdminLogin({ navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate network delay for realism
    setTimeout(() => {
      if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        // Success
        localStorage.setItem('aqua_admin_session', JSON.stringify({
          timestamp: Date.now(),
          user: username
        }));
        navigate('/admin');
      } else {
        setError('Invalid credentials. Access denied.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-8 text-center">
           <div className="mx-auto bg-cyan-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
             <Lock className="text-cyan-400" size={32} />
           </div>
           <h2 className="text-2xl font-bold text-white">Admin Portal</h2>
           <p className="text-slate-400 text-sm mt-2">Restricted Access Area</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              placeholder="Enter admin username"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Authenticate'}
          </button>
          
          <div className="text-center mt-4">
             <button type="button" onClick={() => navigate('/')} className="text-slate-400 text-sm hover:text-slate-600">
               Return to Home
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LANDING SCREEN                              */
/* -------------------------------------------------------------------------- */

function LandingScreen({ navigate }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="mb-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-cyan-500 p-4 rounded-2xl shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)]">
            <Clock size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">AQUA</h1>
        <p className="text-slate-400 text-lg">Select your portal to continue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Card 1: Scanner */}
        <button 
          onClick={() => navigate('/scan')}
          className="group relative flex flex-col p-8 bg-slate-800 rounded-2xl border border-slate-700 hover:border-cyan-400 hover:bg-slate-800/80 transition-all duration-300 text-left"
        >
          <div className="bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
             <Scan size={24} className="text-cyan-400" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            Scanner Portal <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Public kiosk interface for employee attendance. Optimized for barcode scanners and touchless entry.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-green-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            NO LOGIN REQUIRED
          </div>
        </button>

        {/* Card 2: Admin */}
        <button 
          onClick={() => navigate('/login')}
          className="group relative flex flex-col p-8 bg-slate-800 rounded-2xl border border-slate-700 hover:border-indigo-400 hover:bg-slate-800/80 transition-all duration-300 text-left"
        >
          <div className="bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
             <Settings size={24} className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            Admin Dashboard <Lock size={16} className="text-slate-500" />
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Secure backend for payroll, employee management, and analytics. Requires master credentials.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-indigo-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            SECURE ACCESS
          </div>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SCANNER MODE (ISOLATED)                     */
/* -------------------------------------------------------------------------- */

function ScannerMode({ user }) {
  const [code, setCode] = useState('');
  const [lastScans, setLastScans] = useState({}); // Debounce map
  const [scanResult, setScanResult] = useState(null); // { status: 'success'|'error', message, employee, type }
  const [employees, setEmployees] = useState([]);
  const inputRef = useRef(null);
  
  // Fetch employees for lookup (Read Only for scanner)
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'employees');
    const unsub = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, [user?.uid]);

  // Keep input focused
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    const scannedCode = code.trim();
    setCode(''); // Clear immediately for next scan
    
    // 1. Find Employee
    const employee = employees.find(emp => emp.barcode === scannedCode && emp.status === 'Active');
    
    if (!employee) {
      showFeedback('error', 'Employee not found or inactive.');
      return;
    }

    // 2. Check Debounce (30s)
    const now = Date.now();
    const lastScan = lastScans[employee.id];
    if (lastScan && (now - lastScan < 30000)) {
      showFeedback('warning', `Please wait before scanning again, ${employee.name}.`);
      return;
    }

    // 3. Process Logic
    try {
      // Update local debounce
      setLastScans(prev => ({ ...prev, [employee.id]: now }));

      const isCheckIn = !employee.isCheckedIn;
      const timestamp = new Date().toISOString();
      
      let hoursWorked = 0;
      let earnedAmount = 0;

      // Calculate hours if checking out
      if (!isCheckIn && employee.lastCheckInTime) {
        const checkInTime = new Date(employee.lastCheckInTime).getTime();
        const durationMs = now - checkInTime;
        hoursWorked = durationMs / (1000 * 60 * 60); // Hours
        earnedAmount = hoursWorked * (parseFloat(employee.hourlyRate) || 0);
      }

      // Add to Attendance Log
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'attendance'), {
        employeeId: employee.id,
        employeeName: employee.name, // Denormalize
        timestamp: timestamp,
        action: isCheckIn ? 'IN' : 'OUT',
        calculatedHours: isCheckIn ? 0 : hoursWorked,
        earnedAmount: isCheckIn ? 0 : earnedAmount
      });

      // Update Employee Record
      const employeeRef = doc(db, 'artifacts', appId, 'users', user.uid, 'employees', employee.id);
      await updateDoc(employeeRef, {
        isCheckedIn: isCheckIn,
        lastCheckInTime: isCheckIn ? timestamp : null,
        balance: (parseFloat(employee.balance) || 0) + earnedAmount,
        totalHours: (parseFloat(employee.totalHours) || 0) + hoursWorked
      });

      showFeedback('success', isCheckIn ? 'Checked In' : 'Checked Out', employee);

    } catch (error) {
      console.error("Scan Error", error);
      showFeedback('error', 'System Error. Please try again.');
    }
  };

  const showFeedback = (status, message, employee = null) => {
    setScanResult({ status, message, employee, timestamp: new Date() });
    setTimeout(() => {
        setScanResult(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden cursor-none">
        {/* Background Ambient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-black to-black opacity-50 pointer-events-none"></div>

        {/* Main Interface - Simplified for Public View */}
        <div className="z-10 w-full max-w-4xl px-6 flex flex-col items-center">
            
            {/* Header */}
            <div className="mb-12 text-center">
                <h1 className="text-slate-500 text-2xl font-bold tracking-[0.2em] uppercase mb-2">Aqua</h1>
                <p className="text-slate-600 text-sm">Secure Entry Point</p>
            </div>

            {/* Scan Feedback Area */}
            <div className={`w-full h-96 rounded-3xl flex flex-col items-center justify-center transition-all duration-300 border-4 ${
                scanResult?.status === 'success' ? 'bg-green-900/20 border-green-500 shadow-[0_0_100px_rgba(34,197,94,0.2)]' :
                scanResult?.status === 'error' ? 'bg-red-900/20 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.2)]' :
                scanResult?.status === 'warning' ? 'bg-amber-900/20 border-amber-500' :
                'bg-slate-900/50 border-slate-800'
            }`}>
                
                {!scanResult && (
                    <div className="flex flex-col items-center animate-pulse text-slate-600">
                        <Scan size={120} strokeWidth={0.5} />
                        <span className="mt-8 text-3xl font-light tracking-widest">SCAN BADGE</span>
                    </div>
                )}

                {scanResult && (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                        {scanResult.status === 'success' && <CheckCircle2 size={80} className="text-green-500 mx-auto mb-6" />}
                        {scanResult.status === 'error' && <XCircle size={80} className="text-red-500 mx-auto mb-6" />}
                        {scanResult.status === 'warning' && <AlertTriangle size={80} className="text-amber-500 mx-auto mb-6" />}
                        
                        <h2 className={`text-5xl font-bold mb-4 ${
                             scanResult.status === 'success' ? 'text-white' : 
                             scanResult.status === 'error' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                            {scanResult.message}
                        </h2>
                        
                        {scanResult.employee && (
                            <div className="mt-4">
                                <p className="text-3xl text-cyan-400 font-light">{scanResult.employee.name}</p>
                                <p className="text-slate-500 mt-2 font-mono text-xl">
                                    {scanResult.timestamp.toLocaleTimeString()}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden Input Form */}
            <form onSubmit={handleScan} className="w-full mt-12 relative group">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-900/30 text-center text-slate-700 text-xl font-mono py-4 rounded-xl border border-slate-800 focus:border-cyan-900 focus:ring-0 outline-none transition-all placeholder:text-slate-800"
                    placeholder="Input Active"
                    autoComplete="off"
                />
            </form>
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-6 text-slate-800 text-xs font-mono">
            SECURE KIOSK MODE • NO ADMIN ACCESS
        </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADMIN DASHBOARD                             */
/* -------------------------------------------------------------------------- */

function AdminDashboard({ user, navigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Data Hooks
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  useEffect(() => {
    if (!user) return;
    const empUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), 
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Emp Error", err)
    );
    const attQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'attendance'), orderBy('timestamp', 'desc'), limit(500));
    const attUnsub = onSnapshot(attQuery,
      (snap) => setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Att Error", err)
    );

    return () => { empUnsub(); attUnsub(); };
  }, [user?.uid]);

  const handleLogout = () => {
    localStorage.removeItem('aqua_admin_session');
    navigate('/'); // Redirect to landing
  };

  const MenuItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id ? 'bg-cyan-500/10 text-cyan-500' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-6 flex items-center justify-between">
           {isSidebarOpen && <span className="text-xl font-bold text-slate-800 tracking-tight">AQUA<span className="text-cyan-500">.Control</span></span>}
           <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
             {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
           </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <MenuItem id="overview" icon={BarChart3} label={isSidebarOpen ? "Overview" : ""} />
          <MenuItem id="employees" icon={Users} label={isSidebarOpen ? "Employees" : ""} />
          <MenuItem id="attendance" icon={Clock} label={isSidebarOpen ? "Attendance" : ""} />
          <MenuItem id="payroll" icon={DollarSign} label={isSidebarOpen ? "Payroll" : ""} />
          <MenuItem id="absences" icon={CalendarOff} label={isSidebarOpen ? "Absences" : ""} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={`flex items-center gap-3 px-4 py-3 mb-2 bg-slate-50 rounded-lg ${!isSidebarOpen && 'hidden'}`}>
             <div className="w-2 h-2 rounded-full bg-green-500"></div>
             <div className="text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Admin Logged In</p>
                <p>Session Active</p>
             </div>
          </div>
          <button onClick={handleLogout} className="flex items-center space-x-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h1>
            <div className="text-sm text-slate-500">
                Welcome, Master Admin
            </div>
        </header>
        
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'overview' && <OverviewTab employees={employees} attendance={attendance} user={user} />}
            {activeTab === 'employees' && <EmployeesTab employees={employees} attendance={attendance} user={user} />}
            {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}
            {activeTab === 'payroll' && <PayrollTab employees={employees} user={user} />}
            {activeTab === 'absences' && <AbsencesTab employees={employees} user={user} />}
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SUB-MODULES                                 */
/* -------------------------------------------------------------------------- */

// --- Overview ---
function OverviewTab({ employees, attendance, user }) {
  const activeEmployees = employees.filter(e => e.isCheckedIn);
  const totalEmployees = employees.length;
  const today = new Date().toLocaleDateString();
  const todayScans = attendance.filter(a => new Date(a.timestamp).toLocaleDateString() === today);

  const handleQuickCheckout = async (emp) => {
    if (!confirm(`Force checkout for ${emp.name}?`)) return;
    try {
         const timestamp = new Date().toISOString();
         let hours = 0;
         if (emp.lastCheckInTime) {
             hours = (new Date().getTime() - new Date(emp.lastCheckInTime).getTime()) / (1000 * 60 * 60);
         }
         await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'attendance'), {
             employeeId: emp.id,
             employeeName: emp.name,
             timestamp,
             action: 'OUT',
             calculatedHours: hours,
             earnedAmount: hours * (emp.hourlyRate || 0),
             note: 'Admin Forced'
         });
         await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', emp.id), {
             isCheckedIn: false,
             lastCheckInTime: null,
             balance: (emp.balance || 0) + (hours * (emp.hourlyRate || 0)),
             totalHours: (emp.totalHours || 0) + hours
         });
    } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">Currently On-Site</p>
          <p className="text-3xl font-bold text-cyan-600">{activeEmployees.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">Total Employees</p>
          <p className="text-3xl font-bold text-slate-800">{totalEmployees}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">Scans Today</p>
          <p className="text-3xl font-bold text-indigo-600">{todayScans.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">System Status</p>
          <div className="flex items-center mt-1 text-green-600 font-medium">
             <CheckCircle2 size={20} className="mr-2" /> Operational
          </div>
        </div>
      </div>

      {/* Active Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">Currently Checked In</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-medium text-xs">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Checked In At</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeEmployees.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No one is currently active</td></tr>
              ) : activeEmployees.map(emp => {
                const duration = emp.lastCheckInTime ? calculateHours(Date.now() - new Date(emp.lastCheckInTime).getTime()) : 0;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{emp.name}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(emp.lastCheckInTime).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 text-slate-500">{duration} hrs</td>
                    <td className="px-6 py-4">
                       <button onClick={() => handleQuickCheckout(emp)} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full hover:bg-red-100 font-medium">Force Out</button>
                    </td>
                  </tr>
                )
              })}
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
  
  // Gemini State
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'employees', formData.id);
        await updateDoc(ref, formData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), {
          ...formData,
          balance: 0,
          totalHours: 0,
          isCheckedIn: false,
          hourlyRate: Number(formData.hourlyRate)
        });
      }
      setIsEditing(false);
      setFormData({ name: '', barcode: '', hourlyRate: 0, status: 'Active' });
    } catch(err) { alert(err.message); }
  };

  const handleGeminiAnalysis = async (emp) => {
    setGeminiLoading(true);
    setGeminiResult(null);
    const empLogs = attendance.filter(a => a.employeeId === emp.id).slice(0, 20); 
    const context = `
      Employee Name: ${emp.name}
      Total Hours: ${emp.totalHours?.toFixed(2) || 0}
      Rate: €${emp.hourlyRate}
      Balance: €${emp.balance || 0}
      Logs: ${empLogs.map(l => `${l.action} ${l.timestamp}`).join(', ')}
    `;
    const prompt = `Act as HR Analyst. Analyze employee ${emp.name}. Summarize punctuality and consistency in 3 sentences. Data: ${context}`;
    const text = await callGemini(prompt);
    setGeminiResult({ title: `Review: ${emp.name}`, content: text });
    setGeminiLoading(false);
  };

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.barcode.includes(search));

  return (
    <div className="space-y-6">
      <GeminiModal 
        isOpen={!!geminiResult || geminiLoading} 
        onClose={() => { setGeminiResult(null); setGeminiLoading(false); }}
        title={geminiResult?.title || "Analyzing..."}
        content={geminiResult?.content}
        isLoading={geminiLoading}
      />

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
               type="text" 
               placeholder="Search..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg w-full sm:w-64"
            />
        </div>
        <button 
          onClick={() => { setFormData({ name: '', barcode: '', hourlyRate: 0, status: 'Active' }); setIsEditing(true); }}
          className="bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-cyan-700"
        >
          <Plus size={18} /> Add Employee
        </button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{formData.id ? 'Edit' : 'New'} Employee</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-sm font-medium">Name</label><input required className="w-full p-2 border rounded" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="text-sm font-medium">Barcode</label><input required className="w-full p-2 border rounded font-mono" value={formData.barcode} onChange={e=>setFormData({...formData, barcode: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Rate (€)</label><input required type="number" className="w-full p-2 border rounded" value={formData.hourlyRate} onChange={e=>setFormData({...formData, hourlyRate: e.target.value})} /></div>
                <div><label className="text-sm font-medium">Status</label><select className="w-full p-2 border rounded" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}><option>Active</option><option>Inactive</option></select></div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(emp => (
          <div key={emp.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-cyan-300 transition-colors">
            <div>
              <h4 className="font-bold text-lg text-slate-800">{emp.name}</h4>
              <p className="text-sm text-slate-500">ID: {emp.barcode}</p>
              <p className="text-sm text-slate-500">Bal: {formatCurrency(emp.balance || 0)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleGeminiAnalysis(emp)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Sparkles size={16} /></button>
              <button onClick={() => { setFormData(emp); setIsEditing(true); }} className="p-2 bg-slate-100 rounded-lg"><Edit size={16} /></button>
              <button onClick={() => { if(confirm('Delete?')) deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', emp.id)) }} className="p-2 bg-slate-100 text-red-600 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Attendance Logs ---
function AttendanceTab({ attendance }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold">Attendance Log</h3></div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium text-xs sticky top-0">
            <tr><th className="px-6 py-3">Time</th><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Hrs</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attendance.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-6 py-3 font-medium">{log.employeeName}</td>
                <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${log.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>{log.action}</span></td>
                <td className="px-6 py-3 text-slate-600">{log.calculatedHours ? Number(log.calculatedHours).toFixed(2) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Payroll System ---
function PayrollTab({ employees, user }) {
  const [payments, setPayments] = useState([]);
  const [isPaying, setIsPaying] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, note: '' });
  const [selectedEmp, setSelectedEmp] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'payments'), orderBy('date', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, [user?.uid]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'payments'), {
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      amount: parseFloat(payForm.amount),
      date: new Date().toISOString(),
      note: payForm.note
    });
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', selectedEmp.id), {
      balance: (selectedEmp.balance || 0) - parseFloat(payForm.amount)
    });
    setIsPaying(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white rounded-xl p-6 border border-slate-100">
            <h3 className="font-bold mb-4">Balances Due</h3>
            {employees.filter(e => (e.balance || 0) > 0).map(emp => (
                <div key={emp.id} className="flex justify-between items-center p-3 border-b border-slate-50">
                  <span>{emp.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-red-600 font-bold">{formatCurrency(emp.balance)}</span>
                    <button onClick={() => { setSelectedEmp(emp); setPayForm({...payForm, amount: emp.balance}); setIsPaying(true); }} className="text-xs text-white bg-indigo-600 px-3 py-1 rounded">Pay</button>
                  </div>
                </div>
            ))}
         </div>
         <div className="bg-white rounded-xl p-6 border border-slate-100">
            <h3 className="font-bold mb-4">Recent Payments</h3>
            {payments.map(pay => (
                <div key={pay.id} className="flex justify-between p-2 text-sm border-b border-slate-50">
                   <span>{pay.employeeName}</span>
                   <span className="text-green-600 font-bold">+{formatCurrency(pay.amount)}</span>
                </div>
            ))}
         </div>
      </div>
      {isPaying && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
             <h3 className="font-bold mb-4">Pay {selectedEmp.name}</h3>
             <form onSubmit={handlePayment} className="space-y-4">
               <input type="number" className="w-full p-2 border rounded" value={payForm.amount} onChange={e=>setPayForm({...payForm, amount: e.target.value})} />
               <input type="text" placeholder="Notes" className="w-full p-2 border rounded" value={payForm.note} onChange={e=>setPayForm({...payForm, note: e.target.value})} />
               <div className="flex justify-end gap-2"><button type="button" onClick={()=>setIsPaying(false)} className="px-3 py-2 text-slate-500">Cancel</button><button type="submit" className="px-3 py-2 bg-green-600 text-white rounded">Pay</button></div>
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
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'absences'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => setAbsences(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, [user?.uid]);

  const handleAddAbsence = async (e) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === form.employeeId);
    if (!emp) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'absences'), { ...form, employeeName: emp.name });
    setShowModal(false);
  };
  
  const handleDraftEmail = async (ab) => {
    setGeminiLoading(true);
    setGeminiResult(null);
    const text = await callGemini(`Draft email to ${ab.employeeName} about ${ab.type} absence on ${ab.date}. Status: ${ab.paid?'Paid':'Unpaid'}. Notes: ${ab.notes}. Be professional.`);
    setGeminiResult({ title: `Draft: ${ab.employeeName}`, content: text });
    setGeminiLoading(false);
  };

  return (
    <div className="space-y-6">
      <GeminiModal isOpen={!!geminiResult || geminiLoading} onClose={() => { setGeminiResult(null); setGeminiLoading(false); }} title={geminiResult?.title} content={geminiResult?.content} isLoading={geminiLoading} />
      <div className="flex justify-between"><h2 className="font-bold">Leave Management</h2><button onClick={()=>setShowModal(true)} className="bg-cyan-600 text-white px-3 py-1 rounded text-sm">+ Record</button></div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium text-xs"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{absences.map(ab => (<tr key={ab.id} className="hover:bg-slate-50"><td className="px-6 py-3">{ab.date}</td><td className="px-6 py-3">{ab.employeeName}</td><td className="px-6 py-3">{ab.type}</td><td className="px-6 py-3"><button onClick={()=>handleDraftEmail(ab)} className="text-indigo-600 flex items-center gap-1"><Sparkles size={12}/> Email</button></td></tr>))}</tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="font-bold mb-4">Record Absence</h3>
            <form onSubmit={handleAddAbsence} className="space-y-4">
              <select required className="w-full p-2 border rounded" value={form.employeeId} onChange={e=>setForm({...form, employeeId: e.target.value})}><option value="">Select Employee...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              <input required type="date" className="w-full p-2 border rounded" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
              <select className="w-full p-2 border rounded" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}><option>Sick</option><option>Vacation</option><option>Personal</option></select>
              <div className="flex justify-end gap-3"><button type="button" onClick={()=>setShowModal(false)} className="text-slate-500">Cancel</button><button type="submit" className="bg-cyan-600 text-white px-4 py-2 rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
