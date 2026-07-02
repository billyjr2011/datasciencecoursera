import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { referenceRouter } from './modules/reference/reference.routes.js';
import { pricesRouter } from './modules/prices/prices.routes.js';
import { indicesRouter } from './modules/indices/indices.routes.js';
import { esgRouter } from './modules/esg/esg.routes.js';
import { certificatesRouter } from './modules/certificates/certificates.routes.js';
import { alertsRouter } from './modules/alerts/alerts.routes.js';
import { ddraRouter } from './modules/ddra/ddra.routes.js';
import { regulatoryRouter } from './modules/regulatory/regulatory.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { feedsRouter } from './modules/feeds/feeds.routes.js';
import { fobRouter } from './modules/fob/fob.routes.js';
import { sigifRouter } from './modules/sigif/sigif.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { projectionsRouter } from './modules/projections/projections.routes.js';

/** Composes every domain module under the versioned `/api/v1` base path. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/reference', referenceRouter);
apiRouter.use('/prices', pricesRouter);
apiRouter.use('/indices', indicesRouter);
apiRouter.use('/esg', esgRouter);
apiRouter.use('/certificates', certificatesRouter);
apiRouter.use('/alerts', alertsRouter);
apiRouter.use('/ddra', ddraRouter);
apiRouter.use('/regulations', regulatoryRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/feeds', feedsRouter);
apiRouter.use('/fob', fobRouter);
apiRouter.use('/sigif', sigifRouter);
apiRouter.use('/subscriptions', subscriptionsRouter);
apiRouter.use('/projections', projectionsRouter);
