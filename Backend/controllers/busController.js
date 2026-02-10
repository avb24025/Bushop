import redbus from '../scrapers/redbus.js';
import abhibus from '../scrapers/abhibus.js';
// import travelyaari from '../scrapers/travelyaari.js';
// import zingbus from '../scrapers/zingbus.js';
    
export default async function busController(req, res) {
    const { source, destination, date } = req.body;

    const testArgs = ['khed', 'Pune', '15 February 2026'];

    const [redbusRoutes, abhibusRoutes, travelyaariRoutes, zingbusRoutes] = await Promise.all([
        redbus(...testArgs),
        abhibus(...testArgs),
        // travelyaari(source, destination, date),
        // zingbus(source, destination, date)
    ]);

    const busRoutes = [...(redbusRoutes || []), ...(abhibusRoutes || []), ...(travelyaariRoutes || []), ...(zingbusRoutes || [])];
    console.log(`Total Options: redbus=${redbusRoutes.length}, abhibus=${abhibusRoutes.length}`);
    console.log("Combined Bus Routes:", busRoutes);
    res.json(busRoutes);

}
