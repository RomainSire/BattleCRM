# Story 7.6: Prospect Add/Update Popup

Status: review

## Story

As a BattleCRM user,
I want to click the extension icon on a LinkedIn profile and immediately see a form adapted to whether the prospect is already in my CRM,
So that I can add or update a prospect in under 30 seconds, even if I need to click away to copy-paste from the LinkedIn page.

## Acceptance Criteria

1. **AC1 (Popup flow — no skeleton):** Given I click the extension icon on a LinkedIn profile page, when the popup opens, the popup checks `chrome.storage.session['form:' + normalizedUrl]` for saved form state; if found → restore form and show amber "⚠️ Modifications non sauvegardées" banner; if not found → send `GET_PANEL_DATA` message to get the `CachedCheckResult` cached in Story 7.5 (under `chrome.storage.session[normalizedUrl]`). Data is always pre-available — NO skeleton loaders.

2. **AC2 (State persistence across close/reopen):** When the popup is closed while editing, on reopen on the same LinkedIn URL, the form is fully restored (fields + mode) and an amber banner "⚠️ Modifications non sauvegardées — reprendre ?" with a "Recommencer" link is shown. "Recommencer" clears `chrome.storage.session['form:' + url]` and resets to the scraped/CRM defaults.

3. **AC3 (Navigation clears state):** When Story 7.5 detects navigation to a different LinkedIn profile and sends `CLEAR_BADGE`, the service worker also removes `chrome.storage.session['form:' + previousUrl]` in addition to the existing `chrome.storage.session[previousUrl]`.

4. **AC4 (ADD mode — found: false):** Given `CachedCheckResult.found === false`, the popup displays 6 editable fields pre-filled from `scrapedData`: Prénom *, Nom * (both from `scrapedData.name` split on last space), Titre (from `scrapedData.headline`), Entreprise (from `scrapedData.company` — if empty, show placeholder "Vérifiez sur LinkedIn"), Email (empty), Téléphone (empty). Plus 1 read-only field: URL LinkedIn (canonical URL). An "Ajouter le prospect" primary button is shown.

5. **AC5 (ADD focus & tab order):** On open, focus is set on the Prénom input. Tab order: Prénom → Nom → Titre → Entreprise → Email → Téléphone → "Ajouter le prospect" button.

6. **AC6 (Field persistence):** Every field change is immediately persisted to `chrome.storage.session['form:' + linkedinUrl]` with `{ mode: 'add', fields: { firstName, lastName, title, company, email, phone }, hasUnsavedChanges: true }`.

7. **AC7 (ADD submission):** Client-side validation: firstName and lastName are required. On submit: button enters loading/spinner state. `POST /api/extension/prospects` is called with `{ name: firstName + ' ' + lastName, linkedin_url, company, email, phone, title }` (optional fields only sent if non-empty). On success: session form state cleared, badge updated to green ✓, inline success view shown with "Prospect ajouté ✓" and a "Voir dans BattleCRM ↗" link.

8. **AC8 (READ mode — found: true):** Given `CachedCheckResult.found === true`, the popup shows: green banner "✓ Déjà dans BattleCRM", prospect name/title/company (from CRM, NEVER LinkedIn DOM), current funnel stage name, email and phone (displayed as "—" if null). Two CTAs: "Voir dans BattleCRM ↗" (opens `chrome.tabs.create({ url: baseUrl + '/prospects/' + prospect.id })`) and "Modifier" (secondary, enters EDIT mode).

9. **AC9 (EDIT mode):** Given the user clicks "Modifier", form transitions to EDIT with editable fields pre-filled from CRM data, amber banner "⚠️ Modification en cours", "Annuler" and "Mettre à jour" buttons. URL LinkedIn remains read-only. Each change persisted to session with `{ mode: 'edit', fields, hasUnsavedChanges: true, prospectId }`.

10. **AC10 (EDIT cancel):** "Annuler" returns to READ mode immediately. Session state cleared.

11. **AC11 (EDIT submission):** `PATCH /api/extension/prospects/:id` called with only changed fields. On success: session state cleared, transitions to READ mode with updated prospect data, shows brief "✓ Prospect mis à jour" message.

12. **AC12 (Error handling):** Submit button returns to normal state on error. Field-level validation errors (422) shown inline under the relevant inputs. Server/network errors (500, network fail, 409 conflict, no funnel stage) shown as an alert banner at the top of the form.

## Tasks / Subtasks

### Task 1: `background.ts` — also clear form state on CLEAR_BADGE (AC3)

- [x] **1.1** In `handleClearBadge()` in `apps/extension/src/entrypoints/background.ts`, add removal of the form state session key alongside the existing CachedCheckResult removal:
  ```typescript
  async function handleClearBadge(previousUrl?: string): Promise<void> {
    await clearBadge()
    if (previousUrl) {
      await browser.storage.session.remove([previousUrl, `form:${previousUrl}`])
    }
  }
  ```
  > `browser.storage.session.remove()` accepts a string array — cleaner than two separate calls.

### Task 2: New `ProspectCard.tsx` — READ mode component (AC8)

