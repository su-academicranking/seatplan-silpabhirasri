import React, { useState } from 'react';
import { Seat } from '../types';
import { CEREMONY_SETS, CeremonySetDefinition } from '../utils/ceremonySets';
import { Flower2, Award, Users, CheckCircle, Clock, ChevronRight, Mic, Sparkles } from 'lucide-react';

interface ProtocolOrderViewProps {
  seats: Record<string, Seat>;
  onSelectSeat: (seat: Seat) => void;
}

export const ProtocolOrderView: React.FC<ProtocolOrderViewProps> = ({
  seats,
  onSelectSeat,
}) => {
  const [selectedSetCode, setSelectedSetCode] = useState<string>(CEREMONY_SETS[0].code);

  const activeSet = CEREMONY_SETS.find(s => s.code === selectedSetCode) || CEREMONY_SETS[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[580px]">
      {/* Left Sidebar: List of Protocol Sets */}
      <div className="w-full md:w-80 bg-slate-50/90 border-r border-slate-200 p-4 flex flex-col gap-2 shrink-0">
        <div className="mb-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            ลำดับพิธีการและกลุ่ม Set
          </h3>
          <p className="text-xs text-slate-500">
            คลิกเพื่อดูรายชื่อแขกในแต่ละช่วงพิธี
          </p>
        </div>

        <div className="space-y-1.5 overflow-y-auto flex-1">
          {CEREMONY_SETS.map((cSet) => {
            const isCurrent = cSet.code === selectedSetCode;
            const count = cSet.associatedSeats.length;

            return (
              <button
                key={cSet.code}
                type="button"
                onClick={() => setSelectedSetCode(cSet.code)}
                className={`
                  w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between
                  ${isCurrent 
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-medium' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}
                `}
              >
                <div>
                  <p className="font-semibold text-[13px] leading-snug">{cSet.name}</p>
                  <p className={`text-[11px] mt-0.5 truncate max-w-[200px] ${isCurrent ? 'text-blue-100' : 'text-slate-400'}`}>
                    {cSet.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isCurrent ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count} ท่าน
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content Area: Detailed Lineup */}
      <div className="flex-1 p-6 flex flex-col bg-slate-50/30">
        {/* Set Header */}
        <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${activeSet.badgeColor}`}>
                {activeSet.code}
              </span>
              <h2 className="text-base font-bold text-slate-900">{activeSet.name}</h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">{activeSet.description}</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium">
              จำนวนทั้งหมด {activeSet.associatedSeats.length} ที่นั่ง
            </span>
          </div>
        </div>

        {/* Walking Route Guide Box */}
        {activeSet.walkingRoute && (
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50/80 to-purple-50/80 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-slate-700 shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {activeSet.walkingRoute.id}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{activeSet.walkingRoute.title}</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-[10px] font-semibold">
                  ประตู: {activeSet.walkingRoute.gate}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {activeSet.walkingRoute.details}
              </p>
            </div>
          </div>
        )}

        {/* Guest Lineup Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 overflow-y-auto">
          {activeSet.associatedSeats.map((seatId, idx) => {
            const seat = seats[seatId];
            if (!seat) return null;

            return (
              <div
                key={seatId}
                onClick={() => onSelectSeat(seat)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-900 font-bold font-mono text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                        {seat.label || seat.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {seat.hasFlowerBasket && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                          <Flower2 className="w-3 h-3 text-rose-500" />
                          กระเช้าดอกไม้
                        </span>
                      )}
                      {seat.status === 'checked_in' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="มาถึงแล้ว" />
                      )}
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                    {seat.position || seat.guestName || '(ยังไม่ระบุตำแหน่ง)'}
                  </h4>
                  {seat.guestName && seat.guestName !== seat.position && (
                    <p className="text-xs text-slate-600 mt-0.5">{seat.guestName}</p>
                  )}
                  {seat.organization && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{seat.organization}</p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>แถว {seat.row} • ที่นั่ง {seat.number}</span>
                  <span className="text-blue-600 font-medium group-hover:underline">คลิกแก้ไข</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
