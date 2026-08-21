'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Cart } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';

export interface DeliveryDateProps {
  /** The cart to use for the delivery date */
  cart: Cart;

  /** Number of upcoming days to offer as quick-pick tiles. Defaults to 3. */
  showUpcomingDays?: number;

  /** Skip weekends when building the upcoming-days tiles. Defaults to `true`. */
  skipWeekends?: boolean;

  /** Show an "Other date..." tile that opens a date picker. Defaults to `true`. */
  showDatePicker?: boolean;

  /** Fires when a delivery date is selected, with the ISO date string. */
  onDateSelect?: (date: string) => void;

  /** Custom date display formatting function */
  formatDateDisplay?: (date: string) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** The CSS class for the container */
  containerClass?: string;

  /** Pre-selected date from cart (e.g. cart.postageData.requestDate: "2026-04-17T00:00:00.000Z") */
  initialDate?: string;

  /**
   * Active language/locale (e.g. `'NL'`). Sets the `lang` attribute on the
   * native `<input type="date">` so the browser renders its calendar chrome
   * (month name, weekday headers, Today/Clear) in that locale. Resolved from
   * `<PropellerProvider>` when omitted. The quick-pick tile text is localized
   * separately via `labels` (day_N / month_N keys).
   */
  language?: string;
}

// ── Pure date helpers (module scope — created once, not per render) ─────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00Z`;
}

/**
 * Local calendar day (`YYYY-MM-DD`) of an ISO date, for comparing a selected /
 * cart date against the quick-pick tiles. Comparing the raw ISO strings is
 * wrong: the cart's `requestDate` carries its own time/offset/millis (e.g.
 * `...T00:00:00.000Z`, `...+02:00`), so a date that IS the same day as a tile
 * fails a string match and gets misclassified as a custom "other" date —
 * duplicating it into the picker tile. Keying by the LOCAL day matches how the
 * tile labels are rendered (`formatDisplay` uses local getDate), so the
 * comparison and the visible label always agree. Empty/invalid → ''.
 */
