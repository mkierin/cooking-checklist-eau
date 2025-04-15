/**
 * Cooking Checklist Web App - Server-side Code
 * This script serves the web app and provides data access functions
 */

/**
 * Serves the web app HTML interface
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Cooking Checklist')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets data directly from the spreadsheet
 * This is more efficient than using CSV
 * 
 * @return {Array} Formatted table data in the format [name, portions, checked1, checked2, url]
 */
function getTableData() {
  try {
    // Get the active spreadsheet or open by ID if this is deployed separately
    // If deployed within the same spreadsheet, use:
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // If deployed as a standalone app, use:
    // const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID_HERE');
    
    const sheet = ss.getSheetByName('[Checkliste] Kochen & Portionieren');
    if (!sheet) {
      Logger.log('Sheet not found');
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Skip header row and format data
    const tableData = [];
    for (let i = 1; i < values.length; i++) {
      // Skip empty rows
      if (!values[i][0]) continue;
      
      // Format: [name, portions, checked1, checked2, url]
      tableData.push([
        values[i][0],                // Name (Column A)
        parseInt(values[i][1] || 0), // Portions (Column B)
        false,                       // First checkbox (always start unchecked in web app)
        false,                       // Second checkbox (always start unchecked in web app)
        values[i][2] || '#'          // URL (Column C, or adjust as needed)
      ]);
    }
    
    Logger.log('Retrieved ' + tableData.length + ' rows from spreadsheet');
    return tableData;
  } catch (error) {
    Logger.log('Error getting table data: ' + error.toString());
    return [];
  }
}

/**
 * Optional: Save checkbox states back to the spreadsheet
 * This allows for two-way sync between the web app and spreadsheet
 * 
 * @param {string} dishName - The name of the dish
 * @param {number} columnIndex - Which checkbox was changed (2 for cooked, 3 for portioned)
 * @param {boolean} isChecked - Whether the checkbox is now checked
 * @return {boolean} Success status
 */
function saveCheckboxState(dishName, columnIndex, isChecked) {
  try {
    // Get the active spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('[Checkliste] Kochen & Portionieren');
    
    if (!sheet) {
      Logger.log('Sheet not found');
      return false;
    }
    
    // Find the row with the dish name
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let rowIndex = -1;
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === dishName) {
        rowIndex = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      Logger.log('Dish not found: ' + dishName);
      return false;
    }
    
    // Map web app column index to sheet column index
    // In web app: 2 = cooked, 3 = portioned
    // In sheet: C (3) = cooked, D (4) = portioned
    const sheetColumnIndex = columnIndex === 2 ? 3 : 4;
    
    // Update the checkbox in the sheet
    sheet.getRange(rowIndex, sheetColumnIndex).setValue(isChecked);
    Logger.log('Updated ' + dishName + ' checkbox in column ' + sheetColumnIndex + ' to ' + isChecked);
    
    return true;
  } catch (error) {
    Logger.log('Error saving checkbox state: ' + error.toString());
    return false;
  }
}