- [x] **2.1** Create `apps/extension/src/components/ProspectCard.tsx`:
  ```typescript
  import { ExternalLink, Pencil } from 'lucide-react'
  import { useTranslation } from 'react-i18next'
  import type { ExtensionProspectData } from '@battlecrm/shared'
  import { Button } from './ui/button'
  import { Separator } from './ui/separator'

  interface ProspectCardProps {
    prospect: ExtensionProspectData
    baseUrl: string
    onEdit: () => void
    successMessage?: string
  }

  export default function ProspectCard({ prospect, baseUrl, onEdit, successMessage }: ProspectCardProps) {
    const { t } = useTranslation()

    function handleViewInApp() {
      browser.tabs.create({ url: `${baseUrl}/prospects/${prospect.id}` })
    }

    return (
      <div className="flex flex-col gap-0">
        {/* Green found banner */}
        <div className="mx-4 mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 border border-green-200">
          {t('prospect.read.foundBanner')}
        </div>

        {successMessage && (
          <div className="mx-4 mt-2 rounded-md bg-green-100 px-3 py-2 text-xs font-medium text-green-800">
            {successMessage}
          </div>
        )}

        <div className="px-4 py-3 flex flex-col gap-2">
          <div>
            <p className="font-semibold text-sm">{prospect.name}</p>
            {prospect.title && <p className="text-xs text-muted-foreground">{prospect.title}</p>}
            {prospect.company && <p className="text-xs text-muted-foreground">{prospect.company}</p>}
          </div>

          <Separator />

          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('prospect.read.stage')}</span>
              <span className="font-medium">{prospect.funnelStageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('prospect.read.email')}</span>
              <span className="font-medium">{prospect.email ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('prospect.read.phone')}</span>
              <span className="font-medium">{prospect.phone ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-col gap-2">
          <Button className="w-full" onClick={handleViewInApp} type="button">
            <ExternalLink className="size-4" />
            {t('prospect.read.viewInApp')}
          </Button>
          <Button className="w-full" onClick={onEdit} type="button" variant="outline">
            <Pencil className="size-4" />
            {t('prospect.read.edit')}
          </Button>
        </div>
      </div>
    )
  }
  ```

### Task 3: New `ProspectForm.tsx` — ADD/EDIT form component (AC4, AC5, AC6, AC9)

