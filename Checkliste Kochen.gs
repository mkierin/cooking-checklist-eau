// Original applyCheckedFormatting Funktion beibehalten
function applyCheckedFormatting(sheet, startRow, endRow) {
  // Apply font size to columns
  sheet.getRange(startRow, 1, endRow - startRow + 1, 2).setFontSize(20); // Columns A and B
  sheet.getRange(startRow, 3, endRow - startRow + 1, 2).setFontSize(40); // Columns C and D
}

// Google Apps Script for Kitchen Production Checklist
// This script handles the dynamic sorting of rows based on checkbox status

// This function runs when the spreadsheet is opened
function onOpen() {
  // Create menu
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Checkliste')
      .addItem('Sortieren', 'sortDishes')
      .addToUi();
  
  // Initialize status column and ensure all rows have status values
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("[Checkliste] Kochen & Portionieren");
  if (sheet) {
    Logger.log("Initializing on open");
    initializeStatusColumn();
    fastSort(sheet);
  }
}

// Diese Funktionen bleiben unverändert für manuelle Ausführung:
function sortDishes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  
  if (!checklistSheet) {
    SpreadsheetApp.getUi().alert("Checkliste nicht gefunden.");
    return;
  }
  
  fastSort(checklistSheet);
  SpreadsheetApp.getUi().alert("Sortierung abgeschlossen.");
}

function onEdit(e) {
  // Get the active sheet
  var sheet = e.source.getActiveSheet();
  
  // Only run in the "[Checkliste] Kochen & Portionieren" sheet
  if (sheet.getName() !== "[Checkliste] Kochen & Portionieren") return;
  
  // Get the edited range
  var range = e.range;
  
  // Check if the edit was in column C (Cooking Checkbox) or D (Portioning Checkbox)
  if (range.getColumn() == 3 || range.getColumn() == 4) {
    var row = range.getRow();
    
    // Skip header row
    if (row <= 1) return;
    
    // Add a small delay to avoid multiple triggers
    Utilities.sleep(100);
    
    // Flag to prevent re-entry
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return; // If can't get lock within 1 second, exit

    try {
      // Get the current data (excluding headers)
      var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5);
      var data = dataRange.getValues();
      
      // Create arrays to store URLs and cell info for each row
      var urls = [];
      var rowCheckboxes = [];
      
      // Store the current URLs and checkbox states before sorting
      for (var i = 0; i < data.length; i++) {
        var rowIndex = i + 2; // +2 because we start at row 2 (after header)
        
        // Get hyperlink from column A if it exists
        var cellA = sheet.getRange(rowIndex, 1);
        var richTextA = cellA.getRichTextValue();
        var linkUrl = null;
        
        if (richTextA) {
          var linkUrls = richTextA.getLinkUrl();
          if (linkUrls) {
            linkUrl = linkUrls;
          }
        }
        
        urls.push(linkUrl);
        rowCheckboxes.push({
          cooking: data[i][2], // Column C (index 2)
          portioning: data[i][3] // Column D (index 3)
        });
      }
      
      // Sort the data based on checkbox status, portions, and alphabetically
      data.sort(function(a, b) {
        // First priority: Is item portioned (column D checked)? These go to the bottom
        if (a[3] && !b[3]) return 1;
        if (!a[3] && b[3]) return -1;
        
        // Second priority: Items with 0 portions go to the bottom (but above portioned items)
        // Column B (index 1) contains portions
        if (!a[3] && !b[3]) { // Only if neither is portioned
          // Check for zero portions
          if (a[1] === 0 && b[1] !== 0) return 1;   // a has 0 portions, move down
          if (a[1] !== 0 && b[1] === 0) return -1;  // b has 0 portions, move down
          
          // If both have zero portions or both have non-zero portions
          if ((a[1] === 0 && b[1] === 0) || (a[1] > 0 && b[1] > 0)) {
            // Third priority: For non-portioned items with the same portions status (both 0 or both >0)
            // Sort by cooked status
            if (a[2] && !b[2]) return -1;  // a is cooked, move up
            if (!a[2] && b[2]) return 1;   // b is cooked, move up
            
            // If cooking status is the same, sort alphabetically by dish name
            // Only for dishes with portions > 0
            if (a[1] > 0 && b[1] > 0 && a[2] === b[2]) {
              return a[0].toString().localeCompare(b[0].toString());
            }
          }
        }
        
        // If status is the same, keep original order
        return 0;
      });
      
      // Create an array to track which original rows are in which new positions
      var newPositions = [];
      for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data.length; j++) {
          if (data[i][0] === dataRange.getValues()[j][0] && 
              data[i][1] === dataRange.getValues()[j][1] && 
              data[i][4] === dataRange.getValues()[j][4]) {
            newPositions.push(j);
            break;
          }
        }
      }
      
      // Write the sorted data back to the sheet
      dataRange.setValues(data);
      
      // Re-apply the links and checkboxes after sorting
      for (var i = 0; i < data.length; i++) {
        var rowIndex = i + 2; // +2 because we start at row 2 (after header)
        var originalPos = newPositions[i];
        
        // Re-apply link if it exists
        if (urls[originalPos]) {
          var cell = sheet.getRange(rowIndex, 1);
          var richText = SpreadsheetApp.newRichTextValue()
                        .setText(data[i][0])
                        .setLinkUrl(urls[originalPos])
                        .build();
          cell.setRichTextValue(richText);
        }
        
        // Ensure checkboxes match the sorted data
        sheet.getRange(rowIndex, 3).setValue(data[i][2]); // Column C (Cooking)
        sheet.getRange(rowIndex, 4).setValue(data[i][3]); // Column D (Portioning)
      }
      
      // Re-apply formatting to preserve font sizes
      applyCheckedFormatting(sheet, 2, sheet.getLastRow());
    } finally {
      lock.releaseLock();
    }
  }
}

