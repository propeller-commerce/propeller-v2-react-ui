/**
 * useFavorites (React) — Favorite list CRUD with optimistic updates.
 *
 * Responsibilities:
 * - fetchLists: read favoriteLists from Contact/Customer (no separate SDK call needed)
 * - createList: FavoriteListService.createFavoriteList with contactId/customerId from user
 * - updateList / deleteList: FavoriteListService CRUD
 * - addToList / removeFromList: FavoriteListService item management
 * - isProductInList: check products.items for a given productId
 */

import { useState, useCallback, useEffect } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import type { GraphQLClient, FavoriteList, FavoriteListsCreateInput, Product } from '@propeller-commerce/propeller-sdk-v2';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';
import { isContact, isCustomer } from '@propeller-commerce/propeller-v2-core-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Editable fields of a favorite list. */
export interface FavoriteListFormData {
  /** List display name. */
  name: string;
  /** Whether the list is the user's default. */
  isDefault: boolean;
}

/** Options for {@link useFavorites}. */
/** What a favorite-list mutation did — see `onListChanged`. */
export interface FavoriteListChange {
  action: 'created' | 'updated' | 'deleted';
  listId?: string | number;
  name?: string;
  isDefault?: boolean;
}

export interface UseFavoritesOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; favorite lists are read off this object. */
  user: AnyUser;
  /** Language for list operations. */
  language?: string;
  /** Override: fires instead of the default `createFavoriteList` call. */
  onCreate?: (data: FavoriteListFormData) => void;
  /** Override: fires instead of the default `updateFavoriteList` call. */
  onEdit?: (id: string, data: FavoriteListFormData) => void;
  /** Override: fires instead of the default `deleteFavoriteList` call. */
  onDelete?: (id: string) => void;
  /** Fires after any list create / update / delete completes. */
  /**
   * Called after a list mutation succeeds.
   *
   * The `change` argument is optional so existing zero-argument callbacks keep
   * working, but without it a host cannot tell a create from a delete — which
   * makes the hook useless for analytics, audit trails or optimistic UI that
   * needs to know WHAT happened rather than merely THAT something did.
   */
  onListChanged?: (change?: FavoriteListChange) => void;
}

