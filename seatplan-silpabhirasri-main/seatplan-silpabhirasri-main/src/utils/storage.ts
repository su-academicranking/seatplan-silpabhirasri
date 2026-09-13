import { SeatingPlanState, Seat } from '../types';
import { initialPlanState } from '../data/initialPlan';

const STORAGE_KEY = 'silpa_bhirasri_seating_plan_v3';

export function loadSeatingPlan(): SeatingPlanState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.seats && parsed.metadata) {
        if (!parsed.unassignedGuests) {
          parsed.unassignedGuests = initialPlanState.unassignedGuests;
        }
        if (!parsed.metadata.bgImageUrl || parsed.metadata.bgImageUrl.includes('ceremony_flow_100.svg')) {
          parsed.metadata.bgImageUrl = initialPlanState.metadata.bgImageUrl;
        }
        if (!parsed.metadata.bgDriveUrl) {
          parsed.metadata.bgDriveUrl = initialPlanState.metadata.bgDriveUrl;
        }
        // Ensure row K seats exist and are numbered 1-10 independently from row J (remove any 'K' prefix from label/number)
        for (let i = 1; i <= 10; i++) {
          const seatId = `K${i}`;
          if (!parsed.seats[seatId] && initialPlanState.seats[seatId]) {
            parsed.seats[seatId] = initialPlanState.seats[seatId];
          } else if (parsed.seats[seatId]) {
            const currentLabel = String(parsed.seats[seatId].label || '');
            const oldCumulativeNum = String(i + 8);
            if (
              currentLabel === oldCumulativeNum ||
              currentLabel === `K${i}` ||
              currentLabel === `K${oldCumulativeNum}` ||
              currentLabel === seatId ||
              /^K\d+$/i.test(currentLabel)
            ) {
              parsed.seats[seatId].label = String(i);
              if (
                parsed.seats[seatId].setGroup === oldCumulativeNum ||
                parsed.seats[seatId].setGroup === `K${i}` ||
                parsed.seats[seatId].setGroup === `K${oldCumulativeNum}` ||
                parsed.seats[seatId].setGroup === seatId
              ) {
                parsed.seats[seatId].setGroup = String(i);
              }
              if (
                parsed.seats[seatId].position === `ผู้เข้ารับรางวัล ลำดับ ${oldCumulativeNum}` ||
                parsed.seats[seatId].position === `ผู้เข้ารับรางวัล ลำดับ K${i}` ||
                parsed.seats[seatId].position === `ที่นั่งเพิ่มเติม ${seatId}`
              ) {
                parsed.seats[seatId].position = `ผู้เข้ารับรางวัล ลำดับ ${i}`;
              }
            }
          }
        }

        // Clean up any remaining K or J prefix in label for awardees in rows J & K
        Object.values(parsed.seats).forEach((seat: any) => {
          if (seat && typeof seat.label === 'string') {
            if (seat.row === 'K' && /^K\d+$/i.test(seat.label)) {
              seat.label = seat.label.replace(/^K/i, '');
            } else if (seat.row === 'J' && /^J\d+$/i.test(seat.label)) {
              seat.label = seat.label.replace(/^J/i, '');
            }
          }
          if (seat && typeof seat.setGroup === 'string') {
            if (seat.row === 'K' && /^K\d+$/i.test(seat.setGroup)) {
              seat.setGroup = seat.setGroup.replace(/^K/i, '');
            } else if (seat.row === 'J' && /^J\d+$/i.test(seat.setGroup)) {
              seat.setGroup = seat.setGroup.replace(/^J/i, '');
            }
          }
        });

        // Ensure J8 has label: '8'
        if (parsed.seats['J8']) {
          parsed.seats['J8'].label = '8';
        }

        // Ensure B7 is cleared if cached with the erroneous duplicate name
        if (parsed.seats['B7']?.guestName === 'ผศ.วีระวัฒน์') {
          parsed.seats['B7'] = {
            ...parsed.seats['B7'],
            guestName: '',
            organization: '',
            position: 'ที่นั่งสำรอง B7',
            setGroup: '',
            hasFlowerBasket: false,
            hasArtSet: false,
            status: 'empty',
            category: 'general',
          };
        }

        // Migrate any legacy mock names (e.g. J1 = "ดร.สมชาย" or A1 = "กระทรวง อว." or old B7)
        // to authentic Google Sheet data from initialPlanState
        if (parsed.seats['J1']?.guestName === 'ดร.สมชาย' || parsed.seats['A1']?.guestName === 'กระทรวง อว.') {
          Object.keys(initialPlanState.seats).forEach(seatId => {
            const initSeat = initialPlanState.seats[seatId];
            if (initSeat && initSeat.guestName) {
              parsed.seats[seatId] = {
                ...parsed.seats[seatId],
                guestName: initSeat.guestName,
                position: initSeat.position,
                organization: initSeat.organization || parsed.seats[seatId]?.organization,
                setGroup: initSeat.setGroup !== undefined ? initSeat.setGroup : parsed.seats[seatId]?.setGroup,
                hasFlowerBasket: initSeat.hasFlowerBasket !== undefined ? initSeat.hasFlowerBasket : parsed.seats[seatId]?.hasFlowerBasket,
                hasArtSet: initSeat.hasArtSet !== undefined ? initSeat.hasArtSet : parsed.seats[seatId]?.hasArtSet,
                status: initSeat.status || parsed.seats[seatId]?.status,
                label: initSeat.label || parsed.seats[seatId]?.label,
              };
            }
          });
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load stored plan:', err);
  }
  return initialPlanState;
}