function applyConditionalFormatting(sheet) {
  // Clear existing conditional formatting rules
  sheet.clearConditionalFormatRules();
  
  // Get range for rules (all rows except header)
  var dataRange = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 5);
  
  // Die Reihenfolge ist hier entscheidend! Die erste Regel hat die höchste Priorität
  
  // Regel 1 (höchste Priorität): Portionierte Artikel (blau)
  var portionedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2=TRUE')
    .setBackground("#9fc5e8")  // Hellblau
    .setRanges([dataRange])
    .build();
  
  // Regel 2 (zweithöchste Priorität): Gekochte Artikel (grün)
  var cookedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C2=TRUE')
    .setBackground("#b6d7a8")  // Hellgrün
    .setRanges([dataRange])
    .build();
  
  // Regel 3 (dritthöchste Priorität): Artikel mit 0 Portionen (hellgraue Hintergrundfarbe)
  var zeroPortionsRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B2=0')
    .setBackground("#eeeeee")  // Hellgrau
    .setRanges([dataRange])
    .build();
  
  // Regeln in der richtigen Reihenfolge hinzufügen
  // WICHTIG: Die Reihenfolge bestimmt die Priorität (erste Regel hat Vorrang)
  sheet.setConditionalFormatRules([portionedRule, cookedRule, zeroPortionsRule]);
}

// Function to set up the initial checklist structure
function setupChecklist() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  
  // Create the sheet if it doesn't exist
  if (!checklistSheet) {
    checklistSheet = ss.insertSheet("[Checkliste] Kochen & Portionieren");
  }
  
  // Set up headers
  checklistSheet.getRange("A1").setValue("Gericht");
  checklistSheet.getRange("B1").setValue("Portionen");
  checklistSheet.getRange("C1").setValue("Gekocht");
  checklistSheet.getRange("D1").setValue("Portioniert");
  checklistSheet.getRange("E1").setValue("Gericht-ID");
  
  // Format headers
  checklistSheet.getRange("A1:E1").setBackground("#f9cb9c");
  checklistSheet.getRange("A1:E1").setFontWeight("bold");
  checklistSheet.getRange("A1:E1").setFontSize(14); // Set header font size
  
  // Add checkboxes to columns C and D
  var lastRow = Math.max(checklistSheet.getLastRow(), 2);
  if (lastRow > 1) {
    checklistSheet.getRange(2, 3, lastRow - 1, 1).insertCheckboxes();
    checklistSheet.getRange(2, 4, lastRow - 1, 1).insertCheckboxes();
    
    // Apply font formatting
    applyCheckedFormatting(checklistSheet, 2, lastRow);
  }
  
  // Apply conditional formatting
  applyConditionalFormatting(checklistSheet);
  
  // Set column widths
  checklistSheet.setColumnWidth(1, 250);  // Gericht
  checklistSheet.setColumnWidth(2, 100);  // Portionen
  checklistSheet.setColumnWidth(3, 100);  // Gekocht
  checklistSheet.setColumnWidth(4, 100);  // Portioniert
  checklistSheet.setColumnWidth(5, 100);  // Gericht-ID
  
  // Set row heights to accommodate larger font
  for (var i = 2; i <= lastRow; i++) {
    checklistSheet.setRowHeight(i, 40);
  }
}

