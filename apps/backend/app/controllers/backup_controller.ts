import zlib from 'node:zlib'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { exportUserData } from '#services/backup_service'

export default class BackupController {
  /**
   * GET /api/backup/export
   * Exporte l'intégralité des données du user authentifié dans un fichier gzip
   * (`.json.gz`) téléchargeable. Compression via zlib natif (zéro dépendance).
   */
  async export({ auth, response }: HttpContext) {
    const user = auth.user!

    const envelope = await exportUserData(user)
    const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(envelope), 'utf-8'))

    const date = DateTime.now().toFormat('yyyy-MM-dd')
    const filename = `battlecrm-export-${date}.json.gz`

    response.header('Content-Type', 'application/gzip')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.send(buffer)
  }
}
