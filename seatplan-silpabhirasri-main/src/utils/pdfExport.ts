import { jsPDF } from 'jspdf';
import { 
  SARABUN_SVG_FONT_STYLE, 
  SARABUN_REGULAR_BASE64, 
  SARABUN_BOLD_BASE64 
} from './sarabunFont';

const imageCache = new Map<string, string>();

/**
 * Converts an external image URL to a base64 Data URL to prevent canvas tainting
 * and ensure images (like background plans and logos) render 100% in the PDF
 */
async function urlToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  if (imageCache.has(url)) return imageCache.get(url)!;

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl && dataUrl.startsWith('data:')) {
        imageCache.set(url, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Fallback below
  }

  try {
    const dataUrl = await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(url);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });

    if (dataUrl && dataUrl.startsWith('data:')) {
      imageCache.set(url, dataUrl);
      return dataUrl;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Convert an SVG element to high-resolution JPEG Data URL
 * with embedded 100% genuine Sarabun Thai fonts and self-contained base64 images
 */
async function svgToImageData(svgEl: SVGSVGElement): Promise<string> {
  const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('width', '1150');
  clonedSvg.setAttribute('height', '780');

  // Convert all <image> tags in SVG to Base64 data URLs
  const imageElements = Array.from(clonedSvg.querySelectorAll('image'));
  for (const imgEl of imageElements) {
    const href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href') || '';
    if (href && !href.startsWith('data:')) {
      const b64 = await urlToDataUrl(href);
      if (b64.startsWith('data:')) {
        imgEl.setAttribute('href', b64);
        if (imgEl.hasAttribute('xlink:href')) {
          imgEl.setAttribute('xlink:href', b64);
        }
      }
    }
  }

  // Ensure defs and inject embedded Sarabun font styles
  let defs = clonedSvg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    clonedSvg.insertBefore(defs, clonedSvg.firstChild);
  }
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = SARABUN_SVG_FONT_STYLE;
  defs.appendChild(styleEl);

  // Set explicit font family on all text and tspan elements
  const textElements = Array.from(clonedSvg.querySelectorAll('text, tspan'));
  for (const tEl of textElements) {
    tEl.setAttribute('font-family', "'Sarabun', 'TH Sarabun New', sans-serif");
  }

  // Serialize SVG to XML string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);

  // Ensure standard xml namespace
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobURL = window.URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = blobURL;
  });

  // High-resolution canvas (2x: 2300 x 1560) for 300+ DPI print quality
  const canvas = document.createElement('canvas');
  canvas.width = 2300;
  canvas.height = 1560;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2D context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  window.URL.revokeObjectURL(blobURL);

  return canvas.toDataURL('image/jpeg', 0.98);
}

/**
 * Export the complete Seating Plan & Sub-zone Plans to a downloadable multi-page A4 Landscape PDF
 * with 100% faithful system styling and Sarabun fonts
 * 
 * Order of 5 pages:
 * 1. ผังรวมที่นั่งทั้งหมด (Overall Seating Plan)
 * 2. โซนสีชมพู (แถว A, B, C, D, E รวม 60 ที่นั่ง)
 * 3. โซนสีเหลือง (แถว F, G, H รวม 18 ที่นั่ง)
 * 4. โซนสีเขียวด้านขวา (แถว I รวม 8 ที่นั่ง)
 * 5. โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K รวม 17 ที่นั่ง)
 */
export async function exportSeatingPlanToPdf(): Promise<boolean> {
  const pageSpecs = [
    { id: 'seating-plan-canvas', fallbackIds: [], title: 'ผังรวมที่นั่งทั้งหมด' },
    { id: 'zone-subplan-svg-pink', fallbackIds: ['zone-subplan-svg-green'], title: 'ผังย่อยโซนสีชมพู (แถว A - E)' },
    { id: 'zone-subplan-svg-yellow', fallbackIds: ['zone-subplan-svg-blue'], title: 'ผังย่อยโซนสีเหลือง (แถว F - H)' },
    { id: 'zone-subplan-svg-right-green', fallbackIds: ['zone-subplan-svg-right-blue'], title: 'ผังย่อยโซนสีเขียวด้านขวา (แถว I)' },
    { id: 'zone-subplan-svg-right-peach', fallbackIds: ['zone-subplan-svg-right-yellow'], title: 'ผังย่อยโซนสีส้มอ่อนด้านขวา (แถว J & K)' },
  ];

  try {
    // Create A4 Landscape PDF: 297mm x 210mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Add Sarabun font to jsPDF VFS
    try {
      pdf.addFileToVFS('Sarabun-Regular.ttf', SARABUN_REGULAR_BASE64);
      pdf.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
      pdf.addFileToVFS('Sarabun-Bold.ttf', SARABUN_BOLD_BASE64);
      pdf.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
      pdf.setFont('Sarabun');
    } catch {
      // Non-blocking if already registered
    }

    const pdfWidth = 281;
    const pdfHeight = pdfWidth / (1150 / 780); // ~190.6mm
    const x = (297 - pdfWidth) / 2; // ~8mm
    const y = (210 - pdfHeight) / 2; // ~9.7mm

    let renderedPagesCount = 0;

    for (let i = 0; i < pageSpecs.length; i++) {
      const spec = pageSpecs[i];
      let el: SVGSVGElement | null = null;

      if (spec.id === 'seating-plan-canvas') {
        el = (document.querySelector('main svg#seating-plan-canvas') ||
              document.querySelector('#pdf-offscreen-canvas-wrapper svg#seating-plan-canvas') ||
              document.getElementById(spec.id)) as unknown as SVGSVGElement | null;
      } else {
        el = document.getElementById(spec.id) as unknown as SVGSVGElement | null;
        if (!el && spec.fallbackIds.length > 0) {
          for (const fbId of spec.fallbackIds) {
            el = document.getElementById(fbId) as unknown as SVGSVGElement | null;
            if (el) break;
          }
        }
      }

      if (!el) {
        console.warn(`Element #${spec.id} for "${spec.title}" not found, skipping`);
        continue;
      }

      const imgData = await svgToImageData(el);

      if (renderedPagesCount > 0) {
        pdf.addPage('a4', 'landscape');
      }

      pdf.addImage(imgData, 'JPEG', x, y, pdfWidth, pdfHeight);
      renderedPagesCount++;
    }

    if (renderedPagesCount === 0) {
      window.print();
      return false;
    }

    // Save with standardized filename
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Silpa_Bhirasri_Seating_Plan_Complete_${dateStr}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating multi-page PDF:', err);
    window.print();
    return false;
  }
}

