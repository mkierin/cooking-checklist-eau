/**
 * Script to handle alternative ingredient names (Bezeichnungen) in the Bestelltool
 * This script creates a dedicated system for managing standard and alternative ingredient names
 * with their corresponding quantities.
 */
function setupAlternativeBezeichnungen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check if required sheets exist
  const kundenbestellungenSheet = ss.getSheetByName("Kundenbestellungen");
  const rezeptedatenbankSheet = ss.getSheetByName("Rezeptedatenbank");
  
  if (!kundenbestellungenSheet || !rezeptedatenbankSheet) {
    SpreadsheetApp.getUi().alert("Error: Required sheets 'Kundenbestellungen' or 'Rezeptedatenbank' not found.");
    return;
  }
  
  // Create new sheet or use existing one
  let alternativeBezeichnungSheet = ss.getSheetByName("F_Alternative_Bezeichnungen");
  if (!alternativeBezeichnungSheet) {
    alternativeBezeichnungSheet = ss.insertSheet("F_Alternative_Bezeichnungen");
  } else {
    // Clear existing content
    alternativeBezeichnungSheet.clear();
  }
  
  // Set up headers
  const headers = ["Zutat (Original)", "Standardisierter Name", "Alternative Bezeichnung", "Menge (g)"];
  alternativeBezeichnungSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  alternativeBezeichnungSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  
  // Set up rows with direct formulas - increased to handle more ingredients
  const numRows = 300;
  
  for (let row = 2; row <= numRows + 1; row++) {
    // Column B (Standardized Name): Get unique standardized ingredient names from Rezeptedatenbank column D
    alternativeBezeichnungSheet.getRange(row, 2).setFormula(
      `=IF(ROW()-1<=COUNTA(UNIQUE(FILTER(Rezeptedatenbank!D:D,(Rezeptedatenbank!D:D<>"")*(LOWER(Rezeptedatenbank!D:D)<>"gesamtgewicht")))),` +
      `INDEX(SORT(UNIQUE(FILTER(Rezeptedatenbank!D:D,(Rezeptedatenbank!D:D<>"")*(LOWER(Rezeptedatenbank!D:D)<>"gesamtgewicht"))),1,TRUE),ROW()-1),"")`
    );
    
    // Column A (Original Name): Get the original name for this standardized ingredient from Rezeptedatenbank column C
    alternativeBezeichnungSheet.getRange(row, 1).setFormula(
      `=IF(B${row}<>"",IFERROR(INDEX(FILTER(Rezeptedatenbank!C:C,Rezeptedatenbank!D:D=B${row}),1),B${row}),"")`
    );
    
    // Column C (Alternative Name): Get the alternative name from Rezeptedatenbank column S
    alternativeBezeichnungSheet.getRange(row, 3).setFormula(
      `=IF(B${row}<>"",IFERROR(INDEX(FILTER(Rezeptedatenbank!S:S,Rezeptedatenbank!D:D=B${row}),1),""),"")`
    );
    
    // Column D (Amount): Calculate total amount needed for this alternative name
    alternativeBezeichnungSheet.getRange(row, 4).setFormula(
      `=IF(AND(B${row}<>"",C${row}<>""),` +
      `SUMPRODUCT(` +
      `(Rezeptedatenbank!D:D=B${row})*` +
      `(Rezeptedatenbank!S:S=C${row})*` +
      `IFERROR(VALUE(VLOOKUP(Rezeptedatenbank!B:B,Kundenbestellungen!C:B,1,FALSE)),0)*` +
      `IFERROR(VALUE(Rezeptedatenbank!E:E),0)` +
      `),"")`
    );
  }
  
  // Format the amount column as numbers
  alternativeBezeichnungSheet.getRange("D2:D" + (numRows + 1)).setNumberFormat("#,##0.00");
  
  // Adjust column widths for better visibility
  alternativeBezeichnungSheet.setColumnWidth(1, 200); // Zutat (Original)
  alternativeBezeichnungSheet.setColumnWidth(2, 200); // Standardisierter Name
  alternativeBezeichnungSheet.setColumnWidth(3, 200); // Alternative Bezeichnung
  alternativeBezeichnungSheet.setColumnWidth(4, 150); // Menge (g)
  
  // Add a note explaining how the sheet works
  alternativeBezeichnungSheet.getRange("A1").setNote(
    "This sheet manages alternative ingredient names and their quantities. " +
    "It uses the standard name from Rezeptedatenbank (column D) and the alternative name from column S. " +
    "The formulas directly connect to the Kundenbestellungen and Rezeptedatenbank sheets, " +
    "eliminating the need for script execution after initial setup."
  );
  
  // Add conditional formatting to highlight rows with alternative names
  const range = alternativeBezeichnungSheet.getRange("A2:D" + (numRows + 1));
  const rules = alternativeBezeichnungSheet.getConditionalFormatRules();
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormula("=$C2<>\"\"")
    .setBackground("#e6f2ff")
    .setRanges([range])
    .build();
  rules.push(rule);
  alternativeBezeichnungSheet.setConditionalFormatRules(rules);
  
  // Create a second sheet that consolidates ingredients by alternative names
  let consolidatedSheet = ss.getSheetByName("F_Konsolidierte_Bestellliste");
  if (!consolidatedSheet) {
    consolidatedSheet = ss.insertSheet("F_Konsolidierte_Bestellliste");
  } else {
    // Clear existing content
    consolidatedSheet.clear();
  }
  
  // Set up headers for consolidated sheet
  const consolidatedHeaders = ["Bestellname", "Gesamtmenge (g)", "Ursprung"];
  consolidatedSheet.getRange(1, 1, 1, consolidatedHeaders.length).setValues([consolidatedHeaders]);
  consolidatedSheet.getRange(1, 1, 1, consolidatedHeaders.length).setFontWeight("bold");
  
  // Set up formulas for consolidated sheet
  for (let row = 2; row <= numRows + 1; row++) {
    // Column A (Bestellname): Get either the alternative name (if exists) or the original name
    consolidatedSheet.getRange(row, 1).setFormula(
      `=IF(ROW()-1<=COUNTA(UNIQUE(FILTER(Rezeptedatenbank!D:D,(Rezeptedatenbank!D:D<>"")*(LOWER(Rezeptedatenbank!D:D)<>"gesamtgewicht")))),` +
      `INDEX(SORT(UNIQUE(IF(Rezeptedatenbank!S:S<>"",Rezeptedatenbank!S:S,Rezeptedatenbank!C:C)),1,TRUE),ROW()-1),"")`
    );
    
    // Column B (Total Amount): Calculate total amount for this name (either alternative or original)
    consolidatedSheet.getRange(row, 2).setFormula(
      `=IF(A${row}<>"",` +
      `SUMPRODUCT(` +
      `((Rezeptedatenbank!S:S=A${row})+(AND(COUNTIF(Rezeptedatenbank!S:S,A${row})=0,Rezeptedatenbank!C:C=A${row})))*` +
      `IFERROR(VALUE(VLOOKUP(Rezeptedatenbank!B:B,Kundenbestellungen!C:B,1,FALSE)),0)*` +
      `IFERROR(VALUE(Rezeptedatenbank!E:E),0)` +
      `),"")`
    );
    
    // Column C (Origin): Indicate whether this is an alternative name or original name
    consolidatedSheet.getRange(row, 3).setFormula(
      `=IF(A${row}<>"",IF(COUNTIF(Rezeptedatenbank!S:S,A${row})>0,"Alternative","Original"),"")`
    );
  }
  
  // Format the amount column as numbers
  consolidatedSheet.getRange("B2:B" + (numRows + 1)).setNumberFormat("#,##0.00");
  
  // Adjust column widths for better visibility
  consolidatedSheet.setColumnWidth(1, 200); // Bestellname
  consolidatedSheet.setColumnWidth(2, 150); // Gesamtmenge (g)
  consolidatedSheet.setColumnWidth(3, 100); // Ursprung
  
  // Add conditional formatting to highlight alternative names
  const altRange = consolidatedSheet.getRange("A2:C" + (numRows + 1));
  const altRules = consolidatedSheet.getConditionalFormatRules();
  const altRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormula("=$C2=\"Alternative\"")
    .setBackground("#e6fff2")
    .setRanges([altRange])
    .build();
  altRules.push(altRule);
  consolidatedSheet.setConditionalFormatRules(altRules);
  
  // Add a note explaining how the consolidated sheet works
  consolidatedSheet.getRange("A1").setNote(
    "This sheet consolidates ingredients by their alternative names (from column S in Rezeptedatenbank) " +
    "or original names (from column C in Rezeptedatenbank) if no alternative exists. " +
    "The 'Ursprung' column indicates whether the name is an alternative or original."
  );
  
  SpreadsheetApp.getUi().alert(
    "Setup for alternative ingredient names completed. " +
    "Two new sheets have been created:\n" +
    "1. F_Alternative_Bezeichnungen - Shows all standard names with their alternative names\n" +
    "2. F_Konsolidierte_Bestellliste - Consolidates ingredients by their ordering names (alternative or original)"
  );
}

/**
 * Run the setup function when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Eatunique Tools')
    .addItem('Setup Alternative Bezeichnungen', 'setupAlternativeBezeichnungen')
    .addToUi();
}
