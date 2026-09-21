/**
 * Transport & Logistics Management System (TMS)
 * Phase 6 - Enquiry Logic Module (Enquiry.js)
 * STRICT RULES: R7 (Session), R13 (LockService on numbering), R14 (Batch reads/writes), D1, D2, D7, D8, D12, D13.
 */

const EnquiryModule = {
  STAGES: [
    'ENQUIRY_CREATED',
    'VEHICLE_ASSIGNED',
    'CONTAINER_MOVEMENT',
    'PORT_MOVEMENT',
    'COMPLETED',
    'BILLING',
    'PROCESSED',
  ],

  /**
   * Generates next Enquiry ID (sequential integer) and Transaction Number (TXN/YYYY-YY/00001)
   * under LockService to prevent race conditions.
   */
  _getNextNumbers() {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // 30s timeout

    try {
      const now = new Date().toISOString();
      const currentFy = getFinancialYear();
      const seqSheet = SheetRepo.getSheet('number_sequences');
      const allSequences = SheetRepo.getAllRows('number_sequences', true);

      // 1. Resolve Enquiry Sequential Number
      let enquirySeqRow = allSequences.find((s) => s.sequenceKey === 'enquiry');
      let nextEnquiryNum;

      if (enquirySeqRow) {
        nextEnquiryNum = parseInt(enquirySeqRow.currentValue, 10) + 1;
        SheetRepo.updateRow('number_sequences', 'enquiry', {
          currentValue: nextEnquiryNum,
          updatedAt: now,
        });
      } else {
        // Check app_settings for initial start number
        const settings = SheetRepo.getRowById('app_settings', 'DEFAULT');
        const startNumber = settings && settings.enquiryStartNumber ? parseInt(settings.enquiryStartNumber, 10) : 10001;
        nextEnquiryNum = startNumber;
        SheetRepo.insertRow('number_sequences', {
          sequenceKey: 'enquiry',
          financialYear: 'ALL',
          currentValue: nextEnquiryNum,
          updatedAt: now,
        });
      }

      // 2. Resolve Transaction Number for current FY
      const txnKey = 'txn_' + currentFy;
      let txnSeqRow = allSequences.find((s) => s.sequenceKey === txnKey);
      let nextTxnNum;

      if (txnSeqRow) {
        nextTxnNum = parseInt(txnSeqRow.currentValue, 10) + 1;
        SheetRepo.updateRow('number_sequences', txnKey, {
          currentValue: nextTxnNum,
          updatedAt: now,
        });
      } else {
        nextTxnNum = 1;
        SheetRepo.insertRow('number_sequences', {
          sequenceKey: txnKey,
          financialYear: currentFy,
          currentValue: nextTxnNum,
          updatedAt: now,
        });
      }

      const paddedTxn = ('00000' + nextTxnNum).slice(-5);
      const transactionNumber = 'TXN/' + currentFy + '/' + paddedTxn;

      return {
        enquiryNumber: nextEnquiryNum,
        transactionNumber,
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Find-or-create Vehicle (D12: Uppercase alphanumeric)
   */
  _resolveVehicle(input, vendorId, sessionUserId) {
    if (!input || !String(input).trim()) return null;
    const str = String(input).trim();

    // Check if ID
    const byId = SheetRepo.getRowById('vehicles', str);
    if (byId) return byId;

    // Clean format
    const cleaned = str.replace(/[\s-]/g, '').toUpperCase();
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    if (!regex.test(cleaned)) {
      throw new Error('Invalid vehicle number format: "' + str + '". Expected standard uppercase format like TN04AB1234.');
    }

    const allVehicles = SheetRepo.getAllRows('vehicles', false);
    const existing = allVehicles.find((v) => v.vehicleNumber === cleaned);
    if (existing) return existing;

    // Auto-create new vehicle
    const newVehicle = {
      id: 'VEH-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      vehicleNumber: cleaned,
      vehicleType: '40ft Flatbed Trailer',
      vendorId: vendorId || '',
      active: true,
    };
    const created = SheetRepo.insertRow('vehicles', newVehicle, sessionUserId);
    writeAuditLog('vehicles', created.id, 'CREATE', null, created, sessionUserId);
    return created;
  },

  /**
   * Find-or-create Driver (D12: 10-digit mobile starting with 6-9)
   */
  _resolveDriver(input, phoneInput, sessionUserId) {
    if (!input || !String(input).trim()) return null;
    const str = String(input).trim();

    // Check if ID
    const byId = SheetRepo.getRowById('drivers', str);
    if (byId) return byId;

    const phoneStr = phoneInput ? String(phoneInput).replace(/[\s-]/g, '') : str.replace(/[\s-]/g, '');
    const phoneRegex = /^[6-9]\d{9}$/;

    const allDrivers = SheetRepo.getAllRows('drivers', false);
    const existing = allDrivers.find((d) => d.phone === phoneStr || d.name.toLowerCase() === str.toLowerCase());
    if (existing) return existing;

    if (!phoneRegex.test(phoneStr)) {
      throw new Error('Invalid driver phone number: "' + phoneStr + '". Must be a valid 10-digit Indian mobile number.');
    }

    // Auto-create driver
    const newDriver = {
      id: 'DRV-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      name: str.length > 10 && isNaN(Number(str)) ? str : 'Driver ' + phoneStr.slice(-4),
      phone: phoneStr,
      licenseNumber: '',
      active: true,
    };
    const created = SheetRepo.insertRow('drivers', newDriver, sessionUserId);
    writeAuditLog('drivers', created.id, 'CREATE', null, created, sessionUserId);
    return created;
  },

  /**
   * Find-or-create Container (D12: 4 uppercase letters + 7 digits)
   */
  _resolveContainer(input, containerType, sessionUserId) {
    if (!input || !String(input).trim()) return null;
    const str = String(input).trim();

    // Check if ID
    const byId = SheetRepo.getRowById('containers', str);
    if (byId) return byId;

    const cleaned = str.replace(/[\s-]/g, '').toUpperCase();
    const regex = /^[A-Z]{4}[0-9]{7}$/;
    if (!regex.test(cleaned)) {
      throw new Error('Invalid container number format: "' + str + '". Expected 4 uppercase letters followed by 7 digits (e.g. MSCU1234567).');
    }

    const allContainers = SheetRepo.getAllRows('containers', false);
    const existing = allContainers.find((c) => c.containerNumber === cleaned);
    if (existing) return existing;

    // Auto-create container
    const newContainer = {
      id: 'CON-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      containerNumber: cleaned,
      containerType: containerType || '40ft Standard',
    };
    const created = SheetRepo.insertRow('containers', newContainer, sessionUserId);
    writeAuditLog('containers', created.id, 'CREATE', null, created, sessionUserId);
    return created;
  },

  /**
   * Parses various timestamp formats into milliseconds epoch for validation
   */
  _parseTime(val) {
    if (!val) return null;
    if (val instanceof Date) return val.getTime();

    const str = String(val).trim();
    // Try DD-MM-YYYY hh:mm A or DD-MM-YYYY HH:mm
    const customMatch = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
    if (customMatch) {
      const d = parseInt(customMatch[1], 10);
      const m = parseInt(customMatch[2], 10) - 1;
      const y = parseInt(customMatch[3], 10);
      let hh = customMatch[4] ? parseInt(customMatch[4], 10) : 0;
      const mm = customMatch[5] ? parseInt(customMatch[5], 10) : 0;
      const ss = customMatch[6] ? parseInt(customMatch[6], 10) : 0;
      const ampm = customMatch[7] ? customMatch[7].toUpperCase() : null;

      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;

      return new Date(y, m, d, hh, mm, ss).getTime();
    }

    const parsed = Date.parse(str);
    return isNaN(parsed) ? null : parsed;
  },

  /**
   * Action: "enquiry.create"
   * Atomic dual-sheet write (enquiries + movements) with compensatory rollback.
   */
  create(data, sessionToken) {
    const session = requireSession(sessionToken);
    if (!data) throw new Error('Enquiry payload is required.');

    // 1. Validation of required basic fields
    if (!data.companyId) throw new Error('Company is required.');
    if (!data.clientId) throw new Error('Client is required.');
    if (!data.loadingType || !['Import', 'Export'].includes(data.loadingType)) {
      throw new Error('Loading Type must be either "Import" or "Export".');
    }

    // Verify company and client existence
    const company = SheetRepo.getRowById('companies', data.companyId);
    if (!company) throw new Error('Referenced company ID "' + data.companyId + '" does not exist.');
    const client = SheetRepo.getRowById('clients', data.clientId);
    if (!client) throw new Error('Referenced client ID "' + data.clientId + '" does not exist.');

    // 2. Resolve assets (find-or-create)
    const vehicleObj = this._resolveVehicle(data.vehicleNumber || data.vehicleId, data.vendorId, session.userId);
    const driverObj = this._resolveDriver(data.driverName || data.driverId, data.driverPhone, session.userId);
    const containerObj = this._resolveContainer(data.containerNumber || data.containerId, data.containerType, session.userId);

    // 3. Acquire lock and generate sequential numbers
    const { enquiryNumber, transactionNumber } = this._getNextNumbers();
    const enquiryId = 'ENQ-' + enquiryNumber;

    const now = new Date();
    const dateFormatted = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');

    // 4. Construct Enquiry Record
    const enquiryRecord = {
      id: enquiryId,
      enquiryNumber: enquiryNumber,
      transactionNumber: transactionNumber,
      date: data.date || dateFormatted,
      companyId: data.companyId,
      clientId: data.clientId,
      loadingType: data.loadingType,
      vehicleId: vehicleObj ? vehicleObj.id : '',
      driverId: driverObj ? driverObj.id : '',
      containerId: containerObj ? containerObj.id : '',
      sealNumber: data.sealNumber || '',
      stage: 'ENQUIRY_CREATED',
      vendorId: data.vendorId || (vehicleObj && vehicleObj.vendorId ? vehicleObj.vendorId : ''),
      freightAmount: parseFloat(data.freightAmount) || 0,
      dieselAmount: parseFloat(data.dieselAmount) || 0,
      advanceAmount: parseFloat(data.advanceAmount) || 0,
      extraAdvance: parseFloat(data.extraAdvance) || 0,
      haltingDays: parseInt(data.haltingDays, 10) || 0,
      haltingAmount: parseFloat(data.haltingAmount) || 0,
      bonus: parseFloat(data.bonus) || 0,
      billId: '',
      completedAt: '',
      active: true,
    };

    // 5. Dual-Sheet Atomic Insert with Rollback
    let insertedEnquiry;
    try {
      insertedEnquiry = SheetRepo.insertRow('enquiries', enquiryRecord, session.userId);
    } catch (err) {
      throw new Error('Failed to create enquiry row: ' + err.message);
    }

    let insertedMovement;
    try {
      const movementRecord = {
        id: 'MOV-' + enquiryNumber,
        enquiryId: enquiryId,
        companyInTime: data.companyInTime || '',
        companyOutTime: data.companyOutTime || '',
        printInTime: data.printInTime || '',
        printOutTime: data.printOutTime || '',
        portInTime: data.portInTime || '',
        portOutTime: data.portOutTime || '',
        movementStatus: 'NOT_MOVED',
        shippingStatus: 'PENDING',
      };
      insertedMovement = SheetRepo.insertRow('movements', movementRecord, session.userId);
    } catch (err) {
      // Compensatory Rollback: Delete the enquiry row just created
      try {
        const enqSheet = SheetRepo.getSheet('enquiries');
        const lastRow = enqSheet.getLastRow();
        const dataVals = enqSheet.getRange(1, 1, lastRow, 1).getValues();
        for (let r = dataVals.length - 1; r >= 1; r--) {
          if (String(dataVals[r][0]) === String(enquiryId)) {
            enqSheet.deleteRow(r + 1);
            break;
          }
        }
      } catch (rollbackErr) {
        Logger.log('Critical: Compensatory rollback failed: ' + rollbackErr.message);
      }
      throw new Error('Failed to create linked movement row (enquiry rolled back): ' + err.message);
    }

    // 6. Record Initial Stage History
    SheetRepo.insertRow('stage_history', {
      id: 'STG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      enquiryId: enquiryId,
      fromStage: '',
      toStage: 'ENQUIRY_CREATED',
      direction: 'FORWARD',
      remarks: 'Initial enquiry creation',
      timestamp: now.toISOString(),
    }, session.userId);

    // 7. Audit Log
    writeAuditLog('enquiries', enquiryId, 'CREATE', null, insertedEnquiry, session.userId);

    return {
      enquiry: insertedEnquiry,
      movement: insertedMovement,
      vendorFinance: computeVendorPayable(insertedEnquiry),
    };
  },

  /**
   * Action: "enquiry.list"
   * Reads all enquiries and movements in batched calls; filters and sorts in-memory.
   */
  list(params, sessionToken) {
    requireSession(sessionToken);

    const search = String(params?.search || '').trim().toLowerCase();
    const companyId = params?.companyId;
    const clientId = params?.clientId;
    const stage = params?.stage;
    const vendorId = params?.vendorId;
    const loadingType = params?.loadingType;
    const movementStatus = params?.movementStatus;
    const shippingStatus = params?.shippingStatus;
    const page = Math.max(1, parseInt(params?.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params?.limit || '20', 10)));
    const sortField = params?.sortField || 'enquiryNumber';
    const sortOrder = params?.sortOrder === 'asc' ? 1 : -1; // default newest first

    // Batched single reads
    const enquiries = SheetRepo.getAllRows('enquiries', false);
    const movements = SheetRepo.getAllRows('movements', false);
    const vehicles = SheetRepo.getAllRows('vehicles', true);
    const drivers = SheetRepo.getAllRows('drivers', true);
    const companies = SheetRepo.getAllRows('companies', true);
    const clients = SheetRepo.getAllRows('clients', true);

    const movMap = new Map();
    movements.forEach((m) => movMap.set(m.enquiryId, m));

    const vehMap = new Map();
    vehicles.forEach((v) => vehMap.set(v.id, v.vehicleNumber));

    const drvMap = new Map();
    drivers.forEach((d) => drvMap.set(d.id, d.name + ' (' + d.phone + ')'));

    const cmpMap = new Map();
    companies.forEach((c) => cmpMap.set(c.id, c.name));

    const cliMap = new Map();
    clients.forEach((c) => cliMap.set(c.id, c.name));

    let filtered = enquiries.filter((e) => {
      const mov = movMap.get(e.id);

      if (companyId && e.companyId !== companyId) return false;
      if (clientId && e.clientId !== clientId) return false;
      if (stage && e.stage !== stage) return false;
      if (vendorId && e.vendorId !== vendorId) return false;
      if (loadingType && e.loadingType !== loadingType) return false;
      if (movementStatus && mov && mov.movementStatus !== movementStatus) return false;
      if (shippingStatus && mov && mov.shippingStatus !== shippingStatus) return false;

      if (search) {
        const vehNum = (vehMap.get(e.vehicleId) || '').toLowerCase();
        const drvName = (drvMap.get(e.driverId) || '').toLowerCase();
        const cmpName = (cmpMap.get(e.companyId) || '').toLowerCase();
        const cliName = (cliMap.get(e.clientId) || '').toLowerCase();

        const match =
          String(e.enquiryNumber).includes(search) ||
          String(e.transactionNumber).toLowerCase().includes(search) ||
          String(e.sealNumber).toLowerCase().includes(search) ||
          vehNum.includes(search) ||
          drvName.includes(search) ||
          cmpName.includes(search) ||
          cliName.includes(search);

        if (!match) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA = a[sortField] !== undefined ? a[sortField] : '';
      let valB = b[sortField] !== undefined ? b[sortField] : '';

      if (sortField === 'enquiryNumber') {
        return (parseInt(valA, 10) - parseInt(valB, 10)) * sortOrder;
      }
      if (typeof valA === 'string') {
        return valA.localeCompare(String(valB)) * sortOrder;
      }
      return (valA > valB ? 1 : valA < valB ? -1 : 0) * sortOrder;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const pageItems = filtered.slice(startIndex, startIndex + limit).map((e) => {
      const mov = movMap.get(e.id) || null;
      return {
        ...e,
        movement: mov,
        companyName: cmpMap.get(e.companyId) || e.companyId,
        clientName: cliMap.get(e.clientId) || e.clientId,
        vehicleNumber: vehMap.get(e.vehicleId) || '',
        driverInfo: drvMap.get(e.driverId) || '',
        vendorFinance: computeVendorPayable(e),
      };
    });

    return {
      items: pageItems,
      total,
      page,
      limit,
    };
  },

  /**
   * Action: "enquiry.get"
   * Returns full enquiry details, movement row, stage history, and vendor payable.
   */
  get(id, sessionToken) {
    requireSession(sessionToken);
    if (!id) throw new Error('Enquiry ID is required.');

    const enquiry = SheetRepo.getRowById('enquiries', id);
    if (!enquiry) throw new Error('Enquiry not found with ID: "' + id + '"');

    const movements = SheetRepo.getAllRows('movements', true);
    const movement = movements.find((m) => m.enquiryId === id) || null;

    const allHistory = SheetRepo.getAllRows('stage_history', true);
    const stageHistory = allHistory
      .filter((s) => s.enquiryId === id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const company = SheetRepo.getRowById('companies', enquiry.companyId);
    const client = SheetRepo.getRowById('clients', enquiry.clientId);
    const vendor = enquiry.vendorId ? SheetRepo.getRowById('vendors', enquiry.vendorId) : null;
    const vehicle = enquiry.vehicleId ? SheetRepo.getRowById('vehicles', enquiry.vehicleId) : null;
    const driver = enquiry.driverId ? SheetRepo.getRowById('drivers', enquiry.driverId) : null;
    const container = enquiry.containerId ? SheetRepo.getRowById('containers', enquiry.containerId) : null;

    return {
      enquiry,
      movement,
      stageHistory,
      vendorFinance: computeVendorPayable(enquiry),
      company,
      client,
      vendor,
      vehicle,
      driver,
      container,
    };
  },

  /**
   * Action: "enquiry.update"
   */
  update(id, patch, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Enquiry ID is required.');
    if (!patch) throw new Error('Patch data is required.');

    const oldRecord = SheetRepo.getRowById('enquiries', id);
    if (!oldRecord) throw new Error('Enquiry not found with ID: "' + id + '"');

    // Immutable fields
    delete patch.id;
    delete patch.enquiryNumber;
    delete patch.transactionNumber;
    delete patch.createdAt;

    // Resolve assets if changed
    if (patch.vehicleNumber) {
      const v = this._resolveVehicle(patch.vehicleNumber, patch.vendorId || oldRecord.vendorId, session.userId);
      if (v) patch.vehicleId = v.id;
    }
    if (patch.driverPhone || patch.driverName) {
      const d = this._resolveDriver(patch.driverName || oldRecord.driverId, patch.driverPhone, session.userId);
      if (d) patch.driverId = d.id;
    }
    if (patch.containerNumber) {
      const c = this._resolveContainer(patch.containerNumber, patch.containerType, session.userId);
      if (c) patch.containerId = c.id;
    }

    const updated = SheetRepo.updateRow('enquiries', id, patch, session.userId);
    writeAuditLog('enquiries', id, 'UPDATE', oldRecord, updated, session.userId);

    return updated;
  },

  /**
   * Action: "enquiry.delete"
   * Soft delete; blocked if enquiry is attached to a processed bill.
   */
  delete(id, sessionToken) {
    const session = requireSession(sessionToken);
    if (!id) throw new Error('Enquiry ID is required.');

    const enquiry = SheetRepo.getRowById('enquiries', id);
    if (!enquiry) throw new Error('Enquiry not found with ID: "' + id + '"');

    if (enquiry.billId) {
      throw new Error('Cannot delete enquiry "' + id + '": It is already linked to bill ID "' + enquiry.billId + '".');
    }

    SheetRepo.softDeleteRow('enquiries', id, session.userId);
    writeAuditLog('enquiries', id, 'DELETE', enquiry, { deletedAt: new Date().toISOString() }, session.userId);

    return {
      success: true,
      message: 'Enquiry ' + id + ' deleted successfully.',
    };
  },

  /**
   * Action: "enquiry.updateMovement"
   * Updates gate times and validates chronological time order (D13).
   */
  updateMovement(enquiryId, movementData, sessionToken) {
    const session = requireSession(sessionToken);
    if (!enquiryId) throw new Error('Enquiry ID is required.');
    if (!movementData) throw new Error('Movement data is required.');

    const allMovements = SheetRepo.getAllRows('movements', true);
    const currentMov = allMovements.find((m) => m.enquiryId === enquiryId);
    if (!currentMov) throw new Error('Movement record not found for enquiry: "' + enquiryId + '"');

    const merged = { ...currentMov, ...movementData };

    // Chronological validations (D13)
    const compIn = this._parseTime(merged.companyInTime);
    const compOut = this._parseTime(merged.companyOutTime);
    if (compIn && compOut && compOut < compIn) {
      throw new Error('Invalid Movement Times: Factory Gate-Out time cannot be earlier than Factory Gate-In time.');
    }

    const printIn = this._parseTime(merged.printInTime);
    const printOut = this._parseTime(merged.printOutTime);
    if (printIn && printOut && printOut < printIn) {
      throw new Error('Invalid Movement Times: Print Gate-Out time cannot be earlier than Print Gate-In time.');
    }

    const portIn = this._parseTime(merged.portInTime);
    const portOut = this._parseTime(merged.portOutTime);
    if (portIn && portOut && portOut < portIn) {
      throw new Error('Invalid Movement Times: Port Gate-Out time cannot be earlier than Port Gate-In time.');
    }

    // Determine auto statuses if gate times recorded
    if (merged.portOutTime) {
      merged.movementStatus = 'MOVED';
      merged.shippingStatus = 'COMPLETED';
    } else if (merged.companyOutTime || merged.printInTime || merged.portInTime) {
      merged.movementStatus = 'MOVED';
      merged.shippingStatus = 'IN_PROGRESS';
    }

    const updated = SheetRepo.updateRow('movements', currentMov.id, merged, session.userId);
    writeAuditLog('movements', currentMov.id, 'UPDATE_MOVEMENT', currentMov, updated, session.userId);

    return updated;
  },

  /**
   * Action: "enquiry.moveStage"
   * Moves stage with strict prerequisite validation, records to stage_history.
   */
  moveStage(enquiryId, toStage, remarks, sessionToken) {
    const session = requireSession(sessionToken);
    if (!enquiryId) throw new Error('Enquiry ID is required.');
    if (!toStage) throw new Error('Target stage (toStage) is required.');

    if (!this.STAGES.includes(toStage)) {
      throw new Error('Invalid target stage: "' + toStage + '"');
    }

    const enquiry = SheetRepo.getRowById('enquiries', enquiryId);
    if (!enquiry) throw new Error('Enquiry not found: "' + enquiryId + '"');

    const fromStage = enquiry.stage || 'ENQUIRY_CREATED';
    if (fromStage === toStage) {
      return { enquiry, message: 'Enquiry is already at stage ' + toStage };
    }

    // Billing & Processed stages are strictly controlled by the billing module
    if (toStage === 'BILLING' || toStage === 'PROCESSED') {
      throw new Error('Stages "BILLING" and "PROCESSED" can only be assigned through the Billing module.');
    }
    if (fromStage === 'BILLING' || fromStage === 'PROCESSED') {
      throw new Error('Enquiry cannot be transitioned out of "' + fromStage + '" stage.');
    }

    const fromIndex = this.STAGES.indexOf(fromStage);
    const toIndex = this.STAGES.indexOf(toStage);
    const direction = toIndex > fromIndex ? 'FORWARD' : 'BACKWARD';

    const allMovements = SheetRepo.getAllRows('movements', true);
    const movement = allMovements.find((m) => m.enquiryId === enquiryId);

    // Forward Prerequisite Validations
    if (direction === 'FORWARD') {
      // Must move one step at a time
      if (toIndex !== fromIndex + 1) {
        throw new Error('Stage skipping is not allowed. Next valid stage is "' + this.STAGES[fromIndex + 1] + '".');
      }

      if (toStage === 'VEHICLE_ASSIGNED') {
        if (!enquiry.vehicleId || !enquiry.driverId) {
          throw new Error('Prerequisite Error: Cannot move to VEHICLE_ASSIGNED without both vehicle and driver assigned.');
        }
      }

      if (toStage === 'CONTAINER_MOVEMENT') {
        if (!enquiry.containerId) {
          throw new Error('Prerequisite Error: Cannot move to CONTAINER_MOVEMENT without container assigned.');
        }
      }

      if (toStage === 'PORT_MOVEMENT') {
        if (!movement || !movement.companyOutTime) {
          throw new Error('Prerequisite Error: Cannot move to PORT_MOVEMENT without Factory Gate-Out time (companyOutTime).');
        }
      }

      if (toStage === 'COMPLETED') {
        if (!movement || !movement.portOutTime) {
          throw new Error('Prerequisite Error: Cannot complete enquiry without Port Gate-Out time (portOutTime).');
        }
      }
    }

    // Apply stage update
    const enquiryPatch = { stage: toStage };
    const now = new Date();

    if (toStage === 'COMPLETED') {
      enquiryPatch.completedAt = now.toISOString();

      // Automatically set movement statuses
      if (movement) {
        SheetRepo.updateRow('movements', movement.id, {
          shippingStatus: 'COMPLETED',
          movementStatus: 'MOVED',
        }, session.userId);
      }

      // Auto-sync expenses (D8)
      this._syncEnquiryExpenses(enquiry, session.userId);
    }

    const updatedEnquiry = SheetRepo.updateRow('enquiries', enquiryId, enquiryPatch, session.userId);

    // Record stage history
    SheetRepo.insertRow('stage_history', {
      id: 'STG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      enquiryId: enquiryId,
      fromStage: fromStage,
      toStage: toStage,
      direction: direction,
      remarks: remarks || '',
      timestamp: now.toISOString(),
    }, session.userId);

    // Audit log
    writeAuditLog('enquiries', enquiryId, 'MOVE_STAGE', { stage: fromStage }, { stage: toStage, remarks }, session.userId);

    return {
      enquiry: updatedEnquiry,
      movement: SheetRepo.getRowById('movements', movement ? movement.id : ''),
      message: 'Enquiry transitioned from ' + fromStage + ' to ' + toStage + ' (' + direction + ').',
    };
  },

  /**
   * Synchronizes Diesel and Halting amounts from enquiry to loading_expenses (D8)
   */
  _syncEnquiryExpenses(enquiry, sessionUserId) {
    try {
      const allExpenses = SheetRepo.getAllRows('loading_expenses', true);
      const enqId = enquiry.id;
      const dateStr = enquiry.date || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy');

      // 1. Diesel Expense
      const dieselAmt = parseFloat(enquiry.dieselAmount) || 0;
      if (dieselAmt > 0) {
        const existingDiesel = allExpenses.find((e) => e.enquiryId === enqId && e.category === 'Diesel');
        if (!existingDiesel) {
          SheetRepo.insertRow('loading_expenses', {
            id: 'LEXP-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
            expenseDate: dateStr,
            category: 'Diesel',
            amount: dieselAmt,
            vehicleId: enquiry.vehicleId || '',
            enquiryId: enqId,
            vendorId: enquiry.vendorId || '',
            notes: 'Auto-synced from Enquiry ' + enquiry.enquiryNumber,
            source: 'ENQUIRY',
          }, sessionUserId);
        }
      }

      // 2. Halting Expense
      const haltingAmt = parseFloat(enquiry.haltingAmount) || 0;
      if (haltingAmt > 0) {
        const existingHalting = allExpenses.find((e) => e.enquiryId === enqId && e.category === 'Halting');
        if (!existingHalting) {
          SheetRepo.insertRow('loading_expenses', {
            id: 'LEXP-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
            expenseDate: dateStr,
            category: 'Halting',
            amount: haltingAmt,
            vehicleId: enquiry.vehicleId || '',
            enquiryId: enqId,
            vendorId: enquiry.vendorId || '',
            notes: 'Auto-synced from Enquiry ' + enquiry.enquiryNumber + ' (' + (enquiry.haltingDays || 0) + ' days)',
            source: 'ENQUIRY',
          }, sessionUserId);
        }
      }
    } catch (e) {
      Logger.log('Warning: _syncEnquiryExpenses failed: ' + e.message);
    }
  },
};