- [x] **3.1** Create `apps/extension/src/components/ProspectForm.tsx`:
  ```typescript
  import { useEffect, useRef } from 'react'
  import { type SubmitHandler, useForm } from 'react-hook-form'
  import { useTranslation } from 'react-i18next'
  import { Button } from './ui/button'
  import { Input } from './ui/input'
  import { Label } from './ui/label'

  export interface ProspectFormFields {
    firstName: string
    lastName: string
    title: string
    company: string
    email: string
    phone: string
  }

  interface ProspectFormProps {
    mode: 'add' | 'edit'
    defaultValues: ProspectFormFields
    linkedinUrl: string
    hasUnsavedChanges?: boolean
    serverError?: string
    isPending: boolean
    onFieldChange: (fields: ProspectFormFields) => void
    onSubmit: (fields: ProspectFormFields) => void
    onCancel?: () => void   // edit only
    onReset?: () => void    // add only — "Recommencer"
  }

  export default function ProspectForm({
    mode,
    defaultValues,
    linkedinUrl,
    hasUnsavedChanges,
    serverError,
    isPending,
    onFieldChange,
    onSubmit,
    onCancel,
    onReset,
  }: ProspectFormProps) {
    const { t } = useTranslation()
    const firstNameRef = useRef<HTMLInputElement>(null)

    const {
      register,
      handleSubmit,
      watch,
      formState: { errors },
    } = useForm<ProspectFormFields>({ defaultValues, mode: 'onTouched' })

    // Focus first field on mount (AC5)
    useEffect(() => {
      firstNameRef.current?.focus()
    }, [])

    // Persist every field change to session (AC6, AC9)
    useEffect(() => {
      const subscription = watch((values) => {
        onFieldChange(values as ProspectFormFields)
      })
      return () => subscription.unsubscribe()
    }, [watch, onFieldChange])

    const { ref: rhfFirstNameRef, ...firstNameRest } = register('firstName', {
      required: t('validation.required'),
    })

    const onFormSubmit: SubmitHandler<ProspectFormFields> = (data) => {
      onSubmit(data)
    }

    const isEdit = mode === 'edit'

    return (
      <div className="flex flex-col gap-0">
        {/* Amber banner — unsaved state or edit mode */}
        {hasUnsavedChanges && !isEdit && (
          <div className="mx-4 mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 flex items-center justify-between">
            <span>{t('prospect.form.unsavedBanner')}</span>
            {onReset && (
              <button
                className="ml-2 underline text-amber-800 hover:text-amber-900"
                onClick={onReset}
                type="button"
              >
                {t('prospect.form.reset')}
              </button>
            )}
          </div>
        )}
        {isEdit && (
          <div className="mx-4 mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200">
            {t('prospect.form.editBanner')}
          </div>
        )}

        {/* Server error banner */}
        {serverError && (
          <div className="mx-4 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {serverError}
          </div>
        )}

        <form className="flex flex-col gap-2.5 px-4 py-3" onSubmit={handleSubmit(onFormSubmit)}>
          {/* Prénom */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="firstName">
              {t('prospect.form.firstName')} *
            </Label>
            <Input
              {...firstNameRest}
              ref={(el) => {
                rhfFirstNameRef(el)
                ;(firstNameRef as React.MutableRefObject<HTMLInputElement | null>).current = el
              }}
              aria-invalid={!!errors.firstName}
              disabled={isPending}
              id="firstName"
              className="h-8 text-xs"
            />
            {errors.firstName && (
              <p className="text-xs text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          {/* Nom */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="lastName">
              {t('prospect.form.lastName')} *
            </Label>
            <Input
              {...register('lastName', { required: t('validation.required') })}
              aria-invalid={!!errors.lastName}
              disabled={isPending}
              id="lastName"
              className="h-8 text-xs"
            />
            {errors.lastName && (
              <p className="text-xs text-destructive">{errors.lastName.message}</p>
            )}
          </div>

          {/* Titre */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="title">
              {t('prospect.form.title')}
            </Label>
            <Input
              {...register('title')}
              disabled={isPending}
              id="title"
              className="h-8 text-xs"
            />
          </div>

          {/* Entreprise */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="company">
              {t('prospect.form.company')}
            </Label>
            <Input
              {...register('company')}
              disabled={isPending}
              id="company"
              className="h-8 text-xs"
              placeholder={t('prospect.form.companyPlaceholder')}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="email">
              {t('prospect.form.email')}
            </Label>
            <Input
              {...register('email')}
              disabled={isPending}
              id="email"
              type="email"
              className="h-8 text-xs"
            />
          </div>

          {/* Téléphone */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="phone">
              {t('prospect.form.phone')}
            </Label>
            <Input
              {...register('phone')}
              disabled={isPending}
              id="phone"
              type="tel"
              className="h-8 text-xs"
            />
          </div>

          {/* URL LinkedIn — read-only, always */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="linkedinUrl">
              {t('prospect.form.linkedinUrl')}
            </Label>
            <Input
              className="h-8 text-xs bg-muted text-muted-foreground cursor-not-allowed"
              disabled
              id="linkedinUrl"
              readOnly
              value={linkedinUrl}
            />
          </div>

          {/* Action buttons */}
          <div className={`flex gap-2 pt-1 ${isEdit ? 'flex-row' : 'flex-col'}`}>
            {isEdit && (
              <Button
                className="flex-1"
                disabled={isPending}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                {t('prospect.form.cancel')}
              </Button>
            )}
            <Button
              className={isEdit ? 'flex-1' : 'w-full'}
              disabled={isPending}
              type="submit"
            >
              {isPending
                ? t('prospect.form.submitting')
                : isEdit
                  ? t('prospect.form.submitEdit')
                  : t('prospect.form.submitAdd')}
            </Button>
          </div>
        </form>
      </div>
    )
  }
  ```

  > **Name splitting:** `firstName` = everything before the last space, `lastName` = last word. If the name has no space (e.g. single-word name), `firstName = name`, `lastName = ''`. This is handled in `ProspectPopupScreen`.
  >
  > **Tab order:** The natural DOM order of inputs matches the required tab order (AC5): firstName → lastName → title → company → email → phone → button. No explicit `tabIndex` needed.
  >
  > **Email input type:** `type="email"` provides browser-level validation hint but the server is the authoritative validator. No VineJS on the extension frontend — server errors are shown inline.
  >
  > **Ref merging:** React hook form's `ref` callback and the local `firstNameRef` must both be assigned. The merge pattern shown is the standard approach.

### Task 4: New `ProspectPopupScreen.tsx` — orchestrator (AC1, AC2, AC4–AC12)

