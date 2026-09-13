import React, { useState, useMemo } from 'react';
import { Seat } from '../types';
import { 
  UserCheck, Search, CheckCircle2, XCircle, Clock, 
  MapPin, Flower2, Award, Printer, Check, User
} from 'lucide-react';

interface RegistrationDeskViewProps {
  seats: Record<string, Seat>;
  onUpdateSeatStatus: (seatId: string, status: Seat['status'], checkInTime?: string) => void;
  onSelectSeat: (seat: Seat) => void;
}

export const RegistrationDeskView: React.FC<RegistrationDeskViewProps> = ({
  seats,
  onUpdateSeatStatus,
  onSelectSeat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'checked_in' | 'pending'>('all');
  const [ticketSeat, setTicketSeat] = useState<Seat | null>(null);

  const seatList = useMemo(() => Object.values(seats), [seats]);

  const stats = useMemo(() => {
    const totalNamed = seatList.filter(s => s.position || s.guestName).length;
    const checkedIn = seatList.filter(s => s.status === 'checked_in').length;
    const pending = totalNamed - checkedIn;
    const flowerBaskets = seatList.filter(s => s.hasFlowerBasket).length;
    return { totalNamed, checkedIn, pending, flowerBaskets };
  }, [seatList]);

  const filteredSeats = useMemo(() => {
    return seatList
      .filter(s => s.position || s.guestName) // only seats with people
      .filter(s => {
        if (tabFilter === 'checked_in' && s.status !== 'checked_in') return false;
        if (tabFilter === 'pending' && s.status === 'checked_in') return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            s.id.toLowerCase().includes(q) ||
            s.position?.toLowerCase().includes(q) ||
            s.guestName?.toLowerCase().includes(q) ||
            s.organization?.toLowerCase().includes(q) ||
            s.setGroup?.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [seatList, tabFilter, searchTerm]);

  const handleToggleCheckIn = (seat: Seat) => {
    if (seat.status === 'checked_in') {
      onUpdateSeatStatus(seat.id, 'confirmed', undefined);
    } else {
      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      onUpdateSeatStatus(seat.id, 'checked_in', timeStr);
      setTicketSeat(seat);
    }
  };

  const getSeatLocationGuide = (seat: Seat): string => {
    if (['A3', 'A4', 'A5', 'A6', 'A7'].includes(seat.id)) {
      return 'แถวหน้าสุด ตรงข้ามโพเดียมประธาน (Set 1 - Set 5)';
    }
    if (seat.row === 'A') return 'แถว A (แถวหน้าสุด ฝั่ง VIP)';
    if (seat.row === 'B') return 'แถว B (แถวที่ 2 ฝั่งซ้าย)';
    if (seat.row === 'C') return 'แถว C (แถวที่ 3 ผู้แทนหน่วยงาน)';
    if (seat.row === 'D') return 'แถว D (แถวที่ 4)';
    if (seat.row === 'EX') return 'แถว EX (ที่นั่งเสริม ด้านหลัง)';
    if (seat.row === 'E') return 'บล็อก E (ฝั่งคณบดี ด้านขวาของเวที)';
    if (['F', 'G', 'H'].includes(seat.row)) return 'จุดเข้าแถวเตรียมรับรางวัล / วางกระเช้า (ข้างเวทีฝั่งขวา)';
    return `แถว ${seat.row} ที่นั่ง ${seat.number}`;
  };

  return (
    <div className="space-y-4">
      {/* Registration Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">แขกผู้มีเกียรติทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalNamed} <span className="text-xs font-normal text-slate-400">ท่าน</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">ลงทะเบียนมาถึงแล้ว</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.checkedIn} <span className="text-xs font-normal text-slate-400">ท่าน</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">ยังไม่มา / กำลังเดินทาง</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pending} <span className="text-xs font-normal text-slate-400">ท่าน</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">กระเช้าดอกไม้ (*)</p>
            <p className="text-2xl font-bold text-rose-600 mt-0.5">{stats.flowerBaskets} <span className="text-xs font-normal text-slate-400">กระเช้า</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Flower2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Check-in Table & Lookup */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="พิมพ์ชื่อแขก, ตำแหน่ง, รหัสที่นั่ง หรือ Set เพื่อลงทะเบียน..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setTabFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tabFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({stats.totalNamed})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('checked_in')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tabFilter === 'checked_in' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มาแล้ว ({stats.checkedIn})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('pending')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tabFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ยังไม่มา ({stats.pending})
            </button>
          </div>
        </div>

        {/* Guests Grid for Quick Touch Check-in */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
          {filteredSeats.map((seat) => {
            const isChecked = seat.status === 'checked_in';

            return (
              <div
                key={seat.id}
                className={`
                  p-4 rounded-xl border transition-all flex flex-col justify-between
                  ${isChecked 
                    ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400' 
                    : 'bg-white hover:border-slate-400 border-slate-200 shadow-xs'}
                `}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                      {seat.label || seat.id}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {seat.hasFlowerBasket && (
                        <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <Flower2 className="w-3 h-3 text-rose-500" />
                          กระเช้าดอกไม้
                        </span>
                      )}
                      {seat.setGroup && (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {seat.setGroup}
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">
                    {seat.position || seat.guestName}
                  </h4>
                  {seat.guestName && seat.position && seat.guestName !== seat.position && (
                    <p className="text-xs text-slate-600 mt-0.5">{seat.guestName}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{getSeatLocationGuide(seat)}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketSeat(seat)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ดูบัตรที่นั่ง
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleCheckIn(seat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                      isChecked
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isChecked ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        ลงทะเบียนแล้ว ({seat.checkInTime || 'แล้ว'})
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        คลิกเพื่อลงทะเบียน
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticket / Seat Badge Card Modal */}
      {ticketSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative text-slate-800">
            <div className="text-center pb-4 border-b border-slate-100">
              <span className="text-[11px] font-bold tracking-widest text-blue-900 uppercase">
                บัตรระบุที่นั่งสำหรับแขกผู้มีเกียรติ
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                งานวันศิลป์ พีระศรี ประจำปี พ.ศ. 2569
              </h3>
              <p className="text-xs text-slate-500">ณ ลานศาสตราจารย์ศิลป์ พีระศรี</p>
            </div>

            <div className="my-6 text-center">
              <div className="inline-flex flex-col items-center justify-center w-28 h-28 rounded-2xl bg-blue-900 text-white shadow-lg mx-auto mb-3">
                <span className="text-xs uppercase tracking-wider text-blue-200">SEAT</span>
                <span className="text-4xl font-extrabold font-mono">{ticketSeat.label || ticketSeat.id}</span>
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                {ticketSeat.position || ticketSeat.guestName}
              </h2>
              {ticketSeat.guestName && ticketSeat.guestName !== ticketSeat.position && (
                <p className="text-sm font-medium text-slate-600 mt-1">{ticketSeat.guestName}</p>
              )}
              {ticketSeat.organization && (
                <p className="text-xs text-slate-400 mt-0.5">{ticketSeat.organization}</p>
              )}

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  ทิศทางตำแหน่งที่นั่ง: {getSeatLocationGuide(ticketSeat)}
                </p>
                {ticketSeat.setGroup && (
                  <p className="text-slate-600">
                    กลุ่มพิธีการ: <span className="font-bold text-blue-900">{ticketSeat.setGroup}</span>
                  </p>
                )}
                {ticketSeat.hasFlowerBasket && (
                  <p className="text-rose-600 font-bold flex items-center gap-1">
                    <Flower2 className="w-3.5 h-3.5" />
                    มีพิธีวางกระเช้าดอกไม้ (*)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                พิมพ์บัตร
              </button>
              <button
                type="button"
                onClick={() => setTicketSeat(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
