import { readFile } from 'node:fs/promises'
import zlib from 'node:zlib'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { exportUserData, importUserData } from '#services/backup_service'
import { backupEnvelopeValidator, importFileValidator } from '#validators/backup'

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

  /**
   * POST /api/backup/import
   * Restaure l'intégralité des données du user authentifié depuis un fichier d'export
   * (`.json.gz`, champ multipart `file`) — par REMPLACEMENT TOTAL (opération destructive).
   *
   * - Gzip / JSON invalide → `400`.
   * - Enveloppe invalide (`format`/`version`/structure) ou fichier manquant → `422` (Vine).
   * - L'isolation (`userId` forcé) et l'atomicité (transaction) sont gérées par le service.
   */
  async import({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { file } = await request.validateUsing(importFileValidator)

    // Décompression + parsing : toute corruption gzip/JSON ⇒ 400.
    let parsed: unknown
    try {
      const compressed = await readFile(file.tmpPath!)
      const decompressed = zlib.gunzipSync(compressed)
      parsed = JSON.parse(decompressed.toString('utf-8'))
    } catch {
      return response.badRequest({
        errors: [{ message: 'Invalid backup file (corrupted gzip or JSON)', rule: 'invalidFile' }],
      })
    }

    // Validation de l'enveloppe → 422 si format/version/structure invalide.
    const envelope = await backupEnvelopeValidator.validate(parsed)

    await importUserData(user, envelope)

    return response.ok({ message: 'Backup imported' })
  }
}
