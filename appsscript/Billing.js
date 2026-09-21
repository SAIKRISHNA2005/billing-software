/**
 * Transport & Logistics Management System (TMS)
 * Phase 12 — Billing Backend Module
 */

var BillingModule = (function () {
  var BILLS_SHEET = 'bills';
  var BILL_ITEMS_SHEET = 'bill_items';
  var ENQUIRIES_SHEET = 'enquiries';
  var NUMBER_SEQ_SHEET = 'number_sequences';

  /**
   * Lists enquiries at stage COMPLETED ready for billing
   */
  function listPending(params) {
    params = params || {};
    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET);
    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });

    // Filter unbilled completed enquiries
    var pending = enquiries.filter(function (e) {
      if (e.deletedAt) return false;
      var stage = (e.stage || '').toUpperCase();
      var isCompletedStage = (stage === 'COMPLETED');
      var isUnbilled = (!e.billId || e.billId === '');
      return isCompletedStage && isUnbilled;
    });

    // Apply company filter
    if (params.companyId) {
      pending = pending.filter(function (e) { return e.companyId === params.companyId; });
    }

    // Apply client filter
    if (params.clientId) {
      pending = pending.filter(function (e) { return e.clientId === params.clientId; });
    }

    // Apply search filter (enquiryId, transactionNo, vehicleNo, containerNo)
    if (params.search) {
      var q = String(params.search).toLowerCase();
      pending = pending.filter(function (e) {
        return (
          (e.id || '').toLowerCase().indexOf(q) !== -1 ||
          (e.transactionNo || '').toLowerCase().indexOf(q) !== -1 ||
          (e.vehicleNo || '').toLowerCase().indexOf(q) !== -1 ||
          (e.containerNo || '').toLowerCase().indexOf(q) !== -1
        );
      });
    }

    // Format output items with suggested amount
    var items = pending.map(function (e) {
      var freight = parseFloat(e.freightAmount) || 0;
      var halting = parseFloat(e.haltingAmount) || 0;
      var suggestedAmount = freight + halting;

      return {
        enquiryId: e.id,
        transactionNo: e.transactionNo || '',
        companyId: e.companyId || '',
        companyName: companyMap[e.companyId] || e.companyId || '',
        clientId: e.clientId || '',
        clientName: clientMap[e.clientId] || e.clientId || '',
        vehicleNo: e.vehicleNo || '',
        containerNo: e.containerNo || '',
        loadingType: e.loadingType || 'Import',
        freightAmount: freight,
        haltingAmount: halting,
        suggestedAmount: suggestedAmount,
        completedAt: e.completedAt || e.updatedAt || e.createdAt
      };
    });

    return {
      items: items,
      total: items.length
    };
  }

  /**
   * Creates a DRAFT bill from selected enquiries
   */
  function createBill(payload) {
    if (!payload || !payload.companyId || !payload.clientId || !payload.enquiryIds || payload.enquiryIds.length === 0) {
      throw new Error('companyId, clientId, and non-empty enquiryIds array are required to create a bill.');
    }

    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET);
    var targetEnquiries = enquiries.filter(function (e) {
      return payload.enquiryIds.indexOf(e.id) !== -1 && !e.deletedAt;
    });

    if (targetEnquiries.length !== payload.enquiryIds.length) {
      throw new Error('One or more selected enquiries do not exist.');
    }

    // Validate all enquiries belong to same company & client and are at COMPLETED stage
    targetEnquiries.forEach(function (e) {
      if (e.companyId !== payload.companyId || e.clientId !== payload.clientId) {
        throw new Error('All enquiries in a bill must belong to the same Company and Client.');
      }
      if ((e.stage || '').toUpperCase() !== 'COMPLETED' || (e.billId && e.billId !== '')) {
        throw new Error('Enquiry ' + e.id + ' is not unbilled or not in COMPLETED stage.');
      }
    });

    var billId = 'BIL-' + (Date.now() % 1000000);
    var now = new Date().toISOString();
    var billingDate = payload.billingDate || new Date().toISOString().substring(0, 10);

    // Build line items if not explicitly provided
    var lineItems = payload.items;
    if (!lineItems || lineItems.length === 0) {
      lineItems = [];
      targetEnquiries.forEach(function (e) {
        var freight = parseFloat(e.freightAmount) || 0;
        var halting = parseFloat(e.haltingAmount) || 0;

        lineItems.push({
          description: 'Transportation Charges (Enquiry ' + e.id + ')',
          amount: freight,
          enquiryId: e.id
        });

        if (halting > 0) {
          lineItems.push({
            description: 'Halting Charges (Enquiry ' + e.id + ')',
            amount: halting,
            enquiryId: e.id
          });
        }
      });
    }

    var totalAmount = 0;
    lineItems.forEach(function (item) {
      totalAmount += parseFloat(item.amount) || 0;
    });

    var billRecord = {
      id: billId,
      billNumber: '',
      billSeq: 0,
      financialYear: '',
      status: 'DRAFT',
      billingDate: billingDate,
      companyId: payload.companyId,
      clientId: payload.clientId,
      totalAmount: totalAmount,
      remarks: payload.remarks || '',
      processedAt: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: ''
    };

    SheetRepoModule.insertRow(BILLS_SHEET, billRecord);

    // Write bill items
    lineItems.forEach(function (item, index) {
      var itemRecord = {
        id: 'BIT-' + Date.now() + '-' + index,
        billId: billId,
        enquiryId: item.enquiryId || '',
        description: item.description || 'Line Item',
        amount: parseFloat(item.amount) || 0,
        sortOrder: index + 1,
        createdAt: now,
        updatedAt: now
      };
      SheetRepoModule.insertRow(BILL_ITEMS_SHEET, itemRecord);
    });

    // Update enquiries stage to BILLING and set billId
    targetEnquiries.forEach(function (e) {
      SheetRepoModule.updateRow(ENQUIRIES_SHEET, e.id, {
        stage: 'BILLING',
        billId: billId,
        updatedAt: now
      });
      AuditModule.writeAuditLog('enquiries', e.id, 'MOVE_STAGE_BILLING', e.stage, 'BILLING');
    });

    AuditModule.writeAuditLog('bills', billId, 'CREATE_DRAFT_BILL', '', JSON.stringify(billRecord));

    return getBill(billId);
  }

  /**
   * Deletes a draft bill and reverts linked enquiries to COMPLETED stage
   */
  function deleteDraft(billId) {
    var bill = getBillRecord(billId);
    if (!bill) throw new Error('Bill not found.');
    if (bill.status !== 'DRAFT') throw new Error('Only DRAFT bills can be deleted.');

    var now = new Date().toISOString();
    SheetRepoModule.updateRow(BILLS_SHEET, billId, { deletedAt: now });

    // Revert enquiries back to COMPLETED
    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET);
    enquiries.forEach(function (e) {
      if (e.billId === billId) {
        SheetRepoModule.updateRow(ENQUIRIES_SHEET, e.id, {
          stage: 'COMPLETED',
          billId: '',
          updatedAt: now
        });
        AuditModule.writeAuditLog('enquiries', e.id, 'REVERT_STAGE_COMPLETED', 'BILLING', 'COMPLETED');
      }
    });

    AuditModule.writeAuditLog('bills', billId, 'DELETE_DRAFT_BILL', JSON.stringify(bill), '');
    return { success: true, message: 'Draft bill deleted successfully.' };
  }

  /**
   * Atomically processes a bill allocating FY bill number <seq>/<FY>
   */
  function processBill(payload) {
    if (!payload || !payload.id) throw new Error('Bill ID is required to process bill.');

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error('System busy during bill processing. Please try again.');
    }

    try {
      var bill = getBillRecord(payload.id);
      if (!bill) throw new Error('Bill not found.');
      if (bill.status === 'PROCESSED') throw new Error('Bill is already processed with number ' + bill.billNumber);

      var items = SheetRepoModule.getAllRows(BILL_ITEMS_SHEET).filter(function (it) {
        return it.billId === payload.id;
      });

      if (!items || items.length === 0) {
        throw new Error('Cannot process a bill without line items.');
      }

      var totalAmount = 0;
      items.forEach(function (it) { totalAmount += parseFloat(it.amount) || 0; });
      if (totalAmount <= 0) {
        throw new Error('Cannot process a bill with total amount of zero.');
      }

      var billingDate = payload.billingDate || bill.billingDate || new Date().toISOString().substring(0, 10);
      var fy = FinancialYearModule.getFinancialYear(billingDate);
      var settings = SettingsModule.getSettings();

      // Read and increment sequence in number_sequences
      var seqRows = SheetRepoModule.getAllRows(NUMBER_SEQ_SHEET);
      var seqKey = 'bill_' + fy;
      var existingSeqRow = null;

      for (var i = 0; i < seqRows.length; i++) {
        if (seqRows[i].sequenceKey === seqKey) {
          existingSeqRow = seqRows[i];
          break;
        }
      }

      var nextSeq = 0;
      if (existingSeqRow) {
        nextSeq = (parseInt(existingSeqRow.currentValue, 10) || 0) + 1;
        SheetRepoModule.updateRow(NUMBER_SEQ_SHEET, existingSeqRow.id || seqKey, {
          currentValue: nextSeq,
          updatedAt: new Date().toISOString()
        });
      } else {
        nextSeq = settings.billStartNumber || 1;
        SheetRepoModule.insertRow(NUMBER_SEQ_SHEET, {
          id: seqKey,
          sequenceKey: seqKey,
          financialYear: fy,
          currentValue: nextSeq,
          updatedAt: new Date().toISOString()
        });
      }

      var billNumber = nextSeq + '/' + fy;
      var now = new Date().toISOString();

      var updatedFields = {
        billNumber: billNumber,
        billSeq: nextSeq,
        financialYear: fy,
        status: 'PROCESSED',
        billingDate: billingDate,
        totalAmount: totalAmount,
        remarks: payload.remarks !== undefined ? payload.remarks : bill.remarks,
        processedAt: now,
        updatedAt: now
      };

      SheetRepoModule.updateRow(BILLS_SHEET, bill.id, updatedFields);

      // Advance enquiries stage to PROCESSED
      var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET);
      enquiries.forEach(function (e) {
        if (e.billId === bill.id) {
          SheetRepoModule.updateRow(ENQUIRIES_SHEET, e.id, {
            stage: 'PROCESSED',
            updatedAt: now
          });
          AuditModule.writeAuditLog('enquiries', e.id, 'MOVE_STAGE_PROCESSED', e.stage, 'PROCESSED');
        }
      });

      AuditModule.writeAuditLog('bills', bill.id, 'PROCESS_BILL', JSON.stringify(bill), JSON.stringify(updatedFields));

      return getBill(bill.id);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Updates a processed bill (line items / remarks / billing date) preserving bill number
   */
  function updateProcessed(payload) {
    if (!payload || !payload.id) throw new Error('Bill ID is required to update processed bill.');

    var bill = getBillRecord(payload.id);
    if (!bill) throw new Error('Bill not found.');
    if (bill.status !== 'PROCESSED') throw new Error('Only PROCESSED bills can use updateProcessed.');

    // Validate billing date FY consistency
    var newDate = payload.billingDate || bill.billingDate;
    var newFy = FinancialYearModule.getFinancialYear(newDate);
    if (newFy !== bill.financialYear) {
      throw new Error('Cannot change billing date to a different financial year (' + newFy + '). Original FY is ' + bill.financialYear);
    }

    var oldValue = JSON.stringify(bill);
    var now = new Date().toISOString();

    // Update items if provided
    if (payload.items && Array.isArray(payload.items)) {
      // Remove old items
      var allItems = SheetRepoModule.getAllRows(BILL_ITEMS_SHEET);
      allItems.forEach(function (it) {
        if (it.billId === bill.id) {
          SheetRepoModule.deleteRow(BILL_ITEMS_SHEET, it.id);
        }
      });

      var newTotal = 0;
      payload.items.forEach(function (item, index) {
        var amt = parseFloat(item.amount) || 0;
        newTotal += amt;
        SheetRepoModule.insertRow(BILL_ITEMS_SHEET, {
          id: 'BIT-' + Date.now() + '-' + index,
          billId: bill.id,
          enquiryId: item.enquiryId || '',
          description: item.description || 'Line Item',
          amount: amt,
          sortOrder: index + 1,
          createdAt: now,
          updatedAt: now
        });
      });

      bill.totalAmount = newTotal;
    }

    if (payload.remarks !== undefined) bill.remarks = payload.remarks;
    bill.billingDate = newDate;
    bill.updatedAt = now;

    SheetRepoModule.updateRow(BILLS_SHEET, bill.id, bill);
    AuditModule.writeAuditLog('bills', bill.id, 'UPDATE_PROCESSED_BILL', oldValue, JSON.stringify(bill));

    return getBill(bill.id);
  }

  /**
   * Helper to retrieve raw bill row
   */
  function getBillRecord(id) {
    var rows = SheetRepoModule.getAllRows(BILLS_SHEET);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id && !rows[i].deletedAt) return rows[i];
    }
    return null;
  }

  /**
   * Retrieves full bill details (bill, line items, linked enquiries)
   */
  function getBill(id) {
    var bill = getBillRecord(id);
    if (!bill) throw new Error('Bill not found: ' + id);

    var items = SheetRepoModule.getAllRows(BILL_ITEMS_SHEET).filter(function (it) {
      return it.billId === id;
    });

    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET).filter(function (e) {
      return e.billId === id && !e.deletedAt;
    });

    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyName = (companies.find(function (c) { return c.id === bill.companyId; }) || {}).name || bill.companyId;
    var clientName = (clients.find(function (c) { return c.id === bill.clientId; }) || {}).name || bill.clientId;

    return {
      id: bill.id,
      billNumber: bill.billNumber || '',
      billSeq: parseInt(bill.billSeq, 10) || 0,
      financialYear: bill.financialYear || '',
      status: bill.status || 'DRAFT',
      billingDate: bill.billingDate || '',
      companyId: bill.companyId || '',
      companyName: companyName,
      clientId: bill.clientId || '',
      clientName: clientName,
      totalAmount: parseFloat(bill.totalAmount) || 0,
      remarks: bill.remarks || '',
      processedAt: bill.processedAt || '',
      createdAt: bill.createdAt || '',
      updatedAt: bill.updatedAt || '',
      items: items,
      enquiries: enquiries
    };
  }

  /**
   * Lists bills with search, pagination, and multi-filters
   */
  function listBills(params) {
    params = params || {};
    var bills = SheetRepoModule.getAllRows(BILLS_SHEET).filter(function (b) { return !b.deletedAt; });
    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });

    // Filters
    if (params.status) {
      bills = bills.filter(function (b) { return (b.status || '').toUpperCase() === String(params.status).toUpperCase(); });
    }
    if (params.financialYear) {
      bills = bills.filter(function (b) { return b.financialYear === params.financialYear; });
    }
    if (params.companyId) {
      bills = bills.filter(function (b) { return b.companyId === params.companyId; });
    }
    if (params.clientId) {
      bills = bills.filter(function (b) { return b.clientId === params.clientId; });
    }
    if (params.search) {
      var q = String(params.search).toLowerCase();
      bills = bills.filter(function (b) {
        return (
          (b.billNumber || '').toLowerCase().indexOf(q) !== -1 ||
          (b.id || '').toLowerCase().indexOf(q) !== -1 ||
          (companyMap[b.companyId] || '').toLowerCase().indexOf(q) !== -1 ||
          (clientMap[b.clientId] || '').toLowerCase().indexOf(q) !== -1
        );
      });
    }

    // Sort newest first
    bills.sort(function (a, b) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    // Aggregate totals
    var grandTotal = 0;
    bills.forEach(function (b) { grandTotal += parseFloat(b.totalAmount) || 0; });

    // Pagination
    var page = parseInt(params.page, 10) || 1;
    var limit = parseInt(params.limit, 10) || 20;
    var total = bills.length;
    var startIndex = (page - 1) * limit;
    var paginated = bills.slice(startIndex, startIndex + limit);

    var items = paginated.map(function (b) {
      return {
        id: b.id,
        billNumber: b.billNumber || 'DRAFT',
        billSeq: parseInt(b.billSeq, 10) || 0,
        financialYear: b.financialYear || '',
        status: b.status || 'DRAFT',
        billingDate: b.billingDate || '',
        companyId: b.companyId || '',
        companyName: companyMap[b.companyId] || b.companyId || '',
        clientId: b.clientId || '',
        clientName: clientMap[b.clientId] || b.clientId || '',
        totalAmount: parseFloat(b.totalAmount) || 0,
        remarks: b.remarks || '',
        processedAt: b.processedAt || '',
        createdAt: b.createdAt || ''
      };
    });

    return {
      items: items,
      total: total,
      grandTotal: grandTotal,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  return {
    listPending: listPending,
    createBill: createBill,
    deleteDraft: deleteDraft,
    processBill: processBill,
    updateProcessed: updateProcessed,
    getBill: getBill,
    listBills: listBills
  };
})();

if (typeof module !== 'undefined') {
  module.exports = BillingModule;
}
