import redbus from '../scrapers/redbus.js';
import abhibus from '../scrapers/abhibus.js';
import scrapeIxigo from '../scrapers/ixigo.js';

export default async function busController(req, res) {
    const source = req.body.source || 'Khed';
    const destination = req.body.destination || 'Pune';
    const date = req.body.date || '15 February 2026';

    console.log(`🔍 Global Search: ${source} to ${destination} on ${date}`);

    // This helper ensures that if ONE scraper fails, it returns [] 
    // instead of throwing an error that stops the other scrapers.
    const runScraper = async (scraperFn, name, ...args) => {
        try {
            console.log(`🚀 [${name}] started...`);
            const results = await scraperFn(...args);
            console.log(`✅ [${name}] found ${results ? results.length : 0} buses.`);
            return Array.isArray(results) ? results : []; 
        } catch (error) {
            console.error(`❌ [${name}] failed:`, error.message);
            return []; // Fail gracefully with empty results
        }
    };

    // Parallel Execution
    const [redbusResults, abhibusResults, ixigoResults] = await Promise.all([
        runScraper(redbus, 'RedBus', source, destination, date),
        runScraper(abhibus, 'AbhiBus', source, destination, date),
        runScraper(scrapeIxigo, 'Ixigo', source, destination, date)
    ]);

    const categorizedBuses = {
        redbus: redbusResults,
        abhibus: abhibusResults,
        ixigo: ixigoResults
    };

    const allBuses = [...redbusResults, ...abhibusResults, ...ixigoResults];

    res.json({
        success: true,
        summary: {
            total: allBuses.length,
            platforms: {
                redbus: redbusResults.length,
                abhibus: abhibusResults.length,
                ixigo: ixigoResults.length
            }
        },
        data: categorizedBuses,
        combined: allBuses
    });
}