import type { ExtensionProspectData } from '@battlecrm/shared'
import { Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateProspect, useUpdateProspect } from '../features/prospects/hooks/useProspects'
import { HttpError } from '../lib/api'
import type { LinkedInScrapedData } from '../lib/linkedin' // kept for SCRAPE_PROFILE response type
import ProspectCard from './ProspectCard'
import ProspectForm, { type ProspectFormFields } from './ProspectForm'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

type CachedCheckResult = { found: true; prospect: ExtensionProspectData } | { found: false }

type FormSessionState = {
  mode: 'add' | 'edit'
  fields: ProspectFormFields
  hasUnsavedChanges: true
  prospectId?: string
}

type PopupMode = 'loading' | 'add' | 'read' | 'edit' | 'success-add'

async function scrapeFromActiveTab(): Promise<ProspectFormFields> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (!tabId) return emptyFields()
    const scraped = (await browser.tabs.sendMessage(tabId, {
      type: 'SCRAPE_PROFILE',
    })) as LinkedInScrapedData | undefined
    return {
      name: scraped?.name ?? '',
      title: scraped?.headline ?? '',
      company: scraped?.company ?? '',
      email: '',
      phone: '',
    }
  } catch {
    return emptyFields()
  }
}

function emptyFields(): ProspectFormFields {
  return { name: '', title: '', company: '', email: '', phone: '' }
}

interface ProspectPopupScreenProps {
  linkedinUrl: string
  baseUrl: string
  onSettingsClick: () => void
}

