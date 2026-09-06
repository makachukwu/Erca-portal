/**
 * Print Utility for School Management Portal
 * Provides isolated, clean printing of result sheets, report cards, and broadsheets
 * without printing any background website pages, navigation, or unrelated images.
 */

import { getActiveSchoolConfig } from '../config/schoolConfig';

export function printElementDirectly(elementId: string, documentTitle?: string): boolean {
  try {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.warn(`Print target element #${elementId} not found. Falling back to window.print()`);
      window.print();
      return false;
    }

    // Remove any previous temporary print iframe
    const oldFrame = document.getElementById('school-portal-print-isolation-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    // Create a fresh hidden iframe isolated from the main page DOM
    const iframe = document.createElement('iframe');
    iframe.id = 'school-portal-print-isolation-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1400px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!frameDoc) {
      console.warn('Unable to access print frame document. Falling back to window.print()');
      window.print();
      return false;
    }

    // Collect all existing stylesheets and style tags to preserve Tailwind styles & fonts
    const styleElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const activeSchool = getActiveSchoolConfig();
    const cleanTitle = documentTitle || `${activeSchool.schoolName} - Official Academic Document`;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${cleanTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${styleElements}
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm 6mm 6mm 6mm;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-height: 100% !important;
              overflow: visible !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }

            /* Hide all screen-only / action controls */
            .no-print,
            .print\\:hidden,
            button,
            nav,
            header,
            footer,
            [role="button"] {
              display: none !important;
            }

            /* Suppress any images outside of the official document container */
            img:not(#${elementId} img) {
              display: none !important;
            }

            #${elementId} {
              display: block !important;
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: #ffffff !important;
              overflow: visible !important;
            }

            table {
              width: 100% !important;
              page-break-inside: auto !important;
              border-collapse: collapse !important;
            }

            tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }

            thead {
              display: table-header-group !important;
            }

            tfoot {
              display: table-footer-group !important;
            }
          </style>
        </head>
        <body>
          <div id="${elementId}" class="bg-white text-slate-900 p-0 m-0">
            ${targetElement.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    // Trigger printing once the iframe and its images are loaded
    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print():', err);
        window.print();
      } finally {
        // Clean up iframe after a safe delay
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.remove();
          }
        }, 10000);
      }
    };

    // Give iframe time to parse CSS and render DOM
    setTimeout(() => {
      // Check if all images inside iframe have loaded
      const images = Array.from(frameDoc.querySelectorAll('img'));
      if (images.length === 0) {
        triggerPrint();
      } else {
        let loaded = 0;
        const total = images.length;
        const checkDone = () => {
          loaded++;
          if (loaded >= total) {
            triggerPrint();
          }
        };

        images.forEach((img) => {
          if (img.complete) {
            checkDone();
          } else {
            img.onload = checkDone;
            img.onerror = checkDone;
          }
        });

        // Fallback safety timeout if image onload doesn't fire
        setTimeout(triggerPrint, 350);
      }
    }, 150);

    return true;
  } catch (e) {
    console.error('Print element error, falling back to native print:', e);
    window.print();
    return false;
  }
}
