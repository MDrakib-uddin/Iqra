/**
 * City Public Scholarship 2026
 * Attach this Apps Script project to the target Google Sheet.
 *
 * Before deployment:
 * 1. Set Script Property API_SECRET to the same long random secret as SCHOLARSHIP_API_SECRET.
 * 2. Run setup() once and approve permissions.
 * 3. Deploy as Web app, Execute as: Me, access: Anyone.
 * 4. Copy the /exec URL into GOOGLE_APPS_SCRIPT_URL.
 */
const SHEET_NAME = "Applications";
const PHOTO_FOLDER_NAME = "City Public Scholarship Photos 2026";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = [
    "Application ID", "Submission Time",
    "Student Name (Bangla)", "Student Name (English)",
    "Father Name (Bangla)", "Father Mobile", "Father Name (English)",
    "Mother Name (Bangla)", "Mother Mobile", "Mother Name (English)",
    "Class", "Class Roll", "Upazila", "Institution Name",
    "Teacher Representative", "Teacher Mobile", "Payment Method",
    "Fee (BDT)", "Payment Status", "Photo URL", "Transaction ID", "Payer Mobile"
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.indexOf("Transaction ID") === -1) {
      const column = sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue("Transaction ID").setFontWeight("bold");
    }
    const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (updatedHeaders.indexOf("Payer Mobile") === -1) {
      const column = sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue("Payer Mobile").setFontWeight("bold");
    }
  }

  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (!folders.hasNext()) DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function doGet() {
  return ContentService.createTextOutput("City Public Scholarship API is running.");
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let photo = null;
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET");
    if (!expectedSecret || data.apiSecret !== expectedSecret) {
      throw new Error("Unauthorized request.");
    }

    const required = [
      "studentBn", "studentEn", "fatherBn", "fatherEn", "fatherMobile",
      "motherBn", "motherEn", "motherMobile", "studentClass", "roll",
      "upazila", "institution", "teacher", "teacherMobile",
      "paymentMethod", "transactionId", "payerMobile", "photoBase64", "photoType"
    ];
    required.forEach(function(key) {
      if (data[key] === undefined || data[key] === null || String(data[key]).trim() === "") {
        throw new Error("Required information is missing.");
      }
    });

    const mobilePattern = /^(\+?88)?01[3-9]\d{8}$/;
    ["fatherMobile", "motherMobile", "teacherMobile"].forEach(function(key) {
      if (!mobilePattern.test(String(data[key]).trim())) throw new Error("Invalid mobile number.");
    });
    if (String(data.studentClass) !== "3") throw new Error("Invalid class.");
    if (data.upazila !== "রামু") throw new Error("Invalid upazila.");
    if (!/^[1-9]\d*$/.test(String(data.roll))) throw new Error("Invalid roll.");
    if (!["bkash", "nagad"].includes(data.paymentMethod)) throw new Error("Invalid payment method.");
    if (!/^[A-Za-z0-9-]{6,30}$/.test(String(data.transactionId).trim())) throw new Error("Invalid transaction ID.");
    const payerMobileOptions = {
      fatherMobile: String(data.fatherMobile),
      motherMobile: String(data.motherMobile),
      teacherMobile: String(data.teacherMobile)
    };
    if (!Object.prototype.hasOwnProperty.call(payerMobileOptions, data.payerMobile)) throw new Error("Invalid payer mobile selection.");
    if (!["image/jpeg", "image/png"].includes(data.photoType)) throw new Error("Only JPG and PNG images are allowed.");

    const bytes = Utilities.base64Decode(data.photoBase64);
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error("Photo must be 2 MB or smaller.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Run setup() first.");

    const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
    if (!folders.hasNext()) throw new Error("Photo folder not found.");
    const folder = folders.next();
    const ext = data.photoType === "image/png" ? ".png" : ".jpg";
    photo = folder.createFile(Utilities.newBlob(bytes, data.photoType, Utilities.getUuid() + ext));

    const id = "CPS2026-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    const submittedAt = new Date();

    sheet.appendRow([
      id, submittedAt,
      safeCell(data.studentBn), safeCell(data.studentEn),
      safeCell(data.fatherBn), safeCell(data.fatherMobile), safeCell(data.fatherEn),
      safeCell(data.motherBn), safeCell(data.motherMobile), safeCell(data.motherEn),
      String(data.studentClass), String(data.roll),
      safeCell(data.upazila), safeCell(data.institution),
      safeCell(data.teacher), safeCell(data.teacherMobile),
      data.paymentMethod, String(data.fee || "300"),
      "PENDING VERIFICATION - TRANSACTION ID SUBMITTED", photo.getUrl(),
      safeCell(data.transactionId), safeCell(payerMobileOptions[data.payerMobile])
    ]);

    return json_({ success: true, applicationId: id, submittedAt: submittedAt.toISOString() });
  } catch (err) {
    if (photo) { try { photo.setTrashed(true); } catch (_) {} }
    return json_({ success: false, message: err.message || "Submission failed." });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Prevent user-entered values from being interpreted as spreadsheet formulas.
function safeCell(value) {
  const s = String(value == null ? "" : value).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
