/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FunnelStagesController = () => import('#controllers/funnel_stages_controller')

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
        router.put('/:id', [FunnelStagesController, 'update'])
        router.delete('/:id', [FunnelStagesController, 'destroy'])
      })
      .prefix('/funnel_stages')
      .use(middleware.auth())
  })
  .prefix('/api')
