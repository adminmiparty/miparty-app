'use client'

// Dashboard home — profile, children, events summary, invited events, favorites
// Route: /dashboard

import AppNav from '@/components/AppNav'
import DraftEventListRow from '@/components/DraftEventListRow'
import GoogleGIcon from '@/components/GoogleGIcon'
import { ChildrenSection, type DashboardChildRow } from '@/components/ChildrenSection'
import { brand } from '@/lib/brand'
import { formatEventDayMonthShort } from '@/lib/dates'
import {
  buildGoogleMapsSearchUrl,
  buildPlaceAddressLine,
  filterDashboardLocations,
  loadDismissedLocationNames,
  loadSavedPlaces,
  mergeEventAndSavedLocations,
  normalizeLocationNameKey,
  persistDismissedLocationNames,
  persistSavedPlaces,
  tryDeleteSavedPlaceRemote,
  type DashboardLocationCard,
  type SavedPlace,
} from '@/lib/savedPlaces'
import { CalendarDays, Eye, EyeOff, Map as MapIcon, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { EVENT_STATUS_DRAFT, isActiveEventStatus } from '@/lib/eventLifecycle'
import {
  normalizePersonRelation,
  PERSON_RELATION_OPTIONS,
  type PersonRelation,
} from '@/lib/personRelation'

const themeCardBorder: Record<string, string> = {
  yellow: 'border-l-yellow-400',
  pink: 'border-l-pink-400',
  blue: 'border-l-blue-400',
  green: 'border-l-green-400',
  purple: 'border-l-purple-400',
}

const themeRingMap: Record<string, string> = {
  yellow: 'hover:ring-yellow-200',
  pink: 'hover:ring-pink-200',
  blue: 'hover:ring-blue-200',
  green: 'hover:ring-green-200',
  purple: 'hover:ring-purple-200',
}

const themeEventThumbBg: Record<string, string> = {
  yellow: 'bg-yellow-100 border-yellow-200/80',
  pink: 'bg-pink-100 border-pink-200/80',
  blue: 'bg-blue-100 border-blue-200/80',
  green: 'bg-green-100 border-green-200/80',
  purple: 'bg-purple-100 border-purple-200/80',
}

type EventListItem = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  invitation_theme: string | null
  invitation_image_url: string | null
  /** Present when loaded from API; filtered client-side for active-only lists. */
  status?: string | null
}

type DraftEventRow = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string | null
}

type RsvpCounts = {
  confirmed: number
  declined: number
  maybe: number
}

type InvitedListItem = {
  eventId: string
  public_slug: string
  title: string
  event_date: string
  start_time: string | null
  location_name: string | null
  attendance_status: string | null
  invitation_theme: string | null
  invitation_image_url: string | null
}

type ParentProfile = {
  email: string
  fullName: string | null
  avatarUrl: string | null
  phone: string | null
}

type FamilyMemberPartner = {
  id: string
  full_name: string
  last_name: string | null
  phone: string | null
  birth_date: string | null
}

const partnerAvatarColors = [
  brand.avatarBrand,
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
]

const partnerInputClassName = `input-base focus:ring-2 ${brand.inputFocus}`

function getPartnerInitials(name: string, lastName: string | null) {
  const first = name.trim()[0]?.toUpperCase() || ''
  const last = (lastName ?? '').trim()[0]?.toUpperCase() || ''
  return first + last || '?'
}

function sanitizeDialPrefix(raw: string): string {
  const digitsPlus = raw.replace(/[^\d+]/g, '')
  if (digitsPlus.length === 0) return ''
  let body = digitsPlus.startsWith('+') ? digitsPlus.slice(1) : digitsPlus
  body = body.replace(/\+/g, '')
  return ('+' + body).slice(0, 5)
}

function splitDialPhone(full: string): {
  countryCode: '+34' | '+57' | 'otro'
  customCode: string
  number: string
} {
  const trimmed = full.trim()
  if (!trimmed) return { countryCode: '+34', customCode: '', number: '' }
  if (trimmed.startsWith('+57')) {
    return { countryCode: '+57', customCode: '', number: trimmed.slice(3) }
  }
  if (trimmed.startsWith('+34')) {
    return { countryCode: '+34', customCode: '', number: trimmed.slice(3) }
  }
  const match = trimmed.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1] && match[2] !== undefined) {
    return { countryCode: 'otro', customCode: match[1], number: match[2].replace(/\s/g, '') }
  }
  return { countryCode: 'otro', customCode: '', number: trimmed.replace(/^\+/, '') }
}

function resolveDialCode(countryCode: string, customCode: string): string {
  return countryCode === 'otro' ? sanitizeDialPrefix(customCode) : countryCode
}

function dialCodeShortLabel(code: string): string {
  if (code === '+57') return '🇨🇴 +57'
  if (code === 'otro') return '✏️ Otro'
  return '🇪🇸 +34'
}

function buildFullPhone(countryCode: string, customDialCode: string, phoneNumber: string): string {
  const dial = resolveDialCode(countryCode, customDialCode)
  const trimmedPhone = phoneNumber.replace(/\s/g, '')
  return trimmedPhone ? `${dial}${trimmedPhone}` : ''
}

function partnerDisplayLabel(partner: FamilyMemberPartner) {
  const first = partner.full_name.trim()
  const last = (partner.last_name ?? '').trim()
  if (!last) return first
  return `${first} ${last}`.trim()
}

function todayLocalIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function userFirstDisplayName(user: User): string {
  const rawMeta = user.user_metadata?.full_name
  const fullName = typeof rawMeta === 'string' ? rawMeta.trim() : ''
  if (fullName) {
    const first = fullName.split(/\s+/).filter(Boolean)[0]
    if (first) return first
  }
  const email = user.email?.trim() ?? ''
  if (email) {
    const local = email.split('@')[0] ?? ''
    const first = local.split(/[._+\s-]/).filter(Boolean)[0]
    if (first) return first
  }
  return ''
}

function isValidUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function pickAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null
  return trimmed
}

function parentAvatarFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    pickAvatarUrl(meta?.picture) ??
    pickAvatarUrl(meta?.avatar_url) ??
    pickAvatarUrl(meta?.photoURL)
  if (fromMeta) return fromMeta

  for (const identity of user.identities ?? []) {
    const data = identity.identity_data as Record<string, unknown> | undefined
    const fromIdentity =
      pickAvatarUrl(data?.picture) ??
      pickAvatarUrl(data?.avatar_url) ??
      pickAvatarUrl(data?.photoURL)
    if (fromIdentity) return fromIdentity
  }

  return null
}

function parentFullNameFromUser(user: User): string | null {
  const raw = user.user_metadata?.full_name
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function initialsFromDisplay(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
    }
    if (parts[0]) {
      return parts[0]!.slice(0, 2).toUpperCase()
    }
  }
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatBirthDateDisplaySpain(day: string, month: string, year: string): string {
  const dayNum = parseInt(day, 10)
  const monthNum = parseInt(month, 10)
  if (!dayNum || !monthNum || !year.trim()) return ''
  const monthName = SPANISH_MONTHS[monthNum - 1]
  if (!monthName) return ''
  return `${dayNum} de ${monthName.toLowerCase()} de ${year}`
}

