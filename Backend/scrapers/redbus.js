// server/src/scrapers/redBus.js
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function scrapeRedBus(fromCity, toCity, travelDate) {
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
        // 1. HARDCODE a real, modern User-Agent
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        // 2. Set the platform to Win32 explicitly
        extraHTTPHeaders: {
            'accept-language': 'en-US,en;q=0.9',
        }
    });
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

    try {
        console.log("🚀 Starting RedBus Scraper...");

        await page.route('**/*.{png,jpg,jpeg,gif,svg,css}', (route) => route.abort());
        await page.route('**/google-analytics.com/**', (route) => route.abort());

        await page.goto('https://www.redbus.in/', { 
            waitUntil: 'domcontentloaded', // 'networkidle' is too slow for RedBus
            timeout: 60000 
        });

        await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

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
        console.error("⚠️ RedBus Scraper non-fatal error:", err.message);
        return []; // Always return array
    } finally {
        if (browser) {
            // This is the "Magic" fix: catch the error that occurs during close
            await browser.close().catch(err => console.log("Cleanup handled."));
        }
    }
}


export default scrapeRedBus;