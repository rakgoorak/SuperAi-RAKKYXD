import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { tr } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#070a10] text-slate-100 p-6 select-text">
          <div className="max-w-xl w-full bg-[#0e1424] border border-rose-500/50 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <div>
                <h1 className="text-lg font-bold text-white">SuperAi & RAKKYXD</h1>
                <p className="text-xs text-rose-300">{tr("หน้าจอเกิดข้อผิดพลาด กรุณากดโหลดใหม่")}</p>
              </div>
            </div>

            <div className="bg-[#080b12] border border-[#1f283d] rounded-lg p-3 text-xs font-mono text-rose-200 overflow-x-auto mb-4 max-h-48">
              {this.state.error?.message || 'Unknown error'}
              {this.state.error?.stack && (
                <pre className="text-[10px] text-slate-400 mt-2 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={this.handleReload}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{tr("โหลดหน้าจอใหม่")}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
