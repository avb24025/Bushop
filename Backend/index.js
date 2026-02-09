import express from 'express';
import cors from 'cors';
import busRoutes from './routes/bus.js';

const app=express();
const PORT=5000 || process.env.PORT;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use('/api',busRoutes);
 
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});

