import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function scrapeTravelYaari(fromCity, toCity, travelDate) {
    const browser = await chromium.launch({ 
        headless: false
    }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("🚀 Starting TravelYaari Desktop Scraper...");
        await page.goto('https://www.travelyaari.com/', { waitUntil: 'networkidle' });

       await page.waitForSelector("#from-city", { state: "visible" });
       console.log("From Input Found");  





// --- 2. Destination Selection ---
console.log(`Setting destination: ${toCity}`);
const toInput = '#to-city';
await page.waitForSelector(toInput, { visible: true });

await page.focus(toInput);
await page.click(toInput);
await page.locator(toInput).pressSequentially(toCity, { delay: 150 });

// FIXED SELECTOR: Only look for suggestions immediately following the #to-city input
const toSuggestion = '#to-city ~ .atc-city-matched div';

try {
    await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return el && el.innerText.trim().length > 0;
    }, toSuggestion, { timeout: 5000 });

    await page.locator(toSuggestion).first().click();
    console.log("✅ Destination selected.");
} catch (e) {
    await page.focus(toInput);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
}

        // 3. Date Selection ("15 February 2026")
        const [targetDay, targetMonth, targetYear] = travelDate.split(' ');
        const targetMonthYear = `${targetMonth} ${targetYear}`;

        await page.click('#journey_date');
        await page.waitForSelector('.ui-datepicker-calendar', { state: 'visible' });

        let isMonthFound = false;
        while (!isMonthFound) {
            const currentMonth = await page.innerText('.ui-datepicker-month');
            const currentYear = await page.innerText('.ui-datepicker-year');
            const currentMonthYear = `${currentMonth} ${currentYear}`;

            if (currentMonthYear.toLowerCase().includes(targetMonth.toLowerCase()) && currentMonthYear.includes(targetYear)) {
                isMonthFound = true;
            } else {
                await page.click('.ui-datepicker-next');
                await page.waitForTimeout(300);
            }
        }

        // Select the specific day from the calendar table
        await page.click(`.ui-datepicker-calendar td >> text="${parseInt(targetDay)}"`);
        console.log(`✅ Selected ${travelDate}`);

        // 4. Search
        console.log("Searching...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('#search_btn')
        ]);

        // 5. CHECK FOR "NO BUSES FOUND"
        const noBuses = await page.$('.no-bus-found, .error-msg-container');
        if (noBuses) {
            console.log("🛑 No buses found for this route.");
            return [];
        }

        // 6. Extraction Logic
        console.log("Extracting bus data...");
        // Wait for service items to load
        await page.waitForSelector('.service-item', { timeout: 15000 }).catch(() => null);

        // Scroll to load all dynamic content
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(1500);

        const busResults = await page.$$eval('.service-item', (items) => {
            return items.map(item => {
                const operator = item.querySelector('.bus-name')?.innerText.trim() || "N/A";
                const busType = item.querySelector('.bus-type')?.innerText.trim() || "N/A";
                const departure = item.querySelector('.dept-time')?.innerText.trim() || "N/A";
                const arrival = item.querySelector('.arr-time')?.innerText.trim() || "N/A";
                const duration = item.querySelector('.duration')?.innerText.trim() || "N/A";
                
                const rawPrice = item.querySelector('.fare')?.innerText || "0";
                const cleanPrice = parseInt(rawPrice.replace(/[^0-9]/g, '')) || 0;

                const seats = item.querySelector('.seat-left')?.innerText.trim() || "N/A";
                const rating = item.querySelector('.rating-box')?.innerText.trim() || "N/A";

                return {
                    source: "TravelYaari",
                    operator,
                    busType,
                    departure,
                    arrival,
                    duration,
                    price: cleanPrice,
                    seats,
                    rating
                };
            });
        });

        return busResults.filter(bus => bus.price > 0);

    } catch (err) {
        console.error("❌ TravelYaari Scraper Error:", err);
        return [];
    } finally {
        await browser.close();
    }
}

// scrapeTravelYaari('Khed', 'Pune', '15 February 2026').then(console.log)

export default scrapeTravelYaari;