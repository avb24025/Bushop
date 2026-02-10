import redbus from '../scrapers/redbus.js';
import abhibus from '../scrapers/abhibus.js';

export default async function busController(req, res) {
    // Use body params if available, otherwise fallback to testArgs
    const source = req.body.source || 'khed';
    const destination = req.body.destination || 'Pune';
    const date = req.body.date || '15 February 2026';

    console.log(`Searching for: ${source} to ${destination} on ${date}`);

    // Define helper to run scraper safely
    const runScraper = async (scraperFn, name, ...args) => {
        try {
            console.log(`Starting ${name} scraper...`);
            return await scraperFn(...args);
        } catch (error) {
            console.error(`❌ ${name} Scraper Error:`, error.message);
            return []; // Return empty array on failure so logic continues
        }
    };

    // Execute scrapers in parallel but handle errors individually
    const [redbusResults, abhibusResults] = await Promise.all([
        runScraper(redbus, 'RedBus', source, destination, date),
        runScraper(abhibus, 'AbhiBus', source, destination, date)
    ]);

    // Store categorized by platform
    const categorizedBuses = {
        redbus: redbusResults,
        abhibus: abhibusResults,
        // travelyaari: [],
        // zingbus: []
    };

    // Create a combined flat list for easy UI rendering
    const allBuses = [...redbusResults, ...abhibusResults];

    console.log(`Results: RedBus(${redbusResults.length}), AbhiBus(${abhibusResults.length})`);

    // Return both grouped and flat data
    res.json({
        success: true,
        summary: {
            total: allBuses.length,
            platforms: {
                redbus: redbusResults.length,
                abhibus: abhibusResults.length
            }
        },
        data: categorizedBuses, // Organized by platform
        combined: allBuses      // Flat list for sorting/filtering
    });
}