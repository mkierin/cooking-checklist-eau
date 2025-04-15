/**
 * Setup script for Portionen Gesamt calculation sheet using only formulas
 * This script creates a new sheet with helper columns and formulas
 * to calculate total portions and ingredients based on customer orders and recipe database.
 * Once set up, the sheet works entirely through formulas without needing script execution.
 */

function setupPortionenGesamtFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let checklistSheet = ss.getSheetByName("F_[Checkliste] Portionen Gesamt");
  
  // Create the sheet if it doesn't exist
  if (!checklistSheet) {
    checklistSheet = ss.insertSheet("F_[Checkliste] Portionen Gesamt");
    Logger.log("Created new sheet: F_[Checkliste] Portionen Gesamt");
  } else {
    // Clear existing content
    checklistSheet.clear();
  }
  
  // Get references to required sheets
  const orderSheet = ss.getSheetByName("Kundenbestellungen");
  const recipeSheet = ss.getSheetByName("Rezeptedatenbank");
  
  if (!orderSheet || !recipeSheet) {
    SpreadsheetApp.getUi().alert("Required sheets not found. Please ensure 'Kundenbestellungen' and 'Rezeptedatenbank' sheets exist.");
    return;
  }
  
  // Set up the main visible columns
  const visibleHeaders = ["Gericht", "Anzahl Bestellungen", "Gericht auswählen", "Zutat", "Bruttogewicht (g/Portion)", "Gesamtmenge (kg)"];
  checklistSheet.getRange("A1:F1").setValues([visibleHeaders]);
  checklistSheet.getRange("A1:F1").setFontWeight("bold");
  
  // Set up helper columns (hidden)
  const helperHeaders = ["Gericht ID", "Rezept Start", "Rezept Ende", "Zutat Index", "Ist Zutat", "Zutat Name", "Zutat Menge"];
  checklistSheet.getRange("G1:M1").setValues([helperHeaders]);
  checklistSheet.getRange("G1:M1").setFontWeight("bold");
  
  // Hide helper columns
  checklistSheet.hideColumns(7, 7); // Hide columns G through M
  
  // Import order data from Kundenbestellungen
  const orderLastRow = orderSheet.getLastRow();
  if (orderLastRow > 1) {
    // Copy dish names and order quantities to columns A and B
    const orderRange = orderSheet.getRange(2, 1, orderLastRow - 1, 2);
    const orderData = orderRange.getValues();
    checklistSheet.getRange(2, 1, orderData.length, 2).setValues(orderData);
    
    // Get Gericht-IDs from column C of Kundenbestellungen and place in column G (hidden)
    const orderIdsRange = orderSheet.getRange(2, 3, orderLastRow - 1, 1);
    const orderIds = orderIdsRange.getValues();
    checklistSheet.getRange(2, 7, orderIds.length, 1).setValues(orderIds);
  }
  
  // Create dropdown for dish selection in C2
  const allDishes = getAllDishesFromRecipes(recipeSheet);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allDishes, true)
    .build();
  checklistSheet.getRange("C2").setDataValidation(rule);
  
  // Set up helper formulas in row 2
  
  // Formula in H2 to find the starting row of the selected recipe in Rezeptedatenbank
  checklistSheet.getRange("H2").setFormula('=IFERROR(MATCH(C2,Rezeptedatenbank!A:A,0),0)');
  
  // Formula in I2 to find the ending row of the selected recipe in Rezeptedatenbank
  checklistSheet.getRange("I2").setFormula('=IF(H2=0,0,IFERROR(MATCH(TRUE,INDEX(Rezeptedatenbank!A:A,H2+1):INDEX(Rezeptedatenbank!A:A,1000)<>"",0),20)+H2)');
  
  // Create a formula in J2 that will generate a sequence of numbers from 0 to 20
  // This will be used to reference rows in the recipe database
  checklistSheet.getRange("J2").setFormula('=SEQUENCE(20)');
  
  // Prepare the sheet for array formulas in rows 3-22 (to display ingredients)
  // These rows will use the helper columns to extract and display ingredient data
  
  // Column K (row index + recipe start): Is this a valid ingredient row?
  // Formula checks if the current index + recipe start is within recipe bounds and has ingredient data
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`K${row}`).setFormula(`=IF(AND(H2+J${row-1}>H2,H2+J${row-1}<I2),1,0)`);
  }
  
  // Column L (ingredient name): Extract ingredient name from recipe database
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`L${row}`).setFormula(`=IF(K${row}=1,INDEX(Rezeptedatenbank!C:C,H2+J${row-1}),"")`);
  }
  
  // Column M (ingredient amount): Extract ingredient amount from recipe database
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`M${row}`).setFormula(`=IF(K${row}=1,INDEX(Rezeptedatenbank!E:E,H2+J${row-1}),"")`);
  }
  
  // Set formulas for visible columns D, E, F to display ingredient data
  // Column D (Zutat): Display ingredient name from helper column L
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`D${row}`).setFormula(`=IF(L${row}<>"",L${row},"")`);
  }
  
  // Column E (Bruttogewicht): Display ingredient amount from helper column M
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`E${row}`).setFormula(`=IF(M${row}<>"",M${row},"")`);
  }
  
  // Column F (Gesamtmenge): Calculate total amount based on order quantity and per-portion weight
  // Formula: Find order quantity for selected dish and multiply by per-portion weight, then convert to kg
  for (let i = 0; i < 20; i++) {
    const row = i + 3;
    checklistSheet.getRange(`F${row}`).setFormula(`=IF(AND(D${row}<>"",E${row}<>""),SUMIF(A:A,C2,B:B)*E${row}/1000,"")`);
  }
  
  // Format the total amount column as number with 2 decimal places
  checklistSheet.getRange("F3:F22").setNumberFormat("0.00");
  
  // Adjust column widths for better visibility
  checklistSheet.setColumnWidth(1, 200); // Gericht
  checklistSheet.setColumnWidth(2, 150); // Anzahl Bestellungen
  checklistSheet.setColumnWidth(3, 200); // Gericht auswählen
  checklistSheet.setColumnWidth(4, 200); // Zutat
  checklistSheet.setColumnWidth(5, 150); // Bruttogewicht
  checklistSheet.setColumnWidth(6, 150); // Gesamtmenge
  
  // Add a note explaining how to use the sheet
  checklistSheet.getRange("C2").setNote("Select a dish from the dropdown to see its ingredients and calculate total quantities based on order data.");
  
  SpreadsheetApp.getUi().alert("Setup for F_[Checkliste] Portionen Gesamt completed with formulas. Select a dish in cell C2 to see ingredients and quantities.");
  Logger.log("Setup completed for F_[Checkliste] Portionen Gesamt sheet with formula-based calculations");
}

/**
 * Gets list of all unique dishes from recipe database for dropdown
 */
function getAllDishesFromRecipes(recipeSheet) {
  const recipeLastRow = recipeSheet.getLastRow();
  const dishes = [];
  const dishIds = {};
  
  if (recipeLastRow > 1) {
    const recipeData = recipeSheet.getRange("A2:B" + recipeLastRow).getValues();
    
    for (let i = 0; i < recipeData.length; i++) {
      // Check if this is a main recipe entry (not an ingredient line)
      if (recipeData[i][0] && !recipeData[i][0].toString().trim().startsWith("Gesamt")) {
        // Use Gericht-ID as key to prevent duplicates
        const gerichtId = recipeData[i][1];
        if (gerichtId && !dishIds[gerichtId]) {
          dishes.push(recipeData[i][0]);
          dishIds[gerichtId] = true;
        }
      }
    }
  }
  
  return dishes;
}

// Run the setup function when the spreadsheet is opened
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Portionen Gesamt')
    .addItem('Setup Sheet with Formulas', 'setupPortionenGesamtFormulas')
    .addToUi();
}
