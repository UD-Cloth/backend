import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from the correct directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback

import cors from 'cors';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import cartRoutes from './routes/cartRoutes';
import categoryRoutes from './routes/categoryRoutes';
import statsRoutes from './routes/statsRoutes';
import contactRoutes from './routes/contactRoutes';
import uploadRoutes from './routes/uploadRoutes';

connectDB();

const app: Express = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: '*', // For development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

try {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));
} catch (_) { }


app.get('/', (req: Request, res: Response) => {
  res.send('UD Project API is running');
});

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/admin', statsRoutes);
apiRouter.use('/contact', contactRoutes);

app.use('/api', apiRouter);
// Mount at root as a fallback for misconfigured frontend URLs missing /api
app.use('/', apiRouter);


if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
