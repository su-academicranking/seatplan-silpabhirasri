import React from 'react';
import { SeatingPlanState } from '../types';
import { SeatingCanvas } from './SeatingCanvas';
import {
  ZonePinkSvg,
  ZoneYellowSvg,
  ZoneRightGreenSvg,
  ZoneRightPeachSvg,
} from './ZoneSubPlanSvg';

interface PrintLayoutProps {
  planState: SeatingPlanState;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ planState }) => {
  return (
    <>
      {/* ============================================================ */}
      {/* 1. PRINT MEDIA LAYOUT (5 Pages in A4 Landscape)              */}
      {/* ============================================================ */}
      <div className="hidden print:block w-full bg-white text-black p-0 m-0">
        {/* Page 1: Overall Seating Plan (ผังรวมที่นั่งทั้งหมด) */}
        <div className="print-page">
          <SeatingCanvas
            metadata={planState.metadata}
            seats={planState.seats}
            selectedSeat={null}
            highlightFilter=""
            onSelectSeat={() => {}}
            onSwapSeats={() => {}}
            isPrintMode={true}
          />
        </div>

        {/* Page 2: Zone Pink (โซนสีชมพู - แถว A, B, C, D, E รวม 60 ที่นั่ง) */}
        <div className="print-page">
          <ZonePinkSvg metadata={planState.metadata} seats={planState.seats} />
        </div>

        {/* Page 3: Zone Yellow (โซนสีเหลือง - แถว F, G, H รวม 18 ที่นั่ง) */}
        <div className="print-page">
          <ZoneYellowSvg metadata={planState.metadata} seats={planState.seats} />
        </div>

        {/* Page 4: Zone Right Green (โซนสีเขียวด้านขวา - แถว I รวม 8 ที่นั่ง) */}
        <div className="print-page">
          <ZoneRightGreenSvg metadata={planState.metadata} seats={planState.seats} />
        </div>

        {/* Page 5: Zone Right Peach (โซนสีส้มอ่อน/พีชด้านขวา - แถว J & K รวม 17 ที่นั่ง) */}
        <div className="print-page">
          <ZoneRightPeachSvg metadata={planState.metadata} seats={planState.seats} />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. OFFSCREEN RENDER CONTAINER FOR DIRECT PDF EXPORT          */}
      {/*    Ensures SVGs exist with active DOM metrics for jsPDF      */}
      {/* ============================================================ */}
      <div 
        id="pdf-subplans-export-container" 
        className="fixed -left-[99999px] -top-[99999px] w-[1150px] opacity-0 pointer-events-none no-print"
        aria-hidden="true"
      >
        <div id="pdf-offscreen-canvas-wrapper">
          <SeatingCanvas
            metadata={planState.metadata}
            seats={planState.seats}
            selectedSeat={null}
            highlightFilter=""
            onSelectSeat={() => {}}
            onSwapSeats={() => {}}
            isPrintMode={true}
          />
        </div>
        <ZonePinkSvg metadata={planState.metadata} seats={planState.seats} />
        <ZoneYellowSvg metadata={planState.metadata} seats={planState.seats} />
        <ZoneRightGreenSvg metadata={planState.metadata} seats={planState.seats} />
        <ZoneRightPeachSvg metadata={planState.metadata} seats={planState.seats} />
      </div>
    </>
  );
};
