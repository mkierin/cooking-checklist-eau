/**
 * Complete setup script for Bestelltool calculation sheet using only formulas
 * This script creates a new sheet with direct formulas that connect to Kundenbestellungen and Rezeptedatenbank
 * Once set up, the sheet works entirely through formulas without needing script execution.
 */
function setupBestelltoolFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check if required sheets exist
  const kundenbestellungenSheet = ss.getSheetByName("Kundenbestellungen");
  const rezeptedatenbankSheet = ss.getSheetByName("Rezeptedatenbank");
  
  if (!kundenbestellungenSheet || !rezeptedatenbankSheet) {
    SpreadsheetApp.getUi().alert("Error: Required sheets 'Kundenbestellungen' or 'Rezeptedatenbank' not found.");
    return;
  }
  
  // Create new sheet or use existing one
  let bestelltoolSheet = ss.getSheetByName("F_Bestelltool");
  if (!bestelltoolSheet) {
    bestelltoolSheet = ss.insertSheet("F_Bestelltool");
  } else {
    // Clear existing content
    bestelltoolSheet.clear();
  }
  
  // Set up headers
  const headers = ["Zutat", "Benötigte Menge", "Standardisierter Name"];
  bestelltoolSheet.getRange(1, 1, 1, 3).setValues([headers]);
  bestelltoolSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  
  // Set up headers for alternative names (up to 20)
  for (let i = 0; i < 20; i++) {
    const nameCol = 4 + (i * 2); // D=4, F=6, H=8, etc.
    const mengeCol = 5 + (i * 2); // E=5, G=7, I=9, etc.
    
    bestelltoolSheet.getRange(1, nameCol).setValue(`Alternative Bezeichnung ${i+1}`);
    bestelltoolSheet.getRange(1, mengeCol).setValue(`Menge ${i+1} in g`);
    
    bestelltoolSheet.getRange(1, nameCol).setFontWeight("bold");
    bestelltoolSheet.getRange(1, mengeCol).setFontWeight("bold");
  }
  
  // Set up rows with direct formulas - increased to handle more ingredients
  const numRows = 300;
  
  for (let row = 2; row <= numRows + 1; row++) {
    // Column C (Standardized Name): Get unique standardized ingredient names
    bestelltoolSheet.getRange(row, 3).setFormula(
      `=IF(ROW()-1<=COUNTA(UNIQUE(FILTER(Rezeptedatenbank!D:D,(Rezeptedatenbank!D:D<>"")*(LOWER(Rezeptedatenbank!D:D)<>"gesamtgewicht")))),` +
      `INDEX(SORT(UNIQUE(FILTER(Rezeptedatenbank!D:D,(Rezeptedatenbank!D:D<>"")*(LOWER(Rezeptedatenbank!D:D)<>"gesamtgewicht"))),1,TRUE),ROW()-1),"")`
    );
    
    // Column A (Original Name): Get the first original name for this standardized ingredient
    // In Rezeptedatenbank, original names are in column C (index 2)
    bestelltoolSheet.getRange(row, 1).setFormula(
      `=IF(C${row}<>"",IFERROR(INDEX(FILTER(Rezeptedatenbank!C:C,Rezeptedatenbank!D:D=C${row}),1),C${row}),"")`
    );
    
    // Column B (Required Amount): Calculate total amount needed based on ordered dishes
    // This formula uses SUMPRODUCT to:
    // 1. Find all rows in Rezeptedatenbank where the standardized ingredient name matches
    // 2. For each matching row, get the order quantity from Kundenbestellungen
    // 3. Multiply by the ingredient amount
    // 4. Sum all these products
    bestelltoolSheet.getRange(row, 2).setFormula(
      `=IF(C${row}<>"",` +
      `SUMPRODUCT(` +
      `(Rezeptedatenbank!D:D=C${row})*` +
      `IFERROR(VALUE(VLOOKUP(Rezeptedatenbank!B:B,Kundenbestellungen!C:B,1,FALSE)),0)*` +
      `IFERROR(VALUE(Rezeptedatenbank!E:E),0)` +
      `),"")`
    );
  }
  
  // Set up formulas for alternative names and amounts
  for (let i = 0; i < 20; i++) {
    const nameCol = 4 + (i * 2); // D=4, F=6, H=8, etc.
    const mengeCol = 5 + (i * 2); // E=5, G=7, I=9, etc.
    
    // For each row, set up formulas for alternative names
    for (let row = 2; row <= numRows + 1; row++) {
      // Get the i-th alternative name for this ingredient
      bestelltoolSheet.getRange(row, nameCol).setFormula(
        `=IF(C${row}<>"",` +
        `IFERROR(INDEX(FILTER(Rezeptedatenbank!C:C,` +
        `(Rezeptedatenbank!D:D=C${row})*(Rezeptedatenbank!S:S<>"")` +
        `),${i+1}),""),"")`
      );
      
      // Calculate amount for this alternative name using the same formula approach
      bestelltoolSheet.getRange(row, mengeCol).setFormula(
        `=IF(${getLetter(nameCol)}${row}<>"",` +
        `SUMPRODUCT(` +
        `(Rezeptedatenbank!D:D=C${row})*` +
        `(Rezeptedatenbank!C:C=${getLetter(nameCol)}${row})*` +
        `IFERROR(VALUE(VLOOKUP(Rezeptedatenbank!B:B,Kundenbestellungen!C:B,1,FALSE)),0)*` +
        `IFERROR(VALUE(Rezeptedatenbank!E:E),0)` +
        `),"")`
      );

    }
  }
  
  // Format the amount columns as numbers
  bestelltoolSheet.getRange("B2:B" + (numRows + 1)).setNumberFormat("#,##0.00");
  
  // Format the alternative amount columns
  for (let i = 0; i < 20; i++) {
    const mengeCol = 5 + (i * 2); // E=5, G=7, I=9, etc.
    bestelltoolSheet.getRange(2, mengeCol, numRows, 1).setNumberFormat("#,##0.00");
  }
  
  // Adjust column widths for better visibility
  bestelltoolSheet.setColumnWidth(1, 200); // Zutat
  bestelltoolSheet.setColumnWidth(2, 150); // Benötigte Menge
  bestelltoolSheet.setColumnWidth(3, 200); // Standardisierter Name
  
  // Set widths for alternative name and amount columns
  for (let i = 0; i < 20; i++) {
    const nameCol = 4 + (i * 2); // D=4, F=6, H=8, etc.
    const mengeCol = 5 + (i * 2); // E=5, G=7, I=9, etc.
    
    bestelltoolSheet.setColumnWidth(nameCol, 180); // Alternative Bezeichnung
    bestelltoolSheet.setColumnWidth(mengeCol, 100); // Menge
  }
  
  // Add a note explaining how the sheet works
  bestelltoolSheet.getRange("A1").setNote(
    "This sheet automatically calculates ingredient quantities based on customer orders and recipes. " +
    "The formulas directly connect to the Kundenbestellungen and Rezeptedatenbank sheets, " +
    "eliminating the need for script execution after initial setup."
  );
  
  SpreadsheetApp.getUi().alert(
    "Setup for F_Bestelltool completed with formulas. " +
    "The sheet will automatically calculate ingredient quantities based on customer orders and recipes. " +
    "No further script execution is needed."
  );
}

/**
 * Helper function to convert column number to letter
 */
function getLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Run the setup function when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Eatunique Tools')
    .addItem('Setup Bestelltool Formulas', 'setupBestelltoolFormulas')
    .addToUi();
}