- [x] **4.1** Create `apps/extension/src/components/ProspectPopupScreen.tsx`:
  ```typescript
  import { Settings } from 'lucide-react'
  import { useCallback, useEffect, useState } from 'react'
  import { useTranslation } from 'react-i18next'
  import type { ExtensionProspectData } from '@battlecrm/shared'
  import { useCreateProspect, useUpdateProspect } from '../features/prospects/hooks/useProspects'
  import { HttpError } from '../lib/api'
  import type { LinkedInScrapedData } from '../lib/linkedin'
  import ProspectCard from './ProspectCard'
  import ProspectForm, { type ProspectFormFields } from './ProspectForm'
  import { Button } from './ui/button'
  import { Separator } from './ui/separator'

  // chrome.storage.session keys:
  // - `linkedinUrl`      → CachedCheckResult (set by service worker in Story 7.5, read via GET_PANEL_DATA)
  // - `'form:' + linkedinUrl` → FormSessionState (set by popup, read directly)

  type CachedCheckResult =
    | { found: true; prospect: ExtensionProspectData }
    | { found: false; scrapedData: LinkedInScrapedData }

  type FormSessionState = {
    mode: 'add' | 'edit'
    fields: ProspectFormFields
    hasUnsavedChanges: true
    prospectId?: string
  }

  type PopupMode = 'loading' | 'add' | 'read' | 'edit' | 'success-add'

  function splitName(name: string): { firstName: string; lastName: string } {
    const trimmed = name.trim()
    const lastSpace = trimmed.lastIndexOf(' ')
    if (lastSpace === -1) return { firstName: trimmed, lastName: '' }
    return {
      firstName: trimmed.slice(0, lastSpace),
      lastName: trimmed.slice(lastSpace + 1),
    }
  }

  const FORM_SESSION_KEY_PREFIX = 'form:'

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

    const formKey = `${FORM_SESSION_KEY_PREFIX}${linkedinUrl}`

    const [mode, setMode] = useState<PopupMode>('loading')
    const [prospect, setProspect] = useState<ExtensionProspectData | null>(null)
    const [formDefaults, setFormDefaults] = useState<ProspectFormFields>({
      firstName: '',
      lastName: '',
      title: '',
      company: '',
      email: '',
      phone: '',
    })
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [serverError, setServerError] = useState<string | undefined>(undefined)
    const [editSuccessMessage, setEditSuccessMessage] = useState<string | undefined>(undefined)

    // Load panel data on mount
    useEffect(() => {
      async function loadPanelData() {
        // 1. Check for saved form state first
        const sessionResult = await browser.storage.session.get(formKey)
        const saved = sessionResult[formKey] as FormSessionState | undefined

        if (saved?.hasUnsavedChanges) {
          setFormDefaults(saved.fields)
          setHasUnsavedChanges(true)
          if (saved.mode === 'edit' && saved.prospectId) {
            // We need the full prospect for EDIT mode — fetch from GET_PANEL_DATA
            const panelData = await browser.runtime.sendMessage({ type: 'GET_PANEL_DATA', linkedinUrl })
            if (panelData?.found === true) {
              setProspect(panelData.prospect)
            }
            setMode('edit')
          } else {
            setMode('add')
          }
          return
        }

        // 2. No saved form state — get panel data from service worker
        const panelData: CachedCheckResult | null = await browser.runtime.sendMessage({
          type: 'GET_PANEL_DATA',
          linkedinUrl,
        })

        if (!panelData) {
          // No cached data — default to ADD mode with empty fields
          setMode('add')
          return
        }

        if (panelData.found) {
          setProspect(panelData.prospect)
          setMode('read')
        } else {
          // Pre-fill from scraped LinkedIn data
          const { firstName, lastName } = splitName(panelData.scrapedData.name)
          setFormDefaults({
            firstName,
            lastName,
            title: panelData.scrapedData.headline,
            company: panelData.scrapedData.company,
            email: '',
            phone: '',
          })
          setMode('add')
        }
      }

      loadPanelData()
    }, [linkedinUrl, formKey])

    // Persist form changes to chrome.storage.session
    const handleFieldChange = useCallback(
      (fields: ProspectFormFields) => {
        const state: FormSessionState = {
          mode: mode === 'edit' ? 'edit' : 'add',
          fields,
          hasUnsavedChanges: true,
          prospectId: prospect?.id,
        }
        browser.storage.session.set({ [formKey]: state })
      },
      [formKey, mode, prospect?.id],
    )

    // ADD submission
    async function handleAddSubmit(fields: ProspectFormFields) {
      setServerError(undefined)
      try {
        const payload = {
          name: `${fields.firstName} ${fields.lastName}`.trim(),
          linkedin_url: linkedinUrl,
          ...(fields.company ? { company: fields.company } : {}),
          ...(fields.email ? { email: fields.email } : {}),
          ...(fields.phone ? { phone: fields.phone } : {}),
          ...(fields.title ? { title: fields.title } : {}),
        }

        const created = await createProspect.mutateAsync(payload)

        // Clear form session state
        await browser.storage.session.remove(formKey)

        // Update badge to green ✓
        await browser.action.setBadgeText({ text: '✓' })
        await browser.action.setBadgeBackgroundColor({ color: '#16a34a' })
        await browser.action.setTitle({ title: 'Prospect déjà dans BattleCRM' })

        // Update CachedCheckResult in session so GET_PANEL_DATA returns the new prospect
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

    // EDIT submission
    async function handleEditSubmit(fields: ProspectFormFields) {
      if (!prospect) return
      setServerError(undefined)
      try {
        const updated = await updateProspect.mutateAsync({
          id: prospect.id,
          name: `${fields.firstName} ${fields.lastName}`.trim(),
          ...(fields.company !== undefined ? { company: fields.company || null } : {}),
          ...(fields.email !== undefined ? { email: fields.email || null } : {}),
          ...(fields.phone !== undefined ? { phone: fields.phone || null } : {}),
          ...(fields.title !== undefined ? { title: fields.title || null } : {}),
        })

        await browser.storage.session.remove(formKey)
        setProspect(updated)
        setEditSuccessMessage(t('prospect.form.successEdit'))
        setMode('read')
      } catch (err) {
        if (err instanceof HttpError && err.status === 422) {
          setServerError(t('prospect.form.errors.validation'))
        } else {
          setServerError(t('prospect.form.errors.server'))
        }
      }
    }

    // Enter EDIT mode from READ
    function handleEnterEdit() {
      if (!prospect) return
      const { firstName, lastName } = splitName(prospect.name)
      setFormDefaults({
        firstName,
        lastName,
        title: prospect.title ?? '',
        company: prospect.company ?? '',
        email: prospect.email ?? '',
        phone: prospect.phone ?? '',
      })
      setServerError(undefined)
      setMode('edit')
    }

    // Cancel EDIT → back to READ
    async function handleCancelEdit() {
      await browser.storage.session.remove(formKey)
      setHasUnsavedChanges(false)
      setServerError(undefined)
      setMode('read')
    }

    // Reset ADD form ("Recommencer")
    async function handleReset() {
      await browser.storage.session.remove(formKey)
      setHasUnsavedChanges(false)
      // Re-load panel data to get fresh scraped defaults
      const panelData: CachedCheckResult | null = await browser.runtime.sendMessage({
        type: 'GET_PANEL_DATA',
        linkedinUrl,
      })
      if (panelData && !panelData.found) {
        const { firstName, lastName } = splitName(panelData.scrapedData.name)
        setFormDefaults({
          firstName,
          lastName,
          title: panelData.scrapedData.headline,
          company: panelData.scrapedData.company,
          email: '',
          phone: '',
        })
      }
      setMode('add')
    }

    const isAddPending = createProspect.isPending
    const isEditPending = updateProspect.isPending

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

        {(mode === 'add') && (
          <ProspectForm
            defaultValues={formDefaults}
            hasUnsavedChanges={hasUnsavedChanges}
            isPending={isAddPending}
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
            isPending={isEditPending}
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
  ```

  > **`handleFieldChange` dependency on `mode`:** The `useCallback` dep on `mode` means the callback reference changes when mode transitions. The `ProspectForm` receives a new `onFieldChange` after each mode transition, but since `ProspectForm` is re-mounted on mode change (different `key` prop from parent is NOT needed here — mode changes cause the component to be replaced via the conditional render), this is correct.
  >
  > **ADD payload — empty strings vs omit:** The backend validator uses `nullable().optional()` for company/email/phone/title. An empty string `""` passes as valid and is stored as `""` (not null). To store null, we should omit the field or send `null`. The code above omits fields with empty string values, which lets the backend treat them as `undefined → optional → not set → null`. This matches the AC: "optional fields only sent if non-empty".
  >
  > **EDIT payload:** Unlike ADD, EDIT uses `null` explicitly (e.g. `company: '' → null`) to clear existing values. The user clearing a field signals intent to remove it.
  >
  > **`updateProspect.mutateAsync` shape:** The existing hook's `mutationFn` signature is `{ id, ...payload }`. The spread includes `name`, `company`, `email`, `phone`, `title`. This matches `UpdateProspectPayload = Partial<Omit<ExtensionProspectData, 'id'|'linkedinUrl'|...>>`.
  >
  > **No `key` prop trick needed:** Each popup mode renders a completely different component branch (ProspectForm with mode="add", ProspectCard, ProspectForm with mode="edit"), so React re-mounts correctly.

