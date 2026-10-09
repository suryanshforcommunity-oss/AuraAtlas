import React, { useState } from 'react';
import { X, PlusCircle, PackageCheck, Zap } from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (priority: number, qty: number) => void;
  robotCapacity: number;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onDispatch,
  robotCapacity = 1,
}) => {
  const [priority, setPriority] = useState<number>(1);
  const [qty, setQty] = useState<number>(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatch(priority, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Dispatch New Order</h3>
            <p className="text-xs text-slate-400">Add an on-demand task to the swarm auction queue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Priority Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Priority Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 1, label: 'Normal (p1)', cls: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
                { val: 2, label: 'High (p2)', cls: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
                { val: 3, label: 'Urgent (p3)', cls: 'border-rose-500/30 text-rose-300 bg-rose-500/10' },
              ].map(p => (
                <button
                  type="button"
                  key={p.val}
                  onClick={() => setPriority(p.val)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    priority === p.val
                      ? `${p.cls} ring-2 ring-indigo-500/50 shadow-md`
                      : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Multiplier */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Package Payload Quantity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(q => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setQty(q)}
                  className={`p-2.5 rounded-xl border text-xs font-mono font-bold text-center transition-all ${
                    qty === q
                      ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/20 ring-2 ring-indigo-500/50'
                      : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  x{q} Packages
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Dispatch Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
