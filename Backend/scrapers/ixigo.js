import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());

async function closeIxigoModal(page) {
  try {
    console.log("⚡ Checking for modal...");

    await page.waitForTimeout(2000);

    // Try ESC (most common)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Possible close button selectors
    const closeSelectors = [
      'button[aria-label="Close"]',
      'button:has-text("Close")',
      'button:has-text("Skip")',
      ".close",
      ".close-btn",
      ".modal-close",
      ".cross",
      ".login-close",
      ".auth-close",
      ".native-login-interface button",
      ".native-login-interface .close",
      ".modal button",
      ".modal-header button",
      'svg[aria-label="close"]',
      "div[role='button']",
    ];

    for (const selector of closeSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log("✅ Modal closed using:", selector);
        await page.waitForTimeout(1000);
        return;
      }
    }

    // Click outside popup
    await page.mouse.click(10, 10);
    await page.waitForTimeout(1000);

    console.log("⚠️ Modal close button not found, trying DOM remove...");

    // Hard remove overlay
    await page.evaluate(() => {
      const modalSelectors = [
        ".native-login-interface",
        ".content-section",
        ".modal-backdrop",
        ".login-modal",
        ".scrollable-content",
        ".auth-modal",
        ".modal",
        ".overlay",
        ".backdrop",
      ];

      modalSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => el.remove());
      });

      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.documentElement.style.overflow = "auto";
    });

    console.log("✅ DOM cleanup done.");
  } catch (err) {
    console.log("❌ Modal closing error:", err.message);
  }
}

async function scrapeIxigo(fromCity, toCity, travelDate) {
  const browser = await chromium.launch({ 
    headless: true, 
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // FIXES: "Target Closed" errors in Docker
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
    ] 
});

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log("🚀 Starting Ixigo Scraper...");

    await page.goto("https://bus.ixigo.com/", { waitUntil: "domcontentloaded" });

    // Close modal popup if present
    await closeIxigoModal(page);

     // 1. Origin Selection
    console.log(`📍 Setting origin: ${fromCity}`);
    // Target the input specifically by its unique placeholder
    const fromSelector = 'input[placeholder="From Station"]';

    await page.waitForSelector(fromSelector, { timeout: 10000 });
    // Click the parent container first to ensure focus, then the input
    await page.click(fromSelector, { force: true }); 

    // Clear any existing value and type
    await page.locator(fromSelector).fill("");
    await page.locator(fromSelector).pressSequentially(fromCity, { delay: 120 });

    await page.waitForTimeout(1000);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // 2. Destination Selection
    console.log(`📍 Setting destination: ${toCity}`);
    const toSelector = 'input[placeholder="To Station"]';

    await page.waitForSelector(toSelector, { timeout: 10000 });
    await page.click(toSelector, { force: true });
    await page.locator(toSelector).fill("");
    await page.locator(toSelector).pressSequentially(toCity, { delay: 120 });

    await page.waitForTimeout(1000);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // --- 3. Date Selection ("15 February 2026") ---
    console.log(`📅 Setting date: ${travelDate}`);
    const [targetDay, targetMonthName, targetYear] = travelDate.split(' ');

    // Map month names to numbers as used in Ixigo's data-month attribute
    const monthMap = {
        "January": "1", "February": "2", "March": "3", "April": "4",
        "May": "5", "June": "6", "July": "7", "August": "8",
        "September": "9", "October": "10", "November": "11", "December": "12"
    };
    const targetMonthNumeric = monthMap[targetMonthName];

    // 1. Open the calendar
    const dateInputSelector = 'input[placeholder="Onward Journey Date"]';
    await page.waitForSelector(dateInputSelector);
    await page.click(dateInputSelector);

    // 2. Navigate to the correct Month/Year
    const calendarContainer = '.container.calendar';
    await page.waitForSelector(calendarContainer, { visible: true });

    let isMonthFound = false;
    let safetyCounter = 0;

    while (!isMonthFound && safetyCounter < 12) {
        // Check current month and year in the header
        const currentMonthText = await page.locator(`${calendarContainer} .col:has(span)`).nth(1).innerText();
        
        if (currentMonthText.includes(targetMonthName) && currentMonthText.includes(targetYear)) {
            isMonthFound = true;
        } else {
            // Click the SVG inside the month-change div (the "Next" arrow)
            await page.click('.calender-month-change');
            await page.waitForTimeout(500); // Wait for transition
            safetyCounter++;
        }
    }

    if (isMonthFound) {
        // 3. Select the exact day using data attributes from your HTML
        // This is the most precise way to click the right day
        const daySelector = `${calendarContainer} span[data-date="${parseInt(targetDay)}"][data-month="${targetMonthNumeric}"][data-year="${targetYear}"]`;
        
        // Ensure the date is not "out-of-range-date" (disabled)
        const dayElement = page.locator(daySelector);
        if (await dayElement.isVisible()) {
            await dayElement.click();
            console.log(`✅ Successfully clicked ${targetDay} ${targetMonthName}`);
        } else {
            console.error("❌ The requested date is visible but not clickable (possibly out of range).");
        }
    } else {
        console.error("❌ Could not find the target month/year.");
    }

   

    // --- 4. SEARCH BUTTON ---
        console.log("🔍 Clicking Search...");
        const searchBtnSelector = 'button.btn-search:has-text("Search")';
        await page.waitForSelector(searchBtnSelector);
        
        // Use Promise.all to handle the navigation triggered by the button
         await Promise.all([
        // This waits specifically for the URL to contain the bus search pattern
        page.waitForURL(url => url.href.includes('/bus_search/'), { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        }),
        // Trigger the click
        page.click(searchBtnSelector)
    ]);

    await page.waitForTimeout(5000);

    // 5. Extract Results
    const busData = await page.$$eval('.card.service', (cards) => {
    return cards.map(card => {
        // 1. Operator and Bus Type Info
                const operatorName = card.querySelector('.operator-info .title')?.innerText.trim() || 'N/A';
                const busType = card.querySelector('.operator-info .sub-title')?.innerText.trim() || 'N/A';

                // 2. Travel Times (Departure and Arrival)
                const departureTime = card.querySelector('.departure-time')?.innerText.trim() || 'N/A';
                const arrivalTime = card.querySelector('.arrival-time')?.innerText.trim() || 'N/A';
                const duration = card.querySelector('.travel-time')?.innerText.trim() || 'N/A';

                // 3. Rating (The star rating)
                // Note: Using the specific lessRating class from your HTML
                const rating = card.querySelector('.lessRating span')?.innerText.trim() || 'N/A';

                // 4. Fare / Price
                // Targeted the span inside the .fare container
                const priceText = card.querySelector('.fare span')?.innerText.trim() || '0';
                const price = parseInt(priceText.replace(/,/g, '')) || 0;

                // 5. Seat Availability
                const seatsLeft = card.querySelector('#service-operator-select-seat-container small, .text-grey small')?.innerText.trim() || 'N/A';

                return {
                    operator: operatorName,
                    type: busType,
                    departure: departureTime,
                    arrival: arrivalTime,
                    duration: duration,
                    rating: rating,
                    price: price,
                    seatsAvailable: seatsLeft
                };
            });
        });

        // console.log(`✅ Successfully extracted ${busData.length} bus services:`);
        // console.table(busData);
        return busData;
  } catch (err) {
    console.error("❌ Ixigo Scraper Error:", err.message);
    return [];
  } finally {
    await browser.close();
  }
}


export default scrapeIxigo;