### Task 5: Update `App.tsx` — add `prospect` screen (AC1)

- [x] **5.1** In `apps/extension/src/entrypoints/popup/App.tsx`, add the `prospect` screen type and LinkedIn URL detection:
  ```typescript
  import { useEffect, useState } from 'react'
  import { useTranslation } from 'react-i18next'
  import '../../assets/tailwind.css'
  import AuthForm from '../../components/AuthForm'
  import NeutralScreen from '../../components/NeutralScreen'
  import ProspectPopupScreen from '../../components/ProspectPopupScreen'
  import SettingsScreen from '../../components/SettingsScreen'
  import { isProfilePage, normalizeLinkedInUrl } from '../../lib/linkedin'
  import { clearAuth, getStorage } from '../../lib/storage'

  type Screen = 'loading' | 'login' | 'neutral' | 'settings' | 'prospect'

  export default function App() {
    const { t } = useTranslation()
    const [screen, setScreen] = useState<Screen>('loading')
    const [email, setEmail] = useState('')
    const [baseUrl, setBaseUrl] = useState('')
    const [linkedinUrl, setLinkedinUrl] = useState('')
    const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | undefined>(undefined)

    useEffect(() => {
      getStorage().then(({ token, email: storedEmail, baseUrl: storedBaseUrl }) => {
        if (token && storedEmail && storedBaseUrl) {
          setEmail(storedEmail)
          setBaseUrl(storedBaseUrl)
          // Check if we're on a LinkedIn profile
          browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const tabUrl = tabs[0]?.url
            if (tabUrl && isProfilePage(tabUrl)) {
              setLinkedinUrl(normalizeLinkedInUrl(tabUrl))
              setScreen('prospect')
            } else {
              setScreen('neutral')
            }
          })
        } else {
          setScreen('login')
        }
      })
    }, [])

    useEffect(() => {
      function handleMessage(message: { type: string }) {
        if (message.type === 'AUTH_EXPIRED') {
          setSessionExpiredMessage(t('session.expired'))
          setScreen('login')
        }
      }
      browser.runtime.onMessage.addListener(handleMessage)
      return () => {
        browser.runtime.onMessage.removeListener(handleMessage)
      }
    }, [t])

    function handleAuthSuccess(loggedInEmail: string) {
      setEmail(loggedInEmail)
      setSessionExpiredMessage(undefined)
      setScreen('neutral')
    }

    async function handleLogout() {
      try {
        await browser.runtime.sendMessage({ type: 'LOGOUT' })
      } catch {
        await clearAuth()
      }
      setEmail('')
      setBaseUrl('')
      setLinkedinUrl('')
      setScreen('login')
    }

    if (screen === 'loading') {
      return <div className="w-72 py-8" />
    }

    if (screen === 'login') {
      return (
        <div className="min-h-48 w-72">
          <AuthForm initialError={sessionExpiredMessage} onSuccess={handleAuthSuccess} />
        </div>
      )
    }

    if (screen === 'settings') {
      return (
        <div className="min-h-48 w-72">
          <SettingsScreen email={email} onBack={() => setScreen('neutral')} onLogout={handleLogout} />
        </div>
      )
    }

    if (screen === 'prospect' && linkedinUrl) {
      return (
        <div className="w-72">
          <ProspectPopupScreen
            baseUrl={baseUrl}
            linkedinUrl={linkedinUrl}
            onSettingsClick={() => setScreen('settings')}
          />
        </div>
      )
    }

    return (
      <div className="min-h-48 w-72">
        <NeutralScreen
          baseUrl={baseUrl}
          email={email}
          onSettingsClick={() => setScreen('settings')}
        />
      </div>
    )
  }
  ```

  > **`isProfilePage` import from `lib/linkedin.ts`:** These are pure functions — no DOM dependency — safe to import in the popup context (not just content scripts).
  >
  > **Tab URL access:** `browser.tabs.query()` in the popup has URL access because the popup is opened in response to a direct user gesture (clicking the extension icon), which grants `activeTab` access to the URL. The `tabs` permission added in Story 7.5 (Task 4.2) also covers this.
  >
  > **`handleAuthSuccess` → shows neutral, not prospect:** After login, the `RECHECK_CURRENT_TAB` message is sent by `useAuth.ts` (Story 7.5), which triggers badge update. The popup goes to neutral — the user can re-click the icon to get the prospect popup if on a LinkedIn profile. This is correct behaviour.
  >
  > **`prospect` screen uses `w-72` without `min-h-48`:** The prospect popup has variable height depending on content (READ mode is shorter than ADD mode with 6 fields). No min-height needed — the popup sizes to content.

