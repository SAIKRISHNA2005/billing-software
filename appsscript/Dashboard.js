/**
 * Transport & Logistics Management System (TMS)
 * Phase 18 — Executive Dashboard Backend Module
 */

var DashboardModule = (function () {
  var ENQUIRIES_SHEET = 'enquiries';
  var BILLS_SHEET = 'bills';
  var LOADING_EXPENSES_SHEET = 'loading_expenses';
  var GENERAL_EXPENSES_SHEET = 'general_expenses';
  var VENDORS_SHEET = 'vendors';
  var VENDOR_PAYMENTS_SHEET = 'vendor_payments';

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
   * Calculates dashboard summary KPIs, charts data, and recent bills
   */
  function getDashboardSummary() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('TMS_DASHBOARD_SUMMARY');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Cache miss/parse fallback
      }
    }

    var todayStr = formatDateISO(new Date());

    var enquiries = SheetRepoModule.getAllRows(ENQUIRIES_SHEET).filter(function (e) { return !e.deletedAt; });
    var bills = SheetRepoModule.getAllRows(BILLS_SHEET).filter(function (b) { return !b.deletedAt; });
    var loadingExps = SheetRepoModule.getAllRows(LOADING_EXPENSES_SHEET).filter(function (x) { return !x.deletedAt; });
    var generalExps = SheetRepoModule.getAllRows(GENERAL_EXPENSES_SHEET).filter(function (x) { return !x.deletedAt; });
    var vendors = SheetRepoModule.getAllRows(VENDORS_SHEET).filter(function (v) { return !v.deletedAt; });
    var vendorPayments = SheetRepoModule.getAllRows(VENDOR_PAYMENTS_SHEET).filter(function (vp) { return !vp.deletedAt; });

    var companies = SheetRepoModule.getAllRows('companies');
    var clients = SheetRepoModule.getAllRows('clients');

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });

    // 1. Today's Trips count
    var todaysTripsCount = enquiries.filter(function (e) {
      return formatDateISO(e.createdAt) === todayStr || formatDateISO(e.updatedAt) === todayStr;
    }).length;

    // 2. Today's Enquiries created count
    var todaysEnquiriesCount = enquiries.filter(function (e) {
      return formatDateISO(e.createdAt) === todayStr;
    }).length;

    // 3. Pending Bills count & suggested total
    var unbilledCompleted = enquiries.filter(function (e) {
      var stage = (e.stage || '').toUpperCase();
      return stage === 'COMPLETED' && (!e.billId || e.billId === '');
    });
    var pendingBillsCount = unbilledCompleted.length;
    var pendingBillsAmount = 0;
    unbilledCompleted.forEach(function (e) {
      pendingBillsAmount += (parseFloat(e.freightAmount) || 0) + (parseFloat(e.haltingAmount) || 0);
    });

    // 4. Today's Processed Bills count & Today's Revenue
    var todaysProcessedBills = bills.filter(function (b) {
      return b.status === 'PROCESSED' && formatDateISO(b.processedAt || b.billingDate) === todayStr;
    });
    var todaysRevenue = 0;
    todaysProcessedBills.forEach(function (b) {
      todaysRevenue += parseFloat(b.totalAmount) || 0;
    });

    // 5. Today's Expenses (loading + general)
    var todaysExpenses = 0;
    loadingExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === todayStr) {
        todaysExpenses += parseFloat(x.amount) || 0;
      }
    });
    generalExps.forEach(function (x) {
      if (formatDateISO(x.expenseDate || x.createdAt) === todayStr) {
        todaysExpenses += parseFloat(x.amount) || 0;
      }
    });

    // 6. Pending Vendor Payments across all vendors
    var vendorPaymentsMap = {};
    vendorPayments.forEach(function (vp) {
      var vid = vp.vendorId;
      vendorPaymentsMap[vid] = (vendorPaymentsMap[vid] || 0) + (parseFloat(vp.amount) || 0);
    });

    var totalVendorPending = 0;
    vendors.forEach(function (v) {
      var vendorEnquiries = enquiries.filter(function (e) { return e.vendorId === v.id; });
      var totalPayable = 0;
      vendorEnquiries.forEach(function (e) {
        totalPayable += (parseFloat(e.advanceAmount) || 0) +
                        (parseFloat(e.extraAdvance) || 0) +
                        (parseFloat(e.dieselAmount) || 0) +
                        (parseFloat(e.haltingAmount) || 0) +
                        (parseFloat(e.bonus) || 0);
      });
      var paid = vendorPaymentsMap[v.id] || 0;
      var pending = totalPayable - paid;
      if (pending > 0) totalVendorPending += pending;
    });

    // 7. Company-wise Billing chart data (current FY)
    var currentFY = FinancialYearModule.getFinancialYear(new Date());
    var companyBillingChart = {};
    bills.forEach(function (b) {
      if (b.status === 'PROCESSED' && b.financialYear === currentFY) {
        var cName = companyMap[b.companyId] || b.companyId || 'Other';
        companyBillingChart[cName] = (companyBillingChart[cName] || 0) + (parseFloat(b.totalAmount) || 0);
      }
    });

    var chartItems = Object.keys(companyBillingChart).map(function (cName) {
      return { companyName: cName, totalBilling: companyBillingChart[cName] };
    });

    // 8. Recent 10 processed bills
    var processedBills = bills.filter(function (b) { return b.status === 'PROCESSED'; });
    processedBills.sort(function (a, b) {
      return (b.processedAt || b.createdAt || '').localeCompare(a.processedAt || a.createdAt || '');
    });
    var recentBills = processedBills.slice(0, 10).map(function (b) {
      return {
        id: b.id,
        billNumber: b.billNumber,
        companyName: companyMap[b.companyId] || b.companyId,
        clientName: clientMap[b.clientId] || b.clientId,
        totalAmount: parseFloat(b.totalAmount) || 0,
        billingDate: b.billingDate
      };
    });

    var summary = {
      todaysTrips: todaysTripsCount,
      todaysEnquiries: todaysEnquiriesCount,
      pendingBillsCount: pendingBillsCount,
      pendingBillsAmount: pendingBillsAmount,
      processedBillsTodayCount: todaysProcessedBills.length,
      todaysRevenue: todaysRevenue,
      todaysExpenses: todaysExpenses,
      pendingVendorPayments: totalVendorPending,
      currentFinancialYear: currentFY,
      companyBillingChart: chartItems,
      recentBills: recentBills
    };

    // Cache summary for 10 seconds
    try {
      cache.put('TMS_DASHBOARD_SUMMARY', JSON.stringify(summary), 10);
    } catch (e) {}

    return summary;
  }

  return {
    getDashboardSummary: getDashboardSummary
  };
})();

if (typeof module !== 'undefined') {
  module.exports = DashboardModule;
}