export default function ProspectPopupScreen({
  linkedinUrl,
  baseUrl,
  onSettingsClick,
}: ProspectPopupScreenProps) {
  const { t } = useTranslation()
  const createProspect = useCreateProspect()
  const updateProspect = useUpdateProspect()

  const formKey = `form:${linkedinUrl}`

  const [mode, setMode] = useState<PopupMode>('loading')
  const [prospect, setProspect] = useState<ExtensionProspectData | null>(null)
  const [formDefaults, setFormDefaults] = useState<ProspectFormFields>({
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [serverError, setServerError] = useState<string | undefined>(undefined)
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function loadPanelData() {
      // 1. Check for saved form state first
      const sessionResult = await browser.storage.session.get(formKey)
      const saved = sessionResult[formKey] as FormSessionState | undefined

      if (saved?.hasUnsavedChanges) {
        setFormDefaults(saved.fields)
        setHasUnsavedChanges(true)

        if (saved.mode === 'edit' && saved.prospectId) {
          const panelData: CachedCheckResult | null = await browser.runtime.sendMessage({
            type: 'GET_PANEL_DATA',
            linkedinUrl,
          })
          if (panelData?.found === true) {
            setProspect(panelData.prospect)
          }
          setMode('edit')
        } else {
          setMode('add')
        }
        return
      }

      // 2. No saved form state — get cached check result from service worker
      const panelData: CachedCheckResult | null = await browser.runtime.sendMessage({
        type: 'GET_PANEL_DATA',
        linkedinUrl,
      })

      if (!panelData) {
        setFormDefaults(await scrapeFromActiveTab())
        setMode('add')
        return
      }

      if (panelData.found) {
        setProspect(panelData.prospect)
        setMode('read')
      } else {
        setFormDefaults(await scrapeFromActiveTab())
        setMode('add')
      }
    }

    loadPanelData()
  }, [linkedinUrl, formKey])

  const handleFieldChange = useCallback(
    (fields: ProspectFormFields) => {
      const state: FormSessionState = {
        mode: mode === 'edit' ? 'edit' : 'add',
        fields,
        hasUnsavedChanges: true,
        ...(prospect?.id ? { prospectId: prospect.id } : {}),
      }
      browser.storage.session.set({ [formKey]: state })
    },
    [formKey, mode, prospect?.id],
  )

  async function handleAddSubmit(fields: ProspectFormFields) {
    setServerError(undefined)
    try {
      const payload: Record<string, string> = {
        name: fields.name,
        linkedin_url: linkedinUrl,
      }
      if (fields.company) payload.company = fields.company
      if (fields.email) payload.email = fields.email
      if (fields.phone) payload.phone = fields.phone
      if (fields.title) payload.title = fields.title

      const created = await createProspect.mutateAsync(
        payload as Parameters<typeof createProspect.mutateAsync>[0],
      )

      await browser.storage.session.remove(formKey)
      await browser.action.setBadgeText({ text: '✓' })
      await browser.action.setBadgeBackgroundColor({ color: '#16a34a' })
      await browser.action.setTitle({ title: 'Prospect déjà dans BattleCRM' })
      await browser.storage.session.set({ [linkedinUrl]: { found: true, prospect: created } })

      setProspect(created)
      setMode('success-add')
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 409) {
          setServerError(t('prospect.form.errors.alreadyExists'))
        } else if (err.status === 422) {
          setServerError(t('prospect.form.errors.noFunnelStage'))
        } else {
          setServerError(t('prospect.form.errors.server'))
        }
      } else {
        setServerError(t('prospect.form.errors.server'))
      }
    }
  }

  async function handleEditSubmit(fields: ProspectFormFields) {
    if (!prospect) return
    setServerError(undefined)
    try {
      const updated = await updateProspect.mutateAsync({
        id: prospect.id,
        name: fields.name,
        company: fields.company || null,
        email: fields.email || null,
        phone: fields.phone || null,
        title: fields.title || null,
      })

      await browser.storage.session.remove(formKey)
      setProspect(updated)
      setEditSuccessMessage(t('prospect.form.successEdit'))
      setHasUnsavedChanges(false)
      setMode('read')
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        setServerError(t('prospect.form.errors.validation'))
      } else {
        setServerError(t('prospect.form.errors.server'))
      }
    }
  }

  function handleEnterEdit() {
    if (!prospect) return
    setFormDefaults({
      name: prospect.name,
      title: prospect.title ?? '',
      company: prospect.company ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
    })
    setServerError(undefined)
    setMode('edit')
  }

  async function handleCancelEdit() {
    await browser.storage.session.remove(formKey)
    setHasUnsavedChanges(false)
    setServerError(undefined)
    setMode('read')
  }

  async function handleReset() {
    await browser.storage.session.remove(formKey)
    setHasUnsavedChanges(false)
    setFormDefaults(await scrapeFromActiveTab())
    setMode('add')
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img alt="BattleCRM" className="h-5 w-auto" src="/BattleCRM_logo.svg" />
          <span className="font-bold text-lg text-brand-gradient">{t('common.appName')}</span>
        </div>
        <Button
          aria-label={t('aria.settings')}
          onClick={onSettingsClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      </header>

      <Separator />

      {mode === 'loading' && <div className="px-4 py-8" />}

      {mode === 'add' && (
        <ProspectForm
          defaultValues={formDefaults}
          hasUnsavedChanges={hasUnsavedChanges}
          isPending={createProspect.isPending}
          linkedinUrl={linkedinUrl}
          mode="add"
          onFieldChange={handleFieldChange}
          onReset={handleReset}
          onSubmit={handleAddSubmit}
          serverError={serverError}
        />
      )}

      {(mode === 'read' || mode === 'success-add') && prospect && (
        <ProspectCard
          baseUrl={baseUrl}
          onEdit={handleEnterEdit}
          prospect={prospect}
          successMessage={
            mode === 'success-add' ? t('prospect.form.successAdd') : editSuccessMessage
          }
        />
      )}

      {mode === 'edit' && (
        <ProspectForm
          defaultValues={formDefaults}
          hasUnsavedChanges={false}
          isPending={updateProspect.isPending}
          linkedinUrl={linkedinUrl}
          mode="edit"
          onCancel={handleCancelEdit}
          onFieldChange={handleFieldChange}
          onSubmit={handleEditSubmit}
          serverError={serverError}
        />
      )}
    </div>
  )
}
