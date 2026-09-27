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
    if (d instanceof Date) {
      if (isNaN(d.getTime())) return '';
      var year = d.getFullYear();
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return year + '-' + month + '-' + day;
    }
    var s = String(d).trim();
    if (s.indexOf('T') !== -1) return s.substring(0, 10);
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
    var m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      var day = ('0' + m[1]).slice(-2);
      var month = ('0' + m[2]).slice(-2);
      var year = m[3];
      return year + '-' + month + '-' + day;
    }
    try {
      var dateObj = new Date(s);
      if (!isNaN(dateObj.getTime())) {
        var year = dateObj.getFullYear();
        var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        var day = ('0' + dateObj.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
      }
    } catch (e) {}
    return s.length >= 10 ? s.substring(0, 10) : s;
  }

  function formatDateDisplay(d) {
    var iso = formatDateISO(d);
    if (!iso || iso.length < 10) return String(d || '');
    var parts = iso.split('-');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return iso;
  }

  /**
   * Daily Report — Calculates key metrics & detail tables for a single date or all active records
   */
  function getDailyReport(params) {
    params = params || {};
    var targetDate = formatDateISO(params.date || new Date());
    var isViewAll = String(params.all).toLowerCase() === 'true' || params.view === 'all';

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

    // 1. Enquiries created or booked on targetDate
    var todayEnquiries = enquiries.filter(function (e) {
      var cDate = formatDateISO(e.createdAt);
      var bDate = formatDateISO(e.bookingDate);
      var dDate = formatDateISO(e.date);
      return cDate === targetDate || bDate === targetDate || dDate === targetDate;
    });

    // 2. Completed jobs today
    var todayCompleted = enquiries.filter(function (e) {
      var stage = (e.stage || '').toUpperCase();
      var isCompletedStage = (stage === 'COMPLETED' || stage === 'BILLING' || stage === 'PROCESSED');
      var compDate = formatDateISO(e.completedAt || e.updatedAt);
      return isCompletedStage && (compDate === targetDate || isViewAll);
    });

    // 3. Pending jobs (active before COMPLETED)
    var todayPending = enquiries.filter(function (e) {
      var stage = (e.stage || '').toUpperCase();
      return stage !== 'COMPLETED' && stage !== 'BILLING' && stage !== 'PROCESSED';
    });

    // 4. Bills processed today
    var todayBills = bills.filter(function (b) {
      var procDate = formatDateISO(b.processedAt || b.billingDate);
      return b.status === 'PROCESSED' && (procDate === targetDate || isViewAll);
    });

    var totalBillingToday = 0;
    todayBills.forEach(function (b) {
      totalBillingToday += parseFloat(b.totalAmount) || 0;
    });

    // 5. Total Expenses today (loading + general)
    var todayLoadingExpTotal = 0;
    loadingExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === targetDate || isViewAll) {
        todayLoadingExpTotal += parseFloat(x.amount) || 0;
      }
    });

    var todayGeneralExpTotal = 0;
    generalExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === targetDate || isViewAll) {
        todayGeneralExpTotal += parseFloat(x.amount) || 0;
      }
    });

    var totalExpensesToday = todayLoadingExpTotal + todayGeneralExpTotal;

    var movements = SheetRepoModule.getAllRows('movements').filter(function (m) { return !m.deletedAt; });
    var movMap = {};
    movements.forEach(function (m) { movMap[m.enquiryId] = m; });
    var vehicleMap = {};
    SheetRepoModule.getAllRows('vehicles').forEach(function (v) { vehicleMap[v.id] = v.vehicleNumber; });
    var driverMap = {};
    SheetRepoModule.getAllRows('drivers').forEach(function (d) { driverMap[d.id] = d.phone || d.name; });
    var containerMap = {};
    SheetRepoModule.getAllRows('containers').forEach(function (c) { containerMap[c.id] = c; });
    var billMap = {};
    bills.forEach(function (b) { billMap[b.id] = b.billNumber; });

    // If specific target date has 0 direct entries and view was not explicitly restricted,
    // display all active and recent enquiries so the daily operational console is always fully populated.
    var displayEnquiries = (isViewAll || todayEnquiries.length === 0) ? enquiries : todayEnquiries;

    var enquiriesDetail = displayEnquiries.map(function (e) {
      var mov = movMap[e.id] || {};
      var conObj = containerMap[e.containerId] || {};
      return {
        id: e.id,
        creationDate: formatDateDisplay(e.createdAt || e.date),
        bookingDate: formatDateDisplay(e.bookingDate || e.date || e.createdAt),
        companyName: companyMap[e.companyId] || e.companyId || '',
        loadingType: e.loadingType || 'Import',
        clientName: clientMap[e.clientId] || e.clientId || '',
        billingNumber: billMap[e.billId] || e.billNumber || e.billId || '',
        bookingNumber: e.bookingNumber || e.transactionNo || e.transactionNumber || e.id || '',
        feet: e.containerSize || conObj.containerType || '40 FT',
        containerNumber: conObj.containerNumber || e.containerNo || e.containerNumber || '',
        sealNumber: e.sealNumber || '',
        vehicleNumber: vehicleMap[e.vehicleId] || e.vehicleNo || e.vehicleNumber || '',
        driverNumber: driverMap[e.driverId] || e.driverPhone || e.driverInfo || '',
        diesel: parseFloat(e.dieselAmount) || 0,
        advance: parseFloat(e.advanceAmount) || 0,
        companyIn: mov.companyInTime || '',
        companyOut: mov.companyOutTime || '',
        printIn: mov.printInTime || '',
        printOut: mov.printOutTime || '',
        portIn: mov.portInTime || '',
        portOut: mov.portOutTime || '',
        movementStatus: mov.movementStatus || 'NOT_MOVED',
        shippingStatus: mov.shippingStatus || 'PENDING',
        comments: e.comments || e.remarks || '',
        transactionNo: e.transactionNo || e.transactionNumber || '',
        vehicleNo: vehicleMap[e.vehicleId] || e.vehicleNo || e.vehicleNumber || '',
        containerNo: conObj.containerNumber || e.containerNo || e.containerNumber || '',
        stage: e.stage || 'ENQUIRY_CREATED',
        freightAmount: parseFloat(e.freightAmount) || 0
      };
    });

    var billsDetail = (isViewAll ? bills : todayBills).map(function (b) {
      return {
        id: b.id,
        billNumber: b.billNumber || '',
        companyName: companyMap[b.companyId] || b.companyId || '',
        clientName: clientMap[b.clientId] || b.clientId || '',
        totalAmount: parseFloat(b.totalAmount) || 0,
        paidAmount: parseFloat(b.paidAmount) || 0,
        pendingAmount: parseFloat(b.pendingAmount) || 0,
        paymentStatus: b.paymentStatus || 'UNPAID',
        billingDate: formatDateDisplay(b.billingDate) || ''
      };
    });

    return {
      date: targetDate,
      displayDate: formatDateDisplay(targetDate),
      isShowingAll: (isViewAll || todayEnquiries.length === 0),
      totalEnquiries: todayEnquiries.length > 0 ? todayEnquiries.length : enquiries.length,
      completedJobs: todayCompleted.length,
      pendingJobs: todayPending.length,
      billsGenerated: todayBills.length > 0 ? todayBills.length : bills.length,
      totalBilling: totalBillingToday > 0 ? totalBillingToday : bills.reduce(function (sum, b) { return sum + (parseFloat(b.totalAmount) || 0); }, 0),
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
