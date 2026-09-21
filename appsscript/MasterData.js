/**
 * Transport & Logistics Management System (TMS)
 * Phase 5 - Master Data Backend Module
 * Covers: Companies, Clients, Vendors, Vehicles, Drivers (and Containers lookup)
 * STRICT RULES: R7 (Session required), R14 (Batch reads/writes, no loops), D12 (Format validation).
 */

const MasterDataModule = {
  VALID_ENTITIES: ['companies', 'clients', 'vendors', 'vehicles', 'drivers'],

  /**
   * Helper: Validate entity name
   */
  _assertEntity(entity) {
    if (!this.VALID_ENTITIES.includes(entity) && entity !== 'containers') {
      throw new Error('Invalid master data entity: "' + entity + '"');
    }
  },

  /**
   * Helper: Normalize string for comparison
   */
  _norm(str) {
    return String(str || '').trim().toLowerCase();
  },

  /**
   * Helper: Format and validate Vehicle Number (e.g., TN04AB1234)
   * Strips spaces, hyphens, and converts to uppercase.
   */
  _formatVehicleNumber(val) {
    if (!val) throw new Error('Vehicle number is required.');
    const cleaned = String(val).replace(/[\s-]/g, '').toUpperCase();
    // Indian vehicle registration regex (e.g. TN04AB1234, DL1A1234, KA011234)
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    if (!regex.test(cleaned)) {
      throw new Error('Invalid vehicle number format. Expected format like TN04AB1234 (uppercase alphanumeric).');
    }
    return cleaned;
  },

  /**
   * Helper: Validate Driver Mobile (10 digits starting with 6-9)
   */
  _validateDriverPhone(val) {
    if (!val) throw new Error('Driver phone number is required.');
    const cleaned = String(val).replace(/[\s-]/g, '');
    const regex = /^[6-9]\d{9}$/;
    if (!regex.test(cleaned)) {
      throw new Error('Invalid driver phone number. Must be a valid 10-digit Indian mobile number starting with 6-9.');
    }
    return cleaned;
  },

  /**
   * List records with search, filter, pagination, and sorting
   */
  list(entity, params, sessionToken) {
    requireSession(sessionToken);
    this._assertEntity(entity);

    const search = this._norm(params?.search);
    const activeFilter = params?.active; // 'true', 'false', or undefined/'all'
    const page = Math.max(1, parseInt(params?.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params?.limit || '20', 10)));
    const sortField = params?.sortField || 'name';
    const sortOrder = params?.sortOrder === 'desc' ? -1 : 1;

    // Batched single read of sheet
    let rows = SheetRepo.getAllRows(entity, false);

    // Apply active filter
    if (activeFilter !== undefined && activeFilter !== 'all') {
      const isTargetActive = String(activeFilter) === 'true';
      rows = rows.filter((r) => Boolean(r.active) === isTargetActive);
    }

    // Apply search across primary fields
    if (search) {
      rows = rows.filter((r) => {
        if (entity === 'vehicles') {
          return (
            this._norm(r.vehicleNumber).includes(search) ||
            this._norm(r.vehicleType).includes(search)
          );
        }
        if (entity === 'drivers') {
          return (
            this._norm(r.name).includes(search) ||
            this._norm(r.phone).includes(search) ||
            this._norm(r.licenseNumber).includes(search)
          );
        }
        return (
          this._norm(r.name).includes(search) ||
          this._norm(r.phone).includes(search) ||
          this._norm(r.email).includes(search) ||
          this._norm(r.contactPerson).includes(search)
        );
      });
    }

    // Sort rows
    rows.sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      if (typeof valA === 'string') {
        return valA.localeCompare(String(valB)) * sortOrder;
      }
      return (valA > valB ? 1 : valA < valB ? -1 : 0) * sortOrder;
    });

    const total = rows.length;
    const startIndex = (page - 1) * limit;
    const items = rows.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
    };
  },

  /**
   * Get single record by ID
   */
  get(entity, id, sessionToken) {
    requireSession(sessionToken);
    this._assertEntity(entity);
    if (!id) throw new Error('ID is required.');

    const record = SheetRepo.getRowById(entity, id);
    if (!record) {
      throw new Error('Record not found with ID "' + id + '" in ' + entity);
    }
    return record;
  },

  /**
   * Create new master record
   */
  create(entity, data, sessionToken) {
    const session = requireSession(sessionToken);
    this._assertEntity(entity);
    if (!data) throw new Error('Payload data is required.');

    const allRows = SheetRepo.getAllRows(entity, false);

    // Format & Validate Specific Entity Fields
    if (entity === 'vehicles') {
      data.vehicleNumber = this._formatVehicleNumber(data.vehicleNumber);
      if (!data.vehicleType) throw new Error('Vehicle type is required.');

      // Check uniqueness of vehicleNumber
      const dup = allRows.find(
        (r) => this._norm(r.vehicleNumber) === this._norm(data.vehicleNumber)
      );
      if (dup) {
        throw new Error('A vehicle with number "' + data.vehicleNumber + '" already exists.');
      }
    } else if (entity === 'drivers') {
      if (!data.name || !String(data.name).trim()) throw new Error('Driver name is required.');
      data.phone = this._validateDriverPhone(data.phone);

      // Check uniqueness of driver phone
      const dup = allRows.find((r) => this._norm(r.phone) === this._norm(data.phone));
      if (dup) {
        throw new Error('A driver with phone number "' + data.phone + '" already exists (' + dup.name + ').');
      }
    } else {
      // Companies, Clients, Vendors require unique name
      if (!data.name || !String(data.name).trim()) {
        throw new Error(entity.slice(0, -1) + ' name is required.');
      }
      data.name = String(data.name).trim();

      const dup = allRows.find((r) => this._norm(r.name) === this._norm(data.name));
      if (dup) {
        throw new Error(
          'A ' + entity.slice(0, -1) + ' with name "' + data.name + '" already exists.'
        );
      }
    }

    // Additional validations
    if (entity === 'clients' && data.companyId) {
      const company = SheetRepo.getRowById('companies', data.companyId);
      if (!company) {
        throw new Error('Referenced company ID "' + data.companyId + '" does not exist.');
      }
    }

    if (entity === 'vehicles' && data.vendorId) {
      const vendor = SheetRepo.getRowById('vendors', data.vendorId);
      if (!vendor) {
        throw new Error('Referenced vendor ID "' + data.vendorId + '" does not exist.');
      }
    }

    // Prepare new object with auto-generated ID
    const prefixMap = {
      companies: 'CMP',
      clients: 'CLI',
      vendors: 'VND',
      vehicles: 'VEH',
      drivers: 'DRV',
    };
    const prefix = prefixMap[entity] || 'MST';
    const newId = prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

    const newRecord = {
      ...data,
      id: newId,
      active: true,
    };

    const inserted = SheetRepo.insertRow(entity, newRecord, session.userId);

    // Audit log
    writeAuditLog(entity, newId, 'CREATE', null, inserted, session.userId);

    return inserted;
  },

  /**
   * Update existing record
   */
  update(entity, id, patch, sessionToken) {
    const session = requireSession(sessionToken);
    this._assertEntity(entity);
    if (!id) throw new Error('ID is required.');
    if (!patch) throw new Error('Patch data is required.');

    const oldRecord = SheetRepo.getRowById(entity, id);
    if (!oldRecord) {
      throw new Error('Record not found with ID "' + id + '" in ' + entity);
    }

    const allRows = SheetRepo.getAllRows(entity, false);

    // Format & Validate Specific Entity Fields
    if (entity === 'vehicles' && patch.vehicleNumber) {
      patch.vehicleNumber = this._formatVehicleNumber(patch.vehicleNumber);
      const dup = allRows.find(
        (r) => String(r.id) !== String(id) && this._norm(r.vehicleNumber) === this._norm(patch.vehicleNumber)
      );
      if (dup) {
        throw new Error('Another vehicle with number "' + patch.vehicleNumber + '" already exists.');
      }
    } else if (entity === 'drivers') {
      if (patch.phone) {
        patch.phone = this._validateDriverPhone(patch.phone);
        const dup = allRows.find(
          (r) => String(r.id) !== String(id) && this._norm(r.phone) === this._norm(patch.phone)
        );
        if (dup) {
          throw new Error('Another driver with phone number "' + patch.phone + '" already exists.');
        }
      }
    } else if (patch.name) {
      patch.name = String(patch.name).trim();
      const dup = allRows.find(
        (r) => String(r.id) !== String(id) && this._norm(r.name) === this._norm(patch.name)
      );
      if (dup) {
        throw new Error(
          'Another ' + entity.slice(0, -1) + ' with name "' + patch.name + '" already exists.'
        );
      }
    }

    // Do not allow changing id or createdAt
    delete patch.id;
    delete patch.createdAt;

    const updated = SheetRepo.updateRow(entity, id, patch, session.userId);

    // Audit log
    writeAuditLog(entity, id, 'UPDATE', oldRecord, updated, session.userId);

    return updated;
  },

  /**
   * Soft deactivation
   * Never hard-deletes; sets active = false.
   * Excluded from future lookups, but historical references remain intact.
   */
  deactivate(entity, id, sessionToken) {
    const session = requireSession(sessionToken);
    this._assertEntity(entity);
    if (!id) throw new Error('ID is required.');

    const oldRecord = SheetRepo.getRowById(entity, id);
    if (!oldRecord) {
      throw new Error('Record not found with ID "' + id + '" in ' + entity);
    }

    // Check if referenced by active enquiries or bills
    // Note: Deactivation is allowed because active=false preserves history,
    // but hard-deletion is completely prevented.
    const updated = SheetRepo.updateRow(entity, id, { active: false }, session.userId);

    // Audit log
    writeAuditLog(entity, id, 'DEACTIVATE', oldRecord, { active: false }, session.userId);

    return {
      success: true,
      message: entity.slice(0, -1) + ' deactivated successfully.',
      record: updated,
    };
  },

  /**
   * Reactivate an inactive entity
   */
  reactivate(entity, id, sessionToken) {
    const session = requireSession(sessionToken);
    this._assertEntity(entity);
    if (!id) throw new Error('ID is required.');

    const oldRecord = SheetRepo.getRowById(entity, id);
    if (!oldRecord) {
      throw new Error('Record not found with ID "' + id + '" in ' + entity);
    }

    const updated = SheetRepo.updateRow(entity, id, { active: true }, session.userId);

    writeAuditLog(entity, id, 'REACTIVATE', oldRecord, { active: true }, session.userId);

    return {
      success: true,
      message: entity.slice(0, -1) + ' reactivated successfully.',
      record: updated,
    };
  },

  /**
   * Lightweight lookup for dropdowns (id + label, max 20, active only)
   * Supports: companies, clients, vendors, vehicles, drivers, containers
   */
  lookup(entity, query, sessionToken) {
    requireSession(sessionToken);
    if (!this.VALID_ENTITIES.includes(entity) && entity !== 'containers') {
      throw new Error('Invalid lookup entity: "' + entity + '"');
    }

    const search = this._norm(query?.search);
    const companyId = query?.companyId; // for client filtering
    const vendorId = query?.vendorId; // for vehicle filtering
    const limit = Math.min(50, Math.max(1, parseInt(query?.limit || '20', 10)));

    let rows = SheetRepo.getAllRows(entity, false);

    // Filter active only (containers don't have an active flag)
    if (entity !== 'containers') {
      rows = rows.filter((r) => Boolean(r.active) === true);
    }

    // Contextual filtering
    if (entity === 'clients' && companyId) {
      rows = rows.filter((r) => String(r.companyId) === String(companyId));
    }
    if (entity === 'vehicles' && vendorId) {
      rows = rows.filter((r) => String(r.vendorId) === String(vendorId));
    }

    // Search filter
    if (search) {
      rows = rows.filter((r) => {
        if (entity === 'vehicles') {
          return this._norm(r.vehicleNumber).includes(search);
        }
        if (entity === 'drivers') {
          return this._norm(r.name).includes(search) || this._norm(r.phone).includes(search);
        }
        if (entity === 'containers') {
          return this._norm(r.containerNumber).includes(search);
        }
        return this._norm(r.name).includes(search);
      });
    }

    // Format into lightweight { id, label, ...extra }
    const results = rows.slice(0, limit).map((r) => {
      if (entity === 'vehicles') {
        return {
          id: r.id,
          label: r.vehicleNumber + (r.vehicleType ? ' (' + r.vehicleType + ')' : ''),
          vehicleNumber: r.vehicleNumber,
          vehicleType: r.vehicleType,
          vendorId: r.vendorId,
        };
      }
      if (entity === 'drivers') {
        return {
          id: r.id,
          label: r.name + (r.phone ? ' - ' + r.phone : ''),
          name: r.name,
          phone: r.phone,
          licenseNumber: r.licenseNumber,
        };
      }
      if (entity === 'containers') {
        return {
          id: r.id,
          label: r.containerNumber + (r.containerType ? ' (' + r.containerType + ')' : ''),
          containerNumber: r.containerNumber,
          containerType: r.containerType,
        };
      }
      if (entity === 'clients') {
        return {
          id: r.id,
          label: r.name,
          companyId: r.companyId,
          gstin: r.gstin,
        };
      }
      // Companies, Vendors
      return {
        id: r.id,
        label: r.name,
        gstin: r.gstin,
        pan: r.pan,
      };
    });

    return results;
  },
};