// Function to update portions from Kundenbestellungen sheet without changing dishes
// Neue Funktion für zeitverzögertes Sortieren
function performSortingDelayed() {
  // Entferne den Trigger nach Ausführung, damit er nicht wieder ausgelöst wird
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'performSortingDelayed') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Holen der Sortierinfos
  var sortInfoStr = PropertiesService.getScriptProperties().getProperty('sortInfo');
  if (!sortInfoStr) return;
  
  var sortInfo = JSON.parse(sortInfoStr);
  var now = new Date().getTime();
  
  // Wenn der Trigger zu alt ist (> 10 Sekunden), ignorieren
  if (now - sortInfo.timestamp > 10000) return;
  
  // Sheet holen
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  if (!checklistSheet) return;
  
  try {
    // Durchführen der Sortierung mit minimalem Overhead
    fastSort(checklistSheet);
  } catch(e) {
    Logger.log("Fehler bei verzögerter Sortierung: " + e.toString());
  }
}

// Hochperformante Sortierung mit minimalem Overhead
function fastSort(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  // Alles in einem Rutsch lesen (nur ein API-Aufruf)
  var allDataRange = sheet.getRange(2, 1, lastRow - 1, 5);
  var allData = allDataRange.getValues();
  
  // Hyperlinks in einem einzigen Durchgang sammeln
  var linkCache = {};
  var richTextValues = [];
  
  // Alle RichTextValues auf einmal holen (nur ein API-Aufruf)
  for (var c = 1; c <= 1; c++) { // Nur Spalte A (mit den Links)
    var colRange = sheet.getRange(2, c, lastRow - 1, 1);
    richTextValues.push(colRange.getRichTextValues());
  }
  
  // Links aus den RichTextValues extrahieren
  for (var i = 0; i < richTextValues[0].length; i++) {
    var richText = richTextValues[0][i][0]; // [0][i][0] = erste Spalte, i-te Zeile, erste (und einzige) Zelle
    if (richText && richText.getLinkUrl()) {
      var text = allData[i][0];
      linkCache[text] = richText.getLinkUrl();
    }
  }
  
  // Werte mit Index für stabile Sortierung
  var indexedData = allData.map(function(row, idx) {
    return {
      values: row,
      originalIndex: idx
    };
  });
  
  // Sortieren
  indexedData.sort(function(a, b) {
    var aValues = a.values;
    var bValues = b.values;
    
    // Portionierte Artikel nach unten
    if (aValues[3] && !bValues[3]) return 1;
    if (!aValues[3] && bValues[3]) return -1;
    
    // Artikel mit 0 Portionen nach unten
    if (!aValues[3] && !bValues[3]) {
      if (aValues[1] === 0 && bValues[1] !== 0) return 1;
      if (aValues[1] !== 0 && bValues[1] === 0) return -1;
      
      if ((aValues[1] === 0 && bValues[1] === 0) || (aValues[1] > 0 && bValues[1] > 0)) {
        // Gekochte Artikel nach oben
        if (aValues[2] && !bValues[2]) return -1;
        if (!aValues[2] && bValues[2]) return 1;
        
        // Alphabetische Sortierung
        if (aValues[1] > 0 && bValues[1] > 0 && aValues[2] === bValues[2]) {
          return aValues[0].toString().localeCompare(bValues[0].toString());
        }
      }
    }
    
    // Gleiche Priorität = originale Reihenfolge beibehalten
    return a.originalIndex - b.originalIndex;
  });
  
  // Sortierte Werte zurück extrahieren
  var sortedValues = indexedData.map(function(item) {
    return item.values;
  });
  
  // Daten in einem Rutsch zurückschreiben (nur ein API-Aufruf)
  allDataRange.setValues(sortedValues);
  
  // Links wiederherstellen - gruppierte Aktualisierungen vorbereiten
  var linkUpdates = [];
  for (var i = 0; i < sortedValues.length; i++) {
    var dishName = sortedValues[i][0];
    if (linkCache[dishName]) {
      linkUpdates.push({
        row: i + 2,
        text: dishName,
        url: linkCache[dishName]
      });
    }
  }
  
  // Links in Blöcken zu je 10 aktualisieren, um die Performance zu verbessern
  var blockSize = 10;
  for (var i = 0; i < linkUpdates.length; i += blockSize) {
    var batch = linkUpdates.slice(i, i + blockSize);
    for (var j = 0; j < batch.length; j++) {
      var update = batch[j];
      var cell = sheet.getRange(update.row, 1);
      var richText = SpreadsheetApp.newRichTextValue()
          .setText(update.text)
          .setLinkUrl(update.url)
          .build();
      cell.setRichTextValue(richText);
    }
  }
}

