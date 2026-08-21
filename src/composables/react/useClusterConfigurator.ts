/**
 * useClusterConfigurator (React) — Cascading attribute selection state machine.
 */

import { useState, useMemo, useCallback } from 'react';
import type { Product, AttributeResult, ClusterConfig, ClusterConfigSetting } from '@propeller-commerce/propeller-sdk-v2';
import {
  attributeNameMatches,
  extractAttributeValues,
  filterProductsBySelections,
  collectAttributeValues,
  getAttributeDisplayName,
} from '@propeller-commerce/propeller-v2-core-ui';

/** A cluster-config setting resolved against the current product set and selections. */
export interface ConfiguredSetting {
  /** Setting id (uuid) from the cluster config. */
  id: string;
  /** Raw attribute name this setting selects on. */
  name: string;
  /** Display widget hint (e.g. dropdown, swatch). */
  displayType: string;
  /**
   * Source-of-truth attribute type from the underlying
   * `attributeDescription.type` (e.g. `COLOR`, `TEXT`, `INT`). PIMs sometimes
   * configure a setting with `displayType: 'COLOR'` even though the attribute
   * holds plain text — the configurator uses this field to decide whether a
   * value is actually a colour (render swatch) or just a label (render chip).
   * `undefined` when no product carries the attribute yet.
   */
  attributeType?: string;
  /** Sort priority — settings render in ascending order. */
  priority: string;
  /** Localized, human-readable label for the setting. */
  displayName: string;
  /** Attribute values still selectable given prior selections. */
  availableValues: string[];
  /** Currently selected value, or `''`. */
  selectedValue: string;
  /** `true` when no values are available or a preceding setting is unselected. */
  disabled: boolean;
}

/** Options for {@link useClusterConfigurator}. */
export interface UseClusterConfiguratorOptions {
  /** All product variants in the cluster being configured. */
  products: Product[];
  /** Cluster configuration describing the selectable attribute settings. */
  config: ClusterConfig;
  /** Language used to resolve attribute display names. Defaults to `'NL'`. */
  language?: string;
  /** Fires when a complete selection narrows to a single product variant. */
  onConfigurationChange?: (product: Product) => void;
}

/** Selection state and actions returned by {@link useClusterConfigurator}. */
export interface UseClusterConfiguratorReturn {
  /** Map of setting name to currently selected value. */
  selectedAttributes: Record<string, string>;
  /** The cluster settings resolved with available values and disabled state. */
  settingsWithValues: ConfiguredSetting[];
  /** Selects a value for a setting and cascades defaults onto later settings. */
  handleAttributeSelect: (settingName: string, value: string) => void;
  /** Seeds the selection from an existing product's attribute values. */
  initFromProduct: (product: Product) => void;
  /** Clears all selections. */
  reset: () => void;
}

/**
 * useClusterConfigurator — cascading attribute selection state machine.
 *
 * Drives a cluster variant picker: each setting's available values are filtered
 * by the selections made on higher-priority settings, and once every setting has
 * a value the matching product is surfaced via `onConfigurationChange`.
 *
 * @param options - see {@link UseClusterConfiguratorOptions}.
 * @returns selection state plus selection actions — see {@link UseClusterConfiguratorReturn}.
 */
