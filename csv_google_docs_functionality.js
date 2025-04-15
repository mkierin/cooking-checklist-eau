/**
 * CSV and Google Docs Functionality for Cooking Checklist
 * 
 * This file explains the functionality for fetching data from Google Sheets
 * and linking to Google Docs recipes in the cooking checklist application.
 */

/**
 * Function to fetch and parse CSV data from Google Sheets
 * Uses a CORS proxy to handle cross-origin requests
 * Includes cache busting to ensure fresh data
 */
function fetchDataFromGoogleSheets() {
    // Original CSV URL from Google Sheets
    const originalCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlkqs1NPRzcnn5pL0idFo0u58eDZSExJarqh2NqQexmhSMLYmyahISVleD04TULNebkNoi92XFDVvM/pub?gid=1548051930&single=true&output=csv';
    
    // Use a CORS proxy to handle cross-origin requests
    const corsProxyUrl = 'https://corsproxy.io/?';
    
    // Add cache busting parameter to always fetch fresh data
    const csvUrl = corsProxyUrl + encodeURIComponent(originalCsvUrl + '&cachebust=' + Date.now());
    
    console.log('Fetching data from:', csvUrl);
    
    // Primary fetch attempt using CORS proxy
    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.text();
        })
        .then(csvText => {
            processCsvData(csvText);
        })
        .catch(error => {
            console.error('Error fetching or parsing CSV:', error);
            console.log('Trying direct fetch as fallback...');
            
            // Fallback: try direct fetch (works in some environments)
            fetch(originalCsvUrl, { mode: 'no-cors' })
                .then(response => {
                    if (response.type === 'opaque') {
                        // With no-cors, we can't actually read the content
                        console.log('Direct fetch succeeded but content is opaque due to CORS');
                        throw new Error('Cannot read content due to CORS restrictions');
                    }
                    return response.text();
                })
                .then(csvText => {
                    console.log('Direct fetch succeeded!');
                    processCsvData(csvText);
                })
                .catch(directError => {
                    console.error('Direct fetch also failed:', directError);
                    console.log('Falling back to default empty data');
                    // Initialize with default data if all fetches fail
                    initTable();
                });
        });
}

/**
 * Helper function to properly parse CSV rows (handles quoted values)
 * This ensures proper handling of commas within quoted strings
 */
function parseCSVRow(row) {
    const result = [];
    let insideQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(currentValue);
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // Add the last value
    result.push(currentValue);
    
    return result;
}

/**
 * Process CSV text into structured data for the table
 * Filters out dishes with zero portions
 * Extracts Google Docs links from column G
 */
function processCsvData(csvText) {
    // Parse CSV to array format
    const rows = csvText.split('\n');
    const parsedData = [];
    
    // Process each row (skip header if present)
    for (let i = 0; i < rows.length; i++) {
        if (!rows[i].trim()) continue; // Skip empty rows
        
        // Parse the CSV row properly (handling quoted values)
        const values = parseCSVRow(rows[i]);
        
        // Skip header row or rows without proper data
        if (isNaN(parseInt(values[1])) && i === 0) continue;
        if (!values[0]) continue; // Skip rows without a dish name
        
        // Parse portions value
        const portions = parseInt(values[1] || '0', 10);
        if (portions === 0) continue; // Skip rows with 0 portions
        
        // Create row in the format: [name, portions, checked1, checked2, url]
        parsedData.push([
            values[0].trim(),                // Name
            portions,                        // Portions
            false,                          // First checkbox (always start unchecked)
            false,                          // Second checkbox (always start unchecked)
            values[6] || '#'                // URL from column G (Google Docs link) or default to '#'
        ]);
    }
    
    console.log('Parsed data from CSV:', parsedData);
    
    // Replace the table data with the parsed data
    console.log('Before replacement, tableData length:', tableData.length);
    
    // Clear the existing tableData array and replace with parsed data
    tableData.length = 0; // Clear the array
    parsedData.forEach(row => tableData.push(row)); // Add new data
    
    console.log('After replacement, tableData length:', tableData.length);
    console.log('First few items:', tableData.slice(0, 3));
    
    // Reset position tracking since we have new data
    resetPositionTracking();
    
    // Initialize the table with the new data
    initTable();
}

/**
 * Create a table row with hyperlinked dish name to Google Docs
 * This function is part of the table rendering process
 */
function createTableRowWithLink(rowData, index) {
    const [dish, portions, cooked, portioned] = rowData;
    const row = document.createElement('tr');
    
    // Add dish name cell with hyperlink to Google Docs
    const dishCell = document.createElement('td');
    if (dish) {
        const dishLink = document.createElement('a');
        dishLink.href = rowData[4] || '#'; // Use URL from data or default to #
        dishLink.textContent = dish;
        dishLink.target = '_blank'; // Open in new tab
        dishLink.style.textDecoration = 'none';
        dishLink.style.color = '#0066cc';
        dishLink.style.fontWeight = 'bold';
        dishCell.appendChild(dishLink);
    }
    row.appendChild(dishCell);
    
    // Add other cells (portions, checkboxes, etc.)
    // ...
    
    return row;
}

/**
 * CSV Structure Expected:
 * 
 * Column A: Dish Name
 * Column B: Portions
 * Column G: Google Docs URL (Recipe Link)
 * 
 * The application will:
 * 1. Skip the header row
 * 2. Skip rows with empty dish names
 * 3. Skip rows with zero portions
 * 4. Create hyperlinks from dish names to their Google Docs recipes
 * 5. Initialize all checkboxes as unchecked
 */
