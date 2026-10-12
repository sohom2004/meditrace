import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, CheckCircle, ShoppingBag, Truck, Clock } from 'lucide-react';
import { api } from '../api';

interface PharmacyRestockProps {
  activeProfileId: string;
}

export const PharmacyRestockCard: React.FC<PharmacyRestockProps> = ({ activeProfileId }) => {
  const [restockData, setRestockData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('Flat 4B, Silver Oak Heights, Salt Lake Sector 2, Kolkata 700091');
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  const fetchRestock = async () => {
    if (!activeProfileId) return;
    try {
      setLoading(true);
      const data = await api.getRestockStatus(activeProfileId);
      setRestockData(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch restock status:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestock();
  }, [activeProfileId]);

  const medsList: any[] = Array.isArray(restockData) ? restockData : (restockData?.medications || []);
  const hasLowSupply = medsList.some((m: any) => (m.days_supply_left ?? m.days_left) <= 7 || m.is_low_supply);

  const handle1ClickReorder = async () => {
    if (!medsList.length || !activeProfileId) return;
    try {
      setIsOrdering(true);
      const items = medsList.map((m: any) => ({
        medicine_name: m.medicine_name || m.name,
        quantity: m.recommended_refill_quantity || 30,
        estimated_price_inr: m.estimated_price_inr || 200.0,
      }));

      const order = await api.createPharmacyOrder(activeProfileId, items, address);
      setOrderSuccess(order);
      setIsOrdering(false);
      fetchRestock();
    } catch (err: any) {
      alert(`Order creation failed: ${err.message}`);
      setIsOrdering(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Medication Inventory & Refill Operations</h3>
            <p className="text-[11px] text-slate-400 font-medium">Automated supply monitoring & pharmacy dispatch</p>
          </div>
        </div>

        {hasLowSupply && (
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Supply Alert: Restock Needed
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
          Auditing active medication supply and pharmacy availability...
        </div>
      ) : medsList.length > 0 ? (
        <div className="space-y-4">
          {/* Medication list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {medsList.map((med: any, idx: number) => {
              const daysLeft = med.days_supply_left ?? med.days_left ?? 15;
              const isLow = daysLeft <= 7 || med.is_low_supply;
              const percent = Math.min(100, Math.max(0, (daysLeft / 30) * 100));

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isLow
                      ? 'bg-rose-50/70 border-rose-200 shadow-xs'
                      : 'bg-white/80 border-slate-200/70'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{med.medicine_name || med.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium">{med.dosage || med.frequency}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isLow
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {daysLeft} days left
                    </span>
                  </div>

                  {/* Supply bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                      className={`h-full rounded-full ${
                        isLow ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Est. Price: ₹{med.estimated_price_inr || 200}</span>
                    <span>Refill Pack: {med.recommended_refill_quantity || 30} Tabs</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Delivery & Reorder Action */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[260px]">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Verified Delivery Destination (ABDM Integrated)
              </label>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handle1ClickReorder}
              disabled={isOrdering}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isOrdering ? 'Dispatching...' : '1-Click Refill Order'}</span>
            </button>
          </div>

          {/* Order confirmation notice */}
          {orderSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Order #{orderSuccess.order_id} Confirmed with MediTrace Express Partner</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Dispatched to {orderSuccess.delivery_address}. Estimated delivery within 24 hours. Tracking status: {orderSuccess.status}.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
