'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState).
 * Must be rendered inside (or below) a Client Component boundary.
 */
import * as React from 'react';

import { useState } from 'react';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface PriceToggleProps {
  /**
   * Label text shown beside the toggle.
   * Defaults to 'Prices:'.
   */
  label?: string;

  /**
   * Controlled mode: current on/off state (true = incl. VAT).
   * When supplied, the component does not own its state — the parent does.
   * Pair with `onChange` to receive flips.
   */
  value?: boolean;

  /**
   * Controlled mode: notified on every flip with the new state.
   * Required when `value` is supplied. Optional otherwise (uncontrolled).
   */
  onChange?: (on: boolean) => void;

  /**
   * Uncontrolled mode: initial state of the toggle.
   * Ignored when `value` is supplied (controlled mode).
   * Defaults to true (incl. VAT).
   */
  initialState?: boolean;

  /**
   * @deprecated Use `onChange` instead. Alias kept for back-compat with
   * existing call sites; receives the same boolean as `onChange`.
   */
  inclExclVatSwitched?: (on: boolean) => void;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Translated labels keyed by the slugs used inside the component
   * (`pricesLabel`, `inclVat`, `exclVat`). Missing keys fall back to English. */
  labels?: Record<string, string>;
}

/**
 * Renders a switch toggling prices between incl./excl. VAT. Supports both
 * controlled (`value` + `onChange`) and uncontrolled (`initialState`) modes.
 */
function PriceToggle(props: PriceToggleProps) {
  const isControlled = props.value !== undefined;
  // Uncontrolled local state — only used when `value` isn't supplied.
  const [internal, setInternal] = useState<boolean>(props.initialState ?? true);
  const isOn = isControlled ? !!props.value : internal;
  const label = props.label || getLabel(props.labels, 'pricesLabel', 'Prices:');
  const statusText = isOn
    ? getLabel(props.labels, 'inclVat', 'Incl. VAT')
    : getLabel(props.labels, 'exclVat', 'Excl. VAT');

  function handleToggle(): void {
    const newValue = !isOn;
    if (!isControlled) {
      setInternal(newValue);
    }
    // Notify parent. Phase D.3: the package no longer dispatches a global
    // `priceToggleChanged` window event — coordinating tax-inclusive across
    // components is the host's job (via PriceContext or whatever store the
    // host uses). The host's onChange handler will update the store and the
    // PropellerProvider value will propagate `includeTax` reactively.
    props.onChange?.(newValue);
    props.inclExclVatSwitched?.(newValue);
  }

  return (
    <div
      className={cn(`propeller-price-toggle flex items-center gap-2 ${props.className || ''}`)}
      data-state={isOn ? 'on' : 'off'}
    >
      <span className="propeller-price-toggle__label hidden sm:inline text-xs">{label}</span>
      <button
        type="button"
        role="switch"
        className="propeller-price-toggle__switch hover:opacity-80 transition-opacity text-xs font-medium"
        aria-checked={isOn}
        onClick={handleToggle}
      >
        {statusText}
      </button>
    </div>
  );
}

export default PriceToggle;