/** State and favorite-list actions returned by {@link useFavorites}. */
export interface UseFavoritesReturn {
  /** The user's favorite lists. */
  lists: FavoriteList[];
  /** Always `false` — lists are read synchronously from the user object. */
  loading: boolean;
  /** `true` while a create / update / delete call is in flight. */
  saving: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Id of the list currently being edited, or `null`. */
  editingListId: string | null;
  /** Working copy of the edited list's name. */
  editListName: string;
  /** Working copy of the edited list's default flag. */
  editSetAsDefault: boolean;
  /** Draft name for a new list. */
  newListName: string;
  /** Draft default flag for a new list. */
  newSetAsDefault: boolean;
  /** List staged for deletion confirmation, or `null`. */
  listToDelete: FavoriteList | null;
  /** Re-reads the lists from the current user object. */
  fetchLists: () => void;
  /** Enters edit mode for a list, seeding the edit fields. */
  startEdit: (list: FavoriteList) => void;
  /** Exits edit mode and clears the edit fields. */
  cancelEdit: () => void;
  /** Sets the working edit name. */
  setEditListName: (name: string) => void;
  /** Sets the working edit default flag. */
  setEditSetAsDefault: (v: boolean) => void;
  /** Sets the draft name for a new list. */
  setNewListName: (name: string) => void;
  /** Sets the draft default flag for a new list. */
  setNewSetAsDefault: (v: boolean) => void;
  /** Persists the in-progress edit to the given list id. */
  updateList: (listId: string) => Promise<void>;
  /** Stages a list for delete confirmation. */
  confirmDelete: (list: FavoriteList) => void;
  /** Deletes the staged list, with optimistic removal and rollback on failure. */
  deleteList: () => Promise<void>;
  /** Creates a new favorite list. */
  createList: (name: string, isDefault: boolean) => Promise<void>;
  /** Adds a product and/or cluster to a list. */
  addToList: (listId: string, productId?: number, clusterId?: number) => Promise<void>;
  /** Removes one or more products/clusters from a list. */
  removeFromList: (
    listId: string,
    productId?: number | number[],
    clusterId?: number | number[],
  ) => Promise<void>;
  /** `true` when the list already contains the given product id. */
  isProductInList: (listId: string, productId: number) => boolean;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useFavorites — favorite-list CRUD with optimistic updates.
 *
 * @param options - see {@link UseFavoritesOptions}.
 * @returns list state, edit-form state and async actions — see {@link UseFavoritesReturn}.
 *
 * @remarks
 * GraphQL integration: all mutations go through `services.favoriteList`
 * (`FavoriteListService`), built per-call via `createServices(graphqlClient)`.
 * `fetchLists` is local-only — it reads `user.favoriteLists.items` and makes no API
 * call. `createList` calls `createFavoriteList` (with `contactId`/`customerId` from
 * the user); `updateList` calls `updateFavoriteList`; `deleteList` calls
 * `deleteFavoriteList` (optimistically removing the list and re-adding it on error);
 * `addToList` / `removeFromList` call `addFavoriteListItems` / `removeFavoriteListItems`.
 * Setting a list as default first clears the previous default via `updateFavoriteList`.
 * All mutations require an authenticated session; any `on*` callback fully overrides
 * its default API call.
 */
export function useFavorites(options: UseFavoritesOptions): UseFavoritesReturn {
  const { graphqlClient, user, onCreate, onEdit, onDelete, onListChanged } = options;

  const [lists, setLists] = useState<FavoriteList[]>([]);
  // fetchLists reads synchronously from the user object — no async loading needed.
  const loading = false;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editSetAsDefault, setEditSetAsDefault] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newSetAsDefault, setNewSetAsDefault] = useState(false);
  const [listToDelete, setListToDelete] = useState<FavoriteList | null>(null);

  // ── Fetch lists ───────────────────────────────────────────────────────────
  // Reads favoriteLists from the user object directly.

  const fetchLists = useCallback(() => {
    if (!user) { setLists([]); return; }
    const items = user.favoriteLists?.items ?? [];
    setLists(items);
  }, [user]);

  // Auto-sync lists from user whenever user changes (covers initial mount).
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // ── Edit state helpers ────────────────────────────────────────────────────

  const startEdit = useCallback((list: FavoriteList) => {
    setEditingListId(String(list.id));
    setEditListName(list.name);
    setEditSetAsDefault(list.isDefault || false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingListId(null);
    setEditListName('');
    setEditSetAsDefault(false);
  }, []);

  // ── Update list ───────────────────────────────────────────────────────────

  const updateList = useCallback(
    async (listId: string): Promise<void> => {
      const data: FavoriteListFormData = { name: editListName, isDefault: editSetAsDefault };
      if (onEdit) { onEdit(listId, data); cancelEdit(); onListChanged?.({ action: 'updated', listId, ...data }); return; }
      setSaving(true);
      try {
        const service = createServices(graphqlClient).favoriteList;
        if (data.isDefault) {
          const currentDefault = lists.find((l) => l.isDefault && String(l.id) !== listId);
          if (currentDefault) {
            await service.updateFavoriteList(String(currentDefault.id), { name: currentDefault.name, isDefault: false });
          }
        }
        const updated = await service.updateFavoriteList(listId, { name: data.name, isDefault: data.isDefault });
        setLists((prev) => prev.map((l) => String(l.id) === listId ? updated : l));
        cancelEdit();
        onListChanged?.({ action: 'updated', listId, name: data.name, isDefault: data.isDefault });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to update list');
      } finally {
        setSaving(false);
      }
    },
    [graphqlClient, editListName, editSetAsDefault, lists, onEdit, onListChanged, cancelEdit]
  );

  // ── Delete list ───────────────────────────────────────────────────────────

  const confirmDelete = useCallback((list: FavoriteList) => setListToDelete(list), []);

  const deleteList = useCallback(async (): Promise<void> => {
    if (!listToDelete) return;
    const list = listToDelete;
    const listId = String(list.id);
    if (onDelete) { onDelete(listId); setListToDelete(null); onListChanged?.({ action: 'deleted', listId, name: list.name }); return; }
    setSaving(true);
    setLists((prev) => prev.filter((l) => String(l.id) !== listId));
    setListToDelete(null);
    try {
      const service = createServices(graphqlClient).favoriteList;
      await service.deleteFavoriteList(listId);
      onListChanged?.({ action: 'deleted', listId, name: list.name });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete list');
      setLists((prev) => [...prev, list]);
    } finally {
      setSaving(false);
    }
  }, [graphqlClient, listToDelete, onDelete, onListChanged]);

  // ── Create list ───────────────────────────────────────────────────────────
  // Passes contactId/customerId from the user.

  const createList = useCallback(
    async (name: string, isDefault: boolean): Promise<void> => {
      const data: FavoriteListFormData = { name, isDefault };
      if (onCreate) { onCreate(data); onListChanged?.({ action: 'created', name, isDefault }); return; }
      setSaving(true);
      try {
        const service = createServices(graphqlClient).favoriteList;
        if (isDefault) {
          const currentDefault = lists.find((l) => l.isDefault);
          if (currentDefault) {
            await service.updateFavoriteList(String(currentDefault.id), { name: currentDefault.name, isDefault: false });
          }
        }
        const createInput: FavoriteListsCreateInput = { name, isDefault };
        if (isContact(user)) createInput.contactId = user.contactId;
        if (isCustomer(user)) createInput.customerId = user.customerId;
        const created = await service.createFavoriteList(createInput);
        setLists((prev) => [...prev, created]);
        onListChanged?.({ action: 'created', listId: created?.id, name, isDefault });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to create list');
      } finally {
        setSaving(false);
      }
    },
    [graphqlClient, user, lists, onCreate, onListChanged]
  );

  // ── Add / remove items ────────────────────────────────────────────────────

  const addToList = useCallback(
    async (listId: string, productId?: number, clusterId?: number): Promise<void> => {
      try {
        const service = createServices(graphqlClient).favoriteList;
        const updated = await service.addFavoriteListItems(listId, {
          ...(productId && { productIds: [productId] }),
          ...(clusterId && { clusterIds: [clusterId] }),
        });
        setLists((prev) => prev.map((l) => String(l.id) === listId ? updated : l));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to add to list');
      }
    },
    [graphqlClient]
  );

  const removeFromList = useCallback(
    async (
      listId: string,
      productId?: number | number[],
      clusterId?: number | number[],
    ): Promise<void> => {
      const productIds = productId === undefined ? [] : Array.isArray(productId) ? productId : [productId];
      const clusterIds = clusterId === undefined ? [] : Array.isArray(clusterId) ? clusterId : [clusterId];
      if (productIds.length === 0 && clusterIds.length === 0) return;
      try {
        const service = createServices(graphqlClient).favoriteList;
        const updated = await service.removeFavoriteListItems(listId, {
          ...(productIds.length && { productIds }),
          ...(clusterIds.length && { clusterIds }),
        });
        setLists((prev) => prev.map((l) => String(l.id) === listId ? updated : l));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to remove from list');
      }
    },
    [graphqlClient]
  );

  // ── Check product in list ─────────────────────────────────────────────────
  // list.products is ProductsResponse; items are IBaseProduct but runtime Product.

  const isProductInList = useCallback(
    (listId: string, productId: number): boolean => {
      const list = lists.find((l) => String(l.id) === listId);
      if (!list) return false;
      return (list.products?.items ?? []).some((p) => (p as Product).productId === productId);
    },
    [lists]
  );

  return {
    lists, loading, saving, error,
    editingListId, editListName, editSetAsDefault,
    newListName, newSetAsDefault, listToDelete,
    fetchLists, startEdit, cancelEdit,
    setEditListName, setEditSetAsDefault, setNewListName, setNewSetAsDefault,
    updateList, confirmDelete, deleteList, createList,
    addToList, removeFromList, isProductInList,
  };
}
