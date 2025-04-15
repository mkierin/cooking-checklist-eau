/**
 * Custom function to calculate the required amount of an ingredient based on orders
 * 
 * @param {string} ingredientStandardName - The standardized name of the ingredient to calculate
 * @return {number} - The total amount required
 * @customfunction
 */
function calculateIngredientAmount(ingredientStandardName) {
  if (!ingredientStandardName) return 0;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rezeptedatenbankSheet = ss.getSheetByName("Rezeptedatenbank");
  const kundenbestellungenSheet = ss.getSheetByName("Kundenbestellungen");
  
  // Get all data
  const rezeptedatenbankData = rezeptedatenbankSheet.getDataRange().getValues();
  const kundenbestellungenData = kundenbestellungenSheet.getDataRange().getValues();
  
  // Create a map of Gericht-ID to order quantity from Kundenbestellungen
  const orderQuantities = {};
  for (let i = 1; i < kundenbestellungenData.length; i++) {
    const gerichtId = kundenbestellungenData[i][2]; // Column C (index 2)
    const quantity = kundenbestellungenData[i][1];  // Column B (index 1)
    
    if (gerichtId && quantity) {
      orderQuantities[gerichtId] = Number(quantity);
    }
  }
  
  // Calculate total amount needed
  let totalAmount = 0;
  
  for (let i = 1; i < rezeptedatenbankData.length; i++) {
    const row = rezeptedatenbankData[i];
    const gerichtId = row[1];         // Column B (index 1)
    const standardName = row[3];      // Column D (index 3)
    const amount = Number(row[4]);    // Column E (index 4)
    
    // Check if this row matches the ingredient we're looking for
    if (standardName === ingredientStandardName) {
      // Check if this dish was ordered
      const orderQuantity = orderQuantities[gerichtId] || 0;
      
      // Add to total
      totalAmount += amount * orderQuantity;
    }
  }
  
  return totalAmount;
}

/**
 * Custom function to calculate the required amount of an alternative ingredient name
 * 
 * @param {string} ingredientStandardName - The standardized name of the ingredient
 * @param {string} alternativeName - The alternative name to calculate for
 * @return {number} - The total amount required for this alternative name
 * @customfunction
 */
function calculateAlternativeAmount(ingredientStandardName, alternativeName) {
  if (!ingredientStandardName || !alternativeName) return 0;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rezeptedatenbankSheet = ss.getSheetByName("Rezeptedatenbank");
  const kundenbestellungenSheet = ss.getSheetByName("Kundenbestellungen");
  
  // Get all data
  const rezeptedatenbankData = rezeptedatenbankSheet.getDataRange().getValues();
  const kundenbestellungenData = kundenbestellungenSheet.getDataRange().getValues();
  
  // Create a map of Gericht-ID to order quantity from Kundenbestellungen
  const orderQuantities = {};
  for (let i = 1; i < kundenbestellungenData.length; i++) {
    const gerichtId = kundenbestellungenData[i][2]; // Column C (index 2)
    const quantity = kundenbestellungenData[i][1];  // Column B (index 1)
    
    if (gerichtId && quantity) {
      orderQuantities[gerichtId] = Number(quantity);
    }
  }
  
  // Calculate total amount needed for this alternative name
  let totalAmount = 0;
  
  for (let i = 1; i < rezeptedatenbankData.length; i++) {
    const row = rezeptedatenbankData[i];
    const gerichtId = row[1];         // Column B (index 1)
    const originalName = row[2];      // Column C (index 2)
    const standardName = row[3];      // Column D (index 3)
    const amount = Number(row[4]);    // Column E (index 4)
    
    // Check if this row matches both the ingredient standard name and alternative name
    if (standardName === ingredientStandardName && originalName === alternativeName) {
      // Check if this dish was ordered
      const orderQuantity = orderQuantities[gerichtId] || 0;
      
      // Add to total
      totalAmount += amount * orderQuantity;
    }
  }
  
  return totalAmount;
}