function computeAgeYearsFromIso(birthIso: string, today: Date): number {
  const [y, mo, d] = birthIso.split('-').map((value) => Number.parseInt(value, 10))
  const birth = new Date(y, mo - 1, d)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

function calculateAge(birthIso: string | null): number | null {
  if (!birthIso?.trim()) return null
  const match = birthIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const y = Number.parseInt(match[1], 10)
  const mo = Number.parseInt(match[2], 10)
  const d = Number.parseInt(match[3], 10)
  const birth = new Date(y, mo - 1, d)
  const today = new Date()
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let age = todayDate.getFullYear() - birth.getFullYear()
  const monthDiff = todayDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

function formatPartnerBirthSummary(iso: string | null): string | null {
  if (!iso?.trim()) return null
  const parts = isoToBirthParts(iso)
  const display = formatBirthDateDisplaySpain(parts.day, parts.month, parts.year)
  if (!display) return null
  return `${computeAgeYearsFromIso(iso, new Date())} años · ${display}`
}

const profileInputClassName = `input-base focus:ring-2 ${brand.inputFocus}`

const profileBirthDateSelectClassName = `select-base px-2 focus:ring-2 ${brand.inputFocus}`

const childFieldReadOnlyClassName =
  'input-disabled cursor-default border-gray-200 bg-gray-100 text-gray-500'

type ModalActionButtonsProps = {
  saveLabel: string
  cancelLabel?: string
  onCancel: () => void
  hasChanges: boolean
  saving?: boolean
  saveType?: 'button' | 'submit'
  onSave?: () => void
}

function ModalActionButtons({
  saveLabel,
  cancelLabel = 'Cancelar',
  onCancel,
  hasChanges,
  saving = false,
  saveType = 'button',
  onSave,
}: ModalActionButtonsProps) {
  const saveDisabled = !hasChanges || saving

  return (
    <div className="mt-4 flex gap-3">
      <button
        type={saveType}
        onClick={saveType === 'button' ? onSave : undefined}
        disabled={saveDisabled}
        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
          hasChanges && !saving
            ? brand.buttonPrimary
            : `${brand.buttonPrimary} cursor-not-allowed opacity-40`
        }`}
      >
        {saving ? 'Guardando…' : saveLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        {cancelLabel}
      </button>
    </div>
  )
}

type ChildFormDisabledField = 'nombre' | 'apellido' | 'shortName' | 'birth_date' | 'relation'

type ChildFormFieldsProps = {
  idPrefix?: string
  nombre: string
  setNombre: (value: string) => void
  apellido: string
  setApellido: (value: string) => void
  shortName: string
  setShortName: (value: string) => void
  birthDay: string
  setBirthDay: (value: string) => void
  birthMonth: string
  setBirthMonth: (value: string) => void
  birthYear: string
  setBirthYear: (value: string) => void
  relation: PersonRelation
  setRelation: (value: PersonRelation) => void
  phone: string
  setPhone: (value: string) => void
  allergies: string
  setAllergies: (value: string) => void
  birthYears: string[]
  disabledFields?: ChildFormDisabledField[]
  nombreRequired?: boolean
  apellidoRequired?: boolean
}

function isChildFieldDisabled(
  disabledFields: ChildFormDisabledField[] | undefined,
  field: ChildFormDisabledField
) {
  return disabledFields?.includes(field) ?? false
}

function mapDashboardChildRow(row: {
  id: string
  name: string
  last_name: string | null
  birth_date: string | null
  avatar_url: string | null
  short_name: string | null
  allergies: string | null
  relation?: string | null
  phone?: string | null
}): DashboardChildRow {
  return {
    id: row.id,
    name: row.name,
    last_name: row.last_name,
    birth_date: row.birth_date,
    avatar_url: row.avatar_url,
    short_name: row.short_name,
    allergies: row.allergies ?? null,
    relation: normalizePersonRelation(row.relation),
    phone: row.phone ?? null,
  }
}

function ChildFormFields({
  idPrefix = 'child',
  nombre,
  setNombre,
  apellido,
  setApellido,
  shortName,
  setShortName,
  birthDay,
  setBirthDay,
  birthMonth,
  setBirthMonth,
  birthYear,
  setBirthYear,
  relation,
  setRelation,
  phone,
  setPhone,
  allergies,
  setAllergies,
  birthYears,
  disabledFields,
  nombreRequired = false,
  apellidoRequired = false,
}: ChildFormFieldsProps) {
  const nombreDisabled = isChildFieldDisabled(disabledFields, 'nombre')
  const apellidoDisabled = isChildFieldDisabled(disabledFields, 'apellido')
  const birthDisabled = isChildFieldDisabled(disabledFields, 'birth_date')
  const relationDisabled = isChildFieldDisabled(disabledFields, 'relation')

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}Nombre`} className="text-sm font-medium text-gray-700">
            Nombre
          </label>
          {nombreDisabled ? (
            <div className={childFieldReadOnlyClassName}>{nombre}</div>
          ) : (
            <input
              id={`${idPrefix}Nombre`}
              type="text"
              autoComplete="given-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required={nombreRequired}
              className={profileInputClassName}
              placeholder="Ej. Sofía"
            />
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}Apellido`} className="text-sm font-medium text-gray-700">
            Apellido(s)
          </label>
          {apellidoDisabled ? (
            <div className={childFieldReadOnlyClassName}>{apellido || '—'}</div>
          ) : (
            <input
              id={`${idPrefix}Apellido`}
              type="text"
              autoComplete="family-name"
              value={apellido}
              onChange={(event) => setApellido(event.target.value)}
              required={apellidoRequired}
              className={profileInputClassName}
              placeholder="Ej. García"
            />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${idPrefix}ShortName`} className="text-sm font-medium text-gray-700">
            Nombre corto o apodo
          </label>
          <span className="text-xs text-gray-400">Opcional</span>
        </div>
        <input
          id={`${idPrefix}ShortName`}
          type="text"
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
          className={profileInputClassName}
          placeholder="Ej. Sofi"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}Relation`} className="text-sm font-medium text-gray-700">
          Relación
        </label>
        {relationDisabled ? (
          <div className={childFieldReadOnlyClassName}>
            {PERSON_RELATION_OPTIONS.find((o) => o.value === relation)?.label ?? '—'}
          </div>
        ) : (
          <select
            id={`${idPrefix}Relation`}
            value={relation}
            onChange={(event) => setRelation(event.target.value as PersonRelation)}
            required
            className={profileBirthDateSelectClassName}
          >
            {PERSON_RELATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${idPrefix}Phone`} className="text-sm font-medium text-gray-700">
            Móvil de contacto
          </label>
          <span className="text-xs text-gray-400">Opcional</span>
        </div>
        <input
          id={`${idPrefix}Phone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={profileInputClassName}
          placeholder="Ej. 612 345 678"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="mb-1.5 text-sm font-medium text-gray-900">Fecha de nacimiento</p>
          <span className="text-xs text-gray-400">Opcional</span>
        </div>
        {birthDisabled ? (
          <div className={childFieldReadOnlyClassName}>
            {formatBirthDateDisplaySpain(birthDay, birthMonth, birthYear) || '—'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <select
              value={birthDay}
              onChange={(event) => setBirthDay(event.target.value)}
              className={profileBirthDateSelectClassName}
              aria-label="Día"
            >
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <select
              value={birthMonth}
              onChange={(event) => setBirthMonth(event.target.value)}
              className={profileBirthDateSelectClassName}
              aria-label="Mes"
            >
              <option value="">Mes</option>
              {SPANISH_MONTHS.map((monthName, index) => {
                const monthValue = String(index + 1).padStart(2, '0')
                return (
                  <option key={monthValue} value={monthValue}>
                    {monthName}
                  </option>
                )
              })}
            </select>
            <select
              value={birthYear}
              onChange={(event) => setBirthYear(event.target.value)}
              className={profileBirthDateSelectClassName}
              aria-label="Año"
            >
              <option value="">Año</option>
              {birthYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${idPrefix}Allergies`} className="text-sm font-medium text-gray-700">
            Alergias e intolerancias
          </label>
          <span className="text-xs text-gray-400">Opcional</span>
        </div>
        <input
          id={`${idPrefix}Allergies`}
          type="text"
          value={allergies}
          onChange={(event) => setAllergies(event.target.value)}
          className={profileInputClassName}
          placeholder="Ej. Gluten, lactosa"
        />
      </div>
    </>
  )
}

function isGoogleUser(user: User): boolean {
  return (
    user.app_metadata?.provider === 'google' ||
    (user.identities?.some((identity) => identity.provider === 'google') ?? false)
  )
}

