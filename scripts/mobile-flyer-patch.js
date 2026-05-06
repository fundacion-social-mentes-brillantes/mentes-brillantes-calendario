const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const cssMarker = '/* --- MOBILE HTML2CANVAS SAFE MODE --- */';
if (!html.includes(cssMarker)) {
  const cssPatch = `
        /* --- MOBILE HTML2CANVAS SAFE MODE --- */
        #capture-target.mobile-capture-safe {
            background: #061225 !important;
        }

        #capture-target.mobile-capture-safe .flyer-header,
        #capture-target.mobile-capture-safe .flyer-summary,
        #capture-target.mobile-capture-safe .flyer-body,
        #capture-target.mobile-capture-safe .flyer-footer {
            background: #061225 !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        #capture-target.mobile-capture-safe .flyer-row {
            background: #102a56 !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        #capture-target.mobile-capture-safe .flyer-row:nth-child(even) {
            background: #0b1b35 !important;
        }

        #capture-target.mobile-capture-safe .flyer-kpi {
            background: #102a56 !important;
            box-shadow: none !important;
        }

        #capture-target.mobile-capture-safe .flyer-date {
            background: #071a33 !important;
            box-shadow: none !important;
        }

        #capture-target.mobile-capture-safe .flyer-row.presencial .flyer-date {
            background: #4d3a13 !important;
        }

        #capture-target.mobile-capture-safe .flyer-pill,
        #capture-target.mobile-capture-safe .flyer-status {
            box-shadow: none !important;
            filter: none !important;
        }

        #capture-target.mobile-capture-safe .flyer-header::after {
            background: #d6b55e !important;
        }
`;
  const anchor = '        @media (max-width: 640px) {\n            header.no-print > div {';
  if (!html.includes(anchor)) {
    throw new Error('CSS anchor not found for mobile flyer patch');
  }
  html = html.replace(anchor, cssPatch + '\n' + anchor);
}

const oldCapture = `                const html2canvas = await ensureHtml2CanvasLoaded();
                const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
                const blob = await canvasToBlob(canvas);`;

const newCapture = `                const html2canvas = await ensureHtml2CanvasLoaded();
                const previousCaptureStyle = {
                    position: element.style.position,
                    top: element.style.top,
                    left: element.style.left,
                    zIndex: element.style.zIndex,
                    opacity: element.style.opacity,
                    pointerEvents: element.style.pointerEvents
                };

                if (isMobile) {
                    element.classList.add('mobile-capture-safe');
                    element.style.position = 'fixed';
                    element.style.top = '0';
                    element.style.left = '0';
                    element.style.zIndex = '-1';
                    element.style.opacity = '1';
                    element.style.pointerEvents = 'none';
                }

                await document.fonts?.ready?.catch(() => {});
                await Promise.all(
                    Array.from(element.querySelectorAll('img')).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = resolve;
                            img.onerror = resolve;
                        });
                    })
                );
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                let canvas;
                try {
                    canvas = await html2canvas(element, {
                        scale: isMobile ? 1.15 : 2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#061225',
                        windowWidth: 1080,
                        windowHeight: element.scrollHeight,
                        scrollX: 0,
                        scrollY: 0,
                        logging: false
                    });
                } finally {
                    if (isMobile) {
                        element.classList.remove('mobile-capture-safe');
                        element.style.position = previousCaptureStyle.position;
                        element.style.top = previousCaptureStyle.top;
                        element.style.left = previousCaptureStyle.left;
                        element.style.zIndex = previousCaptureStyle.zIndex;
                        element.style.opacity = previousCaptureStyle.opacity;
                        element.style.pointerEvents = previousCaptureStyle.pointerEvents;
                    }
                }

                const blob = await canvasToBlob(canvas);`;

if (!html.includes('previousCaptureStyle')) {
  if (!html.includes(oldCapture)) {
    throw new Error('html2canvas capture block not found for mobile flyer patch');
  }
  html = html.replace(oldCapture, newCapture);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('[OK] mobile flyer export patch applied');
