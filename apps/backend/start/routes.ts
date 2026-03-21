/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { UUID_REGEX } from '#helpers/regex'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FunnelStagesController = () => import('#controllers/funnel_stages_controller')
const InteractionsController = () => import('#controllers/interactions_controller')
const PositioningsController = () => import('#controllers/positionings_controller')
const ProspectsController = () => import('#controllers/prospects_controller')
const TestController = () => import('#controllers/test_controller')

router
  .group(() => {
    router.get('/health', async ({ response }) => {
      return response.ok({ status: 'ok' })
    })

    // Auth routes
    router
      .group(() => {
        router.get('/registration-status', [AuthController, 'registrationStatus'])
        router.post('/register', [AuthController, 'register']).use(middleware.guest())
        router.post('/login', [AuthController, 'login']).use(middleware.guest())
        router.get('/me', [AuthController, 'me']).use(middleware.auth())
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('/auth')

    // Funnel stages routes — ALL require auth
    router
      .group(() => {
        // ⚠️ CRITICAL: reorder MUST be before /:id — otherwise "reorder" is matched as an ID
        router.put('/reorder', [FunnelStagesController, 'reorder'])
        router.get('/', [FunnelStagesController, 'index'])
        router.post('/', [FunnelStagesController, 'store'])
        router.put('/:id', [FunnelStagesController, 'update']).where('id', UUID_REGEX)
        router.delete('/:id', [FunnelStagesController, 'destroy']).where('id', UUID_REGEX)
      })
      .prefix('/funnel_stages')
      .use(middleware.auth())
    // Interactions routes — ALL require auth
    router
      .group(() => {
        router.get('/', [InteractionsController, 'index'])
        router.post('/', [InteractionsController, 'store'])
        router.get('/:id', [InteractionsController, 'show']).where('id', UUID_REGEX)
        router.put('/:id', [InteractionsController, 'update']).where('id', UUID_REGEX)
        router.delete('/:id', [InteractionsController, 'destroy']).where('id', UUID_REGEX)
        router.patch('/:id/restore', [InteractionsController, 'restore']).where('id', UUID_REGEX)
      })
      .prefix('/interactions')
      .use(middleware.auth())
    // Positionings routes — ALL require auth
    router
      .group(() => {
        router.get('/', [PositioningsController, 'index'])
        router.post('/', [PositioningsController, 'store'])
        router.get('/:id', [PositioningsController, 'show']).where('id', UUID_REGEX)
        router.put('/:id', [PositioningsController, 'update']).where('id', UUID_REGEX)
        router.delete('/:id', [PositioningsController, 'destroy']).where('id', UUID_REGEX)
        router.patch('/:id/restore', [PositioningsController, 'restore']).where('id', UUID_REGEX)
        router.get('/:id/prospects', [PositioningsController, 'prospects']).where('id', UUID_REGEX)
      })
      .prefix('/positionings')
      .use(middleware.auth())
    // Prospects routes — ALL require auth
    router
      .group(() => {
        router.get('/', [ProspectsController, 'index'])
        router.post('/', [ProspectsController, 'store'])
        router.get('/:id', [ProspectsController, 'show']).where('id', UUID_REGEX)
        router.put('/:id', [ProspectsController, 'update']).where('id', UUID_REGEX)
        router.delete('/:id', [ProspectsController, 'destroy']).where('id', UUID_REGEX)
        router.patch('/:id/restore', [ProspectsController, 'restore']).where('id', UUID_REGEX)
        router
          .get('/:id/stage-transitions', [ProspectsController, 'stageTransitions'])
          .where('id', UUID_REGEX)
      })
      .prefix('/prospects')
      .use(middleware.auth())
  })
  .prefix('/api')

// Test-only routes — hard-delete helpers for E2E test teardown.
// NOT registered in production.
if (process.env.NODE_ENV !== 'production') {
  router
    .delete('/api/test/reset', [TestController, 'reset'])
    .use(middleware.auth())
}
