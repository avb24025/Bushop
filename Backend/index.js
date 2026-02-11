import express from 'express';
import cors from 'cors';
import busRoutes from './routes/bus.js';

const app=express();
const PORT=5000 || process.env.PORT;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use('/api',busRoutes);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
 
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});

