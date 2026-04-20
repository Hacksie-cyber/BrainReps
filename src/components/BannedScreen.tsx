import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function BannedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Access Restricted</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Your account has been restricted by an administrator. You no longer have access to the BrainReps educational modules.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact your educator for clarification</p>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
