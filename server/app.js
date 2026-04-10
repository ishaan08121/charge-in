import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import bookingsRouter from './routes/bookings.js';
import chargersRouter from './routes/chargers.js';
import authRouter from './routes/auth.js';
import reviewsRouter from './routes/reviews.js';
import payoutsRouter from './routes/payouts.js';
import usersRouter from './routes/users.js';

// Jobs
import { startBookingCron } from './jobs/bookingExpiry.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/bookings',  bookingsRouter);
app.use('/api/chargers',  chargersRouter);
app.use('/api/auth',      authRouter);
app.use('/api/reviews',   reviewsRouter);
app.use('/api/payouts',   payoutsRouter);
app.use('/api/users',     usersRouter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Charge.in API is running' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startBookingCron();
});

export default app;