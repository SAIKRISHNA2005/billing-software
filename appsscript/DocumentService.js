/**
 * Transport & Logistics Management System (TMS)
 * Vehicle Document Management Service
 * Strictly scoped to VEHICLE documents (RC, Insurance, Fitness, PUCC, State Permit, National Permit, etc.)
 */

var DocumentServiceModule = (function () {
  var ALLOWED_CATEGORIES = [
    'RC',
    'INSURANCE',
    'FITNESS',
    'PUCC',
    'STATE_PERMIT',
    'NATIONAL_PERMIT',
    'TAX_TOKEN',
    'ROAD_WORTHINESS',
    'OTHER'
  ];

  /**
   * Helper: Resolves vehicle from database
   */
  function getVehicleRecord(vehicleId) {
    if (!vehicleId) throw new Error('Vehicle ID is required.');
    var vehicles = SheetRepo.getAllRows('vehicles', true);
    var vehicle = vehicles.find(function (v) {
      return String(v.id) === String(vehicleId) || String(v.vehicleNumber).replace(/[\s-]/g, '').toUpperCase() === String(vehicleId).replace(/[\s-]/g, '').toUpperCase();
    });
    if (!vehicle) {
      throw new Error('Vehicle not found with ID/Number: ' + vehicleId);
    }
    return vehicle;
  }

  /**
   * Uploads one or multiple vehicle documents.
   *
   * @param {object} payload
   *   - vehicleId: string (required)
   *   - files: Array of file objects OR a single file object:
   *       - category: string ('RC', 'INSURANCE', 'FITNESS', etc.)
   *       - fileName: string
   *       - mimeType: string (default application/pdf)
   *       - base64Data: string
   *       - documentNumber?: string
   *       - expiryDate?: string (YYYY-MM-DD)
   *       - issueDate?: string (YYYY-MM-DD)
   *       - notes?: string
   * @param {string} sessionToken
   */
  function uploadVehicleDocuments(payload, sessionToken) {
    var session = requireSession(sessionToken);
    if (!payload || !payload.vehicleId) {
      throw new Error('vehicleId is required for document upload.');
    }

    var vehicle = getVehicleRecord(payload.vehicleId);
    var vehicleId = vehicle.id;
    var vehicleNumber = vehicle.vehicleNumber;

    // Normalise incoming files array
    var files = [];
    if (Array.isArray(payload.files)) {
      files = payload.files;
    } else if (payload.base64Data) {
      files = [payload];
    } else if (payload.file && payload.file.base64Data) {
      files = [payload.file];
    }

    if (files.length === 0) {
      throw new Error('No document files provided for upload.');
    }

    var driverName = (payload.driverName || '').trim();

    // Resolve or create vehicle folder in Google Drive (format: {vehicleNumber} - {driverName} documents)
    var vehicleFolder = DriveServiceModule.getOrCreateVehicleFolder(vehicleId, vehicleNumber, driverName);
    var folderId = vehicleFolder.getId();
    var folderUrl = vehicleFolder.getUrl();

    var uploadedDocs = [];
    var vehicleFieldUpdates = {};

    for (var i = 0; i < files.length; i++) {
      var item = files[i];
      if (!item.base64Data) {
        throw new Error('File data (base64Data) is missing for item ' + (i + 1));
      }

      var rawCategory = String(item.category || 'OTHER').toUpperCase().trim();
      var category = ALLOWED_CATEGORIES.indexOf(rawCategory) !== -1 ? rawCategory : 'OTHER';
      var mimeType = item.mimeType || 'application/pdf';
      var rawName = (item.fileName || item.originalFileName || (category + '.pdf')).trim();

      // Clean file name
      var cleanBaseName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!cleanBaseName.toLowerCase().endsWith('.pdf') && mimeType === 'application/pdf') {
        cleanBaseName += '.pdf';
      }

      // Upload to Drive folder
      var uploadResult = DriveServiceModule.uploadFile(folderId, cleanBaseName, mimeType, item.base64Data);

      // Check if an existing active document with the same category exists, and mark as superseded/archived
      var existingDocs = SheetRepo.getAllRows('documents', false);
      for (var d = 0; d < existingDocs.length; d++) {
        var existing = existingDocs[d];
        if (
          String(existing.entityType).toUpperCase() === 'VEHICLE' &&
          String(existing.entityId) === String(vehicleId) &&
          String(existing.category).toUpperCase() === category &&
          existing.status === 'ACTIVE'
        ) {
          try {
            SheetRepo.updateRow('documents', existing.id, {
              status: 'ARCHIVED',
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            Logger.log('Could not archive prior doc: ' + e.message);
          }
        }
      }

      // Create new document record
      var docId = Utilities.getUuid();
      var docRecord = {
        id: docId,
        entityType: 'VEHICLE',
        entityId: vehicleId,
        vehicleNumber: vehicleNumber,
        category: category,
        documentNumber: (item.documentNumber || '').trim(),
        fileName: uploadResult.fileName,
        originalFileName: rawName,
        mimeType: uploadResult.mimeType,
        fileSize: uploadResult.fileSize,
        driveFileId: uploadResult.fileId,
        driveViewUrl: uploadResult.driveViewUrl,
        driveDownloadUrl: uploadResult.driveDownloadUrl,
        expiryDate: (item.expiryDate || '').trim(),
        issueDate: (item.issueDate || '').trim(),
        status: 'ACTIVE',
        notes: (item.notes || '').trim(),
        uploadedBy: session.userId || 'USR-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: ''
      };

      SheetRepo.insertRow('documents', docRecord, session.userId);
      uploadedDocs.push(docRecord);

      // Audit log
      AuditModule.writeAuditLog(
        'documents',
        docId,
        'UPLOAD',
        null,
        {
          vehicleId: vehicleId,
          vehicleNumber: vehicleNumber,
          category: category,
          fileName: docRecord.fileName,
          fileSize: docRecord.fileSize
        },
        session.userId
      );

      // Optionally sync vehicle expiry fields if provided
      if (item.expiryDate) {
        if (category === 'FITNESS') vehicleFieldUpdates.fitnessValidUpTo = item.expiryDate;
        else if (category === 'INSURANCE') vehicleFieldUpdates.insuranceValidUpTo = item.expiryDate;
        else if (category === 'PUCC') vehicleFieldUpdates.puccValidUpTo = item.expiryDate;
        else if (category === 'STATE_PERMIT') vehicleFieldUpdates.permitValidUpTo = item.expiryDate;
        else if (category === 'NATIONAL_PERMIT') vehicleFieldUpdates.nationalPermitValidUpTo = item.expiryDate;
        else if (category === 'TAX_TOKEN') vehicleFieldUpdates.taxValidUpTo = item.expiryDate;
      }
    }

    // If any validity dates were synced, update vehicle record
    if (Object.keys(vehicleFieldUpdates).length > 0) {
      try {
        vehicleFieldUpdates.updatedAt = new Date().toISOString();
        SheetRepo.updateRow('vehicles', vehicleId, vehicleFieldUpdates);
      } catch (err) {
        Logger.log('Notice: Failed updating vehicle expiry dates: ' + err.message);
      }
    }

    var isDriveAuthorized = DriveServiceModule.isDriveAuthorized();

    return {
      success: true,
      message: isDriveAuthorized
        ? ('Successfully uploaded ' + uploadedDocs.length + ' vehicle document(s) to Google Drive.')
        : ('Successfully uploaded ' + uploadedDocs.length + ' vehicle document(s) to secure storage. (Google Drive direct sync pending authorization).'),
      isDriveAuthorized: isDriveAuthorized,
      folderName: vehicleNumber + ' Documents',
      driveAuthUrl: 'https://script.google.com/d/1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs/edit',
      vehicleId: vehicleId,
      vehicleNumber: vehicleNumber,
      driveFolderUrl: folderUrl,
      documents: uploadedDocs
    };
  }

  /**
   * Retrieves all documents for a specific vehicle.
   */
  function getVehicleDocuments(vehicleId, sessionToken) {
    requireSession(sessionToken);
    if (!vehicleId) throw new Error('Vehicle ID is required.');

    var vehicle = getVehicleRecord(vehicleId);
    var allDocs = SheetRepo.getAllRows('documents', false);

    var vehicleDocs = allDocs.filter(function (doc) {
      return (
        String(doc.entityType).toUpperCase() === 'VEHICLE' &&
        (String(doc.entityId) === String(vehicle.id) ||
         String(doc.vehicleNumber).replace(/[\s-]/g, '').toUpperCase() === String(vehicle.vehicleNumber).replace(/[\s-]/g, '').toUpperCase())
      );
    });

    // Sort active first, then newest first
    vehicleDocs.sort(function (a, b) {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Resolve Drive folder URL and folder name
    var folder = null;
    var folderUrl = DriveServiceModule.getEntityFolderUrl('VEHICLE', vehicle.id);
    var folderName = vehicle.vehicleNumber + ' documents';
    try {
      folder = DriveServiceModule.getOrCreateVehicleFolder(vehicle.id, vehicle.vehicleNumber);
      if (folder) {
        folderUrl = folder.getUrl();
        folderName = folder.getName();
      }
    } catch (e) {
      // ignore
    }

    var isDriveAuthorized = DriveServiceModule.isDriveAuthorized();

    return {
      success: true,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      folderName: folderName,
      driveFolderUrl: folderUrl || null,
      isDriveAuthorized: isDriveAuthorized,
      driveAuthUrl: 'https://script.google.com/d/1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs/edit',
      documents: vehicleDocs
    };
  }

  /**
   * Retrieves single document metadata by ID
   */
  function getDocument(documentId, sessionToken) {
    requireSession(sessionToken);
    if (!documentId) throw new Error('Document ID is required.');

    var doc = SheetRepo.getRowById('documents', documentId);
    if (!doc || doc.deletedAt) {
      throw new Error('Document not found with ID: ' + documentId);
    }

    return {
      success: true,
      document: doc
    };
  }

  /**
   * Retrieves document file content as base64 for secure streaming proxy
   */
  function getDocumentContent(documentId, sessionToken) {
    requireSession(sessionToken);
    if (!documentId) throw new Error('Document ID is required.');

    var doc = SheetRepo.getRowById('documents', documentId);
    if (!doc || doc.deletedAt) {
      throw new Error('Document not found with ID: ' + documentId);
    }

    var fileData = DriveServiceModule.getFileBase64(doc.driveFileId);

    return {
      success: true,
      documentId: doc.id,
      fileName: doc.fileName || fileData.fileName,
      mimeType: doc.mimeType || fileData.mimeType,
      fileSize: fileData.fileSize,
      base64Data: fileData.base64Data
    };
  }

  /**
   * Soft deletes a document and moves its file in Google Drive to Trash.
   */
  function deleteDocument(documentId, sessionToken) {
    var session = requireSession(sessionToken);
    if (!documentId) throw new Error('Document ID is required.');

    var doc = SheetRepo.getRowById('documents', documentId);
    if (!doc || doc.deletedAt) {
      throw new Error('Document not found or already deleted: ' + documentId);
    }

    // Trash file in Drive
    if (doc.driveFileId) {
      DriveServiceModule.trashFile(doc.driveFileId);
    }

    // Soft delete in Sheet
    SheetRepo.deleteRow('documents', documentId, session.userId);

    // Write audit log
    AuditModule.writeAuditLog(
      'documents',
      documentId,
      'DELETE',
      {
        vehicleId: doc.entityId,
        category: doc.category,
        fileName: doc.fileName,
        driveFileId: doc.driveFileId
      },
      null,
      session.userId
    );

    return {
      success: true,
      message: 'Document deleted successfully.'
    };
  }

  /**
   * Renames a document and syncs Drive file name
   */
  function renameDocument(documentId, newFileName, sessionToken) {
    var session = requireSession(sessionToken);
    if (!documentId) throw new Error('Document ID is required.');
    if (!newFileName || !newFileName.trim()) throw new Error('New file name is required.');

    var doc = SheetRepo.getRowById('documents', documentId);
    if (!doc || doc.deletedAt) {
      throw new Error('Document not found: ' + documentId);
    }

    var cleanName = newFileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!cleanName.toLowerCase().endsWith('.pdf') && (doc.mimeType === 'application/pdf' || !cleanName.includes('.'))) {
      cleanName += '.pdf';
    }

    if (doc.driveFileId) {
      DriveServiceModule.renameFile(doc.driveFileId, cleanName);
    }

    var oldName = doc.fileName;
    SheetRepo.updateRow('documents', documentId, {
      fileName: cleanName,
      updatedAt: new Date().toISOString()
    });

    AuditModule.writeAuditLog(
      'documents',
      documentId,
      'RENAME',
      { fileName: oldName },
      { fileName: cleanName },
      session.userId
    );

    return {
      success: true,
      documentId: documentId,
      fileName: cleanName
    };
  }

  /**
   * Returns Google Drive folder URL for a vehicle
   */
  function getVehicleFolderUrl(vehicleId, sessionToken) {
    requireSession(sessionToken);
    var vehicle = getVehicleRecord(vehicleId);
    var folder = DriveServiceModule.getOrCreateVehicleFolder(vehicle.id, vehicle.vehicleNumber);
    return {
      success: true,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      driveFolderUrl: folder.getUrl()
    };
  }

  return {
    uploadVehicleDocuments: uploadVehicleDocuments,
    getVehicleDocuments: getVehicleDocuments,
    getDocument: getDocument,
    getDocumentContent: getDocumentContent,
    deleteDocument: deleteDocument,
    renameDocument: renameDocument,
    getVehicleFolderUrl: getVehicleFolderUrl,
    syncPendingDocuments: function (sessionToken) {
      requireSession(sessionToken);
      return DriveServiceModule.syncPendingDocumentsToDrive();
    }
  };
})();