### Task 6: Update locale files (fr.json, en.json)

- [x] **6.1** Add to `apps/extension/src/locales/fr.json` under the root object:
  ```json
  "prospect": {
    "form": {
      "firstName": "Prénom",
      "lastName": "Nom",
      "title": "Titre / Poste",
      "company": "Entreprise",
      "companyPlaceholder": "Vérifiez sur LinkedIn",
      "email": "Email",
      "phone": "Téléphone",
      "linkedinUrl": "URL LinkedIn",
      "submitAdd": "Ajouter le prospect",
      "submitEdit": "Mettre à jour",
      "submitting": "Enregistrement…",
      "cancel": "Annuler",
      "unsavedBanner": "⚠️ Modifications non sauvegardées — reprendre ?",
      "editBanner": "⚠️ Modification en cours",
      "reset": "Recommencer",
      "successAdd": "Prospect ajouté ✓",
      "successEdit": "✓ Prospect mis à jour",
      "errors": {
        "alreadyExists": "Ce prospect existe déjà dans BattleCRM",
        "noFunnelStage": "Aucune étape de funnel active — créez-en une d'abord",
        "validation": "Erreur de validation, vérifiez vos données",
        "server": "Erreur serveur, veuillez réessayer"
      }
    },
    "read": {
      "foundBanner": "✓ Déjà dans BattleCRM",
      "stage": "Étape",
      "email": "Email",
      "phone": "Tél",
      "viewInApp": "Voir dans BattleCRM ↗",
      "edit": "Modifier"
    }
  }
  ```

- [x] **6.2** Add equivalent keys to `apps/extension/src/locales/en.json`:
  ```json
  "prospect": {
    "form": {
      "firstName": "First name",
      "lastName": "Last name",
      "title": "Title / Role",
      "company": "Company",
      "companyPlaceholder": "Check on LinkedIn",
      "email": "Email",
      "phone": "Phone",
      "linkedinUrl": "LinkedIn URL",
      "submitAdd": "Add prospect",
      "submitEdit": "Update",
      "submitting": "Saving…",
      "cancel": "Cancel",
      "unsavedBanner": "⚠️ Unsaved changes — resume?",
      "editBanner": "⚠️ Editing",
      "reset": "Start over",
      "successAdd": "Prospect added ✓",
      "successEdit": "✓ Prospect updated",
      "errors": {
        "alreadyExists": "This prospect already exists in BattleCRM",
        "noFunnelStage": "No active funnel stage — create one first",
        "validation": "Validation error, check your data",
        "server": "Server error, please try again"
      }
    },
    "read": {
      "foundBanner": "✓ Already in BattleCRM",
      "stage": "Stage",
      "email": "Email",
      "phone": "Phone",
      "viewInApp": "View in BattleCRM ↗",
      "edit": "Edit"
    }
  }
  ```

