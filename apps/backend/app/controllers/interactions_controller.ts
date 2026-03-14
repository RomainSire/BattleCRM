import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { UUID_REGEX } from '#helpers/regex'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import { serializeInteraction } from '#serializers/interaction'
import { createInteractionValidator, updateInteractionValidator } from '#validators/interactions'

export default class InteractionsController {
  /**
   * GET /api/interactions
   * Returns active interactions ordered by interaction_date DESC.
   * Filters: ?prospect_id, ?positioning_id, ?status, ?funnel_stage_id, ?include_archived
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const qs = request.qs()
    const includeArchived = qs.include_archived === 'true'
    const prospectId = qs.prospect_id as string | undefined
    const positioningId = qs.positioning_id as string | undefined
    const status = qs.status as string | undefined
    const funnelStageId = qs.funnel_stage_id as string | undefined

    const query = Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .orderBy('interaction_date', 'desc')

    if (includeArchived) {
      query.withTrashed()
    }

    if (prospectId) {
      if (!UUID_REGEX.test(prospectId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'prospect_id', rule: 'uuid' }],
        })
      }
      // withTrashed — allow filtering by archived prospect's interactions
      const prospect = await Prospect.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', prospectId)
        .first()
      if (!prospect) return response.notFound()
      query.where('prospect_id', prospectId)
    }

    if (positioningId) {
      if (!UUID_REGEX.test(positioningId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'positioning_id', rule: 'uuid' }],
        })
      }
      // withTrashed — allow filtering by archived positioning's interactions
      const pos = await Positioning.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', positioningId)
        .first()
      if (!pos) return response.notFound()
      query.where('positioning_id', positioningId)
    }

    if (status) {
      if (!['positive', 'pending', 'negative'].includes(status)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.enum', field: 'status', rule: 'enum' }],
        })
      }
      query.where('status', status)
    }

    if (funnelStageId) {
      if (!UUID_REGEX.test(funnelStageId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'funnel_stage_id', rule: 'uuid' }],
        })
      }
      const stage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .first()
      if (!stage) return response.notFound()
      // funnel_stage_id is on prospects, not interactions — filter via relation
      query.whereHas('prospect', (q) => q.withTrashed().where('funnel_stage_id', funnelStageId))
    }

    const interactions = await query
    return response.ok({
      data: interactions.map(serializeInteraction),
      meta: { total: interactions.length },
    })
  }

  /**
   * GET /api/interactions/:id
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .firstOrFail()
    return response.ok(serializeInteraction(interaction))
  }

  /**
   * POST /api/interactions
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createInteractionValidator)
    const userId = auth.user!.id

    // Validate prospect ownership — withTrashed to allow interactions on archived prospects
    await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.prospect_id)
      .firstOrFail()

    // Validate positioning ownership if provided — withTrashed for archived positionings
    if (payload.positioning_id) {
      await Positioning.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.positioning_id)
        .firstOrFail()
    }

    const interaction = await Interaction.create({
      userId,
      prospectId: payload.prospect_id,
      positioningId: payload.positioning_id ?? null,
      status: payload.status,
      notes: payload.notes ?? null,
      interactionDate: payload.interaction_date
        ? DateTime.fromISO(payload.interaction_date)
        : DateTime.now(),
    })

    // Reload with full preloads for serializer
    const created = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', interaction.id)
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .firstOrFail()

    return response.created(serializeInteraction(created))
  }

  /**
   * PUT /api/interactions/:id
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateInteractionValidator)
    const userId = auth.user!.id

    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    if (payload.status !== undefined) interaction.status = payload.status
    if (payload.notes !== undefined) interaction.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined) {
      // Validate positioning ownership — withTrashed to allow archived positionings
      if (payload.positioning_id) {
        await Positioning.query()
          .withTrashed()
          .withScopes((s) => s.forUser(userId))
          .where('id', payload.positioning_id)
          .firstOrFail()
      }
      interaction.positioningId = payload.positioning_id ?? null
    }
    if (payload.interaction_date !== undefined) {
      interaction.interactionDate = DateTime.fromISO(payload.interaction_date)
    }
    await interaction.save()

    // Reload with full preloads for serializer
    const updated = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', interaction.id)
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .firstOrFail()

    return response.ok(serializeInteraction(updated))
  }

  /**
   * DELETE /api/interactions/:id
   * Soft-deletes an interaction.
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()
    await interaction.delete()
    return response.ok({ message: 'Interaction archived' })
  }
}
