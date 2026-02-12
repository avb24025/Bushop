// server/src/scrapers/abhiBus.js
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function scrapeAbhiBus(fromCity, toCity, travelDate) {
    const browser = await chromium.launch({ 
    headless: true,
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',      // CRITICAL: Prevents crashes in Docker
        '--disable-gpu',                // Docker environments usually don't have GPUs
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ]
});
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        console.log("🚀 Starting AbhiBus Scraper...");
        await page.goto('https://www.abhibus.com/', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });

       // 1. Handle Origin (Leaving From)
        console.log(`Setting origin: ${fromCity}`);

        // Select the input using the placeholder from your HTML
        const fromInput = 'input[placeholder="Leaving From"]';

        // Wait for it, click it to focus, then type
        await page.waitForSelector(fromInput);
        await page.click(fromInput); 
        await page.type(fromInput, fromCity);

        // Wait for the suggestion list to appear
        // Note: If '.station-body' doesn't work, we'll use a generic 'list item' selector
        await page.waitForTimeout(1000); // Give the API time to return results
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        // 2. Handle Destination (Going To)
        console.log(`Setting destination: ${toCity}`);

        // AbhiBus usually uses "Going To" for the second placeholder
        const toInput = 'input[placeholder="Going To"]'; 

        await page.waitForSelector(toInput);
        await page.click(toInput);
        await page.type(toInput, toCity);

        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');


       // 3. Date Selection (Example: travelDate = "15 February 2026")
       const [day, monthName, year] = travelDate.split(' ');
    
    // Convert Month Name to Number (AbhiBus uses 1 for Jan, 2 for Feb, etc.)
        const months = {
            "January": "1", "February": "2", "March": "3", "April": "4",
            "May": "5", "June": "6", "July": "7", "August": "8",
            "September": "9", "October": "10", "November": "11", "December": "12"
        };
        const targetMonthNum = months[monthName];

        console.log(`Targeting: Date ${day}, Month ${targetMonthNum}, Year ${year}`);

        // 1. Open the calendar
        await page.click('input[placeholder="Onward Journey Date"]');
        await page.waitForSelector('.calendar', { state: 'visible' });

        // 2. Month Navigation
        let isMonthFound = false;
        while (!isMonthFound) {
            // Check current month and year displayed
            const displayedMonth = await page.innerText('.container.month .col:nth-child(2)');
            
            if (displayedMonth.includes(monthName) && displayedMonth.includes(year)) {
                isMonthFound = true;
            } else {
                // Click the Next Month SVG button
                await page.click('.calender-month-change');
                await page.waitForTimeout(500); // Wait for transition
            }
        }

        // 3. Select the precise date using data attributes
        // Selector looks for: a button with data-date="15" AND data-month="2" AND data-year="2026"
        const finalDateSelector = `a[data-date="${parseInt(day)}"][data-month="${targetMonthNum}"][data-year="${year}"]`;
        
        console.log(`Clicking selector: ${finalDateSelector}`);
        
        await page.waitForSelector(finalDateSelector);
        await page.click(finalDateSelector);
        
        console.log("✅ AbhiBus date selected!");


    // 4. Trigger Search
        console.log("Clicking Search...");

        // Target the 'Search Buses' button using the ID and text
        const searchBtnSelector = '#search-button a.button';

        await Promise.all([
            // This waits for the URL to change to the search results format
            page.waitForURL(url => url.href.includes('/bus_search/'), { waitUntil: 'load', timeout: 60000 }),
            page.click(searchBtnSelector)
        ]);

        console.log("✅ Redirected to search results page.");

        // 6. Extraction
        console.log("Extracting AbhiBus data...");
        const noServicesFound = await page.evaluate(() => {
            const heading = document.querySelector('h5');
            return heading && heading.innerText.includes("no services on this route");
        });

        if (noServicesFound) {
            console.log("⚠️ No buses available for this route on the selected date.");
            return []; // Return empty results immediately
        }

        // AbhiBus uses cards with service-related classes
        await page.waitForSelector('.card', { timeout: 10000 });

       const busResults = await page.$$eval('.card.service', (cards) => {
            return cards.map(card => {
                // 1. Price Extractiony
                // Your HTML: <span class="fare text-neutral-800">₹550</span>
                const priceElement = card.querySelector('.fare.text-neutral-800');
                const priceText = priceElement ? priceElement.innerText.trim() : "0";
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                // 2. Timing (Departure & Arrival)
                // Your HTML: <span class="departure-time text-neutral-500">22:00</span>
                // Your HTML: <span class="arrival-time text-neutral-500">05:00</span>
                const departure = card.querySelector('.departure-time')?.innerText.trim() || "N/A";
                const arrival = card.querySelector('.arrival-time')?.innerText.trim() || "N/A";
                
                // 3. Duration
                // Your HTML is inside a travel-time chip: <div class="travel-time"><span>07h</span></div>
                const duration = card.querySelector('.travel-time span')?.innerText.trim() || "N/A";

                // 4. Operator & Bus Type
                const operator = card.querySelector('.title')?.innerText.trim() || "N/A";
                const busType = card.querySelector('.sub-title')?.innerText.trim() || "N/A";
                
                // 5. Seats Available
                // In this specific HTML, it's just text inside the seat-info div
                // We look for the text containing "Seats Left"
                const seatContainer = card.querySelector('.seat-info')?.innerText || "";
                const seatsMatch = seatContainer.match(/\d+\s*Seats\s*Left/i);
                const seats = seatsMatch ? seatsMatch[0] : "N/A";
                
                // 6. Rating
                const rating = card.querySelector('.service-rating span')?.innerText.trim() || "N/A";

                return {
                    source: "AbhiBus",
                    operator,
                    busType,
                    departure,
                    arrival,
                    duration,
                    price,
                    seats,
                    rating
                };
            }).filter(bus => bus.price > 0); 
        });
        return busResults;

    } catch (err) {
        console.error("❌ AbhiBus Scraper Error:", err);
        return [];
    } finally {
        await browser.close();
    }
}


export default scrapeAbhiBus;