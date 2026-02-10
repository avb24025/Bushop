import express from 'express';
import busController from '../controllers/busController.js';

const router=express.Router();

router.post('/bus',busController);

export default router;

