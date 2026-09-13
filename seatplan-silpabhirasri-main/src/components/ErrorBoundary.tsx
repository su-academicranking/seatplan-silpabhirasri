import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.removeItem('silpa_bhirasri_seating_plan_v3');
      localStorage.removeItem('silpa_bhirasri_routes');
    } catch {}
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                เกิดข้อผิดพลาดในการแสดงผลระบบ
              </h2>
              <p className="text-xs text-slate-500">
                ระบบพบปัญหาบางประการ สามารถกดโหลดหน้าใหม่ หรือรีเซ็ตข้อมูลเพื่อกลับสู่สถานะเริ่มต้น
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 max-h-32 overflow-y-auto">
                <span className="font-bold text-rose-600">Error:</span> {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                โหลดหน้าใหม่
              </button>
              <button
                type="button"
                onClick={this.handleResetStorage}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                รีเซ็ตค่าเริ่มต้น
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
