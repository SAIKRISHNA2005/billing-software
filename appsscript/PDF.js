/**
 * Transport & Logistics Management System (TMS)
 * Phase 14 - Bill PDF Generation Module
 */

const PDFModule = (function () {
  /**
   * Helper function to convert number to Words (Indian Numbering System)
   */
  function numberToWordsINR(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return 'Zero Rupees Only';

    const rounded = Math.round(Number(amount));
    if (rounded === 0) return 'Zero Rupees Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(num) {
      if ((num = num.toString()).length > 9) return 'overflow';
      const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return '';
      let str = '';
      str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '';
      str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '';
      str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '';
      str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' Hundred ' : '';
      str += Number(n[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + ' ' : '';
      return str.trim();
    }

    return 'Rupees ' + inWords(rounded) + ' Only';
  }

  /**
   * Generates PDF for a processed bill
   */
  function generateBillPdf(payload, sessionToken) {
    if (sessionToken) {
      SessionModule.requireSession(sessionToken);
    }

    const billId = payload && payload.billId;
    if (!billId) {
      throw new Error('billId is required to generate PDF');
    }

    // 1. Fetch Bill Header
    const bill = SheetRepo.getRowById('processed_bills', billId);
    if (!bill) {
      throw new Error('Processed bill not found for ID: ' + billId);
    }

    // 2. Fetch Bill Items
    const allItems = SheetRepo.getAllRows('bill_items');
    const items = allItems.filter(function (it) {
      return String(it.billId) === String(billId);
    });

    // 3. Fetch Company Profile
    const company = bill.companyId ? SheetRepo.getRowById('companies', bill.companyId) : null;

    // 4. Fetch Client Info
    const client = bill.clientId ? SheetRepo.getRowById('clients', bill.clientId) : null;

    // 5. Fetch Settings for Seal/Signature URL
    const settings = SheetRepo.getRowById('app_settings', 'DEFAULT') || {};

    // 6. Build HTML Content
    const companyName = (company && company.name) || bill.companyName || 'TMS Logistics';
    const companyAddress = (company && company.address) || 'Transport Hub, India';
    const companyGstin = (company && company.gstin) || 'N/A';
    const companyPan = (company && company.pan) || 'N/A';
    const companyPhone = (company && company.phone) || 'N/A';

    const clientName = (client && client.name) || bill.clientName || 'Valued Client';
    const clientAddress = (client && client.address) || 'N/A';
    const clientGstin = (client && client.gstin) || 'N/A';

    let itemsHtml = '';
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach(function (it, idx) {
      const taxable = Number(it.taxableAmount || it.amount || 0);
      const cgst = Number(it.cgstAmount || 0);
      const sgst = Number(it.sgstAmount || 0);
      const igst = Number(it.igstAmount || 0);
      const rowTotal = Number(it.totalAmount || taxable + cgst + sgst + igst);

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      itemsHtml += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${it.enquiryId || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${it.vehicleNo || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${it.description || (it.origin + ' to ' + it.destination)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${taxable.toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${(cgst + sgst + igst).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${rowTotal.toFixed(2)}</td>
        </tr>
      `;
    });

    const grandTotal = Number(bill.totalAmount || totalTaxable + totalCgst + totalSgst + totalIgst);
    const amountInWords = numberToWordsINR(grandTotal);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${bill.billNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #0052cc; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #0052cc; font-size: 24px; }
          .header p { margin: 4px 0; font-size: 13px; color: #666; }
          .flex-container { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
          .box { width: 48%; border: 1px solid #ddd; padding: 10px; border-radius: 4px; box-sizing: border-box; }
          .box h3 { margin-top: 0; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background-color: #f4f6f8; border: 1px solid #ddd; padding: 8px; text-align: left; }
          .totals { text-align: right; margin-bottom: 20px; font-size: 13px; }
          .totals table { width: 40%; margin-left: auto; }
          .footer { margin-top: 40px; font-size: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sign-box { text-align: center; width: 200px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${companyName}</h1>
          <p>${companyAddress} | Phone: ${companyPhone}</p>
          <p>GSTIN: ${companyGstin} | PAN: ${companyPan}</p>
        </div>

        <div class="flex-container">
          <div class="box">
            <h3>BILLED TO</h3>
            <strong>${clientName}</strong><br/>
            ${clientAddress}<br/>
            <strong>GSTIN:</strong> ${clientGstin}
          </div>
          <div class="box">
            <h3>INVOICE DETAILS</h3>
            <strong>Invoice No:</strong> ${bill.billNumber}<br/>
            <strong>Invoice Date:</strong> ${bill.billDate || '-'}<br/>
            <strong>Financial Year:</strong> ${bill.fy || '-'}<br/>
            <strong>Status:</strong> ${bill.paymentStatus || 'UNPAID'}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Enquiry ID</th>
              <th>Vehicle No</th>
              <th>Description / Route</th>
              <th style="text-align: right;">Taxable (₹)</th>
              <th style="text-align: right;">GST (₹)</th>
              <th style="text-align: right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="7" style="text-align:center; padding: 12px;">No line items found</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td><strong>Taxable Subtotal:</strong></td>
              <td>₹${totalTaxable.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Total GST:</strong></td>
              <td>₹${(totalCgst + totalSgst + totalIgst).toFixed(2)}</td>
            </tr>
            <tr style="font-size: 15px; background-color: #f4f6f8;">
              <td><strong>Grand Total:</strong></td>
              <td><strong>₹${grandTotal.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 13px; margin-bottom: 20px;">
          <strong>Amount in Words:</strong> ${amountInWords}
        </div>

        <div class="footer">
          <div>
            <p style="margin:0; font-weight:bold;">Terms & Conditions:</p>
            <p style="margin:2px 0; color:#666;">1. Payment due within 30 days of invoice date.</p>
            <p style="margin:2px 0; color:#666;">2. This is a computer generated invoice.</p>
          </div>
          <div class="sign-box">
            ${settings.signatureUrl ? `<img src="${settings.signatureUrl}" style="max-height: 50px;"/><br/>` : ''}
            <div style="border-top: 1px solid #333; margin-top: 40px; padding-top: 4px;">
              Authorized Signatory<br/>
              <strong>${companyName}</strong>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // 7. Convert HTML to Blob & Save to Google Drive
    const blob = HtmlService.createHtmlOutput(html).getAs('application/pdf');
    blob.setName(`Invoice_${bill.billNumber}.pdf`);

    let pdfFolder;
    const folders = DriveApp.getFoldersByName('TMS_Invoices');
    if (folders.hasNext()) {
      pdfFolder = folders.next();
    } else {
      pdfFolder = DriveApp.createFolder('TMS_Invoices');
    }

    const pdfFile = pdfFolder.createFile(blob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const pdfUrl = pdfFile.getUrl();
    const pdfBase64 = Utilities.base64Encode(blob.getBytes());

    // 8. Audit log
    AuditModule.writeAuditLog('processed_bills', billId, 'GENERATE_PDF', null, { pdfUrl }, sessionToken);

    return {
      billId: billId,
      billNumber: bill.billNumber,
      pdfUrl: pdfUrl,
      pdfBase64: pdfBase64,
      amountInWords: amountInWords,
    };
  }

  return {
    generateBillPdf: generateBillPdf,
    numberToWordsINR: numberToWordsINR,
  };
})();
