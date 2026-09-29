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
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    if (confirm("Keshni tozalab, dasturni birlamchi holatda qayta tiklashni xohlaysizmi?")) {
      try {
        sessionStorage.clear();
        window.location.reload();
      } catch (e) {
        console.error(e);
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 text-stone-100 font-sans">
          <div className="max-w-lg w-full bg-stone-950 border border-stone-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-black text-white">
                Dastur ishida vaqtinchalik xatolik yuz berdi
              </h1>
              <p className="text-sm text-stone-400 leading-relaxed">
                Kiritilgan fayl formati yoki ma'lumotlar tahlilida kutilmagan holat yuz berdi. Barcha avvalgi ma'lumotlaringiz xavfsiz saqlangan.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-stone-900/90 border border-stone-800/80 rounded-2xl p-3.5 text-left text-xs font-mono text-amber-300/90 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Qayta yuklash</span>
              </button>
              <button
                onClick={this.handleResetCache}
                className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Keshni yangilash</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
