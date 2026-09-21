/**
 * Transport & Logistics Management System (TMS)
 * Phase 9 - Expenses Module (Loading & General Expenses)
 * STRICT RULES: R7 (Session required), R13 (LockService for sequential numbering), R14 (Batch reads/writes), D8, D9.
 */

const ExpensesModule = {
  LOADING_CATEGORIES: [
    'Diesel',
    'Loading Charges',
    'Unloading Charges',
    'Parking',
    'Halting',
    'Other Trip Expenses',
  ],

  GENERAL_CATEGORIES: [
    'Office Stationery',
    'Internet',
    'Electricity',
    'Tea/Coffee',
    'Maintenance',
    'Salary-Related',
    'Office Repairs',
    'Other',
  ],

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
  // AUTO-SYNC RULE D8
  // ==========================================

  /**
   * Synchronizes Diesel and Halting amounts from enquiry to loading_expenses (D8)
   * Called on enquiry.create and enquiry.update
   */
  syncEnquiryExpenses(enquiry, sessionUserId) {
    if (!enquiry || !enquiry.id) return;

    try {
      const allExpenses = SheetRepo.getAllRows('loading_expenses', true);
      const enqId = enquiry.id;
      const dateStr = enquiry.date || this._formatDate(new Date());
      const now = new Date().toISOString();

      // Resolve vehicle identifier
      const vehicleId = enquiry.vehicleId || '';

      // 1. Diesel Sync
      const dieselAmt = parseFloat(enquiry.dieselAmount) || 0;
      const existingDiesel = allExpenses.find(
        (e) => e.enquiryId === enqId && e.category === 'Diesel' && e.source === 'ENQUIRY'
      );

      if (dieselAmt > 0) {
        if (existingDiesel) {
          SheetRepo.updateRow('loading_expenses', existingDiesel.id, {
            amount: dieselAmt,
            expenseDate: dateStr,
            vehicleId: vehicleId,
            description: 'Auto-synced from Enquiry ' + (enquiry.enquiryNumber || enquiry.id),
            updatedAt: now,
          }, sessionUserId);
        } else {
          const newId = this._getNextId('LEXP', 'loading_expense', 701);
          SheetRepo.insertRow('loading_expenses', {
            id: newId,
            expenseDate: dateStr,
            category: 'Diesel',
            amount: dieselAmt,
            description: 'Auto-synced from Enquiry ' + (enquiry.enquiryNumber || enquiry.id),
            enquiryId: enqId,
            vehicleId: vehicleId,
            source: 'ENQUIRY',
            createdAt: now,
            updatedAt: now,
          }, sessionUserId);
        }
      } else if (existingDiesel) {
        // Amount reduced to 0 or removed -> soft delete the auto-synced row
        SheetRepo.deleteRow('loading_expenses', existingDiesel.id, sessionUserId);
      }

      // 2. Halting Sync
      const haltingAmt = parseFloat(enquiry.haltingAmount) || 0;
      const existingHalting = allExpenses.find(
        (e) => e.enquiryId === enqId && e.category === 'Halting' && e.source === 'ENQUIRY'
      );

      if (haltingAmt > 0) {
        const haltingDesc =
          'Auto-synced from Enquiry ' +
          (enquiry.enquiryNumber || enquiry.id) +
          (enquiry.haltingDays ? ' (' + enquiry.haltingDays + ' days)' : '');

        if (existingHalting) {
          SheetRepo.updateRow('loading_expenses', existingHalting.id, {
            amount: haltingAmt,
            expenseDate: dateStr,
            vehicleId: vehicleId,
            description: haltingDesc,
            updatedAt: now,
          }, sessionUserId);
        } else {
          const newId = this._getNextId('LEXP', 'loading_expense', 701);
          SheetRepo.insertRow('loading_expenses', {
            id: newId,
            expenseDate: dateStr,
            category: 'Halting',
            amount: haltingAmt,
            description: haltingDesc,
            enquiryId: enqId,
            vehicleId: vehicleId,
            source: 'ENQUIRY',
            createdAt: now,
            updatedAt: now,
          }, sessionUserId);
        }
      } else if (existingHalting) {
        // Amount reduced to 0 or removed -> soft delete the auto-synced row
        SheetRepo.deleteRow('loading_expenses', existingHalting.id, sessionUserId);
      }
    } catch (e) {
      Logger.log('ExpensesModule.syncEnquiryExpenses error: ' + e.message);
    }
  },

  /**
   * Cleans up auto-synced expenses when an enquiry is deleted
   */
  deleteEnquiryExpenses(enquiryId, sessionUserId) {
    if (!enquiryId) return;
    try {
      const allExpenses = SheetRepo.getAllRows('loading_expenses', true);
      allExpenses
        .filter((e) => e.enquiryId === enquiryId && e.source === 'ENQUIRY')
        .forEach((exp) => {
          SheetRepo.deleteRow('loading_expenses', exp.id, sessionUserId);
        });
    } catch (e) {
      Logger.log('ExpensesModule.deleteEnquiryExpenses error: ' + e.message);
    }
  },

  // ==========================================
  // LOADING EXPENSES CRUD
  // ==========================================

  /**
   * List loading expenses with filters, search, pagination, sort, and summary totals
   */
  listLoading(params, sessionToken) {
    const session = requireSession(sessionToken);
    params = params || {};

    const allExpenses = SheetRepo.getAllRows('loading_expenses', true);
    const allEnquiries = SheetRepo.getAllRows('enquiries', true);
    const allVehicles = SheetRepo.getAllRows('vehicles', true);

    const enquiryMap = {};
    allEnquiries.forEach((enq) => {
      enquiryMap[enq.id] = enq;
    });

    const vehicleMap = {};
    allVehicles.forEach((v) => {
      vehicleMap[v.id] = v;
    });

    // 1. Filter
    let filtered = allExpenses.filter((exp) => {
      if (params.category && exp.category !== params.category) return false;
      if (params.enquiryId && exp.enquiryId !== params.enquiryId) return false;
      if (params.vehicleId && exp.vehicleId !== params.vehicleId) return false;
      if (params.source && exp.source !== params.source) return false;

      // Filter by linked Company or Client (via Enquiry)
      if (params.companyId || params.clientId) {
        const enq = enquiryMap[exp.enquiryId];
        if (!enq) return false;
        if (params.companyId && enq.companyId !== params.companyId) return false;
        if (params.clientId && enq.clientId !== params.clientId) return false;
      }

      // Date range filter
      if (params.fromDate || params.toDate) {
        const expDate = this._parseDate(exp.expenseDate);
        if (expDate) {
          if (params.fromDate) {
            const fDate = this._parseDate(params.fromDate);
            if (fDate && expDate < fDate) return false;
          }
          if (params.toDate) {
            const tDate = this._parseDate(params.toDate);
            if (tDate) {
              tDate.setHours(23, 59, 59, 999);
              if (expDate > tDate) return false;
            }
          }
        }
      }

      // Text search
      if (params.search) {
        const term = String(params.search).toLowerCase();
        const enq = enquiryMap[exp.enquiryId];
        const veh = vehicleMap[exp.vehicleId];
        const match =
          String(exp.id || '').toLowerCase().includes(term) ||
          String(exp.category || '').toLowerCase().includes(term) ||
          String(exp.description || '').toLowerCase().includes(term) ||
          (enq && String(enq.enquiryNumber || '').toLowerCase().includes(term)) ||
          (veh && String(veh.vehicleNumber || '').toLowerCase().includes(term));
        if (!match) return false;
      }

      return true;
    });

    // 2. Calculate summary totals before pagination
    let totalAmount = 0;
    const categoryBreakdown = {};
    this.LOADING_CATEGORIES.forEach((cat) => {
      categoryBreakdown[cat] = 0;
    });

    filtered.forEach((exp) => {
      const amt = parseFloat(exp.amount) || 0;
      totalAmount += amt;
      const cat = exp.category || 'Other Trip Expenses';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    });

    // 3. Sort
    const sortField = params.sortField || 'expenseDate';
    const sortOrder = (params.sortOrder || 'desc').toLowerCase();

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'expenseDate') {
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
    const enriched = filtered.map((exp) => {
      const enq = enquiryMap[exp.enquiryId] || null;
      const veh = vehicleMap[exp.vehicleId] || (enq ? vehicleMap[enq.vehicleId] : null);
      return {
        ...exp,
        amount: parseFloat(exp.amount) || 0,
        enquiryNumber: enq ? enq.enquiryNumber : null,
        vehicleNumber: veh ? veh.vehicleNumber : null,
        companyName: enq ? enq.companyName : null,
        clientName: enq ? enq.clientName : null,
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
        categoryBreakdown,
      },
    };
  },

  /**
   * Get single loading expense by ID
   */
  getLoading(id, sessionToken) {
    requireSession(sessionToken);
    if (!id) throw new Error('Loading Expense ID is required.');

    const exp = SheetRepo.getRowById('loading_expenses', id);
    if (!exp) throw new Error('Loading expense not found: ' + id);

    const enq = exp.enquiryId ? SheetRepo.getRowById('enquiries', exp.enquiryId) : null;
    const veh = exp.vehicleId ? SheetRepo.getRowById('vehicles', exp.vehicleId) : null;

    return {
      ...exp,
      amount: parseFloat(exp.amount) || 0,
      enquiryNumber: enq ? enq.enquiryNumber : null,
      vehicleNumber: veh ? veh.vehicleNumber : null,
    };
  },

  /**
   * Create manual loading expense
   */
  createLoading(payload, sessionToken) {
    const session = requireSession(sessionToken);
    payload = payload || {};

    if (!payload.category || !this.LOADING_CATEGORIES.includes(payload.category)) {
      throw new Error(
        'Invalid category. Allowed categories: ' + this.LOADING_CATEGORIES.join(', ')
      );
    }

    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be a positive number.');
    }

    const dateStr = payload.expenseDate
      ? this._formatDate(this._parseDate(payload.expenseDate))
      : this._formatDate(new Date());

    let vehicleId = payload.vehicleId || '';

    // If enquiryId provided, resolve vehicleId from enquiry if missing
    if (payload.enquiryId) {
      const enq = SheetRepo.getRowById('enquiries', payload.enquiryId);
      if (enq && !vehicleId && enq.vehicleId) {
        vehicleId = enq.vehicleId;
      }
    }

    const newId = this._getNextId('LEXP', 'loading_expense', 701);
    const now = new Date().toISOString();

    const record = {
      id: newId,
      expenseDate: dateStr,
      category: payload.category,
      amount: Math.round(amount * 100) / 100,
      description: String(payload.description || '').trim(),
      enquiryId: payload.enquiryId || '',
      vehicleId: vehicleId,
      source: 'MANUAL',
      createdAt: now,
      updatedAt: now,
    };

    SheetRepo.insertRow('loading_expenses', record, session.userId);

    AuditModule.log({
      action: 'loadingExpense.create',
      entity: 'loading_expenses',
      entityId: newId,
      details: { category: record.category, amount: record.amount, enquiryId: record.enquiryId },
      userId: session.userId,
    });

    return record;
  },

  /**
   * Update loading expense (rejects if source === 'ENQUIRY')
   */
  updateLoading(id, patch, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Loading Expense ID is required.');
    patch = patch || {};

    const existing = SheetRepo.getRowById('loading_expenses', id);
    if (!existing) throw new Error('Loading expense not found: ' + id);

    // Strict Rule D8: ENQUIRY-sourced rows cannot be edited here
    if (existing.source === 'ENQUIRY') {
      throw new Error('Edit this from the enquiry');
    }

    const updates = {};
    if (patch.category !== undefined) {
      if (!this.LOADING_CATEGORIES.includes(patch.category)) {
        throw new Error(
          'Invalid category. Allowed categories: ' + this.LOADING_CATEGORIES.join(', ')
        );
      }
      updates.category = patch.category;
    }

    if (patch.amount !== undefined) {
      const amount = parseFloat(patch.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Expense amount must be a positive number.');
      }
      updates.amount = Math.round(amount * 100) / 100;
    }

    if (patch.expenseDate !== undefined) {
      updates.expenseDate = this._formatDate(this._parseDate(patch.expenseDate));
    }

    if (patch.description !== undefined) {
      updates.description = String(patch.description).trim();
    }

    if (patch.vehicleId !== undefined) {
      updates.vehicleId = patch.vehicleId;
    }

    if (patch.enquiryId !== undefined) {
      updates.enquiryId = patch.enquiryId;
      if (patch.enquiryId && !updates.vehicleId) {
        const enq = SheetRepo.getRowById('enquiries', patch.enquiryId);
        if (enq && enq.vehicleId) updates.vehicleId = enq.vehicleId;
      }
    }

    updates.updatedAt = new Date().toISOString();

    const updated = SheetRepo.updateRow('loading_expenses', id, updates, session.userId);

    AuditModule.log({
      action: 'loadingExpense.update',
      entity: 'loading_expenses',
      entityId: id,
      details: { updates },
      userId: session.userId,
    });

    return updated;
  },

  /**
   * Delete loading expense (rejects if source === 'ENQUIRY')
   */
  deleteLoading(id, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Loading Expense ID is required.');

    const existing = SheetRepo.getRowById('loading_expenses', id);
    if (!existing) throw new Error('Loading expense not found: ' + id);

    // Strict Rule D8: ENQUIRY-sourced rows cannot be deleted here
    if (existing.source === 'ENQUIRY') {
      throw new Error('Edit this from the enquiry');
    }

    SheetRepo.deleteRow('loading_expenses', id, session.userId);

    AuditModule.log({
      action: 'loadingExpense.delete',
      entity: 'loading_expenses',
      entityId: id,
      details: { category: existing.category, amount: existing.amount },
      userId: session.userId,
    });

    return { id, deleted: true };
  },

  // ==========================================
  // GENERAL EXPENSES CRUD
  // ==========================================

  /**
   * List general expenses with date, category, text search, pagination, sort, and summary totals
   */
  listGeneral(params, sessionToken) {
    requireSession(sessionToken);
    params = params || {};

    const allExpenses = SheetRepo.getAllRows('general_expenses', true);

    // 1. Filter
    let filtered = allExpenses.filter((exp) => {
      if (params.category && exp.category !== params.category) return false;

      // Date range filter
      if (params.fromDate || params.toDate) {
        const expDate = this._parseDate(exp.expenseDate);
        if (expDate) {
          if (params.fromDate) {
            const fDate = this._parseDate(params.fromDate);
            if (fDate && expDate < fDate) return false;
          }
          if (params.toDate) {
            const tDate = this._parseDate(params.toDate);
            if (tDate) {
              tDate.setHours(23, 59, 59, 999);
              if (expDate > tDate) return false;
            }
          }
        }
      }

      // Text search
      if (params.search) {
        const term = String(params.search).toLowerCase();
        const match =
          String(exp.id || '').toLowerCase().includes(term) ||
          String(exp.category || '').toLowerCase().includes(term) ||
          String(exp.description || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });

    // 2. Summary totals before pagination
    let totalAmount = 0;
    const categoryBreakdown = {};
    this.GENERAL_CATEGORIES.forEach((cat) => {
      categoryBreakdown[cat] = 0;
    });

    filtered.forEach((exp) => {
      const amt = parseFloat(exp.amount) || 0;
      totalAmount += amt;
      const cat = exp.category || 'Other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    });

    // 3. Sort
    const sortField = params.sortField || 'expenseDate';
    const sortOrder = (params.sortOrder || 'desc').toLowerCase();

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'expenseDate') {
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

    // 4. Paginate
    const page = parseInt(params.page, 10) || 1;
    const limit = parseInt(params.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit).map((exp) => ({
      ...exp,
      amount: parseFloat(exp.amount) || 0,
    }));

    return {
      items: paginated,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1,
      totals: {
        totalAmount: Math.round(totalAmount * 100) / 100,
        count: filtered.length,
        categoryBreakdown,
      },
    };
  },

  /**
   * Get single general expense by ID
   */
  getGeneral(id, sessionToken) {
    requireSession(sessionToken);
    if (!id) throw new Error('General Expense ID is required.');

    const exp = SheetRepo.getRowById('general_expenses', id);
    if (!exp) throw new Error('General expense not found: ' + id);

    return {
      ...exp,
      amount: parseFloat(exp.amount) || 0,
    };
  },

  /**
   * Create general expense
   */
  createGeneral(payload, sessionToken) {
    const session = requireSession(sessionToken);
    payload = payload || {};

    if (!payload.category || !this.GENERAL_CATEGORIES.includes(payload.category)) {
      throw new Error(
        'Invalid category. Allowed categories: ' + this.GENERAL_CATEGORIES.join(', ')
      );
    }

    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be a positive number.');
    }

    const dateStr = payload.expenseDate
      ? this._formatDate(this._parseDate(payload.expenseDate))
      : this._formatDate(new Date());

    const newId = this._getNextId('GEXP', 'general_expense', 801);
    const now = new Date().toISOString();

    const record = {
      id: newId,
      expenseDate: dateStr,
      category: payload.category,
      amount: Math.round(amount * 100) / 100,
      description: String(payload.description || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    SheetRepo.insertRow('general_expenses', record, session.userId);

    AuditModule.log({
      action: 'generalExpense.create',
      entity: 'general_expenses',
      entityId: newId,
      details: { category: record.category, amount: record.amount },
      userId: session.userId,
    });

    return record;
  },

  /**
   * Update general expense
   */
  updateGeneral(id, patch, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('General Expense ID is required.');
    patch = patch || {};

    const existing = SheetRepo.getRowById('general_expenses', id);
    if (!existing) throw new Error('General expense not found: ' + id);

    const updates = {};
    if (patch.category !== undefined) {
      if (!this.GENERAL_CATEGORIES.includes(patch.category)) {
        throw new Error(
          'Invalid category. Allowed categories: ' + this.GENERAL_CATEGORIES.join(', ')
        );
      }
      updates.category = patch.category;
    }

    if (patch.amount !== undefined) {
      const amount = parseFloat(patch.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Expense amount must be a positive number.');
      }
      updates.amount = Math.round(amount * 100) / 100;
    }

    if (patch.expenseDate !== undefined) {
      updates.expenseDate = this._formatDate(this._parseDate(patch.expenseDate));
    }

    if (patch.description !== undefined) {
      updates.description = String(patch.description).trim();
    }

    updates.updatedAt = new Date().toISOString();

    const updated = SheetRepo.updateRow('general_expenses', id, updates, session.userId);

    AuditModule.log({
      action: 'generalExpense.update',
      entity: 'general_expenses',
      entityId: id,
      details: { updates },
      userId: session.userId,
    });

    return updated;
  },

  /**
   * Delete general expense
   */
  deleteGeneral(id, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('General Expense ID is required.');

    const existing = SheetRepo.getRowById('general_expenses', id);
    if (!existing) throw new Error('General expense not found: ' + id);

    SheetRepo.deleteRow('general_expenses', id, session.userId);

    AuditModule.log({
      action: 'generalExpense.delete',
      entity: 'general_expenses',
      entityId: id,
      details: { category: existing.category, amount: existing.amount },
      userId: session.userId,
    });

    return { id, deleted: true };
  },
};