function toDayKey(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Tomorrow as a YYYY-MM-DD string (the minimum selectable date). */
function getMinDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeUpcomingDates(count: number, skipWeekends: boolean): string[] {
  const days: string[] = [];
  const current = new Date();
  current.setDate(current.getDate() + 1);
  while (days.length < count) {
    const dayOfWeek = current.getDay();
    if (!skipWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      days.push(toApiDate(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Delivery-date selector: quick-pick tiles for the next few days plus an
 * optional custom date picker, with validation against a minimum date.
 */
function DeliveryDate(rawProps: DeliveryDateProps) {
  // Explicit props win; otherwise infra (e.g. `language`) resolves from
  // <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [selectedDate, setSelectedDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [customDateValue, setCustomDateValue] = useState('');
  const [customDateError, setCustomDateError] = useState('');

  const upcomingDays = props.showUpcomingDays !== undefined ? props.showUpcomingDays : 3;
  const skipWeekends = props.skipWeekends !== undefined ? props.skipWeekends : true;
  const showDatePicker = props.showDatePicker !== undefined ? props.showDatePicker : true;
  const containerClass = props.containerClass || 'delivery-date';
  const minDate = getMinDate();

  // Computed once per render (previously recomputed on every call — and
  // `upcomingDates()` was invoked once for the map plus 3× via
  // `isCustomDateSelected()`, each running a Date-math while loop).
  const upcomingDates = computeUpcomingDates(upcomingDays, skipWeekends);
  // Compare by local calendar day, not raw ISO string — see `toDayKey`. The
  // selected date counts as "one of the tiles" when its day matches a tile's
  // day, regardless of the time/offset the cart stored it with.
  const selectedDayKey = toDayKey(selectedDate);
  const upcomingDayKeys = upcomingDates.map(toDayKey);
  const isCustomDateSelected =
    selectedDayKey !== '' && upcomingDayKeys.indexOf(selectedDayKey) === -1;

  function formatDisplay(isoDate: string): string {
    if (props.formatDateDisplay) {
      return props.formatDateDisplay(isoDate);
    }
    // Guard against bad input: invalid dates produce NaN/undefined and render
    // as "undefined, undefined NaN". Return an empty string so the caller can
    // decide what to show.
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    // Weekday / month names go through `labels` so the tile reads in the
    // active locale (e.g. NL "ma, jul 20") instead of hardcoded English.
    // Keys: day_0..day_6 (Sun–Sat), month_0..month_11 (Jan–Dec); the English
    // abbreviations remain the fallback when a key is missing.
    const weekday = getLabel(props.labels, `day_${date.getDay()}`, WEEKDAYS[date.getDay()]);
    const month = getLabel(props.labels, `month_${date.getMonth()}`, MONTHS[date.getMonth()]);
    return `${weekday}, ${month} ${date.getDate()}`;
  }

  function handleSelect(isoDate: string): void {
    setSelectedDate(isoDate);
    setModalOpen(false);
    if (props.onDateSelect) {
      props.onDateSelect(isoDate);
    }
  }

  function handleCustomDateChange(value: string): void {
    // Validate before committing. The native date input doesn't reliably enforce
    // the `min` attribute on typed input across browsers, and historical or
    // out-of-range dates parse to a real Date that crashes downstream rendering
    // ("undefined, undefined NaN"). On any failure we keep the typed value in
    // the input so the user can fix it, and surface a single error message.
    setCustomDateValue(value);
    if (!value) {
      setCustomDateError('');
      return;
    }
    const parsed = new Date(value + 'T00:00:00');
    const year = parsed.getFullYear();
    const isParseable = !isNaN(parsed.getTime()) && year >= 1900 && year <= 9999;
    if (!isParseable) {
      setCustomDateError(getLabel(props.labels, 'invalidDate', 'Please enter a valid date.'));
      return;
    }
    // Reject anything earlier than minDate (tomorrow). String comparison works
    // because both sides are ISO-formatted YYYY-MM-DD.
    if (value < minDate) {
      setCustomDateError(getLabel(props.labels, 'pastDate', 'Please select a date in the future.'));
      return;
    }
    setCustomDateError('');
    handleSelect(toApiDate(parsed));
  }

  function openModal(): void {
    setCustomDateError('');
    setModalOpen(true);
  }

  function closeModal(): void {
    setCustomDateError('');
    setModalOpen(false);
  }

  function handleBackdropClick(event: React.MouseEvent): void {
    if (event.target === event.currentTarget) {
      setCustomDateError('');
      setModalOpen(false);
    }
  }

  // Sync external `initialDate` (from cart.postageData.requestDate) into our
  // local selection state — but only once per `initialDate` change, and only
  // when the user hasn't already picked a date themselves. This propagates
  // the cart's stored delivery date back to the parent via onDateSelect on
  // initial cart load (parent stores selectedDeliveryDate in its own state,
  // which it needs for "Continue" validation).
  //
  // The React Compiler rule flags this as set-state-in-effect; in this case
  // it's intentional external-state sync (the textbook valid use of
  // useEffect) — derived-state-from-props won't work here because we also
  // need to fire props.onDateSelect as a side effect on adoption, and the
  // user can override the initial with handleSelect.
  useEffect(() => {
    if (props.initialDate && !selectedDate) {
      // Normalize cart format "2026-04-17T00:00:00.000Z" → "2026-04-17T00:00:00Z"
      const dot = props.initialDate.lastIndexOf('.');
      const normalized = dot !== -1 ? props.initialDate.substring(0, dot) + 'Z' : props.initialDate;
      // The cart's requestDate can be a weekend (e.g. the backend defaults to
      // "tomorrow" without a business-day rule). Adopting it verbatim when
      // skipWeekends is on drops the selected date into the "Other date" tile —
      // it isn't one of the weekday quick-picks — so the soonest/selected date
      // renders LAST, out of sequence. When that happens, snap to the first
      // valid weekday tile (the earliest offered delivery day) instead, so the
      // selection lands on the leading quick-pick and no weekend leaks in.
      const parsed = new Date(normalized);
      const isWeekend =
        !isNaN(parsed.getTime()) && (parsed.getDay() === 0 || parsed.getDay() === 6);
      const adopt = skipWeekends && isWeekend && upcomingDates.length > 0
        ? upcomingDates[0]
        : normalized;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDate(adopt);
      if (props.onDateSelect) {
        props.onDateSelect(adopt);
      }
    }
  }, [props.initialDate, props.cart, selectedDate, props.onDateSelect, props, skipWeekends, upcomingDates]);

  return (
    <div className={`propeller-delivery-date ${containerClass}`}>
      <div className="propeller-delivery-date__grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {upcomingDates.map((dateStr, index) => {
          const tileSelected = selectedDayKey !== '' && upcomingDayKeys[index] === selectedDayKey;
          return (
          <div
            key={index}
            onClick={() => handleSelect(dateStr)}
            data-selected={tileSelected ? 'true' : 'false'}
            className={`propeller-delivery-date__option cursor-pointer border border-border rounded-container p-3 text-center transition-all ${tileSelected ? 'border-secondary bg-secondary/5 shadow-sm' : 'hover:border-secondary/30'}`}
          >
            <div className="propeller-delivery-date__option-label font-semibold">
              {formatDisplay(dateStr)}
            </div>
          </div>
          );
        })}
        {showDatePicker ? (
          <div
            onClick={() => openModal()}
            data-selected={isCustomDateSelected ? 'true' : 'false'}
            data-custom="true"
            className={`propeller-delivery-date__option propeller-delivery-date__option--custom cursor-pointer border border-border rounded-container p-3 text-center transition-all ${isCustomDateSelected ? 'border-secondary bg-secondary/5 shadow-sm' : 'hover:border-secondary/30'}`}
          >
            <div className="propeller-delivery-date__option-label font-semibold">
              {isCustomDateSelected
                ? formatDisplay(selectedDate)
                : getLabel(props.labels, 'pickDate', 'Other date...')}
            </div>
          </div>
        ) : null}
      </div>
      {modalOpen ? (
        <div
          className="propeller-delivery-date__modal fixed inset-0 z-50 flex items-center justify-center bg-foreground/50"
          onClick={(event) => handleBackdropClick(event)}
        >
          <div className="propeller-delivery-date__modal-content bg-card rounded-container shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="propeller-delivery-date__modal-header flex justify-between items-center mb-4">
              <h3 className="propeller-delivery-date__modal-title text-lg font-semibold">
                {getLabel(props.labels, 'modalTitle', 'Select a delivery date')}
              </h3>
              <button
                type="button"
                className="propeller-delivery-date__modal-close text-foreground-subtle hover:text-foreground transition-colors"
                onClick={() => closeModal()}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="date"
              // `lang` drives the native calendar's locale (month name, weekday
              // headers, Today/Clear) — the one part of this component the
              // browser renders and `labels` can't reach. BCP-47 lowercase.
              lang={props.language ? props.language.toLowerCase() : undefined}
              className={`propeller-delivery-date__input w-full border rounded-control px-3 py-2 text-sm focus:outline-none focus:ring-2 ${customDateError ? 'border-destructive focus:ring-destructive focus:border-destructive' : 'border-input focus:ring-secondary focus:border-secondary'}`}
              min={minDate}
              value={customDateValue}
              onChange={(event) => handleCustomDateChange(event.target.value)}
            />
            {customDateError ? (
              <p
                className="propeller-delivery-date__input-error text-sm text-destructive mt-2"
                role="alert"
              >
                {customDateError}
              </p>
            ) : null}
            <div className="propeller-delivery-date__modal-actions flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="propeller-delivery-date__cancel-btn px-4 py-2 text-sm font-medium text-foreground bg-surface-hover rounded-control hover:bg-muted transition-colors"
                onClick={() => closeModal()}
              >
                {getLabel(props.labels, 'cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DeliveryDate;
