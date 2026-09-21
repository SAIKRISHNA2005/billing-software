/**
 * Transport & Logistics Management System (TMS)
 * Phase 10 - Vendor Management, Payments, Settlements & Report
 * STRICT RULES: R7 (Session required), R13 (LockService for sequential numbering), R14 (Batch reads/writes), D7.
 */

const VendorModule = {
  PAYMENT_MODES: ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'],

  /**
   * Helper: Parse 'DD-MM-YYYY' into Date object for range comparison
   */
  _parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  },

  /**
   * Helper: Format Date object to 'DD-MM-YYYY'
   */
  _formatDate(date) {
    if (!date) return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy');
    return Utilities.formatDate(new Date(date), 'Asia/Kolkata', 'dd-MM-yyyy');
  },

  /**
   * Generates sequential ID under LockService
   */
  _getNextId(prefix, sequenceKey, defaultStart) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const now = new Date().toISOString();
      const allSequences = SheetRepo.getAllRows('number_sequences', true);
      let seqRow = allSequences.find((s) => s.sequenceKey === sequenceKey);
      let nextNum;

      if (seqRow) {
        nextNum = parseInt(seqRow.currentValue, 10) + 1;
        SheetRepo.updateRow('number_sequences', sequenceKey, {
          currentValue: nextNum,
          updatedAt: now,
        });
      } else {
        nextNum = defaultStart;
        SheetRepo.insertRow('number_sequences', {
          sequenceKey: sequenceKey,
          financialYear: getFinancialYear(),
          currentValue: nextNum,
          updatedAt: now,
        });
      }

      return prefix + '-' + nextNum;
    } finally {
      lock.releaseLock();
    }
  },

  // ==========================================
  // VENDOR PAYMENTS CRUD
  // ==========================================

  /**
   * List vendor payments with filters, search, pagination, and totals
   */
  listPayments(params, sessionToken) {
    requireSession(sessionToken);
    params = params || {};

    const allPayments = SheetRepo.getAllRows('vendor_payments', true);
    const allVendors = SheetRepo.getAllRows('vendors', true);
    const allEnquiries = SheetRepo.getAllRows('enquiries', true);

    const vendorMap = {};
    allVendors.forEach((v) => {
      vendorMap[v.id] = v;
    });

    const enquiryMap = {};
    allEnquiries.forEach((e) => {
      enquiryMap[e.id] = e;
    });

    // 1. Filter
    let filtered = allPayments.filter((p) => {
      if (params.vendorId && p.vendorId !== params.vendorId) return false;
      if (params.enquiryId && p.enquiryId !== params.enquiryId) return false;
      if (params.mode && p.mode !== params.mode) return false;

      // Date range filter
      if (params.fromDate || params.toDate) {
        const payDate = this._parseDate(p.paymentDate);
        if (payDate) {
          if (params.fromDate) {
            const fDate = this._parseDate(params.fromDate);
            if (fDate && payDate < fDate) return false;
          }
          if (params.toDate) {
            const tDate = this._parseDate(params.toDate);
            if (tDate) {
              tDate.setHours(23, 59, 59, 999);
              if (payDate > tDate) return false;
            }
          }
        }
      }

      // Text search
      if (params.search) {
        const term = String(params.search).toLowerCase();
        const v = vendorMap[p.vendorId];
        const enq = enquiryMap[p.enquiryId];
        const match =
          String(p.id || '').toLowerCase().includes(term) ||
          String(p.reference || '').toLowerCase().includes(term) ||
          String(p.notes || '').toLowerCase().includes(term) ||
          String(p.mode || '').toLowerCase().includes(term) ||
          (v && String(v.name || '').toLowerCase().includes(term)) ||
          (enq && String(enq.enquiryNumber || '').toLowerCase().includes(term));
        if (!match) return false;
      }

      return true;
    });

    // 2. Summary totals before pagination
    let totalAmount = 0;
    filtered.forEach((p) => {
      totalAmount += parseFloat(p.amount) || 0;
    });

    // 3. Sort
    const sortField = params.sortField || 'paymentDate';
    const sortOrder = (params.sortOrder || 'desc').toLowerCase();

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'paymentDate') {
        const dateA = this._parseDate(valA) || new Date(0);
        const dateB = this._parseDate(valB) || new Date(0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (sortField === 'amount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 4. Enrich records
    const enriched = filtered.map((p) => {
      const v = vendorMap[p.vendorId] || null;
      const enq = enquiryMap[p.enquiryId] || null;
      return {
        ...p,
        amount: parseFloat(p.amount) || 0,
        vendorName: v ? v.name : 'Unknown Vendor',
        enquiryNumber: enq ? enq.enquiryNumber : null,
      };
    });

    // 5. Paginate
    const page = parseInt(params.page, 10) || 1;
    const limit = parseInt(params.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    const paginated = enriched.slice(startIndex, startIndex + limit);

    return {
      items: paginated,
      total: enriched.length,
      page,
      limit,
      totalPages: Math.ceil(enriched.length / limit) || 1,
      totals: {
        totalAmount: Math.round(totalAmount * 100) / 100,
        count: enriched.length,
      },
    };
  },

  /**
   * Get single vendor payment by ID
   */
  getPayment(id, sessionToken) {
    requireSession(sessionToken);
    if (!id) throw new Error('Payment ID is required.');

    const p = SheetRepo.getRowById('vendor_payments', id);
    if (!p) throw new Error('Vendor payment not found: ' + id);

    const v = p.vendorId ? SheetRepo.getRowById('vendors', p.vendorId) : null;
    const enq = p.enquiryId ? SheetRepo.getRowById('enquiries', p.enquiryId) : null;

    return {
      ...p,
      amount: parseFloat(p.amount) || 0,
      vendorName: v ? v.name : null,
      enquiryNumber: enq ? enq.enquiryNumber : null,
    };
  },

  /**
   * Create vendor payment with overpayment warning check (does not block)
   */
  createPayment(payload, sessionToken) {
    const session = requireSession(sessionToken);
    payload = payload || {};

    if (!payload.vendorId) {
      throw new Error('Vendor is required.');
    }

    const vendor = SheetRepo.getRowById('vendors', payload.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found: ' + payload.vendorId);
    }

    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }

    if (!payload.mode || !this.PAYMENT_MODES.includes(payload.mode)) {
      throw new Error('Invalid payment mode. Allowed modes: ' + this.PAYMENT_MODES.join(', '));
    }

    const dateStr = payload.paymentDate
      ? this._formatDate(this._parseDate(payload.paymentDate))
      : this._formatDate(new Date());

    // Check Overpayment Warning (Rule: Warn, do not block)
    let warning = false;
    let warningMessage = null;

    const allPayments = SheetRepo.getAllRows('vendor_payments', true);
    const vendorPayments = allPayments.filter((p) => p.vendorId === payload.vendorId);

    if (payload.enquiryId) {
      const enquiry = SheetRepo.getRowById('enquiries', payload.enquiryId);
      if (enquiry) {
        const enqPayments = vendorPayments.filter((p) => p.enquiryId === payload.enquiryId);
        const payable = VendorFinance.computeVendorPayable(enquiry, enqPayments);
        if (amount > payable.balance) {
          warning = true;
          warningMessage =
            'Payment amount (₹' +
            amount.toFixed(2) +
            ') exceeds the pending balance (₹' +
            payable.balance.toFixed(2) +
            ') for enquiry ' +
            (enquiry.enquiryNumber || enquiry.id) +
            '.';
        }
      }
    } else {
      // General payment to vendor: compare against net vendor pending balance
      const allEnquiries = SheetRepo.getAllRows('enquiries', true);
      const vendorEnquiries = allEnquiries.filter((e) => e.vendorId === payload.vendorId);

      let totalPayable = 0;
      vendorEnquiries.forEach((enq) => {
        const vp = VendorFinance.computeVendorPayable(enq, []);
        totalPayable += vp.totalPayable;
      });

      let totalPaid = 0;
      vendorPayments.forEach((p) => {
        totalPaid += parseFloat(p.amount) || 0;
      });

      const netPending = totalPayable - totalPaid;
      if (amount > netPending) {
        warning = true;
        warningMessage =
          'Payment amount (₹' +
          amount.toFixed(2) +
          ') exceeds the total outstanding balance (₹' +
          netPending.toFixed(2) +
          ') for ' +
          vendor.name +
          '.';
      }
    }

    const newId = this._getNextId('VPAY', 'vendor_payment', 901);
    const now = new Date().toISOString();

    const record = {
      id: newId,
      vendorId: payload.vendorId,
      enquiryId: payload.enquiryId || '',
      paymentDate: dateStr,
      amount: Math.round(amount * 100) / 100,
      mode: payload.mode,
      reference: String(payload.reference || '').trim(),
      notes: String(payload.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    SheetRepo.insertRow('vendor_payments', record, session.userId);

    writeAuditLog('vendor_payments', newId, 'CREATE', null, record, session.userId);

    return {
      payment: record,
      warning,
      warningMessage,
    };
  },

  /**
   * Update vendor payment
   */
  updatePayment(id, patch, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Payment ID is required.');
    patch = patch || {};

    const existing = SheetRepo.getRowById('vendor_payments', id);
    if (!existing) throw new Error('Payment record not found: ' + id);

    const updates = {};

    if (patch.vendorId !== undefined) {
      const v = SheetRepo.getRowById('vendors', patch.vendorId);
      if (!v) throw new Error('Vendor not found: ' + patch.vendorId);
      updates.vendorId = patch.vendorId;
    }

    if (patch.enquiryId !== undefined) {
      updates.enquiryId = patch.enquiryId || '';
    }

    if (patch.paymentDate !== undefined) {
      updates.paymentDate = this._formatDate(this._parseDate(patch.paymentDate));
    }

    if (patch.amount !== undefined) {
      const amount = parseFloat(patch.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Payment amount must be greater than 0.');
      }
      updates.amount = Math.round(amount * 100) / 100;
    }

    if (patch.mode !== undefined) {
      if (!this.PAYMENT_MODES.includes(patch.mode)) {
        throw new Error('Invalid payment mode. Allowed modes: ' + this.PAYMENT_MODES.join(', '));
      }
      updates.mode = patch.mode;
    }

    if (patch.reference !== undefined) {
      updates.reference = String(patch.reference).trim();
    }

    if (patch.notes !== undefined) {
      updates.notes = String(patch.notes).trim();
    }

    updates.updatedAt = new Date().toISOString();

    const updated = SheetRepo.updateRow('vendor_payments', id, updates, session.userId);

    writeAuditLog('vendor_payments', id, 'UPDATE', existing, updated, session.userId);

    return updated;
  },

  /**
   * Delete vendor payment (soft delete)
   */
  deletePayment(id, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Payment ID is required.');

    const existing = SheetRepo.getRowById('vendor_payments', id);
    if (!existing) throw new Error('Payment record not found: ' + id);

    SheetRepo.deleteRow('vendor_payments', id, session.userId);

    writeAuditLog('vendor_payments', id, 'DELETE', existing, { deletedAt: new Date().toISOString() }, session.userId);

    return { id, deleted: true };
  },

  // ==========================================
  // VENDOR TRIPS LEDGER (Action: "vendor.trips")
  // ==========================================

  /**
   * Returns trips and payments breakdown for a specific vendor using computeVendorPayable (D7)
   */
  getVendorTrips(vendorId, sessionToken) {
    requireSession(sessionToken);
    if (!vendorId) throw new Error('Vendor ID is required.');

    const vendor = SheetRepo.getRowById('vendors', vendorId);
    if (!vendor) throw new Error('Vendor not found: ' + vendorId);

    const allEnquiries = SheetRepo.getAllRows('enquiries', true);
    const allPayments = SheetRepo.getAllRows('vendor_payments', true);
    const allVehicles = SheetRepo.getAllRows('vehicles', true);
    const allContainers = SheetRepo.getAllRows('containers', true);

    const vehicleMap = {};
    allVehicles.forEach((v) => {
      vehicleMap[v.id] = v;
    });

    const containerMap = {};
    allContainers.forEach((c) => {
      containerMap[c.id] = c;
    });

    // 1. Get vendor enquiries
    const vendorEnquiries = allEnquiries.filter((e) => e.vendorId === vendorId);

    // 2. Get vendor payments
    const vendorPayments = allPayments.filter((p) => p.vendorId === vendorId);

    // Group payments by enquiryId
    const paymentsByEnquiry = {};
    const unallocatedPayments = [];

    const activeEnquiryIds = new Set(vendorEnquiries.map((e) => e.id));

    vendorPayments.forEach((p) => {
      if (p.enquiryId && activeEnquiryIds.has(p.enquiryId)) {
        if (!paymentsByEnquiry[p.enquiryId]) {
          paymentsByEnquiry[p.enquiryId] = [];
        }
        paymentsByEnquiry[p.enquiryId].push(p);
      } else {
        unallocatedPayments.push({
          ...p,
          amount: parseFloat(p.amount) || 0,
        });
      }
    });

    // 3. Process each trip using unified formula computeVendorPayable (D7)
    let totalPayable = 0;
    let allocatedPaid = 0;

    const trips = vendorEnquiries.map((enq) => {
      const enqPayments = paymentsByEnquiry[enq.id] || [];
      const calc = VendorFinance.computeVendorPayable(enq, enqPayments);

      totalPayable += calc.totalPayable;
      allocatedPaid += calc.totalPaid;

      const veh = vehicleMap[enq.vehicleId];
      const cont = containerMap[enq.containerId];

      return {
        id: enq.id,
        enquiryId: enq.id,
        enquiryNumber: enq.enquiryNumber,
        transactionNumber: enq.transactionNumber,
        transactionNo: enq.transactionNumber,
        date: enq.date,
        loadingType: enq.loadingType,
        vehicleNumber: veh ? veh.vehicleNumber : (enq.vehicleNumber || '-'),
        containerNumber: cont ? cont.containerNumber : (enq.containerNumber || '-'),
        advance: calc.advance,
        extraAdvance: calc.extraAdvance,
        diesel: calc.diesel,
        halting: calc.halting,
        bonus: calc.bonus,
        totalPayable: calc.totalPayable,
        paid: calc.totalPaid,
        pending: calc.balance,
        payments: enqPayments.map((p) => ({
          ...p,
          amount: parseFloat(p.amount) || 0,
        })),
      };
    });

    // Sort trips newest first
    trips.sort((a, b) => {
      const dateA = this._parseDate(a.date) || new Date(0);
      const dateB = this._parseDate(b.date) || new Date(0);
      return dateB - dateA;
    });

    let unallocatedPaid = 0;
    unallocatedPayments.forEach((p) => {
      unallocatedPaid += p.amount || 0;
    });

    const totalPaid = allocatedPaid + unallocatedPaid;
    const netBalance = totalPayable - totalPaid;

    return {
      vendor,
      trips,
      payments: vendorPayments.map((p) => {
        const enq = allEnquiries.find((e) => e.id === p.enquiryId);
        return {
          ...p,
          amount: parseFloat(p.amount) || 0,
          enquiryTransactionNo: enq ? enq.transactionNumber : undefined,
        };
      }),
      unallocatedPayments,
      summary: {
        totalTrips: trips.length,
        totalPayable: Math.round(totalPayable * 100) / 100,
        allocatedPaid: Math.round(allocatedPaid * 100) / 100,
        unallocatedPaid: Math.round(unallocatedPaid * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        netBalance: Math.round(netBalance * 100) / 100,
        netPending: Math.round(netBalance * 100) / 100,
      },
      totals: {
        totalPayable: Math.round(totalPayable * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        netPending: Math.round(netBalance * 100) / 100,
        unallocatedPaid: Math.round(unallocatedPaid * 100) / 100,
      },
    };
  },

  // ==========================================
  // VENDOR REPORT (Action: "vendor.report")
  // ==========================================

  /**
   * Consolidated report of all vendors in a single batched pass
   */
  getVendorReport(filters, sessionToken) {
    requireSession(sessionToken);
    filters = filters || {};

    const allVendors = SheetRepo.getAllRows('vendors', true);
    const allEnquiries = SheetRepo.getAllRows('enquiries', true);
    const allPayments = SheetRepo.getAllRows('vendor_payments', true);
    const allVehicles = SheetRepo.getAllRows('vehicles', true);

    const vehicleMap = {};
    allVehicles.forEach((v) => {
      vehicleMap[v.id] = v;
    });

    // Filter enquiries by criteria
    const filteredEnquiries = allEnquiries.filter((e) => {
      if (filters.vendorId && e.vendorId !== filters.vendorId) return false;
      if (filters.companyId && e.companyId !== filters.companyId) return false;
      if (filters.clientId && e.clientId !== filters.clientId) return false;
      if (filters.loadingType && e.loadingType !== filters.loadingType) return false;

      if (filters.fromDate || filters.toDate) {
        const enqDate = this._parseDate(e.date);
        if (enqDate) {
          if (filters.fromDate) {
            const fDate = this._parseDate(filters.fromDate);
            if (fDate && enqDate < fDate) return false;
          }
          if (filters.toDate) {
            const tDate = this._parseDate(filters.toDate);
            if (tDate) {
              tDate.setHours(23, 59, 59, 999);
              if (enqDate > tDate) return false;
            }
          }
        }
      }

      return true;
    });

    // Filter payments by date if provided
    const filteredPayments = allPayments.filter((p) => {
      if (filters.vendorId && p.vendorId !== filters.vendorId) return false;

      if (filters.fromDate || filters.toDate) {
        const payDate = this._parseDate(p.paymentDate);
        if (payDate) {
          if (filters.fromDate) {
            const fDate = this._parseDate(filters.fromDate);
            if (fDate && payDate < fDate) return false;
          }
          if (filters.toDate) {
            const tDate = this._parseDate(filters.toDate);
            if (tDate) {
              tDate.setHours(23, 59, 59, 999);
              if (payDate > tDate) return false;
            }
          }
        }
      }

      return true;
    });

    // Map enquiries and payments by vendor
    const enquiriesByVendor = {};
    const paymentsByVendor = {};
    const vehiclesByVendor = {};

    filteredEnquiries.forEach((e) => {
      const vId = e.vendorId || 'NO_VENDOR';
      if (!enquiriesByVendor[vId]) enquiriesByVendor[vId] = [];
      enquiriesByVendor[vId].push(e);

      if (!vehiclesByVendor[vId]) vehiclesByVendor[vId] = new Set();
      const veh = vehicleMap[e.vehicleId];
      const vehNumber = veh ? veh.vehicleNumber : e.vehicleNumber;
      if (vehNumber) vehiclesByVendor[vId].add(vehNumber);
    });

    filteredPayments.forEach((p) => {
      const vId = p.vendorId || 'NO_VENDOR';
      if (!paymentsByVendor[vId]) paymentsByVendor[vId] = 0;
      paymentsByVendor[vId] += parseFloat(p.amount) || 0;
    });

    // Build report rows
    const rows = [];
    const grandTotal = {
      vehicleCount: 0,
      tripCount: 0,
      advance: 0,
      diesel: 0,
      halting: 0,
      extraAdvance: 0,
      bonus: 0,
      totalAmount: 0,
      paid: 0,
      pending: 0,
    };

    const targetVendors = filters.vendorId
      ? allVendors.filter((v) => v.id === filters.vendorId)
      : allVendors;

    targetVendors.forEach((vendor) => {
      const enqs = enquiriesByVendor[vendor.id] || [];
      const paid = paymentsByVendor[vendor.id] || 0;
      const vehiclesSet = vehiclesByVendor[vendor.id] || new Set();

      let advance = 0;
      let diesel = 0;
      let halting = 0;
      let extraAdvance = 0;
      let bonus = 0;
      let totalAmount = 0;

      enqs.forEach((enq) => {
        const vp = VendorFinance.computeVendorPayable(enq, []);
        advance += vp.advance;
        diesel += vp.diesel;
        halting += vp.halting;
        extraAdvance += vp.extraAdvance;
        bonus += vp.bonus;
        totalAmount += vp.totalPayable;
      });

      const pending = totalAmount - paid;

      // Only include vendors with trips or payments unless explicitly filtered by single vendor
      if (enqs.length > 0 || paid > 0 || filters.vendorId) {
        const row = {
          vendorId: vendor.id,
          vendorName: vendor.name,
          contactPerson: vendor.contactPerson || '-',
          phone: vendor.phone || '-',
          vehicleCount: vehiclesSet.size,
          tripCount: enqs.length,
          advance: Math.round(advance * 100) / 100,
          diesel: Math.round(diesel * 100) / 100,
          halting: Math.round(halting * 100) / 100,
          extraAdvance: Math.round(extraAdvance * 100) / 100,
          bonus: Math.round(bonus * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          paid: Math.round(paid * 100) / 100,
          pending: Math.round(pending * 100) / 100,
        };

        rows.push(row);

        grandTotal.vehicleCount += row.vehicleCount;
        grandTotal.tripCount += row.tripCount;
        grandTotal.advance += row.advance;
        grandTotal.diesel += row.diesel;
        grandTotal.halting += row.halting;
        grandTotal.extraAdvance += row.extraAdvance;
        grandTotal.bonus += row.bonus;
        grandTotal.totalAmount += row.totalAmount;
        grandTotal.paid += row.paid;
        grandTotal.pending += row.pending;
      }
    });

    // Round grand totals
    grandTotal.advance = Math.round(grandTotal.advance * 100) / 100;
    grandTotal.diesel = Math.round(grandTotal.diesel * 100) / 100;
    grandTotal.halting = Math.round(grandTotal.halting * 100) / 100;
    grandTotal.extraAdvance = Math.round(grandTotal.extraAdvance * 100) / 100;
    grandTotal.bonus = Math.round(grandTotal.bonus * 100) / 100;
    grandTotal.totalAmount = Math.round(grandTotal.totalAmount * 100) / 100;
    grandTotal.paid = Math.round(grandTotal.paid * 100) / 100;
    grandTotal.pending = Math.round(grandTotal.pending * 100) / 100;

    return {
      rows,
      grandTotal,
      vendorCount: rows.length,
    };
  },
};
