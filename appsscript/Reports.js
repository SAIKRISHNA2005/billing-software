/**
 * Transport & Logistics Management System (TMS)
 * Phase 16 — Reports Backend Module
 */

var ReportsModule = (function () {
  var ENQUIRIES_SHEET = 'enquiries';
  var BILLS_SHEET = 'bills';
  var LOADING_EXPENSES_SHEET = 'loading_expenses';
  var GENERAL_EXPENSES_SHEET = 'general_expenses';

  /**
   * Helper to normalize date string to YYYY-MM-DD
   */
  function formatDateISO(d) {
    if (!d) return '';
    if (typeof d === 'string') {
      if (d.indexOf('T') !== -1) return d.substring(0, 10);
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
    }
    try {
      var dateObj = new Date(d);
      var year = dateObj.getFullYear();
      var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
      var day = ('0' + dateObj.getDate()).slice(-2);
      return year + '-' + month + '-' + day;
    } catch (e) {
      return String(d).substring(0, 10);
    }
  }

  /**
   * Daily Report — Calculates key metrics & detail tables for a single date
   */
  function getDailyReport(params) {
    params = params || {};
    var targetDate = formatDateISO(params.date || new Date());

    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET).filter(function (e) { return !e.deletedAt; });
    var bills = SheetRepoModule.getAllRows(BILLS_SHEET).filter(function (b) { return !b.deletedAt; });
    var loadingExps = SheetRepoModule.getAllRows(LOADING_EXPENSES_SHEET).filter(function (x) { return !x.deletedAt; });
    var generalExps = SheetRepoModule.getAllRows(GENERAL_EXPENSES_SHEET).filter(function (x) { return !x.deletedAt; });

    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });

    // 1. Enquiries created today
    var todayEnquiries = enquiries.filter(function (e) {
      return formatDateISO(e.createdAt) === targetDate;
    });

    // 2. Completed jobs today
    var todayCompleted = enquiries.filter(function (e) {
      var stage = (e.stage || '').toUpperCase();
      var isCompletedStage = (stage === 'COMPLETED' || stage === 'BILLING' || stage === 'PROCESSED');
      var compDate = formatDateISO(e.completedAt || e.updatedAt);
      return isCompletedStage && compDate === targetDate;
    });

    // 3. Pending jobs (active before COMPLETED)
    var todayPending = enquiries.filter(function (e) {
      var stage = (e.stage || '').toUpperCase();
      return stage !== 'COMPLETED' && stage !== 'BILLING' && stage !== 'PROCESSED';
    });

    // 4. Bills processed today
    var todayBills = bills.filter(function (b) {
      var procDate = formatDateISO(b.processedAt || b.billingDate);
      return b.status === 'PROCESSED' && procDate === targetDate;
    });

    var totalBillingToday = 0;
    todayBills.forEach(function (b) {
      totalBillingToday += parseFloat(b.totalAmount) || 0;
    });

    // 5. Total Expenses today (loading + general)
    var todayLoadingExpTotal = 0;
    loadingExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === targetDate) {
        todayLoadingExpTotal += parseFloat(x.amount) || 0;
      }
    });

    var todayGeneralExpTotal = 0;
    generalExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === targetDate) {
        todayGeneralExpTotal += parseFloat(x.amount) || 0;
      }
    });

    var totalExpensesToday = todayLoadingExpTotal + todayGeneralExpTotal;

    var enquiriesDetail = todayEnquiries.map(function (e) {
      return {
        id: e.id,
        transactionNo: e.transactionNo || '',
        companyName: companyMap[e.companyId] || e.companyId || '',
        clientName: clientMap[e.clientId] || e.clientId || '',
        vehicleNo: e.vehicleNo || '',
        containerNo: e.containerNo || '',
        stage: e.stage || 'ENQUIRY_CREATED',
        freightAmount: parseFloat(e.freightAmount) || 0
      };
    });

    var billsDetail = todayBills.map(function (b) {
      return {
        id: b.id,
        billNumber: b.billNumber || '',
        companyName: companyMap[b.companyId] || b.companyId || '',
        clientName: clientMap[b.clientId] || b.clientId || '',
        totalAmount: parseFloat(b.totalAmount) || 0,
        billingDate: b.billingDate || ''
      };
    });

    return {
      date: targetDate,
      totalEnquiries: todayEnquiries.length,
      completedJobs: todayCompleted.length,
      pendingJobs: todayPending.length,
      billsGenerated: todayBills.length,
      totalBilling: totalBillingToday,
      totalExpenses: totalExpensesToday,
      loadingExpensesTotal: todayLoadingExpTotal,
      generalExpensesTotal: todayGeneralExpTotal,
      enquiriesDetail: enquiriesDetail,
      billsDetail: billsDetail
    };
  }

  /**
   * Company-wise Report — Aggregates trips, completed, pending, and total billing per company
   */
  function getCompanyReport(params) {
    params = params || {};
    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET).filter(function (e) { return !e.deletedAt; });
    var bills = SheetRepoModule.getAllRows(BILLS_SHEET).filter(function (b) { return !b.deletedAt; });
    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });

    // Filter enquiries by date range, company, client, loadingType, stage
    if (params.companyId) {
      enquiries = enquiries.filter(function (e) { return e.companyId === params.companyId; });
    }
    if (params.clientId) {
      enquiries = enquiries.filter(function (e) { return e.clientId === params.clientId; });
    }
    if (params.loadingType) {
      enquiries = enquiries.filter(function (e) { return (e.loadingType || '').toUpperCase() === String(params.loadingType).toUpperCase(); });
    }
    if (params.stage) {
      enquiries = enquiries.filter(function (e) { return (e.stage || '').toUpperCase() === String(params.stage).toUpperCase(); });
    }
    if (params.dateFrom) {
      enquiries = enquiries.filter(function (e) { return formatDateISO(e.createdAt) >= params.dateFrom; });
    }
    if (params.dateTo) {
      enquiries = enquiries.filter(function (e) { return formatDateISO(e.createdAt) <= params.dateTo; });
    }

    // Group billing by companyId
    var companyBillingMap = {};
    bills.forEach(function (b) {
      if (b.status === 'PROCESSED') {
        var cid = b.companyId || 'UNKNOWN';
        companyBillingMap[cid] = (companyBillingMap[cid] || 0) + (parseFloat(b.totalAmount) || 0);
      }
    });

    // Group enquiries by companyId
    var companyGroups = {};
    enquiries.forEach(function (e) {
      var cid = e.companyId || 'UNKNOWN';
      if (!companyGroups[cid]) {
        companyGroups[cid] = {
          companyId: cid,
          companyName: companyMap[cid] || cid,
          totalTrips: 0,
          completedTrips: 0,
          pendingTrips: 0,
          totalBilling: 0,
          trips: []
        };
      }

      companyGroups[cid].totalTrips += 1;
      var stage = (e.stage || '').toUpperCase();
      if (stage === 'COMPLETED' || stage === 'BILLING' || stage === 'PROCESSED') {
        companyGroups[cid].completedTrips += 1;
      } else {
        companyGroups[cid].pendingTrips += 1;
      }

      companyGroups[cid].trips.push(e);
    });

    // Format output list
    var items = [];
    var grandTotalTrips = 0;
    var grandTotalCompleted = 0;
    var grandTotalPending = 0;
    var grandTotalBilling = 0;

    Object.keys(companyGroups).forEach(function (cid) {
      var group = companyGroups[cid];
      group.totalBilling = companyBillingMap[cid] || 0;

      grandTotalTrips += group.totalTrips;
      grandTotalCompleted += group.completedTrips;
      grandTotalPending += group.pendingTrips;
      grandTotalBilling += group.totalBilling;

      items.push(group);
    });

    // Sort by total trips descending
    items.sort(function (a, b) { return b.totalTrips - a.totalTrips; });

    return {
      items: items,
      totals: {
        totalTrips: grandTotalTrips,
        completedTrips: grandTotalCompleted,
        pendingTrips: grandTotalPending,
        totalBilling: grandTotalBilling
      }
    };
  }

  /**
   * Billing Summary Report — Aggregates processed bills with company/client/FY filters
   */
  function getBillingReport(params) {
    params = params || {};
    var bills = SheetRepoModule.getAllRows(BILLS_SHEET).filter(function (b) { return !b.deletedAt; });
    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });

    // Apply filters
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
    if (params.dateFrom) {
      bills = bills.filter(function (b) { return formatDateISO(b.billingDate || b.createdAt) >= params.dateFrom; });
    }
    if (params.dateTo) {
      bills = bills.filter(function (b) { return formatDateISO(b.billingDate || b.createdAt) <= params.dateTo; });
    }

    var totalBilled = 0;
    var processedCount = 0;
    var draftCount = 0;

    var items = bills.map(function (b) {
      var amt = parseFloat(b.totalAmount) || 0;
      totalBilled += amt;

      if (b.status === 'PROCESSED') processedCount++;
      else draftCount++;

      return {
        id: b.id,
        billNumber: b.billNumber || 'DRAFT',
        financialYear: b.financialYear || '-',
        billingDate: b.billingDate || '',
        companyName: companyMap[b.companyId] || b.companyId || '',
        clientName: clientMap[b.clientId] || b.clientId || '',
        status: b.status || 'DRAFT',
        totalAmount: amt,
        paidAmount: 0, // Placeholder for Phase 15 payments
        balanceAmount: amt
      };
    });

    return {
      items: items,
      totals: {
        totalBills: bills.length,
        processedCount: processedCount,
        draftCount: draftCount,
        totalBilled: totalBilled,
        totalPaid: 0,
        totalBalance: totalBilled
      }
    };
  }

  return {
    getDailyReport: getDailyReport,
    getCompanyReport: getCompanyReport,
    getBillingReport: getBillingReport
  };
})();

if (typeof module !== 'undefined') {
  module.exports = ReportsModule;
}
