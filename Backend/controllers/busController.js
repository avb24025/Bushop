import redbus from '../scrapers/redbus.js';
import abhibus from '../scrapers/abhibus.js';
import travelyaari from '../scrapers/travelyaari.js';
import zingbus from '../scrapers/zingbus.js';
    
export default function busController(req,res){
    const { source, destination,date } = req.body;
    const redbusRoutes=redbus(source,destination,date);
    const abhibusRoutes=abhibus(source,destination,date);
    const travelyaariRoutes=travelyaari(source,destination,date);
    const zingbusRoutes=zingbus(source,destination,date);
    const busRoutes=[...redbusRoutes,...abhibusRoutes,...travelyaariRoutes,...zingbusRoutes];
    res.json(busRoutes);
}