export function saveSeatingPlan(state: SeatingPlanState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save plan:', err);
  }
}

export function resetToDefaultPlan(): SeatingPlanState {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('silpa_bhirasri_plan_bg_image');
    localStorage.removeItem('silpa_bhirasri_plan_drive_url');
    localStorage.removeItem('silpa_bhirasri_plan_bg_drive_url');
    localStorage.removeItem('silpa_bhirasri_plan_default_url');
    localStorage.removeItem('silpa_bhirasri_plan_default_drive_url');
    localStorage.removeItem('silpa_bhirasri_plan_default_image');
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(initialPlanState));
}

export function exportToJsonFile(state: SeatingPlanState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `silpa_bhirasri_seating_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportToCsv(seats: Record<string, Seat>): void {
  const headers = ['Seat ID', 'Row', 'Number', 'Guest Name', 'Organization', 'Set Group', 'Flower Basket (*)', 'Art Set', 'Seat Color', 'Category', 'Status', 'Notes', 'Check-in Time'];
  
  const rows = Object.values(seats)
    .sort((a, b) => {
      const rowA = a.row || a.id.match(/^[A-Za-z]+/)?.[0] || '';
      const rowB = b.row || b.id.match(/^[A-Za-z]+/)?.[0] || '';
      if (rowA !== rowB) return rowA.localeCompare(rowB, 'th');
      const numA = typeof a.number === 'number' && !isNaN(a.number) ? a.number : parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = typeof b.number === 'number' && !isNaN(b.number) ? b.number : parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    })
    .map(s => [
      `"${s.id}"`,
      `"${s.row}"`,
      s.number,
      `"${(s.guestName || '').replace(/"/g, '""')}"`,
      `"${(s.organization || s.position || '').replace(/"/g, '""')}"`,
      `"${(s.setGroup || '').replace(/"/g, '""')}"`,
      s.hasFlowerBasket ? 'YES' : 'NO',
      s.hasArtSet ? 'YES' : 'NO',
      `"${(s.colorBg || 'Default White').replace(/"/g, '""')}"`,
      `"${s.category}"`,
      `"${s.status}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
      `"${s.checkInTime || ''}"`
    ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `silpa_bhirasri_guest_list_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
