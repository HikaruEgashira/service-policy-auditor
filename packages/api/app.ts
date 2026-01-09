import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DatabaseAdapter } from './db/interface'
import { createReportsRoutes } from './routes/reports'
import { createSyncRoutes } from './routes/sync'

export function createApp(db: DatabaseAdapter) {
  const app = new Hono()

  app.use('*', cors())

  app.route('/api/v1/reports', createReportsRoutes(db))
  app.route('/api/v1/sync', createSyncRoutes(db))

  app.get('/api/v1/stats', async (c) => {
    const stats = await db.getStats()
    return c.json(stats)
  })

  app.get('/api/v1/violations', async (c) => {
    const violations = await db.getAllViolations()
    return c.json({ violations })
  })

  app.get('/api/v1/requests', async (c) => {
    const requests = await db.getAllNetworkRequests()
    return c.json({ requests })
  })

  return app
}
