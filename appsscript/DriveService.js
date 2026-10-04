/**
 * Transport & Logistics Management System (TMS)
 * Google Drive Storage Service
 * Encapsulates all Google Drive operations using native DriveApp with fallback storage resilience.
 * STRICT RULES: Centralized Drive operations, no public links required, folder caching in document_folders.
 */

var DriveServiceModule = (function () {
  var DEFAULT_ROOT_FOLDER_NAME = 'Billing-Software-Documents';
  var VEHICLES_FOLDER_NAME = 'Vehicles';

  /**
   * Safe check to verify if DriveApp has been authorized by the account.
   */
  function isDriveAuthorized() {
    try {
      DriveApp.getRootFolder();
      return true;
    } catch (err) {
      Logger.log('DriveApp authorization check: ' + err.message);
      return false;
    }
  }

  /**
   * Helper: Resolves root Google Drive folder
   * Reads DOCUMENT_ROOT_FOLDER_ID from Script Properties or auto-creates Billing-Software-Documents.
   */
  function getRootFolder() {
    if (!isDriveAuthorized()) {
      return null;
    }

    var scriptProps = PropertiesService.getScriptProperties();
    var rootId = (
      scriptProps.getProperty('DOCUMENT_ROOT_FOLDER_ID') ||
      scriptProps.getProperty('BILLING_DOCUMENTS_FOLDER_ID') ||
      scriptProps.getProperty('BILLING_SOFTWARE_DOCUMENTS_FOLDER_ID') ||
      scriptProps.getProperty('DOCUMENT_ID') ||
      scriptProps.getProperty('DOCUMENTS_FOLDER_ID') ||
      scriptProps.getProperty('DRIVE_FOLDER_ID') ||
      scriptProps.getProperty('ROOT_FOLDER_ID') ||
      scriptProps.getProperty('FOLDER_ID') ||
      ''
    ).trim();

    if (rootId) {
      try {
        var folder = DriveApp.getFolderById(rootId);
        if (folder) return folder;
      } catch (err) {
        Logger.log('Notice: Script property folder ID "' + rootId + '" could not be opened: ' + err.message);
      }
    }

    // Fallback: Search for existing folder by name or create it
    try {
      var folders = DriveApp.getFoldersByName(DEFAULT_ROOT_FOLDER_NAME);
      if (folders.hasNext()) {
        var found = folders.next();
        try {
          scriptProps.setProperty('DOCUMENT_ROOT_FOLDER_ID', found.getId());
        } catch (e) {}
        return found;
      }

      var created = DriveApp.createFolder(DEFAULT_ROOT_FOLDER_NAME);
      try {
        scriptProps.setProperty('DOCUMENT_ROOT_FOLDER_ID', created.getId());
      } catch (e) {}
      return created;
    } catch (e) {
      Logger.log('Error resolving root folder: ' + e.message);
      return null;
    }
  }

  /**
   * Helper: Gets root folder or creates it directly under Billing-Software-Documents
   */
  function getVehiclesCategoryFolder() {
    return getRootFolder();
  }

  /**
   * Gets or creates a vehicle-specific folder directly under Billing-Software-Documents
   * Format: "{ VEHICLE NUMBER } - { DRIVER NAME } documents"
   *
   * @param {string} vehicleId - Internal database ID (e.g. VEH-001)
   * @param {string} vehicleNumber - Human readable vehicle reg number (e.g. TN04AB1234)
   * @param {string} [driverName] - Driver name (e.g. DHARMARAJAN)
   * @returns {Folder|object} Google Drive Folder instance or safe virtual descriptor
   */
  function getOrCreateVehicleFolder(vehicleId, vehicleNumber, driverName) {
    if (!vehicleId) throw new Error('Vehicle ID is required to resolve Drive folder.');
    var cleanNumber = String(vehicleNumber || vehicleId).replace(/[\s-]/g, '').toUpperCase();

    // 1. Resolve driverName if not explicitly passed
    var cleanDriver = String(driverName || '').trim();
    if (!cleanDriver) {
      try {
        var enquiries = SheetRepoModule.getAllRows('enquiries', false);
        for (var i = enquiries.length - 1; i >= 0; i--) {
          var enq = enquiries[i];
          var enqVehNo = String(enq.vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase();
          if ((String(enq.vehicleId) === String(vehicleId) || enqVehNo === cleanNumber) && enq.driverName) {
            cleanDriver = String(enq.driverName).trim();
            break;
          }
        }
      } catch (e) {
        Logger.log('Could not look up driver from enquiries: ' + e.message);
      }
    }

    if (!cleanDriver) {
      try {
        var vehicles = SheetRepoModule.getAllRows('vehicles', false);
        var veh = vehicles.find(function (v) {
          return String(v.id) === String(vehicleId) || String(v.vehicleNumber).replace(/[\s-]/g, '').toUpperCase() === cleanNumber;
        });
        if (veh) {
          if (veh.driverName) {
            cleanDriver = String(veh.driverName).trim();
          } else if (veh.ownerName) {
            cleanDriver = String(veh.ownerName).trim();
          }
        }
      } catch (e) {
        Logger.log('Could not look up driver from vehicles: ' + e.message);
      }
    }

    // Required naming standard: { VEHICLE NUMBER } - { DRIVER NAME } documents
    var folderName = cleanDriver
      ? (cleanNumber + ' - ' + cleanDriver.toUpperCase() + ' documents')
      : (cleanNumber + ' documents');

    // 2. Check document_folders sheet
    var folderRecords = SheetRepoModule.getAllRows('document_folders', false);
    var cached = folderRecords.find(function (f) {
      return String(f.entityType).toUpperCase() === 'VEHICLE' && String(f.entityId) === String(vehicleId);
    });

    if (isDriveAuthorized()) {
      var rootFolder = getRootFolder();
      if (rootFolder) {
        // If cached folder exists in Drive
        if (cached && cached.driveFolderId && cached.driveFolderId.indexOf('pending_') !== 0) {
          try {
            var existingFolder = DriveApp.getFolderById(cached.driveFolderId);
            if (existingFolder) {
              if (existingFolder.getName() !== folderName) {
                try { existingFolder.setName(folderName); } catch (renErr) {}
                SheetRepoModule.updateRow('document_folders', cached.id, {
                  entityName: folderName,
                  updatedAt: new Date().toISOString()
                });
              }
              return existingFolder;
            }
          } catch (e) {
            Logger.log('Cached folder ID invalid, searching root: ' + e.message);
          }
        }

        // Search directly under root folder: Billing-Software-Documents
        try {
          var targetFolder = null;
          var existingFolders = rootFolder.getFoldersByName(folderName);
          if (existingFolders.hasNext()) {
            targetFolder = existingFolders.next();
          } else {
            // Check for previous naming style (e.g. without driver or with old case) to reuse and rename
            var oldNameFolders = rootFolder.getFoldersByName(cleanNumber + ' Documents');
            if (oldNameFolders.hasNext()) {
              targetFolder = oldNameFolders.next();
              try { targetFolder.setName(folderName); } catch (e) {}
            } else {
              targetFolder = rootFolder.createFolder(folderName);
            }
          }

          var folderId = targetFolder.getId();
          var folderUrl = targetFolder.getUrl();

          // Persist into document_folders table
          if (cached) {
            SheetRepoModule.updateRow('document_folders', cached.id, {
              entityName: folderName,
              driveFolderId: folderId,
              driveFolderUrl: folderUrl,
              updatedAt: new Date().toISOString(),
              status: 'ACTIVE'
            });
          } else {
            SheetRepoModule.insertRow('document_folders', {
              id: Utilities.getUuid(),
              entityType: 'VEHICLE',
              entityId: vehicleId,
              entityName: folderName,
              driveFolderId: folderId,
              driveFolderUrl: folderUrl,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'ACTIVE'
            });
          }

          return targetFolder;
        } catch (err) {
          Logger.log('Drive folder creation failed: ' + err.message);
        }
      }
    }

    // Fallback: Return virtual folder object when Drive authorization is pending
    var virtualFolderId = (cached && cached.driveFolderId) ? cached.driveFolderId : ('pending_drive_' + vehicleId);
    var virtualFolderUrl = (cached && cached.driveFolderUrl) ? cached.driveFolderUrl : 'https://drive.google.com';

    if (!cached) {
      SheetRepoModule.insertRow('document_folders', {
        id: Utilities.getUuid(),
        entityType: 'VEHICLE',
        entityId: vehicleId,
        entityName: folderName,
        driveFolderId: virtualFolderId,
        driveFolderUrl: virtualFolderUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'PENDING_DRIVE_AUTH'
      });
    }

    return {
      getId: function () { return virtualFolderId; },
      getUrl: function () { return virtualFolderUrl; },
      getName: function () { return folderName; },
      isVirtual: true,
      isPendingDriveAuth: true
    };
  }

  /**
   * Synchronizes any documents temporarily held in document_files sheet into Google Drive
   */
  function syncPendingDocumentsToDrive() {
    if (!isDriveAuthorized()) {
      return { success: false, count: 0, message: 'DriveApp is not authorized yet.' };
    }

    var pendingDocs = SheetRepoModule.getAllRows('document_files', false);
    if (!pendingDocs || pendingDocs.length === 0) {
      return { success: true, count: 0, message: 'No pending documents in temporary queue.' };
    }

    var allDocs = SheetRepoModule.getAllRows('documents', false);
    var syncedCount = 0;

    for (var i = 0; i < pendingDocs.length; i++) {
      var pf = pendingDocs[i];
      var matchingDoc = allDocs.find(function (d) {
        return d.driveFileId === pf.id;
      });

      if (matchingDoc && pf.base64Data) {
        try {
          var targetFolder = getOrCreateVehicleFolder(matchingDoc.entityId, matchingDoc.vehicleNumber);
          var uploadResult = uploadFile(targetFolder.getId(), matchingDoc.fileName, pf.mimeType, pf.base64Data);

          SheetRepoModule.updateRow('documents', matchingDoc.id, {
            driveFileId: uploadResult.fileId,
            driveViewUrl: uploadResult.driveViewUrl,
            driveDownloadUrl: uploadResult.driveDownloadUrl,
            updatedAt: new Date().toISOString()
          });

          try {
            SheetRepoModule.deleteRow('document_files', pf.id);
          } catch (delErr) {}

          syncedCount++;
        } catch (syncErr) {
          Logger.log('Error syncing file ' + pf.fileName + ': ' + syncErr.message);
        }
      }
    }

    return { success: true, count: syncedCount, message: 'Successfully synced ' + syncedCount + ' document(s) directly to Google Drive.' };
  }

  /**
   * Uploads a file to a specific Drive folder from base64 string
   */
  function uploadFile(folderId, fileName, mimeType, base64Data) {
    if (!fileName) throw new Error('File name is required.');
    if (!base64Data) throw new Error('File data is required.');

    // If Drive is authorized and folderId is a real Drive folder
    if (isDriveAuthorized() && folderId && folderId.indexOf('pending_') !== 0) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        var bytes = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(bytes, mimeType || 'application/pdf', fileName);

        var file = folder.createFile(blob);
        var fileId = file.getId();
        var size = file.getSize();

        return {
          fileId: fileId,
          fileName: fileName,
          mimeType: mimeType || 'application/pdf',
          fileSize: size,
          driveViewUrl: file.getUrl(),
          driveDownloadUrl: file.getDownloadUrl(),
          isPendingDriveSync: false
        };
      } catch (err) {
        Logger.log('Direct Drive upload error, saving to secure database storage: ' + err.message);
      }
    }

    // Resilient Fallback: Save to document_files sheet
    var fileId = 'doc_file_' + Utilities.getUuid();
    var approxSize = Math.round(base64Data.length * 0.75);

    SheetRepoModule.insertRow('document_files', {
      id: fileId,
      fileName: fileName,
      mimeType: mimeType || 'application/pdf',
      fileSize: approxSize,
      base64Data: base64Data,
      createdAt: new Date().toISOString()
    });

    return {
      fileId: fileId,
      fileName: fileName,
      mimeType: mimeType || 'application/pdf',
      fileSize: approxSize,
      driveViewUrl: '',
      driveDownloadUrl: '',
      isPendingDriveSync: true
    };
  }

  /**
   * Retrieves file binary content as base64 string for secure Next.js server proxying.
   */
  function getFileBase64(fileId) {
    if (!fileId) throw new Error('File ID is required.');

    // 1. Check fallback document_files sheet
    if (fileId.indexOf('doc_file_') === 0 || fileId.indexOf('pending_') === 0) {
      var allFiles = SheetRepoModule.getAllRows('document_files', false);
      var match = allFiles.find(function (f) { return String(f.id) === String(fileId); });
      if (match && match.base64Data) {
        return {
          fileId: match.id,
          fileName: match.fileName,
          mimeType: match.mimeType || 'application/pdf',
          fileSize: match.fileSize || 0,
          base64Data: match.base64Data
        };
      }
    }

    // 2. DriveApp
    if (isDriveAuthorized()) {
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var bytes = blob.getBytes();
      return {
        fileId: fileId,
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        fileSize: file.getSize(),
        base64Data: Utilities.base64Encode(bytes)
      };
    }

    throw new Error('Google Drive authorization required to read file ID: ' + fileId);
  }

  /**
   * Safely deletes file by moving it to Google Drive Trash (recoverable)
   */
  function trashFile(fileId) {
    if (!fileId) return false;
    if (fileId.indexOf('doc_file_') === 0) {
      try {
        SheetRepoModule.deleteRow('document_files', fileId);
        return true;
      } catch (e) {
        return false;
      }
    }

    if (isDriveAuthorized()) {
      try {
        var file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        return true;
      } catch (e) {
        Logger.log('Notice: Failed to trash file ' + fileId + ': ' + e.message);
        return false;
      }
    }
    return false;
  }

  /**
   * Renames a file
   */
  function renameFile(fileId, newName) {
    if (!fileId || !newName) return false;
    if (fileId.indexOf('doc_file_') === 0) {
      try {
        SheetRepoModule.updateRow('document_files', fileId, { fileName: newName });
        return true;
      } catch (e) {
        return false;
      }
    }

    if (isDriveAuthorized()) {
      try {
        var file = DriveApp.getFileById(fileId);
        file.setName(newName);
        return true;
      } catch (e) {
        Logger.log('Notice: Failed to rename file ' + fileId + ': ' + e.message);
        return false;
      }
    }
    return false;
  }

  /**
   * Gets direct Google Drive folder URL for an entity
   */
  function getEntityFolderUrl(entityType, entityId) {
    var folders = SheetRepoModule.getAllRows('document_folders', false);
    var match = folders.find(function (f) {
      return String(f.entityType).toUpperCase() === String(entityType).toUpperCase() && String(f.entityId) === String(entityId);
    });
    if (match && match.driveFolderUrl) {
      return match.driveFolderUrl;
    }
    if (match && match.driveFolderId && match.driveFolderId.indexOf('pending_') !== 0) {
      return 'https://drive.google.com/drive/folders/' + match.driveFolderId;
    }
    return null;
  }

  return {
    isDriveAuthorized: isDriveAuthorized,
    getRootFolder: getRootFolder,
    getVehiclesCategoryFolder: getVehiclesCategoryFolder,
    getOrCreateVehicleFolder: getOrCreateVehicleFolder,
    uploadFile: uploadFile,
    getFileBase64: getFileBase64,
    trashFile: trashFile,
    renameFile: renameFile,
    getEntityFolderUrl: getEntityFolderUrl,
    syncPendingDocumentsToDrive: syncPendingDocumentsToDrive
  };
})();