function splitFullName(full: string | null | undefined) {
  const trimmed = full?.trim() ?? ''
  if (!trimmed) {
    return { first: '', last: '' }
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

function composeBirthDateIso(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) {
    return null
  }
  const dayNumber = Number.parseInt(day, 10)
  const monthNumber = Number.parseInt(month, 10)
  const yearNumber = Number.parseInt(year, 10)
  if (
    Number.isNaN(dayNumber) ||
    Number.isNaN(monthNumber) ||
    Number.isNaN(yearNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null
  }
  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber)
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() + 1 !== monthNumber ||
    parsed.getDate() !== dayNumber
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function isoToBirthParts(iso: string | null) {
  if (!iso) {
    return { day: '', month: '', year: '' }
  }
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return { day: '', month: '', year: '' }
  }
  return { day: match[3], month: match[2], year: match[1] }
}

function formatTimeShort(time: string | null) {
  if (!time || String(time).trim() === '') {
    return null
  }
  return String(time).slice(0, 5)
}

function eventStatusLabel(eventDate: string, todayStr: string): 'Próximo' | 'Hoy' | 'Pasado' {
  if (eventDate > todayStr) return 'Próximo'
  if (eventDate === todayStr) return 'Hoy'
  return 'Pasado'
}

function statusDotClass(status: 'Próximo' | 'Hoy' | 'Pasado') {
  if (status === 'Hoy') return 'bg-amber-400'
  if (status === 'Pasado') return 'bg-gray-400'
  return 'bg-green-500'
}

function invitedAttendanceLabel(status: string | null) {
  if (status === 'confirmed') return <span>✅ Confirmado</span>
  if (status === 'declined') return <span>❌ No puede</span>
  return <span>🤔 Pendiente</span>
}

function EventRow({
  event,
  rsvpCounts,
  todayStr,
  isInvited = false,
  attendanceStatus = null,
}: {
  event: EventListItem
  rsvpCounts: RsvpCounts
  todayStr: string
  isInvited?: boolean
  attendanceStatus?: string | null
}) {
  const status = eventStatusLabel(event.event_date, todayStr)
  const themeKey = event.invitation_theme ?? 'yellow'
  const leftBorderClass = themeCardBorder[themeKey] ?? themeCardBorder.yellow
  const hoverRingClass = themeRingMap[themeKey] ?? themeRingMap.yellow
  const timeLabel = formatTimeShort(event.start_time)
  const dateShort = formatEventDayMonthShort(event.event_date)
  const loc = event.location_name?.trim()
  const to = isInvited ? `/e/${event.public_slug}` : `/dashboard/eventos/${event.public_slug}`
  const img = event.invitation_image_url?.trim()
  const thumbBgClass = themeEventThumbBg[themeKey] ?? themeEventThumbBg.yellow
  const isPastEvent = event.event_date < todayStr
  const attendeeLabel =
    rsvpCounts.confirmed === 1
      ? isPastEvent
        ? '1 asistió'
        : '1 confirmado'
      : isPastEvent
        ? `${rsvpCounts.confirmed} asistieron`
        : `${rsvpCounts.confirmed} confirmados`

  const metaCounts = isInvited ? (
    invitedAttendanceLabel(attendanceStatus)
  ) : (
    <>
      <span>👥 {attendeeLabel}</span>
      {rsvpCounts.declined > 0 ? <span>❌ {rsvpCounts.declined} no pueden</span> : null}
      {rsvpCounts.maybe > 0 ? <span>🤔 {rsvpCounts.maybe} aún no saben</span> : null}
    </>
  )

  return (
    <li className="w-full">
      <Link
        href={to}
        className={`flex w-full flex-col gap-2.5 rounded-xl border border-gray-100 border-l-4 ${leftBorderClass} bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md hover:ring-2 sm:flex-row sm:items-center sm:gap-3 sm:p-3 ${hoverRingClass}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          {img ? (
            <img
              src={img}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-cover sm:h-10 sm:w-10"
            />
          ) : (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base leading-none sm:h-10 sm:w-10 sm:text-lg ${thumbBgClass}`}
              aria-hidden
            >
              🎉
            </div>
          )}
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:min-w-0 sm:gap-2">
            {isInvited ? (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                Invitado/a
              </span>
            ) : (
              <>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`}
                  aria-hidden
                />
                <span className="shrink-0 text-xs font-medium text-gray-600">{status}</span>
                <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  Organizador
                </span>
              </>
            )}
            <p className="min-w-0 text-sm font-semibold leading-snug text-gray-900 sm:flex-1 sm:truncate">
              {event.title}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-500 sm:hidden">
            📅 {dateShort}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </p>
          {loc ? (
            <p className="mt-0.5 text-xs text-gray-500 sm:hidden" title={loc}>
              📍 {loc}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 sm:hidden">
            {metaCounts}
          </div>
          <div className="mt-1 hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 sm:flex">
            <span>
              📅 {dateShort}
              {timeLabel ? ` · ${timeLabel}` : ''}
            </span>
            {loc ? (
              <span className="max-w-full min-w-0 truncate" title={loc}>
                📍 {loc}
              </span>
            ) : null}
            {metaCounts}
          </div>
          </div>
        </div>
        <span className="hidden shrink-0 self-center text-base font-medium text-gray-400 sm:block" aria-hidden>
          →
        </span>
      </Link>
    </li>
  )
}

type InvitedEventRecord = {
  id: string
  title: string
  event_date: string
  start_time: string | null
  location_name: string | null
  public_slug: string
  user_id: string
  invitation_theme: string | null
  invitation_image_url: string | null
}

function normalizeInvitedNestedEvent(
  raw: InvitedEventRecord | InvitedEventRecord[] | null | undefined
): InvitedEventRecord | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function invitedItemToEventListItem(item: InvitedListItem): EventListItem {
  return {
    id: item.eventId,
    public_slug: item.public_slug,
    title: item.title,
    child_name: '',
    event_date: item.event_date,
    start_time: item.start_time,
    location_name: item.location_name,
    location_address: null,
    google_maps_url: null,
    invitation_theme: item.invitation_theme,
    invitation_image_url: item.invitation_image_url ?? null,
  }
}

export default function DashboardHomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [draftEvents, setDraftEvents] = useState<DraftEventRow[]>([])
  const [showCreateEventDraftModal, setShowCreateEventDraftModal] = useState(false)
  const [createEventNextHref, setCreateEventNextHref] = useState('/dashboard/eventos/nuevo')
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<DraftEventRow | null>(null)
  const [draftDeleteBusy, setDraftDeleteBusy] = useState(false)
  const [draftDeletedToast, setDraftDeletedToast] = useState(false)
  const [rsvpCountsByEventId, setRsvpCountsByEventId] = useState<Record<string, RsvpCounts>>({})
  const [children, setChildren] = useState<DashboardChildRow[]>([])
  const [invitedItems, setInvitedItems] = useState<InvitedListItem[]>([])
  const [userFirstName, setUserFirstName] = useState('')
  const [userId, setUserId] = useState('')
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProximos, setShowProximos] = useState(true)
  const [showPasados, setShowPasados] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [partner, setPartner] = useState<FamilyMemberPartner | null>(null)
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [partnerFirstName, setPartnerFirstName] = useState('')
  const [partnerLastName, setPartnerLastName] = useState('')
  const [partnerCountryCode, setPartnerCountryCode] = useState<string>('+34')
  const [partnerCustomDialCode, setPartnerCustomDialCode] = useState('')
  const [partnerPhoneNumber, setPartnerPhoneNumber] = useState('')
  const [partnerDialOpen, setPartnerDialOpen] = useState(false)
  const [partnerSaving, setPartnerSaving] = useState(false)
  const [partnerModalError, setPartnerModalError] = useState<string | null>(null)
  const [partnerSaveSuccess, setPartnerSaveSuccess] = useState(false)
  const [originalPartnerPhone, setOriginalPartnerPhone] = useState('')
  const [partnerBirthDay, setPartnerBirthDay] = useState('')
  const [partnerBirthMonth, setPartnerBirthMonth] = useState('')
  const [partnerBirthYear, setPartnerBirthYear] = useState('')
  const [originalPartnerBirth, setOriginalPartnerBirth] = useState<string | null>(null)
  const partnerDialRef = useRef<HTMLDivElement>(null)
  const [showAddChildModal, setShowAddChildModal] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childShortName, setChildShortName] = useState('')
  const [childBirthDay, setChildBirthDay] = useState('')
  const [childBirthMonth, setChildBirthMonth] = useState('')
  const [childBirthYear, setChildBirthYear] = useState('')
  const [childAllergies, setChildAllergies] = useState('')
  const [childRelation, setChildRelation] = useState<PersonRelation>('hijo')
  const [childPhone, setChildPhone] = useState('')
  const [childSaving, setChildSaving] = useState(false)
  const [childModalError, setChildModalError] = useState<string | null>(null)
  const [childAddSuccessToast, setChildAddSuccessToast] = useState(false)
  const [viewingChild, setViewingChild] = useState<DashboardChildRow | null>(null)
  const [childActionTarget, setChildActionTarget] = useState<DashboardChildRow | null>(null)
  const [locationActionTarget, setLocationActionTarget] = useState<DashboardLocationCard | null>(null)
  const [pendingDeleteLocation, setPendingDeleteLocation] = useState<{
    savedPlaceId: string | null
    locationName: string
  } | null>(null)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [dismissedLocationNames, setDismissedLocationNames] = useState<string[]>([])
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false)
  const [placeName, setPlaceName] = useState('')
  const [placeStreet, setPlaceStreet] = useState('')
  const [placeNumber, setPlaceNumber] = useState('')
  const [placePostal, setPlacePostal] = useState('')
  const [placeCity, setPlaceCity] = useState('')
  const [placeModalError, setPlaceModalError] = useState<string | null>(null)
  const [placeSaving, setPlaceSaving] = useState(false)
  const [placeAddSuccessToast, setPlaceAddSuccessToast] = useState(false)
  const [placeDeleteSuccessToast, setPlaceDeleteSuccessToast] = useState(false)
  const [viewChildFirstName, setViewChildFirstName] = useState('')
  const [viewChildLastName, setViewChildLastName] = useState('')
  const [viewChildShortName, setViewChildShortName] = useState('')
  const [viewChildBirthDay, setViewChildBirthDay] = useState('')
  const [viewChildBirthMonth, setViewChildBirthMonth] = useState('')
  const [viewChildBirthYear, setViewChildBirthYear] = useState('')
  const [viewChildAllergies, setViewChildAllergies] = useState('')
  const [viewChildRelation, setViewChildRelation] = useState<PersonRelation>('hijo')
  const [viewChildPhone, setViewChildPhone] = useState('')
  const [viewChildSaving, setViewChildSaving] = useState(false)
  const [viewChildError, setViewChildError] = useState<string | null>(null)
  const [childUpdateSuccessToast, setChildUpdateSuccessToast] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [userDbProfile, setUserDbProfile] = useState<{
    first_name: string | null
    last_name: string | null
    phone: string | null
    birth_date: string | null
  } | null>(null)
  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profileBirthDay, setProfileBirthDay] = useState('')
  const [profileBirthMonth, setProfileBirthMonth] = useState('')
  const [profileBirthYear, setProfileBirthYear] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileEmailInitial, setProfileEmailInitial] = useState('')
  const [profileCountryCode, setProfileCountryCode] = useState<string>('+34')
  const [profileCustomCode, setProfileCustomCode] = useState('')
  const [profilePhoneNumber, setProfilePhoneNumber] = useState('')
  const [profileInitialPhone, setProfileInitialPhone] = useState('')
  const [profileIsGoogle, setProfileIsGoogle] = useState(false)
  const [profileDialOpen, setProfileDialOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccessToast, setProfileSuccessToast] = useState(false)
  const [profilePhoneNotice, setProfilePhoneNotice] = useState(false)
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [profileNewPassword, setProfileNewPassword] = useState('')
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const profileDialRef = useRef<HTMLDivElement>(null)

  const todayStr = useMemo(() => todayLocalIso(), [])

  const loadPartner = useCallback(
    async (uid: string) => {
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select('id, full_name, last_name, phone, birth_date')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })

      const first = (familyMembers?.[0] as FamilyMemberPartner | undefined) ?? null
      setPartner(first)
      return first
    },
    [supabase]
  )

  const loadChildren = useCallback(
    async (uid: string) => {
      const { data, error: childrenError } = await supabase
        .from('children')
        .select('id, name, last_name, birth_date, avatar_url, short_name, allergies, relation, phone')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })

      if (!childrenError && data) {
        setChildren(data.map(mapDashboardChildRow))
      }
    },
    [supabase]
  )

  const childBirthYears = useMemo(
    () => Array.from({ length: 101 }, (_, index) => String(new Date().getFullYear() - index)),
    []
  )

  const viewChildDisabledFields = useMemo((): ChildFormDisabledField[] => {
    if (!viewingChild) return []
    const locked: ChildFormDisabledField[] = []
    if (viewingChild.name?.trim()) locked.push('nombre')
    if (viewingChild.last_name?.trim()) locked.push('apellido')
    if (viewingChild.birth_date?.trim()) locked.push('birth_date')
    return locked
  }, [viewingChild])

  const profileCurrentPhone = useMemo(
    () => buildFullPhone(profileCountryCode, profileCustomCode, profilePhoneNumber),
    [profileCountryCode, profileCustomCode, profilePhoneNumber]
  )

  const profileHasChanges = useMemo(() => {
    const birthIso = composeBirthDateIso(profileBirthDay, profileBirthMonth, profileBirthYear)
    const originalBirth = userDbProfile?.birth_date ?? null
    return (
      profileFirstName !== (userDbProfile?.first_name || '') ||
      profileLastName !== (userDbProfile?.last_name || '') ||
      profileCurrentPhone !== profileInitialPhone ||
      (birthIso ?? null) !== (originalBirth ?? null)
    )
  }, [
    profileFirstName,
    profileLastName,
    profileCurrentPhone,
    profileInitialPhone,
    profileBirthDay,
    profileBirthMonth,
    profileBirthYear,
    userDbProfile,
  ])

  const partnerCurrentPhone = useMemo(
    () => buildFullPhone(partnerCountryCode, partnerCustomDialCode, partnerPhoneNumber),
    [partnerCountryCode, partnerCustomDialCode, partnerPhoneNumber]
  )

  const partnerBirthIso = useMemo(
    () => composeBirthDateIso(partnerBirthDay, partnerBirthMonth, partnerBirthYear),
    [partnerBirthDay, partnerBirthMonth, partnerBirthYear]
  )

  const partnerHasChanges = useMemo(() => {
    if (!partner) {
      return partnerFirstName.trim() !== ''
    }
    return (
      partnerFirstName !== (partner.full_name?.split(' ')[0] || '') ||
      partnerLastName !== (partner.last_name || '') ||
      partnerCurrentPhone !== originalPartnerPhone ||
      (partnerBirthIso ?? null) !== (originalPartnerBirth ?? null)
    )
  }, [
    partner,
    partnerFirstName,
    partnerLastName,
    partnerCurrentPhone,
    originalPartnerPhone,
    partnerBirthIso,
    originalPartnerBirth,
  ])

  const childAddHasChanges =
    childFirstName.trim() !== '' ||
    childLastName.trim() !== '' ||
    childPhone.trim() !== '' ||
    childShortName.trim() !== '' ||
    childAllergies.trim() !== ''

  const childHasChanges = useMemo(() => {
    if (!viewingChild) return false
    return (
      viewChildShortName !== (viewingChild.short_name || '') ||
      viewChildAllergies !== (viewingChild.allergies || '') ||
      viewChildRelation !== normalizePersonRelation(viewingChild.relation) ||
      viewChildPhone.trim() !== (viewingChild.phone || '').trim()
    )
  }, [viewingChild, viewChildShortName, viewChildAllergies, viewChildRelation, viewChildPhone])

  const { upcomingCount, pastCount } = useMemo(() => {
    const upIds = new Set<string>()
    const pastIds = new Set<string>()
    for (const e of events) {
      if (e.event_date >= todayStr) upIds.add(e.id)
      else pastIds.add(e.id)
    }
    for (const i of invitedItems) {
      if (i.event_date >= todayStr) upIds.add(i.eventId)
      else pastIds.add(i.eventId)
    }
    return { upcomingCount: upIds.size, pastCount: pastIds.size }
  }, [events, invitedItems, todayStr])

  const dashboardUpcomingEvents = useMemo((): EventListItem[] => {
    const byId = new Map<string, EventListItem>()
    for (const e of events) {
      if (e.event_date >= todayStr) byId.set(e.id, e)
    }
    for (const item of invitedItems) {
      if (item.event_date >= todayStr && !byId.has(item.eventId)) {
        byId.set(item.eventId, invitedItemToEventListItem(item))
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.event_date.localeCompare(b.event_date))
  }, [events, invitedItems, todayStr])

  const lastPastEvent = useMemo((): EventListItem | null => {
    const byId = new Map<string, EventListItem>()
    for (const e of events) {
      if (e.event_date < todayStr) byId.set(e.id, e)
    }
    for (const item of invitedItems) {
      if (item.event_date < todayStr && !byId.has(item.eventId)) {
        byId.set(item.eventId, invitedItemToEventListItem(item))
      }
    }
    const sorted = Array.from(byId.values()).sort((a, b) => b.event_date.localeCompare(a.event_date))
    return sorted[0] ?? null
  }, [events, invitedItems, todayStr])

  const hasAnyEvents = events.length > 0 || invitedItems.length > 0

  const requestCreateEvent = useCallback(
    (href: string) => {
      if (draftEvents.length >= 1) {
        setCreateEventNextHref(href)
        setShowCreateEventDraftModal(true)
      } else {
        router.push(href)
      }
    },
    [draftEvents.length, router]
  )

  const confirmDeleteDraft = useCallback(async () => {
    if (!draftDeleteTarget || !userId) return
    const id = draftDeleteTarget.id
    setDraftDeleteBusy(true)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', EVENT_STATUS_DRAFT)
    setDraftDeleteBusy(false)
    setDraftDeleteTarget(null)
    if (!error) {
      setDraftEvents((prev) => prev.filter((d) => d.id !== id))
      setDraftDeletedToast(true)
      window.setTimeout(() => setDraftDeletedToast(false), 2500)
    }
  }, [draftDeleteTarget, userId, supabase])

  const organizedEventIds = useMemo(() => new Set(events.map((e) => e.id)), [events])

  const invitedAttendanceByEventId = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const item of invitedItems) {
      map[item.eventId] = item.attendance_status
    }
    return map
  }, [invitedItems])

  const dashboardLocations = useMemo(() => {
    const merged = mergeEventAndSavedLocations(events, savedPlaces)
    return filterDashboardLocations(merged, dismissedLocationNames)
  }, [events, savedPlaces, dismissedLocationNames])

  const placeFormCanSave = useMemo(
    () =>
      Boolean(placeName.trim() && placeStreet.trim() && placeCity.trim()),
    [placeName, placeStreet, placeCity]
  )

  useEffect(() => {
    if (!userId) {
      setSavedPlaces([])
      setDismissedLocationNames([])
      return
    }
    setSavedPlaces(loadSavedPlaces(userId))
    setDismissedLocationNames(loadDismissedLocationNames(userId))
  }, [userId])

  const openAddPlaceModal = () => {
    setPlaceName('')
    setPlaceStreet('')
    setPlaceNumber('')
    setPlacePostal('')
    setPlaceCity('')
    setPlaceModalError(null)
    setShowAddPlaceModal(true)
  }

  const handlePlaceSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }

    const trimmedName = placeName.trim()
    const trimmedStreet = placeStreet.trim()
    const trimmedCity = placeCity.trim()

    if (!trimmedName || !trimmedStreet || !trimmedCity) {
      setPlaceModalError('Completa los campos obligatorios.')
      return
    }

    const nameTaken = dashboardLocations.some(
      (loc) => loc.location_name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (nameTaken) {
      setPlaceModalError('Ya tienes un lugar con este nombre.')
      return
    }

    setPlaceSaving(true)
    setPlaceModalError(null)

    const newPlace: SavedPlace = {
      id: crypto.randomUUID(),
      location_name: trimmedName,
      street: trimmedStreet,
      number: placeNumber.trim(),
      postal: placePostal.trim(),
      city: trimmedCity,
      location_address: buildPlaceAddressLine(
        trimmedStreet,
        placeNumber,
        placePostal,
        trimmedCity
      ),
      google_maps_url: buildGoogleMapsSearchUrl(
        trimmedStreet,
        placeNumber,
        placePostal,
        trimmedCity
      ),
    }

    const next = [...savedPlaces, newPlace]
    persistSavedPlaces(userId, next)
    setSavedPlaces(next)
    setPlaceSaving(false)
    setShowAddPlaceModal(false)
    setPlaceAddSuccessToast(true)
    window.setTimeout(() => setPlaceAddSuccessToast(false), 2500)
  }

  const handleConfirmDeleteLocation = async () => {
    if (!pendingDeleteLocation || !userId) {
      return
    }
    const { savedPlaceId, locationName } = pendingDeleteLocation
    setPendingDeleteLocation(null)

    if (savedPlaceId) {
      const supabase = createClient()
      await tryDeleteSavedPlaceRemote(supabase, userId, savedPlaceId)
      setSavedPlaces((prev) => {
        const next = prev.filter((p) => p.id !== savedPlaceId)
        persistSavedPlaces(userId, next)
        return next
      })
    }

    const key = normalizeLocationNameKey(locationName)
    setDismissedLocationNames((prev) => {
      const has = prev.some((name) => normalizeLocationNameKey(name) === key)
      const next = has ? prev : [...prev, locationName.trim()]
      persistDismissedLocationNames(userId, next)
      return next
    })

    setPlaceDeleteSuccessToast(true)
    window.setTimeout(() => setPlaceDeleteSuccessToast(false), 2500)
  }

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (isMounted) {
          setError(userError?.message ?? 'No se pudo obtener tu sesión.')
          setEvents([])
          setChildren([])
          setInvitedItems([])
          setRsvpCountsByEventId({})
          setUserFirstName('')
          setUserId('')
          setParentProfile(null)
          setPartner(null)
          setLoading(false)
        }
        return
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('first_name, last_name, phone, birth_date')
        .eq('id', user.id)
        .maybeSingle()

      const phone =
        typeof userProfile?.phone === 'string' && userProfile.phone.trim()
          ? userProfile.phone.trim()
          : null

      const dbDisplayName = userProfile
        ? `${userProfile.first_name ?? ''} ${userProfile.last_name ?? ''}`.trim()
        : ''

      if (isMounted) {
        setUserId(user.id)
        setAuthUser(user)
        setUserDbProfile(
          userProfile
            ? {
                first_name: userProfile.first_name ?? null,
                last_name: userProfile.last_name ?? null,
                phone: userProfile.phone ?? null,
                birth_date: userProfile.birth_date ?? null,
              }
            : null
        )
        setUserFirstName(userFirstDisplayName(user))
        setParentProfile({
          email: user.email ?? '',
          fullName: dbDisplayName || parentFullNameFromUser(user),
          avatarUrl: parentAvatarFromUser(user),
          phone,
        })
      }

      const [eventsRes, childrenRes, familyRes] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, public_slug, title, child_name, event_date, start_time, location_name, location_address, google_maps_url, invitation_theme, invitation_image_url, status'
          )
          .eq('user_id', user.id),
        supabase
          .from('children')
          .select('id, name, last_name, birth_date, avatar_url, short_name, allergies, relation, phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('family_members')
          .select('id, full_name, last_name, phone, birth_date')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      if (!isMounted) return

      const familyMembers = familyRes.data as FamilyMemberPartner[] | null
      setPartner(familyMembers?.[0] ?? null)

      const loadedChildren = (childrenRes.data ?? []).map(mapDashboardChildRow)
      if (childrenRes.error) {
        setChildren([])
      } else {
        setChildren(loadedChildren)
      }

      if (eventsRes.error) {
        setError(eventsRes.error.message)
        setEvents([])
        setDraftEvents([])
        setRsvpCountsByEventId({})
        setInvitedItems([])
        setLoading(false)
        return
      }

      const rawList = (eventsRes.data ?? []) as EventListItem[]
      const activeList = rawList.filter((e) => isActiveEventStatus(e.status))
      const draftList: DraftEventRow[] = rawList
        .filter((e) => (e.status ?? '') === EVENT_STATUS_DRAFT)
        .map((e) => ({
          id: e.id,
          public_slug: e.public_slug,
          title: e.title,
          child_name: e.child_name,
          event_date: e.event_date,
          start_time: e.start_time,
        }))
        .sort((a, b) => b.event_date.localeCompare(a.event_date))

      const list = [...activeList].sort((a, b) => b.event_date.localeCompare(a.event_date))
      setEvents(list)
      setDraftEvents(draftList)

      const organizedIds = new Set(list.map((e) => e.id))

      let invited: InvitedListItem[] = []
      const { data: userRsvps } = await supabase
        .from('rsvps')
        .select('id, attendance_status, event_id')
        .eq('user_id', user.id)

      console.log('User rsvps:', userRsvps)

      if (!isMounted) return

      const rsvpEventIds = (userRsvps || [])
        .map((r) => r.event_id)
        .filter(Boolean)

      let invitedEventsData: Array<
        EventListItem & {
          isInvited: boolean
          attendanceStatus: string | null
          confirmedCount: number
          declinedCount: number
          maybeCount: number
        }
      > = []

      if (rsvpEventIds.length > 0) {
        const { data: rsvpEvents } = await supabase
          .from('events')
          .select(
            'id, title, event_date, start_time, location_name, public_slug, invitation_theme, invitation_image_url, user_id'
          )
          .in('id', rsvpEventIds)
          .neq('user_id', user.id)
          .eq('status', 'active')

        console.log('Rsvp events:', rsvpEvents)

        invitedEventsData = (rsvpEvents || []).map((e) => ({
          id: e.id,
          public_slug: e.public_slug,
          title: e.title,
          child_name: '',
          event_date: e.event_date,
          start_time: e.start_time,
          location_name: e.location_name,
          location_address: null,
          google_maps_url: null,
          invitation_theme: e.invitation_theme,
          invitation_image_url: e.invitation_image_url ?? null,
          isInvited: true,
          attendanceStatus:
            userRsvps?.find((r) => r.event_id === e.id)?.attendance_status ?? null,
          confirmedCount: 0,
          declinedCount: 0,
          maybeCount: 0,
        }))
      }

      console.log('Invited events after filter:', invitedEventsData)

      const seen = new Set<string>()
      for (const e of invitedEventsData) {
        if (organizedIds.has(e.id) || seen.has(e.id)) continue
        seen.add(e.id)
        invited.push({
          eventId: e.id,
          public_slug: e.public_slug,
          title: e.title,
          event_date: e.event_date,
          start_time: e.start_time,
          location_name: e.location_name,
          attendance_status: e.attendanceStatus,
          invitation_theme: e.invitation_theme,
          invitation_image_url: e.invitation_image_url,
        })
      }
      invited.sort((a, b) => b.event_date.localeCompare(a.event_date))

      const emptyRsvpCounts = (): RsvpCounts => ({ confirmed: 0, declined: 0, maybe: 0 })
      const byEvent: Record<string, RsvpCounts> = {}

      const organizedEventIds = list.map((e) => e.id)
      for (const id of organizedEventIds) {
        byEvent[id] = emptyRsvpCounts()
      }

      if (organizedEventIds.length > 0) {
        const { data: rsvpRows, error: rsvpError } = await supabase
          .from('rsvps')
          .select('event_id, attendance_status')
          .in('event_id', organizedEventIds)

        if (!isMounted) return

        if (!rsvpError && rsvpRows) {
          for (const row of rsvpRows as { event_id: string; attendance_status: string | null }[]) {
            const id = row.event_id
            const bucket = byEvent[id]
            if (!bucket) continue
            const s = row.attendance_status
            if (s === 'confirmed') bucket.confirmed += 1
            else if (s === 'declined') bucket.declined += 1
            else if (s === 'maybe') bucket.maybe += 1
          }
        }
      }

      if (isMounted) {
        setRsvpCountsByEventId(byEvent)
        setInvitedItems(invited)
        setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!partnerDialOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (partnerDialRef.current?.contains(event.target as Node)) return
      setPartnerDialOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [partnerDialOpen])

  useEffect(() => {
    if (!profileDialOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (profileDialRef.current?.contains(event.target as Node)) return
      setProfileDialOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [profileDialOpen])

  useEffect(() => {
    if (!profileSuccessToast) return
    const t = window.setTimeout(() => {
      setProfileSuccessToast(false)
      setProfilePhoneNotice(false)
    }, 3000)
    return () => window.clearTimeout(t)
  }, [profileSuccessToast])

  useEffect(() => {
    if (!showAddPartnerModal) return
    setPartnerModalError(null)
    if (partner) {
      setPartnerFirstName(partner.full_name)
      setPartnerLastName(partner.last_name ?? '')
      const phoneParts = splitDialPhone(partner.phone ?? '')
      setPartnerCountryCode(phoneParts.countryCode)
      setPartnerCustomDialCode(phoneParts.customCode)
      setPartnerPhoneNumber(phoneParts.number)
      setOriginalPartnerPhone(partner.phone ?? '')
      const birth = isoToBirthParts(partner.birth_date)
      setPartnerBirthDay(birth.day)
      setPartnerBirthMonth(birth.month)
      setPartnerBirthYear(birth.year)
      setOriginalPartnerBirth(partner.birth_date ?? null)
    } else {
      setPartnerFirstName('')
      setPartnerLastName('')
      setPartnerCountryCode('+34')
      setPartnerCustomDialCode('')
      setPartnerPhoneNumber('')
      setOriginalPartnerPhone('')
      setPartnerBirthDay('')
      setPartnerBirthMonth('')
      setPartnerBirthYear('')
      setOriginalPartnerBirth(null)
    }
  }, [showAddPartnerModal, partner])

  const handlePartnerSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPartnerModalError(null)
    setPartnerSaving(true)

    const trimmedName = partnerFirstName.trim()
    const trimmedLastName = partnerLastName.trim()
    if (!trimmedName) {
      setPartnerModalError('El nombre es obligatorio.')
      setPartnerSaving(false)
      return
    }

    if (!userId) {
      setPartnerModalError('No se pudo obtener tu sesión.')
      setPartnerSaving(false)
      return
    }

    const dial = resolveDialCode(partnerCountryCode, partnerCustomDialCode)
    if (partnerCountryCode === 'otro' && dial.length <= 1 && partnerPhoneNumber.trim()) {
      setPartnerModalError('Indica un prefijo internacional válido.')
      setPartnerSaving(false)
      return
    }

    const fullPhone = buildFullPhone(partnerCountryCode, partnerCustomDialCode, partnerPhoneNumber)
    const birthDate = composeBirthDateIso(partnerBirthDay, partnerBirthMonth, partnerBirthYear)

    if (partner) {
      const { error: updateError } = await supabase
        .from('family_members')
        .update({
          full_name: trimmedName,
          last_name: trimmedLastName || null,
          phone: fullPhone || null,
          birth_date: birthDate || null,
        })
        .eq('id', partner.id)

      if (updateError) {
        setPartnerModalError(updateError.message)
        setPartnerSaving(false)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('family_members').insert({
        user_id: userId,
        full_name: trimmedName,
        last_name: trimmedLastName || null,
        phone: fullPhone || null,
        birth_date: birthDate || null,
      })

      if (insertError) {
        setPartnerModalError(insertError.message)
        setPartnerSaving(false)
        return
      }
    }

    await loadPartner(userId)
    setShowAddPartnerModal(false)
    setPartnerSaving(false)
    setPartnerSaveSuccess(true)
    window.setTimeout(() => setPartnerSaveSuccess(false), 2000)
  }

  useEffect(() => {
    if (!showAddChildModal) return
    setChildModalError(null)
    setChildFirstName('')
    setChildLastName('')
    setChildShortName('')
    setChildBirthDay('')
    setChildBirthMonth('')
    setChildBirthYear('')
    setChildAllergies('')
    setChildRelation('hijo')
    setChildPhone('')
  }, [showAddChildModal])

  const handleChildSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChildModalError(null)
    setChildSaving(true)

    const trimmedName = childFirstName.trim()
    const trimmedLastName = childLastName.trim()
    const trimmedShortName = childShortName.trim()
    const trimmedAllergies = childAllergies.trim()

    if (!trimmedName) {
      setChildModalError('El nombre es obligatorio.')
      setChildSaving(false)
      return
    }

    if (!trimmedLastName) {
      setChildModalError('El apellido es obligatorio.')
      setChildSaving(false)
      return
    }

    if (!userId) {
      setChildModalError('No se pudo obtener tu sesión.')
      setChildSaving(false)
      return
    }

    const childBirthDate =
      childBirthDay && childBirthMonth && childBirthYear
        ? `${childBirthYear}-${childBirthMonth.padStart(2, '0')}-${childBirthDay.padStart(2, '0')}`
        : null

    const trimmedPhone = childPhone.trim()

    const { error: insertError } = await supabase.from('children').insert({
      user_id: userId,
      name: trimmedName,
      last_name: trimmedLastName,
      short_name: trimmedShortName || null,
      birth_date: childBirthDate || null,
      allergies: trimmedAllergies || null,
      relation: childRelation,
      phone: trimmedPhone || null,
    })

    if (insertError) {
      setChildModalError(insertError.message)
      setChildSaving(false)
      return
    }

    await loadChildren(userId)
    setShowAddChildModal(false)
    setChildSaving(false)
    setChildAddSuccessToast(true)
    window.setTimeout(() => setChildAddSuccessToast(false), 2000)
  }

  useEffect(() => {
    if (!viewingChild) return
    setViewChildError(null)
    setViewChildFirstName(viewingChild.name ?? '')
    setViewChildLastName(viewingChild.last_name ?? '')
    setViewChildShortName(viewingChild.short_name ?? '')
    const birth = isoToBirthParts(viewingChild.birth_date)
    setViewChildBirthDay(birth.day)
    setViewChildBirthMonth(birth.month)
    setViewChildBirthYear(birth.year)
    setViewChildAllergies(viewingChild.allergies ?? '')
    setViewChildRelation(normalizePersonRelation(viewingChild.relation))
    setViewChildPhone(viewingChild.phone ?? '')
  }, [viewingChild])

  const handleViewChildSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!viewingChild) return

    setViewChildError(null)
    setViewChildSaving(true)

    const trimmedName = viewChildFirstName.trim()
    const trimmedLastName = viewChildLastName.trim()
    const trimmedShortName = viewChildShortName.trim()
    const trimmedAllergies = viewChildAllergies.trim()
    const trimmedPhone = viewChildPhone.trim()

    if (!userId) {
      setViewChildError('No se pudo obtener tu sesión.')
      setViewChildSaving(false)
      return
    }

    const childBirthDate =
      viewChildBirthDay && viewChildBirthMonth && viewChildBirthYear
        ? `${viewChildBirthYear}-${viewChildBirthMonth.padStart(2, '0')}-${viewChildBirthDay.padStart(2, '0')}`
        : null

    const updates: {
      allergies: string | null
      relation: PersonRelation
      phone: string | null
      name?: string
      last_name?: string | null
      short_name?: string | null
      birth_date?: string | null
    } = {
      allergies: trimmedAllergies || null,
      relation: viewChildRelation,
      phone: trimmedPhone || null,
    }
    if (!viewingChild.name) updates.name = trimmedName
    if (!viewingChild.last_name) updates.last_name = trimmedLastName || null
    if (!viewingChild.short_name) updates.short_name = trimmedShortName || null
    if (!viewingChild.birth_date) updates.birth_date = childBirthDate || null

    const { error: updateError } = await supabase
      .from('children')
      .update(updates)
      .eq('id', viewingChild.id)

    if (updateError) {
      setViewChildError(updateError.message)
      setViewChildSaving(false)
      return
    }

    await loadChildren(userId)
    setViewingChild(null)
    setViewChildSaving(false)
    setChildUpdateSuccessToast(true)
    window.setTimeout(() => setChildUpdateSuccessToast(false), 2000)
  }

  const profileBirthYears = Array.from({ length: 101 }, (_, index) =>
    String(new Date().getFullYear() - index)
  )

  const openProfileModal = () => {
    let first = userDbProfile?.first_name?.trim() ?? ''
    let last = userDbProfile?.last_name?.trim() ?? ''
    if (!first && !last) {
      const full =
        parentProfile?.fullName?.trim() ||
        (authUser ? parentFullNameFromUser(authUser) : null)
      const split = splitFullName(full)
      first = split.first
      last = split.last
    }
    setProfileFirstName(first)
    setProfileLastName(last)
    const birth = isoToBirthParts(userDbProfile?.birth_date ?? null)
    setProfileBirthDay(birth.day)
    setProfileBirthMonth(birth.month)
    setProfileBirthYear(birth.year)
    const email = parentProfile?.email ?? ''
    setProfileEmail(email)
    setProfileEmailInitial(email)
    const phone = userDbProfile?.phone ?? parentProfile?.phone ?? ''
    setProfileInitialPhone(phone)
    const dial = splitDialPhone(phone)
    setProfileCountryCode(dial.countryCode)
    setProfileCustomCode(dial.customCode)
    setProfilePhoneNumber(dial.number)
    setProfileIsGoogle(authUser ? isGoogleUser(authUser) : false)
    setShowPasswordSection(false)
    setProfileNewPassword('')
    setProfileConfirmPassword('')
    setPasswordError(null)
    setPasswordSuccess(false)
    setProfileError(null)
    setProfilePhoneNotice(false)
    setShowProfileModal(true)
  }

  const handleProfileBirthDateChange = (day: string, month: string, year: string) => {
    setProfileBirthDay(day)
    setProfileBirthMonth(month)
    setProfileBirthYear(year)
  }

  const handleProfileSave = async () => {
    if (!userId) return
    setProfileError(null)
    setProfileSaving(true)

    const trimmedFirst = profileFirstName.trim()
    const trimmedLast = profileLastName.trim()
    if (!trimmedFirst) {
      setProfileError('El nombre es obligatorio.')
      setProfileSaving(false)
      return
    }

    const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst

    if (profileBirthDay || profileBirthMonth || profileBirthYear) {
      const combined = composeBirthDateIso(profileBirthDay, profileBirthMonth, profileBirthYear)
      if (!combined) {
        setProfileError('La fecha de nacimiento no es válida.')
        setProfileSaving(false)
        return
      }
    }

    const birthIso = composeBirthDateIso(profileBirthDay, profileBirthMonth, profileBirthYear)

    const dial = resolveDialCode(profileCountryCode, profileCustomCode)
    if (profileCountryCode === 'otro' && dial.length <= 1 && profilePhoneNumber.trim()) {
      setProfileError('Indica un prefijo internacional válido.')
      setProfileSaving(false)
      return
    }

    const fullPhone = buildFullPhone(profileCountryCode, profileCustomCode, profilePhoneNumber)

    const combinedBirthDate = birthIso

    console.log('Attempting to save profile:', {
      id: userId,
      first_name: trimmedFirst,
      last_name: trimmedLast || null,
      phone: fullPhone || null,
      birth_date: combinedBirthDate || null,
    })

    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        first_name: trimmedFirst,
        last_name: trimmedLast || null,
        phone: fullPhone || null,
        birth_date: birthIso,
      })
      .select()

    console.log('Upsert error:', error)
    console.log('Upsert data:', data)

    if (error) {
      setProfileError(error.message)
      setProfileSaving(false)
      return
    }

    window.dispatchEvent(new Event('profile-updated'))

    const trimmedEmail = profileEmail.trim()
    if (!profileIsGoogle && trimmedEmail && trimmedEmail !== profileEmailInitial) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (emailError) {
        setProfileError(emailError.message)
        setProfileSaving(false)
        return
      }
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    })
    if (metaError) {
      setProfileError(metaError.message)
      setProfileSaving(false)
      return
    }

    const phoneChanged = fullPhone !== profileInitialPhone

    const { data: refreshed } = await supabase
      .from('users')
      .select('first_name, last_name, phone, birth_date')
      .eq('id', userId)
      .maybeSingle()

    const refreshedProfile = refreshed ?? {
      first_name: trimmedFirst,
      last_name: trimmedLast || null,
      phone: fullPhone || null,
      birth_date: birthIso,
    }

    setUserDbProfile({
      first_name: refreshedProfile.first_name ?? null,
      last_name: refreshedProfile.last_name ?? null,
      phone: refreshedProfile.phone ?? null,
      birth_date: refreshedProfile.birth_date ?? null,
    })

    setProfileFirstName(refreshedProfile.first_name?.trim() ?? '')
    setProfileLastName(refreshedProfile.last_name?.trim() ?? '')
    const birth = isoToBirthParts(refreshedProfile.birth_date ?? null)
    setProfileBirthDay(birth.day)
    setProfileBirthMonth(birth.month)
    setProfileBirthYear(birth.year)

    const refreshedPhone =
      typeof refreshedProfile.phone === 'string' && refreshedProfile.phone.trim()
        ? refreshedProfile.phone.trim()
        : ''
    setProfileInitialPhone(refreshedPhone)
    const refreshedDial = splitDialPhone(refreshedPhone)
    setProfileCountryCode(refreshedDial.countryCode)
    setProfileCustomCode(refreshedDial.customCode)
    setProfilePhoneNumber(refreshedDial.number)

    const displayFullName =
      `${refreshedProfile.first_name ?? ''} ${refreshedProfile.last_name ?? ''}`.trim() || fullName
    setParentProfile((prev) =>
      prev
        ? {
            ...prev,
            fullName: displayFullName,
            phone: refreshedPhone || null,
            email: profileIsGoogle ? prev.email : trimmedEmail || prev.email,
          }
        : prev
    )
    setProfileEmailInitial(trimmedEmail)
    setProfileSaving(false)
    setShowProfileModal(false)
    setProfilePhoneNotice(phoneChanged)
    setProfileSuccessToast(true)
  }

  const handlePasswordUpdate = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    if (profileNewPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (profileNewPassword !== profileConfirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setPasswordSaving(true)
    const { error: passwordUpdateError } = await supabase.auth.updateUser({
      password: profileNewPassword,
    })
    setPasswordSaving(false)

    if (passwordUpdateError) {
      setPasswordError(passwordUpdateError.message)
      return
    }

    setProfileNewPassword('')
    setProfileConfirmPassword('')
    setPasswordSuccess(true)
  }

  const greetingName =
    userDbProfile?.first_name ||
    authUser?.user_metadata?.full_name?.split(' ')[0] ||
    authUser?.email?.split('@')[0] ||
    ''
  const greetingTitle = greetingName ? `Hola, ${greetingName} 👋` : 'Hola 👋'

  const profileInitials = parentProfile
    ? initialsFromDisplay(parentProfile.fullName, parentProfile.email)
    : '?'

  const avatarUrl = parentProfile?.avatarUrl ?? null
  const showParentAvatar = avatarUrl != null && isValidUrl(avatarUrl) && !avatarError

  useEffect(() => {
    setAvatarError(false)
  }, [avatarUrl])

  return (
    <main
      className={`min-h-screen ${brand.pageBg} pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-12`}
    >
      <AppNav brandHref="/" />
      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 md:px-8">
        <header className="mb-5 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl md:text-3xl">{greetingTitle}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Todos tus eventos y cumpleaños organizados en un solo lugar.
            </p>
          </div>
        </header>

        {loading && !parentProfile ? (
          <div
            className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2"
            aria-busy="true"
            aria-label="Cargando perfil"
          >
            {[0, 1].map((i) => (
              <div
                key={i}
                className="card-soft flex min-h-[5.625rem] animate-pulse flex-row items-center gap-3 p-3 sm:gap-4"
              >
                <div className="h-16 w-16 shrink-0 rounded-full bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2 pr-6">
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-100" />
                  <div className="h-3 w-32 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {parentProfile ? (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={openProfileModal}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openProfileModal()
                }
              }}
              className="card-soft relative flex min-h-[5.625rem] cursor-pointer flex-row items-center gap-3 p-3 sm:gap-4"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openProfileModal()
                }}
                className="absolute top-2 right-2 rounded-full p-1 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
                aria-label="Editar perfil"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden />
              </button>
              {showParentAvatar ? (
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${brand.accentBg}`}
                  aria-hidden
                >
                  {profileInitials.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1 pr-6">
                <p className="text-xs font-medium text-gray-500">Mi perfil</p>
                <p className="text-base font-semibold leading-snug text-gray-900 break-words sm:truncate">
                  {parentProfile.fullName ?? 'Tu cuenta'}
                </p>
                {parentProfile.phone ? (
                  <p className="text-sm text-gray-500 break-words sm:truncate">{parentProfile.phone}</p>
                ) : null}
                <p className="text-sm text-gray-400 break-words sm:truncate">{parentProfile.email}</p>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowAddPartnerModal(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setShowAddPartnerModal(true)
                }
              }}
              className={`card-soft relative flex min-h-[5.625rem] cursor-pointer flex-row items-center gap-3 p-3 sm:gap-4 ${
                partner ? 'border border-gray-100' : 'border border-dashed border-gray-200'
              }`}
            >
              {partner ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setShowAddPartnerModal(true)
                  }}
                  className="absolute top-2 right-2 rounded-full p-1 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
                  aria-label="Editar pareja"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-base font-semibold ${
                  partner ? partnerAvatarColors[0] : 'border-2 bg-gray-50 text-gray-400'
                }`}
                aria-hidden
              >
                {partner ? getPartnerInitials(partner.full_name, partner.last_name) : '+'}
              </div>
              <div className={`min-w-0 flex-1 text-left ${partner ? 'pr-6' : ''}`}>
                {partner ? (
                  <>
                    <p className="text-xs font-medium text-gray-500">Pareja</p>
                    <p className="text-base font-semibold leading-snug text-gray-900 break-words sm:truncate">
                      {partnerDisplayLabel(partner)}
                    </p>
                    {partner.phone ? (
                      <p className="text-sm text-gray-500 break-words sm:truncate">{partner.phone}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs font-medium text-gray-400">Añadir pareja</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {userId || loading ? (
          <ChildrenSection
            userId={userId}
            initialChildren={children}
            isLoading={loading || !userId}
            onAddChild={() => setShowAddChildModal(true)}
            onChildCardPress={(child) => setChildActionTarget(child)}
            childActionTargetId={childActionTarget?.id ?? null}
          />
        ) : null}

        {!loading && draftEvents.length > 0 ? (
          <section className="card-soft mb-6 border border-dashed border-gray-200 bg-gray-50/90 p-4 sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-700">Borradores</h2>
            <ul className="space-y-3">
              {draftEvents.map((d) => (
                <DraftEventListRow
                  key={d.id}
                  draft={d}
                  onContinue={() => router.push(`/dashboard/eventos/nuevo?draftId=${d.id}`)}
                  onDelete={() => setDraftDeleteTarget(d)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card-soft p-4 sm:p-6">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!error ? (
            <div>
              <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mt-2">
                <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg">
                  <CalendarDays className="h-4 w-4 shrink-0 text-gray-600" strokeWidth={2} aria-hidden />
                  <span className="truncate">Eventos</span>
                </h2>
                <button
                  type="button"
                  onClick={() => requestCreateEvent('/dashboard/eventos/nuevo')}
                  className={`${brand.dashboardPrimaryPill} w-max justify-self-end`}
                >
                  Crear evento
                </button>
              </div>

              {loading ? (
                <div className="space-y-4" aria-busy="true" aria-label="Cargando eventos">
                  <div className="grid w-full grid-cols-2 gap-3">
                    <div className="pill-soft h-10 animate-pulse border border-gray-200 bg-gray-100" />
                    <div className="pill-soft h-10 animate-pulse border border-gray-200 bg-gray-100" />
                  </div>
                  <div className="h-[4.5rem] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
                </div>
              ) : !hasAnyEvents && draftEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">🎉 Todos tus eventos aparecerán aquí.</p>
              ) : (
                <>
                  <div className="mb-4 grid w-full grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setShowProximos((v) => !v)}
                      className={`pill-soft flex w-full cursor-pointer items-center justify-between border py-2 px-3 text-left transition sm:px-4 ${
                        showProximos
                          ? `bg-white ${brand.borderBrand} shadow-sm`
                          : 'border-gray-200 bg-white opacity-50 text-gray-400'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium sm:text-sm ${showProximos ? 'text-gray-600' : 'text-gray-400'}`}
                      >
                        Próximos
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs ${
                          showProximos ? brand.togglePillActive : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {upcomingCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasados((v) => !v)}
                      className={`pill-soft flex w-full cursor-pointer items-center justify-between border py-2 px-3 text-left transition sm:px-4 ${
                        showPasados
                          ? `bg-white ${brand.borderBrand} shadow-sm`
                          : 'border-gray-200 bg-white opacity-50 text-gray-400'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium sm:text-sm ${showPasados ? 'text-gray-600' : 'text-gray-400'}`}
                      >
                        Pasados
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs ${
                          showPasados ? brand.togglePillActive : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {pastCount}
                      </span>
                    </button>
                  </div>

                  {!showProximos && !showPasados ? (
                    <p className="py-6 text-center text-sm text-gray-500">
                      Selecciona Próximos o Pasados para ver tus eventos.
                    </p>
                  ) : (showProximos && dashboardUpcomingEvents.length > 0) ||
                    (showPasados && lastPastEvent) ? (
                    <ul className="mt-3 grid w-full grid-cols-1 gap-3">
                      {showProximos
                        ? dashboardUpcomingEvents.map((event) => (
                            <EventRow
                              key={event.id}
                              event={event}
                              rsvpCounts={
                                rsvpCountsByEventId[event.id] ?? {
                                  confirmed: 0,
                                  declined: 0,
                                  maybe: 0,
                                }
                              }
                              todayStr={todayStr}
                              isInvited={!organizedEventIds.has(event.id)}
                              attendanceStatus={invitedAttendanceByEventId[event.id] ?? null}
                            />
                          ))
                        : null}
                      {showPasados && lastPastEvent ? (
                        <EventRow
                          key={`past-${lastPastEvent.id}`}
                          event={lastPastEvent}
                          rsvpCounts={
                            rsvpCountsByEventId[lastPastEvent.id] ?? {
                              confirmed: 0,
                              declined: 0,
                              maybe: 0,
                            }
                          }
                          todayStr={todayStr}
                          isInvited={!organizedEventIds.has(lastPastEvent.id)}
                          attendanceStatus={invitedAttendanceByEventId[lastPastEvent.id] ?? null}
                        />
                      ) : null}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="card-soft mt-6 p-4 sm:mt-8 sm:p-6">
          <div>
            <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mt-2">
              <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg">
                <span className="shrink-0" aria-hidden>
                  📍
                </span>
                <span className="truncate">Lugares</span>
              </h2>
              <button
                type="button"
                onClick={openAddPlaceModal}
                className={`${brand.dashboardPrimaryPill} w-max justify-self-end`}
              >
                Añadir lugar
              </button>
            </div>
            {loading ? (
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-busy="true"
                aria-label="Cargando lugares"
              >
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="card-soft flex h-16 animate-pulse flex-row items-center gap-3 p-3"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-20 rounded bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboardLocations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                📍 Añade un lugar o crea un evento para verlo aquí.
              </p>
            ) : (
              <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 scroll-px-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 md:grid-cols-3">
                {dashboardLocations.map((location) => (
                  <div
                    key={location.saved_place_id ?? `event:${location.location_name}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLocationActionTarget(location)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setLocationActionTarget(location)
                      }
                    }}
                    className="card-soft flex w-[min(82vw,17rem)] shrink-0 cursor-pointer snap-start flex-row items-center gap-3 p-3 transition hover:shadow-md sm:w-full sm:shrink"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100"
                      aria-hidden
                    >
                      <MapIcon className="h-4 w-4 text-gray-400" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-gray-700 line-clamp-2 sm:truncate">
                        {location.location_name}
                      </p>
                      {location.location_address ? (
                        <p
                          className="mt-0.5 text-xs leading-snug text-gray-400 line-clamp-2 sm:truncate"
                          title={location.location_address}
                        >
                          {location.location_address}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {partnerSaveSuccess ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          Pareja guardada ✓
        </p>
      ) : null}

      {childAddSuccessToast ? (
        <div
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          🎉 Persona añadida
        </div>
      ) : null}

      {childUpdateSuccessToast ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          ✓ Perfil actualizado
        </p>
      ) : null}

      {placeDeleteSuccessToast ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          ✓ Lugar eliminado
        </p>
      ) : null}

      {placeAddSuccessToast ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          ✓ Lugar añadido
        </p>
      ) : null}

      {draftDeletedToast ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          Borrador eliminado
        </p>
      ) : null}

      {showCreateEventDraftModal ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateEventDraftModal(false)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-event-draft-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateEventDraftModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="create-event-draft-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {draftEvents.length > 1 ? 'Tienes borradores pendientes' : 'Tienes un evento en borrador'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Puedes seguir donde lo dejaste o crear un evento nuevo.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2">
              {draftEvents.length > 1
                ? draftEvents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setShowCreateEventDraftModal(false)
                        router.push(`/dashboard/eventos/nuevo?draftId=${d.id}`)
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:bg-[var(--brand-primary-light)]"
                    >
                      <span className="text-xs font-medium text-gray-500">Continuar borrador</span>
                      <span className="mt-0.5 block line-clamp-2 text-sm font-semibold text-gray-900">
                        {d.title}
                      </span>
                    </button>
                  ))
                : draftEvents[0] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateEventDraftModal(false)
                        router.push(`/dashboard/eventos/nuevo?draftId=${draftEvents[0].id}`)
                      }}
                      className={`w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${brand.buttonPrimary}`}
                    >
                      Continuar borrador
                    </button>
                  ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowCreateEventDraftModal(false)
                  router.push(createEventNextHref)
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                Crear evento nuevo
              </button>
              <button
                type="button"
                onClick={() => setShowCreateEventDraftModal(false)}
                className="w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draftDeleteTarget ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !draftDeleteBusy && setDraftDeleteTarget(null)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-draft-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={draftDeleteBusy}
              onClick={() => setDraftDeleteTarget(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="delete-draft-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              ¿Eliminar borrador?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Este borrador se eliminará de tu perfil.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={draftDeleteBusy}
                onClick={() => setDraftDeleteTarget(null)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:min-w-[7.5rem]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={draftDeleteBusy}
                onClick={() => void confirmDeleteDraft()}
                className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60 sm:w-auto sm:min-w-[7.5rem]"
              >
                {draftDeleteBusy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {profileSuccessToast ? (
        <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] flex max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-2">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Cambios guardados ✓
          </div>
          {profilePhoneNotice ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 shadow-lg">
              Tu nuevo número aparecerá en los próximos eventos que crees.
            </p>
          ) : null}
        </div>
      ) : null}

      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white pt-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <div className="max-h-[85vh] overflow-y-auto px-6 pb-6">
              <div className="mb-4 mt-1 flex items-center justify-between gap-2">
                <h2 id="profile-modal-title" className="text-lg font-semibold text-gray-900">
                  Mi perfil
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="profileFirstName" className="text-sm font-medium text-gray-700">
                      Nombre
                    </label>
                    <input
                      id="profileFirstName"
                      type="text"
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      className={profileInputClassName}
                    />
                  </div>
                  <div>
                    <label htmlFor="profileLastName" className="text-sm font-medium text-gray-700">
                      Apellido(s)
                    </label>
                    <input
                      id="profileLastName"
                      type="text"
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      className={profileInputClassName}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 block text-sm font-medium text-gray-900">Fecha de nacimiento</p>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={profileBirthDay}
                      onChange={(e) =>
                        handleProfileBirthDateChange(e.target.value, profileBirthMonth, profileBirthYear)
                      }
                      className={profileBirthDateSelectClassName}
                      aria-label="Día"
                    >
                      <option value="">Día</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      value={profileBirthMonth}
                      onChange={(e) =>
                        handleProfileBirthDateChange(profileBirthDay, e.target.value, profileBirthYear)
                      }
                      className={profileBirthDateSelectClassName}
                      aria-label="Mes"
                    >
                      <option value="">Mes</option>
                      {SPANISH_MONTHS.map((monthName, index) => {
                        const monthValue = String(index + 1).padStart(2, '0')
                        return (
                          <option key={monthValue} value={monthValue}>
                            {monthName}
                          </option>
                        )
                      })}
                    </select>
                    <select
                      value={profileBirthYear}
                      onChange={(e) =>
                        handleProfileBirthDateChange(profileBirthDay, profileBirthMonth, e.target.value)
                      }
                      className={profileBirthDateSelectClassName}
                      aria-label="Año"
                    >
                      <option value="">Año</option>
                      {profileBirthYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="profileEmail" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Email
                  </label>
                  {profileIsGoogle ? (
                    <div>
                      <div className="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-500">
                        {profileEmail}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                        <GoogleGIcon size={16} className="h-4 w-4 shrink-0" />
                        Vinculado con Google
                      </p>
                    </div>
                  ) : (
                    <input
                      id="profileEmail"
                      type="email"
                      autoComplete="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className={profileInputClassName}
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="profilePhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Teléfono
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      ref={profileDialRef}
                      className={
                        profileCountryCode === 'otro'
                          ? 'relative w-20 max-w-20 shrink-0'
                          : 'relative w-28 max-w-28 shrink-0'
                      }
                    >
                      <button
                        type="button"
                        aria-expanded={profileDialOpen}
                        aria-haspopup="listbox"
                        onClick={() => setProfileDialOpen((open) => !open)}
                        className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {dialCodeShortLabel(profileCountryCode)}
                        </span>
                        <span className="shrink-0 text-[10px] leading-none text-gray-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {profileDialOpen ? (
                        <ul
                          role="listbox"
                          className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={profileCountryCode === '+34'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('+34')
                                setProfileDialOpen(false)
                              }}
                            >
                              🇪🇸 +34 (España)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={profileCountryCode === '+57'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('+57')
                                setProfileDialOpen(false)
                              }}
                            >
                              🇨🇴 +57 (Colombia)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={profileCountryCode === 'otro'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('otro')
                                setProfileDialOpen(false)
                              }}
                            >
                              ✏️ Otro
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </div>
                    {profileCountryCode === 'otro' ? (
                      <input
                        type="text"
                        inputMode="tel"
                        autoComplete="tel-country-code"
                        value={profileCustomCode}
                        onChange={(e) => setProfileCustomCode(sanitizeDialPrefix(e.target.value))}
                        maxLength={5}
                        placeholder="+00"
                        aria-label="Prefijo internacional"
                        className="input-base w-16 shrink-0 px-2 ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                      />
                    ) : null}
                    <input
                      id="profilePhone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      value={profilePhoneNumber}
                      onChange={(e) => setProfilePhoneNumber(e.target.value)}
                      placeholder="Ej. 612345678"
                      className="input-base min-w-0 flex-1 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {!profileIsGoogle ? (
                  <div className="rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordSection((open) => !open)
                        setPasswordError(null)
                        setPasswordSuccess(false)
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-gray-900"
                    >
                      Cambiar contraseña
                      <span className="text-xs text-gray-400">{showPasswordSection ? '▲' : '▼'}</span>
                    </button>
                    {showPasswordSection ? (
                      <div className="space-y-3 border-t border-gray-200 px-3 pb-3 pt-3">
                        <div>
                          <label
                            htmlFor="profileNewPassword"
                            className="mb-1.5 block text-sm font-medium text-gray-900"
                          >
                            Nueva contraseña
                          </label>
                          <div className="relative">
                            <input
                              id="profileNewPassword"
                              type={showNewPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={profileNewPassword}
                              onChange={(e) => setProfileNewPassword(e.target.value)}
                              className={`${profileInputClassName} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="profileConfirmPassword"
                            className="mb-1.5 block text-sm font-medium text-gray-900"
                          >
                            Confirmar contraseña
                          </label>
                          <div className="relative">
                            <input
                              id="profileConfirmPassword"
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={profileConfirmPassword}
                              onChange={(e) => setProfileConfirmPassword(e.target.value)}
                              className={`${profileInputClassName} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        {passwordError ? (
                          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {passwordError}
                          </p>
                        ) : null}
                        {passwordSuccess ? (
                          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                            Contraseña actualizada ✓
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={passwordSaving}
                          onClick={() => void handlePasswordUpdate()}
                          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonOutline} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {passwordSaving ? 'Actualizando…' : 'Actualizar contraseña'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {profileError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </p>
                ) : null}

                <ModalActionButtons
                  saveLabel="Guardar"
                  onCancel={() => setShowProfileModal(false)}
                  hasChanges={profileHasChanges}
                  saving={profileSaving}
                  onSave={() => void handleProfileSave()}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddPartnerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-modal-title"
          >
            <button
              type="button"
              onClick={() => setShowAddPartnerModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="partner-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {partner ? 'Editar pareja' : 'Añadir pareja'}
            </h2>
            <form onSubmit={handlePartnerSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="partnerFirstName" className="text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <input
                    id="partnerFirstName"
                    type="text"
                    autoComplete="given-name"
                    value={partnerFirstName}
                    onChange={(event) => setPartnerFirstName(event.target.value)}
                    required
                    className={partnerInputClassName}
                    placeholder="Ej. Carlos"
                  />
                </div>
                <div>
                  <label htmlFor="partnerLastName" className="text-sm font-medium text-gray-700">
                    Apellido(s)
                  </label>
                  <input
                    id="partnerLastName"
                    type="text"
                    autoComplete="family-name"
                    value={partnerLastName}
                    onChange={(event) => setPartnerLastName(event.target.value)}
                    className={partnerInputClassName}
                    placeholder="Ej. López"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">Fecha de nacimiento</p>
                  <span className="text-xs text-gray-400">Opcional</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={partnerBirthDay}
                    onChange={(event) => setPartnerBirthDay(event.target.value)}
                    className={profileBirthDateSelectClassName}
                    aria-label="Día"
                  >
                    <option value="">Día</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <select
                    value={partnerBirthMonth}
                    onChange={(event) => setPartnerBirthMonth(event.target.value)}
                    className={profileBirthDateSelectClassName}
                    aria-label="Mes"
                  >
                    <option value="">Mes</option>
                    {SPANISH_MONTHS.map((monthName, index) => {
                      const monthValue = String(index + 1).padStart(2, '0')
                      return (
                        <option key={monthValue} value={monthValue}>
                          {monthName}
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={partnerBirthYear}
                    onChange={(event) => setPartnerBirthYear(event.target.value)}
                    className={profileBirthDateSelectClassName}
                    aria-label="Año"
                  >
                    <option value="">Año</option>
                    {childBirthYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="partnerPhoneNumber" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Teléfono
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    ref={partnerDialRef}
                    className={
                      partnerCountryCode === 'otro'
                        ? 'relative w-20 max-w-20 shrink-0'
                        : 'relative w-28 max-w-28 shrink-0'
                    }
                  >
                    <button
                      type="button"
                      aria-expanded={partnerDialOpen}
                      aria-haspopup="listbox"
                      onClick={() => setPartnerDialOpen((open) => !open)}
                      className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {dialCodeShortLabel(partnerCountryCode)}
                      </span>
                      <span className="shrink-0 text-[10px] leading-none text-gray-500" aria-hidden>
                        ▾
                      </span>
                    </button>
                    {partnerDialOpen ? (
                      <ul
                        role="listbox"
                        className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === '+34'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('+34')
                              setPartnerDialOpen(false)
                            }}
                          >
                            🇪🇸 +34 (España)
                          </button>
                        </li>
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === '+57'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('+57')
                              setPartnerDialOpen(false)
                            }}
                          >
                            🇨🇴 +57 (Colombia)
                          </button>
                        </li>
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === 'otro'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('otro')
                              setPartnerDialOpen(false)
                            }}
                          >
                            ✏️ Otro
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  {partnerCountryCode === 'otro' ? (
                    <input
                      type="text"
                      inputMode="tel"
                      autoComplete="tel-country-code"
                      value={partnerCustomDialCode}
                      onChange={(event) =>
                        setPartnerCustomDialCode(sanitizeDialPrefix(event.target.value))
                      }
                      maxLength={5}
                      placeholder="+00"
                      aria-label="Prefijo internacional"
                      className="input-base w-16 shrink-0 px-2 ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                    />
                  ) : null}
                  <input
                    id="partnerPhoneNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={partnerPhoneNumber}
                    onChange={(event) => setPartnerPhoneNumber(event.target.value)}
                    placeholder="Ej. 612345678"
                    className="input-base min-w-0 flex-1 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {partnerModalError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {partnerModalError}
                </p>
              ) : null}

              <ModalActionButtons
                saveLabel="Guardar"
                onCancel={() => setShowAddPartnerModal(false)}
                hasChanges={partnerHasChanges}
                saving={partnerSaving}
                saveType="submit"
              />
            </form>
          </div>
        </div>
      ) : null}

      {showAddChildModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-child-modal-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
              <h2 id="add-child-modal-title" className="text-lg font-semibold text-gray-900">
                Añadir persona
              </h2>
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleChildSave} className="space-y-4 px-6 py-4">
              <ChildFormFields
                idPrefix="child"
                nombre={childFirstName}
                setNombre={setChildFirstName}
                apellido={childLastName}
                setApellido={setChildLastName}
                shortName={childShortName}
                setShortName={setChildShortName}
                birthDay={childBirthDay}
                setBirthDay={setChildBirthDay}
                birthMonth={childBirthMonth}
                setBirthMonth={setChildBirthMonth}
                birthYear={childBirthYear}
                setBirthYear={setChildBirthYear}
                relation={childRelation}
                setRelation={setChildRelation}
                phone={childPhone}
                setPhone={setChildPhone}
                allergies={childAllergies}
                setAllergies={setChildAllergies}
                birthYears={childBirthYears}
                nombreRequired
                apellidoRequired
              />

              {childModalError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {childModalError}
                </p>
              ) : null}

              <ModalActionButtons
                saveLabel="Guardar"
                onCancel={() => setShowAddChildModal(false)}
                hasChanges={childAddHasChanges}
                saving={childSaving}
                saveType="submit"
              />
            </form>
          </div>
        </div>
      ) : null}

      {viewingChild ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-child-modal-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
              <h2 id="view-child-modal-title" className="text-lg font-semibold text-gray-900">
                Perfil de {viewingChild.name}
              </h2>
              <button
                type="button"
                onClick={() => setViewingChild(null)}
                className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleViewChildSave} className="space-y-4 px-6 py-4">
              <ChildFormFields
                idPrefix="viewChild"
                nombre={viewChildFirstName}
                setNombre={setViewChildFirstName}
                apellido={viewChildLastName}
                setApellido={setViewChildLastName}
                shortName={viewChildShortName}
                setShortName={setViewChildShortName}
                birthDay={viewChildBirthDay}
                setBirthDay={setViewChildBirthDay}
                birthMonth={viewChildBirthMonth}
                setBirthMonth={setViewChildBirthMonth}
                birthYear={viewChildBirthYear}
                setBirthYear={setViewChildBirthYear}
                relation={viewChildRelation}
                setRelation={setViewChildRelation}
                phone={viewChildPhone}
                setPhone={setViewChildPhone}
                allergies={viewChildAllergies}
                setAllergies={setViewChildAllergies}
                birthYears={childBirthYears}
                disabledFields={viewChildDisabledFields}
              />

              {viewChildError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {viewChildError}
                </p>
              ) : null}

              <ModalActionButtons
                saveLabel="Guardar"
                onCancel={() => setViewingChild(null)}
                hasChanges={childHasChanges}
                saving={viewChildSaving}
                saveType="submit"
              />
            </form>
          </div>
        </div>
      ) : null}

      {childActionTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setChildActionTarget(null)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="child-action-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setChildActionTarget(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="child-action-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {`${childActionTarget.name} ${childActionTarget.last_name || ''}`.trim()}
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const displayName =
                    (childActionTarget.short_name ?? '').trim() || childActionTarget.name
                  const age = calculateAge(childActionTarget.birth_date)
                  const title = age
                    ? `Cumple ${age + 1} de ${displayName}`
                    : `Cumple de ${displayName}`
                  setChildActionTarget(null)
                  requestCreateEvent(
                    `/dashboard/eventos/nuevo?childId=${childActionTarget.id}&mode=birthday&title=${encodeURIComponent(title)}`
                  )
                }}
                className={brand.modalActionPrimary}
              >
                <span className={brand.modalActionPrimaryIcon} aria-hidden>
                  🎉
                </span>
                <span className="text-sm font-medium text-gray-700">Crear evento</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const child = childActionTarget
                  setChildActionTarget(null)
                  setViewingChild(child)
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 transition hover:bg-gray-100"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg"
                  aria-hidden
                >
                  ✏️
                </span>
                <span className="text-sm font-medium text-gray-700">Ver perfil</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddPlaceModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowAddPlaceModal(false)}
          role="presentation"
        >
          <div
            className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-place-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAddPlaceModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="add-place-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              Añadir lugar
            </h2>
            <form onSubmit={handlePlaceSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="placeName" className="text-sm font-medium text-gray-700">
                  Nombre del lugar
                </label>
                <input
                  id="placeName"
                  type="text"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                  required
                  className={partnerInputClassName}
                  placeholder="Ej. Casa de los abuelos"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="placeStreet" className="text-sm font-medium text-gray-700">
                    Calle
                  </label>
                  <input
                    id="placeStreet"
                    type="text"
                    value={placeStreet}
                    onChange={(event) => setPlaceStreet(event.target.value)}
                    required
                    className={partnerInputClassName}
                    placeholder="Ej. Carrer de França"
                  />
                </div>
                <div>
                  <label htmlFor="placeNumber" className="text-sm font-medium text-gray-700">
                    Número
                  </label>
                  <input
                    id="placeNumber"
                    type="text"
                    inputMode="numeric"
                    value={placeNumber}
                    onChange={(event) => setPlaceNumber(event.target.value)}
                    className={partnerInputClassName}
                    placeholder="Ej. 7"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="placePostal" className="text-sm font-medium text-gray-700">
                    Código postal
                  </label>
                  <input
                    id="placePostal"
                    type="text"
                    inputMode="numeric"
                    value={placePostal}
                    onChange={(event) => setPlacePostal(event.target.value)}
                    className={partnerInputClassName}
                    placeholder="Ej. 07108"
                  />
                </div>
                <div>
                  <label htmlFor="placeCity" className="text-sm font-medium text-gray-700">
                    Ciudad
                  </label>
                  <input
                    id="placeCity"
                    type="text"
                    value={placeCity}
                    onChange={(event) => setPlaceCity(event.target.value)}
                    required
                    className={partnerInputClassName}
                    placeholder="Ej. Sóller"
                  />
                </div>
              </div>

              {placeModalError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {placeModalError}
                </p>
              ) : null}

              <ModalActionButtons
                saveLabel="Guardar lugar"
                onCancel={() => setShowAddPlaceModal(false)}
                hasChanges={placeFormCanSave}
                saving={placeSaving}
                saveType="submit"
              />
            </form>
          </div>
        </div>
      ) : null}

      {locationActionTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setLocationActionTarget(null)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-action-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLocationActionTarget(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="location-action-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {locationActionTarget.location_name}
            </h2>
            {locationActionTarget.location_address ? (
              <p className="mt-0.5 text-sm text-gray-400">{locationActionTarget.location_address}</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  requestCreateEvent(
                    `/dashboard/eventos/nuevo?locationName=${encodeURIComponent(locationActionTarget.location_name)}&locationAddress=${encodeURIComponent(locationActionTarget.location_address || '')}${locationActionTarget.google_maps_url ? `&googleMapsUrl=${encodeURIComponent(locationActionTarget.google_maps_url)}` : ''}`
                  )
                  setLocationActionTarget(null)
                }}
                className={`${brand.modalActionPrimary} text-left`}
              >
                <span className={brand.modalActionPrimaryIcon} aria-hidden>
                  🎉
                </span>
                <span className="text-sm font-medium text-gray-700">Crear evento en este lugar</span>
              </button>
              {locationActionTarget.google_maps_url ? (
                <button
                  type="button"
                  onClick={() => {
                    const url = locationActionTarget.google_maps_url
                    setLocationActionTarget(null)
                    if (url) {
                      window.open(url, '_blank')
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg"
                    aria-hidden
                  >
                    🗺️
                  </span>
                  <span className="text-sm font-medium text-gray-700">Ver en Google Maps</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteLocation({
                    savedPlaceId: locationActionTarget.saved_place_id,
                    locationName: locationActionTarget.location_name,
                  })
                  setLocationActionTarget(null)
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-rose-100/90 bg-rose-50 px-4 py-3 text-left transition hover:bg-rose-100/80"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100/90 text-lg"
                  aria-hidden
                >
                  🗑️
                </span>
                <span className="text-sm font-medium text-rose-800/90">Eliminar lugar</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteLocation ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setPendingDeleteLocation(null)}
          role="presentation"
        >
          <div
            className="relative mx-4 max-h-[min(85vh,calc(100dvh-2rem))] w-full max-w-xs overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-place-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPendingDeleteLocation(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="delete-place-confirm-title" className="pr-8 text-lg font-semibold text-gray-900">
              ¿Eliminar lugar?
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-800">
              {pendingDeleteLocation.locationName}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Este lugar dejará de mostrarse en Mi Panel. Ninguno de tus eventos se verá afectado.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteLocation(null)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:min-w-[7.5rem]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteLocation()}
                className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 sm:w-auto sm:min-w-[7.5rem]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