// NEW STATUS-BASED SORTING SYSTEM
function calculateStatus(rowData) {
  var dish = rowData[0];
  var portions = rowData[1];
  var cooked = rowData[2];
  var portioned = rowData[3];
  
  // Debug the raw values
  Logger.log("CALCULATE STATUS - Raw values:");
  Logger.log("Dish: " + dish);
  Logger.log("Portions: " + portions + " (type: " + typeof portions + ")");
  Logger.log("Cooked: " + cooked + " (type: " + typeof cooked + ")");
  Logger.log("Portioned: " + portioned + " (type: " + typeof portioned + ")");
  
  // CRITICAL: Handle all possible checkbox value formats
  // Google Sheets checkboxes can be TRUE/FALSE strings, true/false booleans, or checked/unchecked values
  if (cooked === true || cooked === "TRUE" || cooked === "true" || cooked === "WAHR" || cooked === "wahr" || cooked === "✓" || cooked === "✔" || cooked === "☑") {
    cooked = true;
  } else {
    cooked = false;
  }
  
  if (portioned === true || portioned === "TRUE" || portioned === "true" || portioned === "WAHR" || portioned === "wahr" || portioned === "✓" || portioned === "✔" || portioned === "☑") {
    portioned = true;
  } else {
    portioned = false;
  }
  
  Logger.log("After conversion - Cooked: " + cooked + ", Portioned: " + portioned);
  
  // SUPER SIMPLE status calculation with clear separation between categories
  // Using single-digit values for clarity
  
  // 1. Cooked items with portions > 0 (TOP PRIORITY)
  if (cooked === true && portions > 0) {
    Logger.log("Cooked with portions > 0, status = 0");
    return 0;
  }
  
  // 2. Uncooked items with portions > 0
  if (cooked === false && portions > 0) {
    Logger.log("Uncooked with portions > 0, status = 1");
    return 1;
  }
  
  // 3. Cooked items with 0 portions
  if (cooked === true && (portions === 0 || portions === "")) {
    Logger.log("Cooked with 0 portions, status = 2");
    return 2;
  }
  
  // 4. Uncooked items with 0 portions
  if (cooked === false && (portions === 0 || portions === "")) {
    Logger.log("Uncooked with 0 portions, status = 3");
    return 3;
  }
  
  // 5. Portioned items (BOTTOM PRIORITY)
  if (portioned === true) {
    Logger.log("Portioned item, status = 4");
    return 4;
  }
  
  // Default case (should never reach here)
  Logger.log("Default case, status = 5");
  return 5;
}

function updateStatus(row) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rowData = sheet.getRange(row, 1, 1, 5).getValues()[0];
  
  // Log the raw data
  Logger.log("UPDATE STATUS: Raw row data: " + JSON.stringify(rowData));
  
  var dish = rowData[0];
  var portions = rowData[1];
  var cooked = rowData[2];
  var portioned = rowData[3];
  
  Logger.log("Dish: " + dish + ", Portions: " + portions + ", Cooked: " + cooked + ", Portioned: " + portioned);
  
  var status = calculateStatus(rowData);
  Logger.log("Calculated status: " + status);
  
  // Update the status cell
  sheet.getRange(row, 7).setValue(status); // Update Status column (G)
  
  // Verify the update
  var newStatus = sheet.getRange(row, 7).getValue();
  Logger.log("STATUS UPDATED: Row " + row + ": " + dish + " - New status: " + newStatus);
}