### Task 7: Verification (AC1–AC12)

- [x] **7.1** `pnpm --filter @battlecrm/extension type-check` → 0 TypeScript errors
- [x] **7.2** `pnpm biome check --write .` → 0 Biome errors
- [x] **7.3** `pnpm build:extension` → success, no build errors
- [ ] **7.4** Manual test in Chrome (unpacked extension):

  **ADD flow:**
  - Navigate to a LinkedIn profile not in CRM → red `+` badge
  - Click extension icon → popup opens with ADD form, fields pre-filled from LinkedIn scrape
  - Close popup (click outside) → reopen → form restored with amber "Modifications non sauvegardées" banner
  - Click "Recommencer" → form resets to scraped defaults, no banner
  - Fill Prénom + Nom, click "Ajouter le prospect" → loading state → success view with "Prospect ajouté ✓"
  - Badge turns green ✓
  - Reopen popup → shows READ mode (prospect found)

  **READ flow:**
  - Navigate to LinkedIn profile already in CRM → green `✓` badge
  - Click extension icon → READ mode: green banner, name/title/company/stage/email/phone
  - Click "Voir dans BattleCRM ↗" → new tab opens to prospect detail page

  **EDIT flow:**
  - In READ mode, click "Modifier" → EDIT form opens with amber banner, CRM data pre-filled
  - Modify a field → close → reopen → form restored (amber "Modifications non sauvegardées" banner)
  - Click "Mettre à jour" → loading → success → back to READ mode with "✓ Prospect mis à jour"
  - Click "Annuler" → back to READ mode

  **Error cases:**
  - Try to add prospect with empty Prénom → inline validation error shown
  - ADD when no funnel stage configured → amber server error banner "Aucune étape de funnel active"

  **Navigation:**
  - On LinkedIn profile page → navigate to LinkedIn home → badge clears → popup shows neutral screen
  - Reopen popup on profile again → fresh ADD/READ state (no stale form state)

---

## Dev Notes

### chrome.storage.session Key Convention

Two distinct keys are used to avoid collision:

| Key | Written by | Content | Purpose |
|-----|-----------|---------|---------|
| `linkedinUrl` (e.g. `"https://www.linkedin.com/in/johndoe"`) | Service worker (Story 7.5) | `CachedCheckResult` | Panel data — read via `GET_PANEL_DATA` message |
| `"form:" + linkedinUrl` | Popup (this story) | `FormSessionState` | Form persistence across popup close/reopen |

The popup FIRST checks `"form:" + linkedinUrl`. If no form state → asks the service worker via `GET_PANEL_DATA` which reads the `linkedinUrl` key. The two keys never collide.

### Name Splitting Logic

`ExtensionProspectData.name` is a single string (e.g. `"Jean Dupont"`). The form shows Prénom + Nom as separate fields. Split rule:
- `firstName = everything before the last space`
- `lastName = last word`
- If no space: `firstName = name`, `lastName = ''`

On submit, recombined as `` `${firstName} ${lastName}`.trim() ``. Single-name prospects (no last name) are valid per the backend validator (`name: minLength(1)`).

### ADD Payload — Empty Optional Fields

The backend `extensionCreateProspectValidator` uses `.nullable().optional()` for company/email/phone/title. Sending an empty string `""` is valid and stored as `""`. To send null (store as NULL in DB), omit the field or send `null`. The implementation omits empty fields, which lets the backend treat them as not provided → null in the DB.

### EDIT Payload — Null vs Omit

In EDIT mode, empty string = user intent to clear the field. The payload uses `|| null` to convert empty strings to null, which the `extensionUpdateProspectValidator` accepts via `.nullable().optional()`.

Example: user clears company → `company: '' → payload: { company: null }` → DB: NULL.

### handleFieldChange useCallback dep on mode

`handleFieldChange` captures `mode` and `prospect?.id` to correctly build the `FormSessionState`. When mode transitions (e.g. 'loading' → 'add'), `handleFieldChange` is recreated. `ProspectForm` receives the new reference, but since it's a new component instance (conditional render by mode), this is correct — no stale closure issues.

### ADD success → badge update from popup context

The popup (a trusted extension context) can call `browser.action.setBadgeText()` directly — no need to route through the service worker. This avoids adding a new message type. The popup also updates the `chrome.storage.session[linkedinUrl]` CachedCheckResult so that if the service worker reads it later (e.g., via `GET_PANEL_DATA`), it returns the correct found state.

### ProspectForm — react-hook-form `watch()` subscription

`watch()` returns a subscription that fires on every field change. The cleanup (`subscription.unsubscribe()`) runs on component unmount. This is the standard RHF pattern for observing all fields. The subscription fires synchronously after each input change — `chrome.storage.session.set()` is async but fire-and-forget (no await needed in the callback; failures are silent which is acceptable for form state persistence).

