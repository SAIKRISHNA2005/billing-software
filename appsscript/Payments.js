/**
 * Transport & Logistics Management System (TMS)
 * Phase 15 - Client Payment Tracking & Ageing Analysis Module
 */

const PaymentsModule = (function () {
  /**
   * Helper to recalculate and update bill payment totals & status
   */
  function syncBillPaymentState(billId) {
    const bill = SheetRepo.getRowById('processed_bills', billId);
    if (!bill) return;

    const allPayments = SheetRepo.getAllRows('bill_payments');
    const billPayments = allPayments.filter(function (p) {
      return String(p.billId) === String(billId);
    });

    const totalPaid = billPayments.reduce(function (sum, p) {
      return sum + (Number(p.amount) || 0);
    }, 0);

    const billTotal = Number(bill.totalAmount) || 0;
    const pendingAmount = Math.max(0, billTotal - totalPaid);

    let status = 'UNPAID';
    if (totalPaid >= billTotal && billTotal > 0) {
      status = 'PAID';
    } else if (totalPaid > 0) {
      status = 'PARTIAL';
    }

    SheetRepo.updateRow('processed_bills', billId, {
      paidAmount: totalPaid,
      pendingAmount: pendingAmount,
      paymentStatus: status,
      updatedAt: new Date().toISOString(),
    });

    return { totalPaid, pendingAmount, status };
  }

  /**
   * List client payments with optional filters
   */
  function listPayments(payload, sessionToken) {
    if (sessionToken) {
      SessionModule.requireSession(sessionToken);
    }

    let payments = SheetRepo.getAllRows('bill_payments');

    if (payload) {
      if (payload.billId) {
        payments = payments.filter(function (p) { return String(p.billId) === String(payload.billId); });
      }
      if (payload.clientId) {
        payments = payments.filter(function (p) { return String(p.clientId) === String(payload.clientId); });
      }
      if (payload.paymentMode) {
        payments = payments.filter(function (p) { return p.paymentMode === payload.paymentMode; });
      }
    }

    // Sort descending by paymentDate
    payments.sort(function (a, b) {
      return new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime();
    });

    return payments;
  }

  /**
   * Record a new client payment against a processed bill
   */
  function createPayment(payload, sessionToken) {
    let userId = 'SYSTEM';
    if (sessionToken) {
      const session = SessionModule.requireSession(sessionToken);
      userId = session.userId;
    }

    if (!payload || !payload.billId) throw new Error('billId is required');
    if (!payload.amount || Number(payload.amount) <= 0) throw new Error('Valid payment amount is required');

    const bill = SheetRepo.getRowById('processed_bills', payload.billId);
    if (!bill) throw new Error('Processed bill not found for ID: ' + payload.billId);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      // Check current paid total
      const allPayments = SheetRepo.getAllRows('bill_payments');
      const existingPaid = allPayments
        .filter(function (p) { return String(p.billId) === String(payload.billId); })
        .reduce(function (sum, p) { return sum + (Number(p.amount) || 0); }, 0);

      const billTotal = Number(bill.totalAmount) || 0;
      const remainingBalance = billTotal - existingPaid;
      const newAmount = Number(payload.amount);

      if (newAmount > remainingBalance + 0.01) {
        throw new Error(
          'Payment amount (₹' + newAmount.toFixed(2) + ') exceeds remaining bill balance (₹' + remainingBalance.toFixed(2) + ')'
        );
      }

      const seq = SequenceRepository.getNextSequence('bill_payments');
      const paymentId = 'BPAY-' + String(seq).padStart(4, '0');

      const now = new Date().toISOString();
      const paymentRow = {
        id: paymentId,
        billId: payload.billId,
        billNumber: bill.billNumber || '',
        clientId: bill.clientId || payload.clientId || '',
        clientName: bill.clientName || payload.clientName || '',
        paymentDate: payload.paymentDate || now.split('T')[0],
        amount: newAmount,
        paymentMode: payload.paymentMode || 'BANK_TRANSFER',
        referenceNo: payload.referenceNo || '',
        notes: payload.notes || '',
        createdAt: now,
        createdBy: userId,
      };

      SheetRepo.insertRow('bill_payments', paymentRow);

      // Synchronize state on processed bill
      syncBillPaymentState(payload.billId);

      // Audit Log
      AuditModule.writeAuditLog('bill_payments', paymentId, 'CREATE', null, paymentRow, sessionToken);

      return paymentRow;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Update existing client payment
   */
  function updatePayment(payload, sessionToken) {
    if (sessionToken) {
      SessionModule.requireSession(sessionToken);
    }

    if (!payload || !payload.id) throw new Error('Payment ID is required');

    const payment = SheetRepo.getRowById('bill_payments', payload.id);
    if (!payment) throw new Error('Payment record not found for ID: ' + payload.id);

    const bill = SheetRepo.getRowById('processed_bills', payment.billId);
    if (!bill) throw new Error('Associated bill not found');

    const patch = payload.patch || payload;
    const newAmount = patch.amount !== undefined ? Number(patch.amount) : Number(payment.amount);

    if (newAmount <= 0) throw new Error('Payment amount must be greater than zero');

    // Validate balance overflow
    const allPayments = SheetRepo.getAllRows('bill_payments');
    const otherPaid = allPayments
      .filter(function (p) { return String(p.billId) === String(payment.billId) && p.id !== payment.id; })
      .reduce(function (sum, p) { return sum + (Number(p.amount) || 0); }, 0);

    const billTotal = Number(bill.totalAmount) || 0;
    const remainingBalance = billTotal - otherPaid;

    if (newAmount > remainingBalance + 0.01) {
      throw new Error(
        'Updated amount (₹' + newAmount.toFixed(2) + ') exceeds remaining bill balance (₹' + remainingBalance.toFixed(2) + ')'
      );
    }

    const updatedRow = SheetRepo.updateRow('bill_payments', payment.id, {
      amount: newAmount,
      paymentDate: patch.paymentDate || payment.paymentDate,
      paymentMode: patch.paymentMode || payment.paymentMode,
      referenceNo: patch.referenceNo !== undefined ? patch.referenceNo : payment.referenceNo,
      notes: patch.notes !== undefined ? patch.notes : payment.notes,
      updatedAt: new Date().toISOString(),
    });

    syncBillPaymentState(payment.billId);

    AuditModule.writeAuditLog('bill_payments', payment.id, 'UPDATE', payment, updatedRow, sessionToken);

    return updatedRow;
  }

  /**
   * Delete client payment
   */
  function deletePayment(payload, sessionToken) {
    if (sessionToken) {
      SessionModule.requireSession(sessionToken);
    }

    const paymentId = payload && (payload.id || payload.paymentId);
    if (!paymentId) throw new Error('Payment ID is required for deletion');

    const payment = SheetRepo.getRowById('bill_payments', paymentId);
    if (!payment) throw new Error('Payment record not found for ID: ' + paymentId);

    const billId = payment.billId;

    SheetRepo.deleteRow('bill_payments', paymentId);

    syncBillPaymentState(billId);

    AuditModule.writeAuditLog('bill_payments', paymentId, 'DELETE', payment, null, sessionToken);

    return { success: true, deletedId: paymentId, billId: billId };
  }

  /**
   * Generates Client Payment Ageing Analysis Report
   */
  function getAgeingReport(payload, sessionToken) {
    if (sessionToken) {
      SessionModule.requireSession(sessionToken);
    }

    const bills = SheetRepo.getAllRows('processed_bills');
    const today = new Date();

    const summary = {
      bucket_0_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      totalPending: 0,
      totalOverdueBills: 0,
    };

    const clientsMap = {};

    bills.forEach(function (b) {
      const pending = Number(b.pendingAmount || 0);
      if (pending <= 0) return; // Only process unpaid/partial bills

      const billDate = b.billDate ? new Date(b.billDate) : today;
      const diffTime = Math.abs(today - billDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      summary.totalPending += pending;
      summary.totalOverdueBills += 1;

      const clientId = b.clientId || 'UNKNOWN';
      const clientName = b.clientName || 'Unknown Client';

      if (!clientsMap[clientId]) {
        clientsMap[clientId] = {
          clientId: clientId,
          clientName: clientName,
          bucket_0_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_90_plus: 0,
          totalPending: 0,
          billsCount: 0,
        };
      }

      clientsMap[clientId].totalPending += pending;
      clientsMap[clientId].billsCount += 1;

      if (diffDays <= 30) {
        summary.bucket_0_30 += pending;
        clientsMap[clientId].bucket_0_30 += pending;
      } else if (diffDays <= 60) {
        summary.bucket_31_60 += pending;
        clientsMap[clientId].bucket_31_60 += pending;
      } else if (diffDays <= 90) {
        summary.bucket_61_90 += pending;
        clientsMap[clientId].bucket_61_90 += pending;
      } else {
        summary.bucket_90_plus += pending;
        clientsMap[clientId].bucket_90_plus += pending;
      }
    });

    const clientsList = Object.keys(clientsMap).map(function (k) { return clientsMap[k]; });
    clientsList.sort(function (a, b) { return b.totalPending - a.totalPending; });

    return {
      summary: summary,
      clients: clientsList,
    };
  }

  return {
    list: listPayments,
    create: createPayment,
    update: updatePayment,
    delete: deletePayment,
    ageing: getAgeingReport,
  };
})();
