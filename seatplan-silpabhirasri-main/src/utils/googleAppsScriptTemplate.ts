/**
 * Google Apps Script Webhook Template for Ceremonial Seating Plan
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet
 * 2. In the top menu, go to Extensions > Apps Script
 * 3. Delete any default code and paste this code
 * 4. Click "Deploy" > "New deployment"
 * 5. Choose "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone"
 * 8. Click "Deploy", authorize permissions, and copy the Web app URL
 * 9. Paste that URL in the app's Google Sheet Sync settings
 */

export const GOOGLE_APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var contents = e.postData ? e.postData.contents : "";
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "No data received" })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = JSON.parse(contents);
    var action = data.action || "update";

    // Action 1: Push all seats from web to Google Sheet
    if (action === "push_all") {
      var seats = data.seats || [];
      var headers = ["รายชื่อ/ตำแหน่ง", "ตำแหน่ง/สังกัด", "ลำดับการวาง (Set)", "วางกระเช้าดอกไม้", "วาง Art Set", "ที่นั่ง", "สถานะการตอบกลับ"];
      sheet.clearContents();
      sheet.getRange(1, 1, 1, 7).setValues([headers]);

      seats.sort(function(a, b) {
        if (a.row !== b.row) return a.row.localeCompare(b.row);
        return (a.number || 0) - (b.number || 0);
      });

      var rows = [];
      for (var i = 0; i < seats.length; i++) {
        var s = seats[i];
        if (s.guestName || (s.status && s.status !== "empty")) {
          var posOrg = s.organization ? (s.position && s.position !== s.organization ? s.position + " (" + s.organization + ")" : s.organization) : (s.position || "");
          var st = s.status === "confirmed" ? "เข้าร่วม" : (s.status === "checked_in" ? "เช็คอินแล้ว" : (s.status === "absent" ? "สละสิทธิ์" : "รอการตอบกลับ"));
          rows.push([
            s.guestName || "",
            posOrg,
            s.setGroup || "",
            s.hasFlowerBasket ? "TRUE" : "FALSE",
            s.hasArtSet ? "TRUE" : "FALSE",
            s.id,
            st
          ]);
        }
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 7).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: rows.length })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action 2: Update or add a single seat
    if (action === "update" || action === "add") {
      var seatId = String(data.seatId || "").trim().toUpperCase();
      var values = sheet.getDataRange().getValues();
      var targetRow = -1;

      for (var r = 1; r < values.length; r++) {
        var existingSeatId = String(values[r][5] || "").trim().toUpperCase();
        if (existingSeatId === seatId) {
          targetRow = r + 1;
          break;
        }
      }

      var posOrg = data.organization ? (data.position && data.position !== data.organization ? data.position + " (" + data.organization + ")" : data.organization) : (data.position || "");
      var rowData = [
        data.guestName || "",
        posOrg,
        data.setGroup || "",
        data.hasFlowerBasket ? "TRUE" : "FALSE",
        data.hasArtSet ? "TRUE" : "FALSE",
        data.seatId || seatId,
        data.status || "เข้าร่วม"
      ];

      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, 7).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, seatId: seatId })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action 3: Clear or delete seat
    if (action === "clear" || action === "delete") {
      var seatId = String(data.seatId || "").trim().toUpperCase();
      var values = sheet.getDataRange().getValues();
      var targetRow = -1;
      for (var r = values.length - 1; r >= 1; r--) {
        if (String(values[r][5] || "").trim().toUpperCase() === seatId) {
          targetRow = r + 1;
          break;
        }
      }
      if (targetRow > 0) {
        if (action === "delete") {
          sheet.deleteRow(targetRow);
        } else {
          // Clear row values and set status to 'ว่าง'
          sheet.getRange(targetRow, 1, 1, 7).setValues([["", "", "", "FALSE", "FALSE", seatId, "ว่าง"]]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: action, seatId: seatId })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action 4: Save Plan Drive Image link
    if (action === "save_plan_drive_url" && data.planDriveUrl) {
      var planSheet = ss.getSheetByName("ภาพผัง");
      if (!planSheet) {
        planSheet = ss.insertSheet("ภาพผัง");
      }
      planSheet.getRange(1, 1).setValue("ลิงก์ Google Drive ภาพผังที่นั่ง");
      planSheet.getRange(2, 1).setValue(data.planDriveUrl);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action 5: Save Webhook URL & Configuration into Google Sheet ("ตั้งค่า")
    if (action === "save_config" || action === "save_apps_script_url") {
      var configSheet = ss.getSheetByName("ตั้งค่า") || ss.getSheetByName("Config");
      if (!configSheet) {
        configSheet = ss.insertSheet("ตั้งค่า");
      }
      configSheet.getRange(1, 1).setValue("คีย์ (Key)");
      configSheet.getRange(1, 2).setValue("ค่า (Value)");
      configSheet.getRange(1, 3).setValue("อัปเดตล่าสุด");

      var cfgVals = configSheet.getDataRange().getValues();
      var scriptRow = -1;
      var driveRow = -1;
      for (var cr = 1; cr < cfgVals.length; cr++) {
        var k = String(cfgVals[cr][0] || "").trim().toLowerCase();
        if (k === "appsscripturl" || k === "webhook" || k === "script_url") scriptRow = cr + 1;
        if (k === "plandriveurl" || k === "drive_image") driveRow = cr + 1;
      }

      var nowIso = new Date().toISOString();
      if (data.appsScriptUrl) {
        if (scriptRow > 0) {
          configSheet.getRange(scriptRow, 2).setValue(data.appsScriptUrl);
          configSheet.getRange(scriptRow, 3).setValue(nowIso);
        } else {
          configSheet.appendRow(["appsScriptUrl", data.appsScriptUrl, nowIso]);
        }
      }
      if (data.planDriveUrl) {
        if (driveRow > 0) {
          configSheet.getRange(driveRow, 2).setValue(data.planDriveUrl);
          configSheet.getRange(driveRow, 3).setValue(nowIso);
        } else {
          configSheet.appendRow(["planDriveUrl", data.planDriveUrl, nowIso]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Saved config to sheet successfully" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("ตั้งค่า") || ss.getSheetByName("Config");
  var savedScriptUrl = "";
  var savedDriveUrl = "";
  if (configSheet) {
    var vals = configSheet.getDataRange().getValues();
    for (var r = 1; r < vals.length; r++) {
      var k = String(vals[r][0] || "").trim().toLowerCase();
      if (k === "appsscripturl" || k === "webhook") savedScriptUrl = String(vals[r][1] || "").trim();
      if (k === "plandriveurl") savedDriveUrl = String(vals[r][1] || "").trim();
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Sheet Sync Webhook is running",
    appsScriptUrl: savedScriptUrl,
    planDriveUrl: savedDriveUrl
  })).setMimeType(ContentService.MimeType.JSON);
}`;