### File Locations (This Story)

| File | Action |
|------|--------|
| `apps/extension/src/entrypoints/background.ts` | Modify `handleClearBadge` — add `form:${previousUrl}` to remove |
| `apps/extension/src/components/ProspectCard.tsx` | **NEW** — READ mode component |
| `apps/extension/src/components/ProspectForm.tsx` | **NEW** — ADD/EDIT form component |
| `apps/extension/src/components/ProspectPopupScreen.tsx` | **NEW** — orchestrator for LinkedIn profile popup |
| `apps/extension/src/entrypoints/popup/App.tsx` | Modify — add `prospect` screen + LinkedIn URL detection |
| `apps/extension/src/locales/fr.json` | Modify — add `prospect` i18n keys |
| `apps/extension/src/locales/en.json` | Modify — add `prospect` i18n keys |

No backend changes needed — all 3 endpoints are already implemented and tested.

### Previous Story Learnings (Stories 7.4 & 7.5)

- **`browser.*` globals:** Available in all extension contexts (popup, service worker, lib files) — no manual import needed.
- **MV3 async message handlers:** `return true` in `onMessage.addListener` is CRITICAL for async handlers. In the popup, `browser.runtime.sendMessage()` is a standard async call — no `return true` needed on the caller side.
- **Biome import order:** `@battlecrm/shared` comes before relative imports. `lucide-react` comes before `@battlecrm/shared` (external packages before workspace packages). Run `pnpm biome check --write .` after any import changes.
- **`pnpm build:extension` from root:** Always verify this passes — it's the AC gate.
- **No shadcn/ui component installs needed:** The extension already has `Button`, `Input`, `Label`, `Separator` in `apps/extension/src/components/ui/`. Use these directly.
- **`tabs` permission:** Already added in Story 7.5 — `browser.tabs.query()` in the popup works without additional permission changes.
- **`useCreateProspect`/`useUpdateProspect`:** Already implemented with QueryClient invalidation — no additional hook work needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md → Story 7.6]
- [Source: _bmad-output/planning-artifacts/architecture.md → Gotcha: chrome.storage.session et form state]
- [Source: _bmad-output/planning-artifacts/architecture.md → Flux de Données]
- [Source: _bmad-output/planning-artifacts/architecture.md → Routes API Extension]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md → Browser Extension UX (Epic 8)]
- [Source: _bmad-output/implementation-artifacts/7-5-linkedin-profile-detection-and-badge-update.md]
- [Source: apps/extension/src/entrypoints/background.ts] — CachedCheckResult, handleClearBadge, GET_PANEL_DATA
- [Source: apps/extension/src/features/prospects/lib/api.ts] — prospectsApi.create(), update(), CreateProspectPayload, UpdateProspectPayload
- [Source: apps/extension/src/features/prospects/hooks/useProspects.ts] — useCreateProspect(), useUpdateProspect()
- [Source: apps/extension/src/lib/linkedin.ts] — isProfilePage(), normalizeLinkedInUrl(), LinkedInScrapedData
- [Source: apps/backend/app/controllers/extension_prospects_controller.ts] — 409 conflict, 422 no stage
- [Source: apps/backend/app/validators/extension_prospects.ts] — extensionCreateProspectValidator, extensionUpdateProspectValidator

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: `handleClearBadge` already updated with array-form `remove([previousUrl, form:${previousUrl}])` — AC3 satisfied
- Task 2: `ProspectCard.tsx` created — READ mode with green banner, prospect info, funnel stage, CTAs (AC8)
- Task 3: `ProspectForm.tsx` created — ADD/EDIT form with react-hook-form, focus on mount, field persistence via watch(), amber banners (AC4, AC5, AC6, AC9, AC10, AC12)
- Task 4: `ProspectPopupScreen.tsx` created — orchestrator managing all modes (loading/add/read/edit/success-add), session form persistence, ADD/EDIT submissions with error handling (AC1, AC2, AC7, AC11)
- Task 5: `App.tsx` updated — added `prospect` screen type, LinkedIn URL detection via `isProfilePage`/`normalizeLinkedInUrl`, `ProspectPopupScreen` render path (AC1)
- Task 6: locale keys added to both fr.json and en.json — all prospect form + read keys
- Task 7: type-check ✓, Biome ✓ (auto-fixed import order in 3 components), build ✓ (553ms, 393KB)

### File List

- `apps/extension/src/entrypoints/background.ts` (modified — AC3)
- `apps/extension/src/components/ProspectCard.tsx` (new — AC8)
- `apps/extension/src/components/ProspectForm.tsx` (new — AC4, AC5, AC6, AC9, AC10, AC12)
- `apps/extension/src/components/ProspectPopupScreen.tsx` (new — AC1, AC2, AC7, AC11)
- `apps/extension/src/entrypoints/popup/App.tsx` (modified — AC1)
- `apps/extension/src/locales/fr.json` (modified — i18n keys)
- `apps/extension/src/locales/en.json` (modified — i18n keys)