function updateAllStatuses() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var data = values.slice(1);
  
  Logger.log("Updating all statuses for " + data.length + " rows");
  
  var statuses = [];
  for (var i = 0; i < data.length; i++) {
    var rowData = data[i];
    var status = calculateStatus(rowData);
    statuses.push([status]);
    
    // Log every few rows to avoid excessive logging
    if (i < 10 || i % 10 === 0) {
      Logger.log("Row " + (i+2) + ": " + rowData[0] + " - Status: " + status + ", Cooked: " + rowData[2]);
    }
  }
  
  // Update all statuses at once
  if (statuses.length > 0) {
    sheet.getRange(2, 7, statuses.length, 1).setValues(statuses);
    Logger.log("Updated " + statuses.length + " status values");
  }
}

function initializeStatusColumn() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("[Checkliste] Kochen & Portionieren");
  if (!sheet) return;
  
  // Check if column G exists and has a header
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 7) {
    // Add column G if it doesn't exist
    sheet.insertColumnAfter(6);
    sheet.getRange(1, 7).setValue("Status");
  }
  
  // Always hide the status column
  sheet.hideColumns(7);
  
  // Initialize all status values
  updateAllStatuses();
  
  Logger.log("Status column initialized");
}

// Use triggers for debouncing in Google Apps Script
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "[Checkliste] Kochen & Portionieren") return;

  var column = e.range.getColumn();
  var row = e.range.getRow();
  if (row === 1 || (column != 2 && column != 3 && column != 4)) return;

  Logger.log("EDIT DETECTED: Row " + row + ", Column " + column);
  Logger.log("Edit value: " + e.value + " (type: " + typeof e.value + ")");
  
  // Get the current values of the row
  var rowData = sheet.getRange(row, 1, 1, 5).getValues()[0];
  Logger.log("Row data: " + JSON.stringify(rowData));
  
  // Update just the changed row's status
  updateStatus(row);
  
  // Immediately check if status was updated
  var newStatus = sheet.getRange(row, 7).getValue();
  Logger.log("New status value: " + newStatus);
  
  // Schedule a delayed sort (Google Apps Script version of debouncing)
  Logger.log("Scheduling sort...");
  scheduleSort();
  
  // Force a refresh of the sheet to ensure UI updates
  SpreadsheetApp.flush();
}

function scheduleSort() {
  // Delete any existing triggers for sorting
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'performScheduledSort') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create a new trigger to sort after 1 second (reduced for faster feedback)
  ScriptApp.newTrigger('performScheduledSort')
    .timeBased()
    .after(1000) // 1 second
    .create();
  
  Logger.log("Sort scheduled to run in 1 second");
  
  // IMPORTANT: For debugging, we'll also run an immediate sort
  // This helps us see if the trigger system is the issue
  Logger.log("ALSO running immediate sort for debugging");
  performScheduledSort();
}

function performScheduledSort() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("[Checkliste] Kochen & Portionieren");
  if (sheet) {
    Logger.log("SORTING NOW: Performing scheduled sort");
    
    // Force a full refresh of status values BEFORE sorting
    updateAllStatuses();
    
    // Debug: Check status values before sorting
    var data = sheet.getDataRange().getValues();
    Logger.log("STATUS VALUES BEFORE SORT:");
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = row[0];
      var portions = row[1];
      var cooked = row[2];
      var portioned = row[3];
      var status = row[6]; // Status in column G (index 6)
      Logger.log("Row " + (i+1) + ": " + name + " - Status: " + status + ", Portions: " + portions + ", Cooked: " + cooked + ", Portioned: " + portioned);
    }
    
    // DIRECTLY sort the data without using fastSort
    sheet.getDataRange().sort({column: 7, ascending: true});
    
    // Debug: Check order after sorting
    var sortedData = sheet.getDataRange().getValues();
    Logger.log("ORDER AFTER SORT:");
    for (var i = 1; i < sortedData.length; i++) {
      var row = sortedData[i];
      var name = row[0];
      var status = row[6];
      Logger.log("Row " + (i+1) + ": " + name + " - Status: " + status + ", Cooked: " + row[2]);
    }
    
    // Apply formatting
    adjustFontSizes(false);
  }
}