export function useClusterConfigurator(
  options: UseClusterConfiguratorOptions
): UseClusterConfiguratorReturn {
  const { products, config, language = 'NL', onConfigurationChange } = options;

  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  function getSortedSettings(): ClusterConfigSetting[] {
    const settings = config?.settings;
    if (!settings?.length) return [];
    return settings.slice().sort((a, b) => parseInt(a.priority) - parseInt(b.priority));
  }

  function getAvailableValuesForIndexWithSelections(
    attributeName: string,
    settingIndex: number,
    selections: Record<string, string>
  ): string[] {
    if (settingIndex === 0) return collectAttributeValues(products, attributeName);
    const sortedSettings = getSortedSettings();
    const previousSelections: Record<string, string> = {};
    for (let i = 0; i < settingIndex; i++) {
      const prev = sortedSettings[i];
      if (selections[prev.attributeName]) previousSelections[prev.attributeName] = selections[prev.attributeName];
    }
    const matching = filterProductsBySelections(products, previousSelections);
    return collectAttributeValues(matching, attributeName);
  }

  const settingsWithValues = useMemo<ConfiguredSetting[]>(() => {
    const sortedSettings = getSortedSettings();
    const sel = selectedAttributes;
    return sortedSettings.map((setting, index) => {
      const availableValues = getAvailableValuesForIndexWithSelections(setting.attributeName, index, sel);
      const selectedValue = sel[setting.attributeName] || '';
      const isPreviousMissing = index > 0 && sortedSettings.slice(0, index).some((prev) => !sel[prev.attributeName]);
      const isDisabled = availableValues.length === 0 || isPreviousMissing;
      let displayName = setting.attributeName;
      let attributeType: string | undefined;
      // Look across all products, not just the first — different variants
      // may omit an attribute, and the first product happens not to carry
      // the type/description we need.
      for (const product of products) {
        const items = product.attributes?.items as AttributeResult[] | undefined;
        if (!items) continue;
        const match = items.find((a) => attributeNameMatches(a, setting.attributeName));
        if (!match) continue;
        displayName = getAttributeDisplayName(match, language) || setting.attributeName;
        attributeType = (match.attributeDescription?.type ?? undefined) as string | undefined;
        break;
      }
      return { id: setting.uuid, name: setting.attributeName, displayType: setting.displayType as string, attributeType, priority: setting.priority, displayName, availableValues, selectedValue, disabled: isDisabled };
    });
  }, [products, config, selectedAttributes, language]);

  const handleAttributeSelect = useCallback(
    (settingName: string, value: string): void => {
      const sortedSettings = getSortedSettings();
      const changedIndex = sortedSettings.findIndex((s) => s.attributeName === settingName);
      if (changedIndex < 0) return;
      const newSelections: Record<string, string> = { ...selectedAttributes };
      newSelections[settingName] = value;
      for (let i = changedIndex + 1; i < sortedSettings.length; i++) delete newSelections[sortedSettings[i].attributeName];
      for (let i = changedIndex + 1; i < sortedSettings.length; i++) {
        const next = sortedSettings[i];
        const available = getAvailableValuesForIndexWithSelections(next.attributeName, i, newSelections);
        if (available.length > 0) { newSelections[next.attributeName] = available[0]; } else { break; }
      }
      setSelectedAttributes(newSelections);
      const allSelected = sortedSettings.every((s) => !!newSelections[s.attributeName]);
      if (allSelected) {
        const matching = filterProductsBySelections(products, newSelections);
        if (matching.length > 0 && onConfigurationChange) onConfigurationChange(matching[0]);
      }
    },
    [products, config, selectedAttributes, onConfigurationChange]
  );

  const initFromProduct = useCallback(
    (product: Product): void => {
      const sortedSettings = getSortedSettings();
      if (!sortedSettings.length) return;
      const attrItems = product.attributes?.items as AttributeResult[] | undefined;
      if (!attrItems) return;
      const initial: Record<string, string> = {};
      for (const setting of sortedSettings) {
        const match = attrItems.find((a) => attributeNameMatches(a, setting.attributeName));
        if (match) { const values = extractAttributeValues(match); if (values.length) initial[setting.attributeName] = values[0]; }
      }
      if (!Object.keys(initial).length) return;
      setSelectedAttributes(initial);
      const allSelected = sortedSettings.every((s) => !!initial[s.attributeName]);
      if (allSelected && onConfigurationChange) {
        const matching = filterProductsBySelections(products, initial);
        if (matching.length > 0) onConfigurationChange(matching[0]);
      }
    },
    [products, config, onConfigurationChange]
  );

  const reset = useCallback(() => setSelectedAttributes({}), []);

  return { selectedAttributes, settingsWithValues, handleAttributeSelect, initFromProduct, reset };
}
