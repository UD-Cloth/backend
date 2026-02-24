import express from 'express';
import { submitContact } from '../controllers/contactController';

const router = express.Router();

router.post('/', submitContact);

export default router;
