/**
 * Setup script for Portionen Gesamt calculation sheet
 * This script creates a new sheet or updates an existing one with helper columns and formulas
 * to calculate total portions and ingredients based on customer orders and recipe database.
 */

function setupPortionenGesamtSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let checklistSheet = ss.getSheetByName("F_[Checkliste] Portionen Gesamt");
  
  // Create the sheet if it doesn't exist
  if (!checklistSheet) {
    checklistSheet = ss.insertSheet("F_[Checkliste] Portionen Gesamt");
    Logger.log("Created new sheet: F_[Checkliste] Portionen Gesamt");
  } else {
    // Clear existing content except headers if sheet exists
    const lastRow = Math.max(checklistSheet.getLastRow(), 2);
    const lastCol = Math.max(checklistSheet.getLastColumn(), 6);
    if (lastRow > 1 && lastCol >= 1) {
      checklistSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
  }
  
  // Set headers for the checklist
  const headers = ["Gericht", "Anzahl Bestellungen", "Gericht auswählen", "Zutat", "Bruttogewicht (g/Portion)", "Gesamtmenge (kg)"];
  checklistSheet.getRange("A1:F1").setValues([headers]);
  checklistSheet.getRange("A1:F1").setFontWeight("bold");
  
  // Transfer order data to columns A and B
  const orderSheet = ss.getSheetByName("Kundenbestellungen");
  if (!orderSheet) {
    SpreadsheetApp.getUi().alert("Kundenbestellungen sheet not found. Please ensure it exists.");
    return;
  }
  const orderLastRow = orderSheet.getLastRow();
  if (orderLastRow > 1) {
    const orderData = orderSheet.getRange("A2:B" + orderLastRow).getValues();
    checklistSheet.getRange(2, 1, orderData.length, 2).setValues(orderData);
  } else {
    Logger.log("Order sheet is empty or only has headers");
  }
  
  // Get list of all dishes for dropdown from Rezeptedatenbank
  const recipeSheet = ss.getSheetByName("Rezeptedatenbank");
  if (!recipeSheet) {
    SpreadsheetApp.getUi().alert("Rezeptedatenbank sheet not found. Please ensure it exists.");
    return;
  }
  const recipeLastRow = recipeSheet.getLastRow();
  let allDishes = [];
  if (recipeLastRow > 1) {
    const recipeData = recipeSheet.getRange("A2:B" + recipeLastRow).getValues();
    const dishIds = {};
    for (let i = 0; i < recipeData.length; i++) {
      if (recipeData[i][0] && !recipeData[i][0].toString().trim().startsWith("Gesamt")) {
        const gerichtId = recipeData[i][1];
        if (gerichtId && !dishIds[gerichtId]) {
          allDishes.push(recipeData[i][0]);
          dishIds[gerichtId] = true;
        }
      }
    }
  }
  
  // Set dropdown in cell C2 for dish selection
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allDishes, true)
    .build();
  checklistSheet.getRange("C2").setDataValidation(rule);
  
  // Add note for where formulas will be dynamically updated
  checklistSheet.getRange("D2:F2").setNote("Formulas for ingredients and quantities will be populated here based on the selected dish in C2.");
  
  // Set up an onEdit trigger to handle dish selection
  setupOnEditTrigger();
  
  // Adjust column widths for better visibility
  checklistSheet.setColumnWidths(1, 6, 150);
  
  SpreadsheetApp.getUi().alert("Setup for F_[Checkliste] Portionen Gesamt completed. Select a dish in cell C2 to populate ingredients.");
  Logger.log("Setup completed for F_[Checkliste] Portionen Gesamt sheet");
}

function setupOnEditTrigger() {
  // Delete any existing triggers for onEditHandler
  const allTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === "onEditHandler") {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  }
  
  // Create a new trigger
  ScriptApp.newTrigger("onEditHandler")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log("onEdit trigger set up for dish selection");
}

function onEditHandler(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() === "F_[Checkliste] Portionen Gesamt" && e.range.getA1Notation() === "C2") {
    populateIngredientsForSelectedDish(e.value);
  }
}

function populateIngredientsForSelectedDish(selectedDish) {
  if (!selectedDish) {
    Logger.log("No dish selected, clearing ingredient list");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const checklistSheet = ss.getSheetByName("F_[Checkliste] Portionen Gesamt");
    const lastRow = Math.max(checklistSheet.getLastRow(), 2);
    if (lastRow > 1) {
      checklistSheet.getRange(2, 4, lastRow - 1, 3).clearContent();
    }
    return;
  }
  
  Logger.log("Selected dish: " + selectedDish);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checklistSheet = ss.getSheetByName("F_[Checkliste] Portionen Gesamt");
  const recipeSheet = ss.getSheetByName("Rezeptedatenbank");
  
  // Get recipe data
  const recipeLastRow = recipeSheet.getLastRow();
  if (recipeLastRow < 2) {
    Logger.log("Recipe sheet is empty");
    return;
  }
  const recipeData = recipeSheet.getRange("A2:E" + recipeLastRow).getValues();
  
  // Find ingredients for the selected dish
  const ingredients = [];
  let recipeFound = false;
  for (let i = 0; i < recipeData.length; i++) {
    if (recipeData[i][0] === selectedDish && recipeData[i][2]) {
      recipeFound = true;
      ingredients.push([recipeData[i][2], recipeData[i][3]]);
    } else if (recipeFound && recipeData[i][0] && recipeData[i][0].toString().trim().startsWith("Gesamt")) {
      break;
    }
  }
  
  if (ingredients.length > 0) {
    // Clear previous ingredients
    const lastRow = Math.max(checklistSheet.getLastRow(), 2);
    if (lastRow > 1) {
      checklistSheet.getRange(2, 4, lastRow - 1, 3).clearContent();
    }
    
    // Write ingredient names and per-portion weights starting from row 2
    checklistSheet.getRange(2, 4, ingredients.length, 2).setValues(ingredients);
    
    // Set formula for Gesamtmenge (kg) in column F
    // This formula looks up the number of orders for the selected dish and multiplies by Bruttogewicht per portion
    for (let i = 0; i < ingredients.length; i++) {
      const row = i + 2;
      // Formula: If the dish in C2 matches a dish in column A, multiply the corresponding orders (column B) by the per-portion weight (column E), then divide by 1000 to convert grams to kg
      checklistSheet.getRange(row, 6).setFormula(`=IFERROR(SUMIF(A:A, C$2, B:B) * E${row} / 1000, 0)`);
    }
    Logger.log("Populated " + ingredients.length + " ingredients for " + selectedDish + " with formulas for total quantity");
  } else {
    Logger.log("No ingredients found for " + selectedDish);
    checklistSheet.getRange(2, 4, 1, 3).setValue("No ingredients found");
  }
}

// Run the setup function when the spreadsheet is opened
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Portionen Gesamt')
    .addItem('Setup Sheet', 'setupPortionenGesamtSheet')
    .addToUi();
}
