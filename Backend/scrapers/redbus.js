// server/src/scrapers/redBus.js
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function scrapeRedBus(fromCity, toCity, travelDate) {
    const browser = await chromium.launch({ 
        headless: true, // No window pops up
        args: [
            '--disable-blink-features=AutomationControlled', // Extra stealth
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-http2',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
     }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("🚀 Starting RedBus Scraper...");
        await page.goto('https://www.redbus.in/', { waitUntil: 'networkidle' });

        // 1. Origin Selection
        console.log(`Setting origin: ${fromCity}`);
        await page.type('#srcinput', fromCity, { delay: 50 });
        await page.waitForTimeout(20000); 
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        // 2. Destination Selection
        console.log(`Setting destination: ${toCity}`);
        await page.type('#destinput', toCity, { delay: 50 });
        await page.waitForTimeout(20000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        // 3. Date Selection ("15 February 2026")
        const [targetDay, targetMonth, targetYear] = travelDate.split(' ');
        const targetMonthYear = `${targetMonth} ${targetYear}`;

        await page.click('.dateInputWrapper___c59b4e');
        await page.waitForSelector('.datepicker___2f8dc4', { state: 'visible' });

        let isMonthFound = false;
        while (!isMonthFound) {
            const currentMonthYear = await page.innerText('.monthYear___f6ba90');
            if (currentMonthYear.includes(targetMonthYear)) {
                isMonthFound = true;
            } else {
                await page.click('.icon-arrow.right___8f9055');
                await page.waitForTimeout(500);
            }
        }

        const daySelector = `div.calendarDate[aria-label*="${targetMonth} ${targetDay}"]`;
        await page.click(daySelector);
        console.log(`✅ Selected ${travelDate}`);

        // 4. Search and Wait for Results
        console.log("Searching...");
        await Promise.all([
            page.waitForURL(url => url.href.includes('/bus-tickets/'), { waitUntil: 'load' }),
            page.click('button.searchButtonWrapper___2d58a0')
        ]);

        // 5. CHECK FOR "NO BUSES FOUND"
        // We wait a moment for the page to decide if there are buses or an error
        await page.waitForTimeout(10000); 
        const noBusesFound = await page.$('.titleSection___4069e8');
        
        if (noBusesFound) {
            const text = await noBusesFound.innerText();
            if (text.includes("Oops!!") || text.includes("No buses found")) {
                console.log("🛑 Oops!! No buses found for this route/date.");
                return []; // Return empty as requested
            }
        }

        // 6. Extraction Logic
        console.log("Extracting bus data...");
        await page.waitForSelector('[data-autoid="inv-wrap"]', { timeout: 10000 }).catch(() => null);

        // Small scroll to trigger rendering
        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(1000);

        const busResults = await page.$$eval('li.tupleWrapper___d5a78a', (listItems) => {
            return listItems.map(li => {
                const priceElement = li.querySelector('[class*="finalFare"]');
                const rawPrice = priceElement ? priceElement.innerText : "0";
                const cleanPrice = parseInt(rawPrice.replace(/[^0-9]/g, '')) || 0;

                return {
                    id: li.id,
                    operator: li.querySelector('[class*="travelsName"]')?.innerText.trim() || "N/A",
                    departure: li.querySelector('[class*="boardingTime"]')?.innerText.trim() || "N/A",
                    arrival: li.querySelector('[class*="droppingTime"]')?.innerText.trim() || "N/A",
                    duration: li.querySelector('[class*="duration___"]')?.innerText.trim() || "N/A",
                    price: cleanPrice,
                    busType: li.querySelector('[class*="busType"]')?.innerText.trim() || "N/A",
                    seats: li.querySelector('[class*="totalSeats"]')?.innerText.trim() || "N/A",
                    rating: li.querySelector('[class*="rating___"]')?.innerText.trim() || "N/A",
                    summary: li.getAttribute('aria-label') || ""
                };
            });
        });

        return busResults;

    } catch (err) {
        console.error("❌ Scraper Error:", err);
        return [];
    } finally {
        await browser.close();
    }
}


export default scrapeRedBus;