function fastSort(sheet) {
  // First ensure all status values are up to date
  updateAllStatuses();
  
  // Perform the sort - only by status column
  var range = sheet.getDataRange();
  range.sort({column: 7, ascending: true}); // Sort by status column (G) only
  
  // Log after sorting for debugging
  Logger.log("Sorting complete - current order:");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < Math.min(data.length, 10); i++) {
    Logger.log("Row " + i + ": " + data[i][0] + " - Status: " + data[i][6] + ", Cooked: " + data[i][2]);
  }
  
  adjustFontSizes(false); // Pass false to avoid showing alerts
}

function sortDishes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  
  if (!checklistSheet) {
    Logger.log("Checkliste nicht gefunden.");
    return;
  }
  
  // Get the last row
  var lastRow = checklistSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("Keine Daten zum Sortieren.");
    return; // No data to sort
  }
  
  Logger.log("Sortiere Daten in Checkliste Kochen & Portionieren...");
  
  try {
    // Ensure status column exists and is initialized
    initializeStatusColumn();
    
    // Use the optimized fastSort function
    fastSort(checklistSheet);
    
    Logger.log("Sortierung abgeschlossen.");
  } catch (error) {
    Logger.log("Fehler beim Sortieren: " + error.toString());
  }
}

function updatePortions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  var orderSheet = ss.getSheetByName("Kundenbestellungen");
  
  // Exit if either sheet doesn't exist
  if (!checklistSheet || !orderSheet) {
    SpreadsheetApp.getUi().alert("Beide Sheets ([Checkliste] Kochen & Portionieren und Kundenbestellungen) müssen existieren.");
    return;
  }
  
  // Debug-Log zum Tracken der Funktionsausführung
  Logger.log("updatePortions Funktion gestartet");
  
  // Get checklist data including hyperlinks
  var lastRow = checklistSheet.getLastRow();
  if (lastRow <= 1) return; // No data
  
  var checklistRange = checklistSheet.getRange(2, 1, lastRow - 1, 5);
  var checklistData = checklistRange.getValues();
  
  // Store hyperlink info
  var hyperlinks = [];
  for (var i = 0; i < checklistData.length; i++) {
    var rowIndex = i + 2;
    var cell = checklistSheet.getRange(rowIndex, 1);
    var richText = cell.getRichTextValue();
    var linkUrl = null;
    
    if (richText) {
      linkUrl = richText.getLinkUrl();
    }
    
    hyperlinks.push(linkUrl);
  }
  
  // Get order data
  var orderRange = orderSheet.getDataRange();
  var orderData = orderRange.getValues();
  
  // Find the column indexes in order sheet
  var totalCol = -1;
  var dishIdCol = -1;
  
  // Find columns in order data
  for (var i = 0; i < orderData[0].length; i++) {
    var headerText = String(orderData[0][i]).trim();
    if (headerText === "total") totalCol = i;
    if (headerText === "Gericht-ID") dishIdCol = i;
  }
  
  // Exit if we couldn't find the required columns
  if (totalCol === -1 || dishIdCol === -1) {
    var errorMsg = "Konnte die erforderlichen Spalten nicht finden.\n";
    errorMsg += "Benötigt: 'total' und 'Gericht-ID' Spalten in Kundenbestellungen.";
    SpreadsheetApp.getUi().alert(errorMsg);
    return;
  }
  
  // Find Gericht-ID column in checklist - we know it's always column E (index 4)
  var checklistIdCol = 4; // E ist die 5. Spalte (nullbasierter Index 4)
  
  // Backup-Suche falls die feste Spalte nicht funktioniert
  if (checklistData[0].length <= checklistIdCol || String(checklistData[0][checklistIdCol]).trim() !== "Gericht-ID") {
    // Versuche manuell zu suchen
    for (var i = 0; i < checklistData[0].length; i++) {
      var headerText = String(checklistData[0][i]).trim();
      if (headerText === "Gericht-ID") {
        checklistIdCol = i;
        break;
      }
    }
    
    // Wenn immer noch nicht gefunden, verwenden wir die Standardposition
    if (checklistIdCol === -1) {
      Logger.log("Spaltenüberschrift 'Gericht-ID' nicht gefunden, verwende Spalte E (nullbasierter Index 4)");
      checklistIdCol = 4; // Fallback zu E
    }
  }
  
  // Create a map of dish IDs to portions from order data
  var portionsMap = {};
  for (var i = 1; i < orderData.length; i++) {
    if (orderData[i][dishIdCol]) {
      var dishId = String(orderData[i][dishIdCol]).trim();
      var portions = orderData[i][totalCol];
      
      // Debug-Logging
      Logger.log("Verarbeite Gericht-ID: " + dishId + ", Portionen vorher: " + portions);
      
      // Add 2 to portions if it's a number
      if (typeof portions === 'number') {
        portions = portions + 2;
        Logger.log("Portionen nach +2: " + portions);
      }
      
      portionsMap[dishId] = portions;
    }
  }
  
  // Log die gesamte Portions-Map
  Logger.log("Portions-Map: " + JSON.stringify(portionsMap));
  
  // Update portions in checklist without disturbing hyperlinks
  var updated = 0;
  var reset = 0;
  for (var i = 0; i < checklistData.length; i++) {
    var rowIndex = i + 2;
    
    // Sicherstellen, dass die checklistIdCol gültig ist
    if (checklistIdCol >= checklistData[i].length) {
      Logger.log("Warnung: checklistIdCol (" + checklistIdCol + ") ist größer als die Anzahl der Spalten in Zeile " + rowIndex);
      continue;
    }
    
    var dishId = String(checklistData[i][checklistIdCol]).trim();
    Logger.log("Zeile " + rowIndex + ", Gericht-ID: '" + dishId + "'");
    
    if (dishId) {
      if (portionsMap[dishId] !== undefined) {
        // Only update the portion value
        Logger.log("Update Portionen für " + dishId + " auf " + portionsMap[dishId]);
        checklistSheet.getRange(rowIndex, 2).setValue(portionsMap[dishId]);
        updated++;
      } else {
        // Set to 0 for dishes that don't exist in the orders
        Logger.log("Setze Portionen für " + dishId + " auf 0 (nicht in Bestellungen gefunden)");
        checklistSheet.getRange(rowIndex, 2).setValue(0);
        reset++;
      }
    } else {
      Logger.log("Keine Gericht-ID in Zeile " + rowIndex + " gefunden");
    }
  }
  
  Logger.log("Aktualisiert: " + updated + " Gerichte, Zurückgesetzt: " + reset + " Gerichte");
  
  // Re-apply links
  for (var i = 0; i < hyperlinks.length; i++) {
    var rowIndex = i + 2;
    if (hyperlinks[i]) {
      var cell = checklistSheet.getRange(rowIndex, 1);
      var text = cell.getValue();
      var richText = SpreadsheetApp.newRichTextValue()
                    .setText(text)
                    .setLinkUrl(hyperlinks[i])
                    .build();
      cell.setRichTextValue(richText);
    }
  }
  
  // Maintain formatting
  applyCheckedFormatting(checklistSheet, 2, lastRow);
  
  // Automatically sort dishes after updating portions
  sortDishes();
}

