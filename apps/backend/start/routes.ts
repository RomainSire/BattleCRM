/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router.get('/health', async ({ response }) => {
      return response.ok({ status: 'ok' })
    })
  })
  .prefix('/api')
