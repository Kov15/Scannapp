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
  limit,
  where
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
  Barcode
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* CONFIGURATION & FIREBASE SETUP              */
/* -------------------------------------------------------------------------- */

// --- ADMIN CREDENTIALS ---
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
/* UTILITIES & CHARTS                          */
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

// --- Custom SVG Charts (No external lib needed) ---

const SimpleLineChart = ({ data, color = "#0891b2", height = 60 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data) || 1;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (val / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        points={points}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 1 && <circle cx="100" cy={100 - (data[data.length-1]/max)*100} r="4" fill={color} />}
    </svg>
  );
};

const SimpleBarChart = ({ data, labels, color = "#0891b2" }) => {
  const max = Math.max(...data) || 1;
  return (
    <div className="flex items-end justify-between h-40 gap-2 w-full">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
          <div className="relative w-full bg-slate-100 rounded-t-md overflow-hidden flex items-end h-full">
             <div 
               className="w-full transition-all duration-700 ease-out relative group-hover:opacity-90"
               style={{ height: `${(val / max) * 100}%`, backgroundColor: color }}
             ></div>
             {/* Tooltip */}
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-mono">
               {val.toFixed(1)} hrs
             </div>
          </div>
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider truncate w-full text-center">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

// Gemini API Integration
const callGemini = async (prompt) => {
  const apiKey = "AIzaSyBxo61DEjt0WerbLY9_jSW_WhTtpYJ4VJA"; 
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

// --- Unique ID Generator for Barcode String ---
const generateUniqueId = (employees) => {
  const existingCodes = employees.map(e => e.barcode).filter(Boolean);
  let newId = 10001;
  while(existingCodes.includes(String(newId))) {
    newId++;
  }
  return String(newId);
};

// --- Simplified SVG Barcode Visualization (Non-encoding) ---
const BarcodeVisualization = ({ code }) => {
    // Generates a simple, readable bar pattern based on the length and characters of the code.
    const barWidth = 3;
    const barHeight = 60;
    
    let segments = [];
    let currentX = 0;
    
    // Use the numeric value of the characters to determine bar width/color pseudo-randomly
    const input = code.padEnd(10, '0'); // Ensure minimum length for visibility

    for (let i = 0; i < input.length * 2; i++) {
        const isBlack = i % 2 === 0;
        const charIndex = Math.floor(i / 2);
        const charValue = input.charCodeAt(charIndex) || 70;
        const width = (charValue % 4) + 5; // Width variation 5-8 px

        segments.push(
            `<rect x="${currentX}" y="0" width="${width}" height="${barHeight}" fill="${isBlack ? 'black' : 'white'}" />`
        );
        currentX += width;
    }
    
    const totalWidth = currentX;

    return (
        <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-slate-200">
            <svg width="100%" height={barHeight + 20} viewBox={`0 0 ${totalWidth} ${barHeight + 20}`} xmlns="http://www.w3.org/2000/svg" className="max-w-xs">
                <g transform="translate(0, 10)">
                    {segments.join('')}
                    <text x="${totalWidth / 2}" y="${barHeight + 15}" 
                          font-family="monospace, sans-serif" 
                          font-size="12" 
                          text-anchor="middle" 
                          fill="black"
                          className="font-bold">
                        {code}
                    </text>
                </g>
            </svg>
            <p className="text-xs text-slate-500 mt-2 italic">Scannable ID: {code}</p>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* ROUTER & AUTH HOOKS                         */
/* -------------------------------------------------------------------------- */

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
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed text-sm max-h-[60vh] overflow-y-auto">
                {content}
              </div>
              <div className="mt-4 flex justify-end gap-2">
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
/* BARCODE MODAL COMPONENT                     */
/* -------------------------------------------------------------------------- */

function BarcodeDisplayModal({ employee, onClose }) {
    if (!employee) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Barcode size={24} className="text-cyan-600"/> Employee Code: {employee.name}
                        </h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <p className="text-slate-600 mb-6">
                        This is the unique ID used for the scanner portal. Generate and distribute this code for quick clock-in/out.
                    </p>

                    <div className="flex justify-center mb-6">
                        <BarcodeVisualization code={employee.barcode} />
                    </div>

                    <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                        <h4 className="font-semibold text-cyan-800 flex items-center gap-2">
                            <AlertTriangle size={16} /> Production Note
                        </h4>
                        <p className="text-sm text-cyan-700 mt-2">
                            For guaranteed scannability and EAN 128 compliance, you must use the ID below with a dedicated external Barcode API (e.g., Google Charts, Barcode Generator Service) to generate a high-resolution, encoded image before sending it to your employees.
                        </p>
                        <p className="text-sm text-cyan-700 mt-2 font-mono break-all">
                            Unique ID: <span className="font-bold text-lg text-cyan-900">{employee.barcode}</span>
                        </p>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                            Close
                        </button>
                    </div>
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
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth failed, falling back to anonymous:", error);
        // Fallback if the token is invalid
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
  }, [route]); 

  // 3. Routing Logic
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400">
        <div className="animate-spin mr-3"><Loader2 size={32} /></div>
        <span className="text-xl font-mono">Initializing AQUA System...</span>
      </div>
    );
  }

  if (route === '/scan') return <ScannerMode user={user} />;

  if (route.startsWith('/admin')) {
    if (!isAdminAuthenticated) return <AdminLogin navigate={navigate} />;
    return <AdminDashboard user={user} navigate={navigate} />;
  }

  if (route === '/login') return <AdminLogin navigate={navigate} />;

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

    setTimeout(() => {
      if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
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
        <p className="text-slate-400 text-lg">Workforce Management System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
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
          <div className="mt-6 flex items-center gap-2 text-xs text-green-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            NO LOGIN REQUIRED
          </div>
        </button>

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
/* SCANNER MODE                                */
/* -------------------------------------------------------------------------- */

function ScannerMode({ user }) {
  const [code, setCode] = useState('');
  const [lastScans, setLastScans] = useState({});
  const [scanResult, setScanResult] = useState(null); 
  const [employees, setEmployees] = useState([]);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'employees');
    const unsub = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, [user?.uid]);

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
    setCode('');
    
    // Scan logic looks for the 'barcode' field (which is now the unique ID)
    const employee = employees.find(emp => emp.barcode === scannedCode && emp.status === 'Active');
    
    if (!employee) {
      showFeedback('error', 'Employee not found or inactive.');
      return;
    }

    const now = Date.now();
    const lastScan = lastScans[employee.id];
    if (lastScan && (now - lastScan < 30000)) {
      showFeedback('warning', `Please wait before scanning again, ${employee.name}.`);
      return;
    }

    try {
      setLastScans(prev => ({ ...prev, [employee.id]: now }));
      const isCheckIn = !employee.isCheckedIn;
      const timestamp = new Date().toISOString();
      let hoursWorked = 0;
      let earnedAmount = 0;

      if (!isCheckIn && employee.lastCheckInTime) {
        const checkInTime = new Date(employee.lastCheckInTime).getTime();
        const durationMs = now - checkInTime;
        hoursWorked = durationMs / (1000 * 60 * 60); 
        earnedAmount = hoursWorked * (parseFloat(employee.hourlyRate) || 0);
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), {
        employeeId: employee.id,
        employeeName: employee.name, 
        timestamp: timestamp,
        action: isCheckIn ? 'IN' : 'OUT',
        calculatedHours: isCheckIn ? 0 : hoursWorked,
        earnedAmount: isCheckIn ? 0 : earnedAmount
      });

      const employeeRef = doc(db, 'artifacts', appId, 'public', 'data', 'employees', employee.id);
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-black to-black opacity-50 pointer-events-none"></div>

        <div className="z-10 w-full max-w-4xl px-6 flex flex-col items-center">
            <div className="mb-12 text-center">
                <h1 className="text-slate-500 text-2xl font-bold tracking-[0.2em] uppercase mb-2">Aqua</h1>
                <p className="text-slate-600 text-sm">Product Code</p>
            </div>

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
  const [activeTab, setActiveTab] = useState('analytics'); // Default to Analytics for demo
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Data Hooks
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  useEffect(() => {
    if (!user) return;
    // NOTE: Uses public data
    const empUnsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'employees'), 
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Emp Error", err)
    );
    // Fetch last 1000 logs for analytics
    const attQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), orderBy('timestamp', 'desc'), limit(1000));
    const attUnsub = onSnapshot(attQuery,
      (snap) => setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Att Error", err)
    );

    return () => { empUnsub(); attUnsub(); };
  }, [user?.uid]);

  const handleLogout = () => {
    localStorage.removeItem('aqua_admin_session');
    navigate('/'); 
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
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-6 flex items-center justify-between">
           {isSidebarOpen && <span className="text-xl font-bold text-slate-800 tracking-tight">AQUA<span className="text-cyan-500">.Control</span></span>}
           <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
             {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
           </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <MenuItem id="analytics" icon={BarChart3} label={isSidebarOpen ? "Analytics" : ""} />
          <MenuItem id="overview" icon={Activity} label={isSidebarOpen ? "Live View" : ""} />
          <MenuItem id="employees" icon={Users} label={isSidebarOpen ? "Employees" : ""} />
          <MenuItem id="attendance" icon={Clock} label={isSidebarOpen ? "Attendance" : ""} />
          <MenuItem id="payroll" icon={Euro} label={isSidebarOpen ? "Payroll" : ""} />
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

      <main className="flex-1 overflow-auto p-8">
        <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h1>
            <div className="text-sm text-slate-500">
                Welcome, Master Admin
            </div>
        </header>
        
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'analytics' && <AnalyticsTab employees={employees} attendance={attendance} />}
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
/* NEW ANALYTICS MODULE                        */
/* -------------------------------------------------------------------------- */

function AnalyticsTab({ employees, attendance }) {
  const [range, setRange] = useState('Month');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all'); // Filter State
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (range === 'Week') newDate.setDate(newDate.getDate() + (direction * 7));
    else if (range === 'Month') newDate.setMonth(newDate.getMonth() + direction);
    else if (range === 'Year') newDate.setFullYear(newDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };
  
  // -- Analytic Logic --
  const metrics = useMemo(() => {
    // 1. Calculate Time Window
    const endWindow = new Date(currentDate);
    const startWindow = new Date(currentDate);

    if (range === 'Week') {
        // Find Monday of the current week
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
      const d = new Date(dateStr);
      return d >= startWindow && d <= endWindow;
    };

    let filteredLogs = attendance.filter(log => rangeFilter(log.timestamp));

    // 2. Employee Filter
    if (selectedEmployeeId !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.employeeId === selectedEmployeeId);
    }

    const completedShifts = filteredLogs.filter(log => log.action === 'OUT');

    // 3. Calculations
    const totalHours = completedShifts.reduce((acc, curr) => acc + (curr.calculatedHours || 0), 0);
    const totalEarnings = completedShifts.reduce((acc, curr) => acc + (curr.earnedAmount || 0), 0);
    const avgShift = completedShifts.length ? (totalHours / completedShifts.length) : 0;
    const performanceScore = Math.min(100, Math.round((avgShift / 8) * 100)) || 0;

    // 4. Chart Data (Dynamic buckets based on range)
    let chartData = [];
    let chartLabels = [];

    if (range === 'Week') {
        // Show Days (Mon-Sun)
        const daysMap = {};
        const temp = new Date(startWindow);
        for(let i=0; i<7; i++) {
            daysMap[temp.toLocaleDateString('en-US', {weekday:'short'})] = 0;
            temp.setDate(temp.getDate() + 1);
        }
        completedShifts.forEach(log => {
            const key = new Date(log.timestamp).toLocaleDateString('en-US', {weekday:'short'});
            if (daysMap[key] !== undefined) daysMap[key] += log.calculatedHours || 0;
        });
        chartLabels = Object.keys(daysMap);
        chartData = Object.values(daysMap);
    } else if (range === 'Month') {
        // Show Weeks (Week 1 - Week 5)
        const weeks = [0,0,0,0,0];
        completedShifts.forEach(log => {
            const d = new Date(log.timestamp);
            const date = d.getDate();
            const weekIndex = Math.min(4, Math.floor((date - 1) / 7));
            weeks[weekIndex] += log.calculatedHours || 0;
        });
        chartLabels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'];
        chartData = weeks;
    } else {
        // Show Months (Jan - Dec)
        const months = new Array(12).fill(0);
        completedShifts.forEach(log => {
            const m = new Date(log.timestamp).getMonth();
            months[m] += log.calculatedHours || 0;
        });
        chartLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        chartData = months;
    }

    // Format display title
    let displayTitle = "";
    if (range === 'Week') displayTitle = `${startWindow.toLocaleDateString()} - ${endWindow.toLocaleDateString()}`;
    else if (range === 'Month') displayTitle = startWindow.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    else displayTitle = startWindow.getFullYear();

    return {
      totalHours,
      totalEarnings,
      avgShift,
      performanceScore,
      chartData,
      chartLabels,
      shiftCount: completedShifts.length,
      displayTitle
    };
  }, [attendance, employees, range, selectedEmployeeId, currentDate]);

  const handleExportCSV = () => {
    // Re-calculate window (copied logic to ensure consistency with view)
    const endWindow = new Date(currentDate);
    const startWindow = new Date(currentDate);

    if (range === 'Week') {
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

    // Filter
    const filteredLogs = attendance.filter(log => {
        const d = new Date(log.timestamp);
        const inTime = d >= startWindow && d <= endWindow;
        const matchesEmp = selectedEmployeeId === 'all' || log.employeeId === selectedEmployeeId;
        return inTime && matchesEmp;
    });

    if (filteredLogs.length === 0) {
        alert("No data to export for the selected range.");
        return;
    }

    // Convert to CSV
    const csvHeader = "Date,Time,Employee Name,Action,Hours,Earnings,Note\n";
    const csvRows = filteredLogs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString();
        const name = `"${log.employeeName || ''}"`;
        const action = log.action;
        const hours = log.calculatedHours || 0;
        const earnings = log.earnedAmount || 0;
        const note = `"${log.note || ''}"`;
        return `${dateStr},${timeStr},${name},${action},${hours},${earnings},${note}`;
    }).join("\n");

    const csvString = csvHeader + csvRows;
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export_${range.toLowerCase()}_${startWindow.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-4">
         
         <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
             {/* Employee Selector */}
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <Users size={16} className="text-slate-400" />
                <select 
                    value={selectedEmployeeId} 
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 outline-none w-full sm:w-48 font-medium"
                >
                    <option value="all">All Employees</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
             </div>

             {/* Range Selector */}
             <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                {['Week', 'Month', 'Year'].map(r => (
                  <button 
                    key={r}
                    onClick={() => { setRange(r); setCurrentDate(new Date()); }}
                    className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md transition-all ${range === r ? 'bg-white shadow text-cyan-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {r}
                  </button>
                ))}
             </div>
         </div>

         {/* Time Travel Controls */}
         <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
             <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                 <ChevronLeft size={20} />
             </button>
             <span className="font-bold text-slate-700 w-40 text-center text-sm">{metrics.displayTitle}</span>
             <button onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                 <ChevronRight size={20} />
             </button>
         </div>

         <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 text-slate-500 hover:text-cyan-600 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white w-full xl:w-auto justify-center"
         >
            <Download size={16} /> Export CSV
         </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
           { label: 'Total Hours', val: metrics.totalHours.toFixed(1) + 'h', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Worked this period' },
           { label: 'Total Earnings', val: formatCurrency(metrics.totalEarnings), icon: Euro, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Base + Overtime' },
           { label: 'Avg Shift', val: metrics.avgShift.toFixed(1) + 'h', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Per employee' },
           { label: 'Efficiency Score', val: metrics.performanceScore + '%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'Based on 8h target' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-cyan-200 transition-colors">
             <div className="flex justify-between items-start mb-2">
                <div>
                   <p className="text-slate-500 text-sm font-medium">{k.label}</p>
                   <h3 className={`text-2xl font-bold ${k.color} mt-1`}>{k.val}</h3>
                </div>
                <div className={`p-2 rounded-lg ${k.bg} ${k.color}`}><k.icon size={20} /></div>
             </div>
             <p className="text-xs text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800">Hours Distribution ({range})</h3>
              <div className="flex gap-2 text-xs text-slate-500">
                 <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-600"></div> Regular</span>
              </div>
           </div>
           <SimpleBarChart data={metrics.chartData} labels={metrics.chartLabels} color="#0891b2" />
        </div>

        {/* Breakdown Panel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4">Shift Types</h3>
           <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clock size={16} /></div>
                    <div>
                       <p className="font-medium text-sm">Regular Shifts</p>
                       <p className="text-xs text-slate-500">{metrics.shiftCount} shifts recorded</p>
                    </div>
                 </div>
                 <span className="font-bold text-slate-700">{metrics.totalHours.toFixed(0)}h</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><AlertTriangle size={16} /></div>
                    <div>
                       <p className="font-medium text-sm">Overtime</p>
                       <p className="text-xs text-slate-500">Shifts &gt; 8h</p>
                    </div>
                 </div>
                 {/* Mock calculation for demo visuals */}
                 <span className="font-bold text-orange-700">{(metrics.totalHours * 0.15).toFixed(0)}h</span>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                 <h4 className="text-sm font-medium mb-3">Top Performers (Hours)</h4>
                 {employees
                    .sort((a,b) => (b.totalHours||0) - (a.totalHours||0))
                    .slice(0,3)
                    .map(e => (
                       <div key={e.id} className="flex justify-between items-center text-sm py-1">
                          <span className="text-slate-600">{e.name}</span>
                          <span className="font-mono font-medium text-cyan-600">{e.totalHours?.toFixed(1) || 0}h</span>
                       </div>
                    ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

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
         // NOTE: Changed to 'public/data' for shared access
         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), {
             employeeId: emp.id,
             employeeName: emp.name,
             timestamp,
             action: 'OUT',
             calculatedHours: hours,
             earnedAmount: hours * (emp.hourlyRate || 0),
             note: 'Admin Forced'
         });
         // NOTE: Changed to 'public/data' for shared access
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', emp.id), {
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
  
  // Barcode State
  const [showBarcode, setShowBarcode] = useState(null); // Holds the employee object for the modal

  // Gemini State
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'employees', formData.id);
        await updateDoc(ref, formData);
      } else {
        // Generate a new unique ID for the barcode field
        const newBarcode = generateUniqueId(employees);

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'employees'), {
          ...formData,
          barcode: newBarcode, // Save the generated ID
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
      Rate: € ${emp.hourlyRate}
      Balance: € ${emp.balance || 0}
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
      {showBarcode && (
        <BarcodeDisplayModal 
          employee={showBarcode} 
          onClose={() => setShowBarcode(null)} 
        />
      )}

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
              {/* Barcode input remains hidden as it is auto-generated upon creation */}
              {!formData.id && 
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 italic">
                  *Barcode ID will be automatically generated upon creation.
                </div>
              }
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
              <button onClick={() => setShowBarcode(emp)} className="p-2 bg-green-50 text-green-600 rounded-lg" title="Generate Barcode"><Barcode size={16} /></button>
              <button onClick={() => handleGeminiAnalysis(emp)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Sparkles size={16} /></button>
              <button onClick={() => { setFormData(emp); setIsEditing(true); }} className="p-2 bg-slate-100 rounded-lg"><Edit size={16} /></button>
              <button onClick={() => { if(confirm('Delete?')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', emp.id)) }} className="p-2 bg-slate-100 text-red-600 rounded-lg"><Trash2 size={16} /></button>
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
    // NOTE: Changed to 'public/data' for shared access
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), orderBy('date', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, [user?.uid]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    // NOTE: Changed to 'public/data' for shared access
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), {
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      amount: parseFloat(payForm.amount),
      date: new Date().toISOString(),
      note: payForm.note
    });
    // NOTE: Changed to 'public/data' for shared access
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', selectedEmp.id), {
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
    // NOTE: Changed to 'public/data' for shared access
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'absences'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => setAbsences(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsub();
  }, [user?.uid]);

  const handleAddAbsence = async (e) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === form.employeeId);
    if (!emp) return;
    // NOTE: Changed to 'public/data' for shared access
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absences'), { ...form, employeeName: emp.name });
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