// Function to reapply formatting
function reapplyFormatting() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  
  if (checklistSheet) {
    applyConditionalFormatting(checklistSheet);
    SpreadsheetApp.getUi().alert("Formatierung wurde neu angewendet.");
  } else {
    SpreadsheetApp.getUi().alert("Bitte erst die Checkliste einrichten.");
  }
}

// Function to adjust font sizes
function adjustFontSizes(showAlerts) {
  // Default showAlerts to true if not specified
  if (showAlerts === undefined) showAlerts = true;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checklistSheet = ss.getSheetByName("[Checkliste] Kochen & Portionieren");
  
  if (checklistSheet) {
    var lastRow = checklistSheet.getLastRow();
    if (lastRow > 1) {
      applyCheckedFormatting(checklistSheet, 2, lastRow);
      
      // Set row heights to accommodate larger font
      for (var i = 2; i <= lastRow; i++) {
        checklistSheet.setRowHeight(i, 40);
      }
      
      // Only show alerts if explicitly requested
      if (showAlerts) {
        SpreadsheetApp.getUi().alert("Schriftgrößen wurden angepasst.");
      }
    } else if (showAlerts) {
      SpreadsheetApp.getUi().alert("Keine Daten vorhanden.");
    }
  } else if (showAlerts) {
    SpreadsheetApp.getUi().alert("Bitte erst die Checkliste einrichten.");
  }
}