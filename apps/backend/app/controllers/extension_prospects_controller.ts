import type { HttpContext } from '@adonisjs/core/http'
import type { ExtensionCheckResponse, ExtensionProspectData } from '@battlecrm/shared'
import { UUID_REGEX } from '#helpers/regex'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import {
  extensionCheckValidator,
  extensionCreateProspectValidator,
  extensionUpdateProspectValidator,
} from '#validators/extension_prospects'

function normalizeLinkedinUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
      .replace(/[?#].*$/, '')
      .trim()
      .replace(/\/$/, '')
  }
}

async function serializeExtensionProspect(prospect: Prospect): Promise<ExtensionProspectData> {
  await prospect.load('funnelStage')
  return {
    id: prospect.id,
    name: prospect.name,
    company: prospect.company,
    linkedinUrl: prospect.linkedinUrl,
    email: prospect.email,
    phone: prospect.phone,
    title: prospect.title,
    notes: prospect.notes,
    funnelStageId: prospect.funnelStageId,
    funnelStageName: prospect.funnelStage.name,
  }
}

export default class ExtensionProspectsController {
  /**
   * GET /api/extension/prospects/check?linkedin_url=<url>
   * Returns { found: true, prospect } or { found: false }.
   * Always 200 — never 404 — to avoid leaking prospect existence across users.
   */
  async check({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(extensionCheckValidator)
    const userId = auth.use('extension').user!.id
    const normalized = normalizeLinkedinUrl(data.linkedin_url)

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('linkedin_url', normalized)
      .first()

    if (!prospect) {
      const body: ExtensionCheckResponse = { found: false }
      return response.ok(body)
    }

    const body: ExtensionCheckResponse = {
      found: true,
      prospect: await serializeExtensionProspect(prospect),
    }
    return response.ok(body)
  }

  /**
   * POST /api/extension/prospects
   * Creates a prospect, auto-assigns to first funnel stage.
   * Returns 409 if linkedin_url already exists for this user (non-deleted).
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(extensionCreateProspectValidator)
    const userId = auth.use('extension').user!.id
    const normalizedUrl = normalizeLinkedinUrl(payload.linkedin_url)

    // Pre-check for duplicate linkedin_url (user-friendly 409 with prospectId)
    const existing = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('linkedin_url', normalizedUrl)
      .first()

    if (existing) {
      return response.conflict({
        message: 'Prospect already exists',
        prospectId: existing.id,
      })
    }

    // Auto-assign to first funnel stage (lowest position)
    const firstStage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .first()

    if (!firstStage) {
      return response.unprocessableEntity({
        errors: [
          {
            message: 'No active funnel stage found — create at least one stage first',
            field: 'funnel_stage_id',
            rule: 'required',
          },
        ],
      })
    }

    const prospect = new Prospect()
    prospect.userId = userId
    prospect.funnelStageId = firstStage.id
    prospect.name = payload.name
    prospect.linkedinUrl = normalizedUrl
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null

    await prospect.save()
    return response.created(await serializeExtensionProspect(prospect))
  }

  /**
   * PATCH /api/extension/prospects/:id
   * Partial update. linkedin_url is read-only (excluded from validator).
   * Returns 404 if prospect belongs to another user (forUser() pattern).
   */
  async update({ params, request, response, auth }: HttpContext) {
    if (!UUID_REGEX.test(params.id)) {
      return response.notFound()
    }

    const payload = await request.validateUsing(extensionUpdateProspectValidator)
    const userId = auth.use('extension').user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    if (payload.name !== undefined) prospect.name = payload.name
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null

    await prospect.save()
    return response.ok(await serializeExtensionProspect(prospect))
  }
}
