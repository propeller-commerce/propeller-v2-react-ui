'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect, useMemo } from 'react';
import {
  FavoriteList,
  GraphQLClient,
  Contact,
  Customer,
} from '@propeller-commerce/propeller-sdk-v2';
import { useFavorites, type FavoriteListChange } from '../composables/react/useFavorites';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';
export type { FavoriteListFormData, FavoriteListChange } from '../composables/react/useFavorites';

export interface FavoriteListsProps {
  /** The authenticated user (Contact or Customer). Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /** The initialized GraphQL Client instance. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** Callback when a list is clicked (navigate to detail) */
  onListClick?: (listId: string | number) => void;

  /** Limit the number of lists shown (e.g. 3 = last 3 modified). undefined = show all */
  limit?: number;

  /** Displays the "Default" badge on the favorite list (default: true) */
  showDefaultIndicator?: boolean;

  /** Displays the last modified date on the favorite list (default: true) */
  showLastModified?: boolean;

  /** Displays number of products and clusters contained in the favorite list (default: true) */
  showItemsCount?: boolean;

  /** Displays edit/delete action buttons on each list (default: true) */
  showActions?: boolean;

  /** Displays create new favorite list button (default: true) */
  allowFavoriteListCreate?: boolean;

  /** Custom class name */
  className?: string;

  /** Format date function override. If not provided, dates are formatted as dd/mm/YYYY */
  formatDate?: (dateString: string) => string;

  /** Localization labels */
  labels?: {
    lastModified?: string;
    items?: string;
    products?: string;
    clusters?: string;
    defaultBadge?: string;
    editSave?: string;
    editCancel?: string;
    makeDefault?: string;
    deleteTitle?: string;
    deleteConfirm?: string;
    deleteWarning?: string;
    deleteButton?: string;
    cancelButton?: string;
    createTitle?: string;
    createButton?: string;
    createPlaceholder?: string;
    setAsDefault?: string;
    saveButton?: string;
    noLists?: string;
    noListsDescription?: string;
    createFirstList?: string;
    loading?: string;
    nameLabel?: string;
    editTooltip?: string;
    deleteTooltip?: string;
  };

  /** Action function triggered when creating a new favorite list. If not provided, the default action is executed */
  onCreate?: (favoriteListData: { name: string; isDefault: boolean }) => void;

  /** Action function triggered when editing a favorite list. If not provided, the default action is executed */
  onEdit?: (favoriteListId: string, favoriteListData: { name: string; isDefault: boolean }) => void;

  /** Action function triggered when deleting a favorite list. If not provided, the default action is executed */
  onDelete?: (favoriteListId: string) => void;

  /**
   * Called after any list mutation succeeds, with what it did.
   *
   * The argument is optional so existing zero-argument callbacks keep working.
   */
  onListChanged?: (change?: FavoriteListChange) => void;
}

/**
 * Lists the user's favorite lists with inline edit, delete and create-list
 * modals.
 *
 * @remarks Uses {@link useFavorites} for fetching and list CRUD operations.
 */
function FavoriteLists(rawProps: FavoriteListsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const {
    lists,
    loading,
    saving,
    editingListId,
    editListName,
    editSetAsDefault,
    newListName,
    newSetAsDefault,
    listToDelete,
    fetchLists,
    startEdit,
    cancelEdit,
    setEditListName,
    setEditSetAsDefault,
    setNewListName,
    setNewSetAsDefault,
    updateList,
    confirmDelete,
    deleteList,
    createList,
  } = useFavorites({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    onCreate: props.onCreate,
    onEdit: props.onEdit,
    onDelete: props.onDelete,
    onListChanged: props.onListChanged,
  });

  const [showCreateModal, setShowCreateModal] = useState(() => false);
  const [showDeleteModal, setShowDeleteModal] = useState(() => false);

  function formatDate(dateString: string): string {
    if (props.formatDate) return props.formatDate(dateString);
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    // Numeric day-first DD-MM-YYYY, consistent with the order components.
    return `${day}-${month}-${year}`;
  }

  function getProductCount(list: FavoriteList): number {
    const products = list.products;
    if (!products) return 0;
    if (products.itemsFound !== undefined) return products.itemsFound;
    if (products.items) return products.items.length;
    return 0;
  }

  function getClusterCount(list: FavoriteList): number {
    const clusters = list.clusters;
    if (!clusters) return 0;
    if (clusters.itemsFound !== undefined) return clusters.itemsFound;
    if (clusters.items) return clusters.items.length;
    return 0;
  }

  function getTotalCount(list: FavoriteList): number {
    return getProductCount(list) + getClusterCount(list);
  }


  const displayedLists = useMemo((): FavoriteList[] => {
    if (props.limit && props.limit > 0) {
      const sorted = [...lists].sort((a: FavoriteList, b: FavoriteList) => {
        const dateA = new Date(a.updatedAt || '').getTime();
        const dateB = new Date(b.updatedAt || '').getTime();
        return dateB - dateA;
      });
      return sorted.slice(0, props.limit);
    }
    return lists;
  }, [lists, props.limit]);

  useEffect(() => {
    if (props.user) {
      fetchLists();
    }
  }, [props.user]);

  function handleDeleteClick(list: FavoriteList) {
    confirmDelete(list);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    await deleteList();
    setShowDeleteModal(false);
  }

  function handleCancelDelete() {
    setShowDeleteModal(false);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  async function handleCreateList() {
    if (!newListName.trim() || saving) return;
    await createList(newListName, newSetAsDefault);
    setNewListName('');
    setNewSetAsDefault(false);
    closeCreateModal();
  }

  return (
    <div className={cn(`propeller-favorite-lists ${props.className || ''}`)} data-loading={loading ? 'true' : 'false'}>
      {props.allowFavoriteListCreate !== false &&
      !loading &&
      displayedLists.length > 0 ? (
        <div className="propeller-favorite-lists__toolbar flex justify-end mb-4">
          <button
            className="propeller-favorite-lists__create-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control text-primary-foreground bg-primary hover:bg-primary/80"
            onClick={(event) => {
              setShowCreateModal(true);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            {getLabel(props.labels, 'createButton', 'Create New List')}
          </button>
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-4">
          <div className="propeller-favorite-lists__skeleton border border-border rounded-container p-6 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-1/3 bg-border rounded" />
                <div className="h-4 w-1/4 bg-border rounded" />
                <div className="h-4 w-1/2 bg-border rounded" />
              </div>
            </div>
          </div>
          <div className="propeller-favorite-lists__skeleton border border-border rounded-container p-6 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-1/3 bg-border rounded" />
                <div className="h-4 w-1/4 bg-border rounded" />
                <div className="h-4 w-1/2 bg-border rounded" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {!loading ? (
        <>
          {displayedLists.length > 0 ? (
            <div className="propeller-favorite-lists__list space-y-4">
              {displayedLists?.map((list) => (
                <div
                  key={list.id}
                  onClick={(event) => {
                    if (editingListId !== String(list.id) && props.onListClick) {
                      props.onListClick(list.id);
                    }
                  }}
                  data-editing={editingListId === String(list.id) ? 'true' : 'false'}
                  data-default={list.isDefault ? 'true' : 'false'}
                  className={
                    'propeller-favorite-lists__item border border-border rounded-container p-6 hover:bg-surface-hover transition-colors' +
                    (editingListId !== String(list.id) && props.onListClick
                      ? ' cursor-pointer'
                      : '')
                  }
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {editingListId === String(list.id) ? (
                        <div className="propeller-favorite-lists__edit space-y-4">
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder={getLabel(props.labels, 'createPlaceholder', 'Enter list name')}
                              className="propeller-favorite-lists__input max-w-md block w-full rounded-control border border-input px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                              value={editListName}
                              onChange={(e) => {
                                setEditListName(e.target.value);
                              }}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              className="propeller-favorite-lists__checkbox rounded border-input"
                              id={`default-edit-${list.id}`}
                              checked={editSetAsDefault}
                              onChange={(e) => {
                                setEditSetAsDefault(e.target.checked);
                              }}
                            />
                            <label
                              className="propeller-favorite-lists__checkbox-label text-sm text-muted-foreground"
                              htmlFor={`default-edit-${list.id}`}
                            >
                              {getLabel(props.labels, 'makeDefault', 'Make default')}
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="propeller-favorite-lists__save-btn inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-control text-primary-foreground bg-primary hover:bg-primary/80 disabled:opacity-50"
                              onClick={(event) => updateList(String(list.id))}
                              disabled={!editListName.trim()}
                            >
                              {getLabel(props.labels, 'editSave', 'Save')}
                            </button>
                            <button
                              className="propeller-favorite-lists__cancel-btn inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-control border border-input text-foreground bg-card hover:bg-surface-hover"
                              onClick={(event) => cancelEdit()}
                            >
                              {getLabel(props.labels, 'editCancel', 'Cancel')}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {editingListId !== String(list.id) ? (
                        <div className="propeller-favorite-lists__display space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="propeller-favorite-lists__name text-xl font-semibold">{list.name}</span>
                            {props.showDefaultIndicator !== false && list.isDefault ? (
                              <span className="propeller-favorite-lists__default-badge inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {getLabel(props.labels, 'defaultBadge', 'Default')}
                              </span>
                            ) : null}
                          </div>
                          <div className="propeller-favorite-lists__meta flex items-center gap-4 text-sm text-muted-foreground">
                            {props.showLastModified !== false ? (
                              <div className="flex items-center gap-1">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                  <line x1="16" x2="16" y1="2" y2="6" />
                                  <line x1="8" x2="8" y1="2" y2="6" />
                                  <line x1="3" x2="21" y1="10" y2="10" />
                                </svg>
                                {getLabel(props.labels, 'lastModified', 'Last modified')}:{' '}
                                {formatDate(list.updatedAt)}
                              </div>
                            ) : null}
                            {props.showItemsCount !== false ? (
                              <div className="flex items-center gap-1">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M16.5 9.4 7.55 4.24" />
                                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                  <polyline points="3.29 7 12 12 20.71 7" />
                                  <line x1="12" x2="12" y1="22" y2="12" />
                                </svg>
                                {getTotalCount(list)}&nbsp;{getTotalCount(list) === 1
                                  ? getLabel(props.labels, 'itemSingular', 'item')
                                  : getLabel(props.labels, 'itemPlural', 'items')}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {props.showActions !== false && editingListId !== String(list.id) ? (
                      <div className="propeller-favorite-lists__actions flex gap-2">
                        <button
                          title={getLabel(props.labels, 'editTooltip', 'Edit')}
                          className="propeller-favorite-lists__edit-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(list);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          title={getLabel(props.labels, 'deleteTooltip', 'Delete')}
                          className="propeller-favorite-lists__delete-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(list);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {displayedLists.length === 0 ? (
            <div className="propeller-favorite-lists__empty border border-border rounded-container p-12 text-center space-y-4">
              <div className="propeller-favorite-lists__empty-icon-wrapper bg-surface-hover p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="propeller-favorite-lists__empty-icon text-foreground-subtle"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <div>
                <p className="propeller-favorite-lists__empty-title text-lg font-medium">{getLabel(props.labels, 'noLists', 'No favorite lists')}</p>
                <p className="propeller-favorite-lists__empty-message text-muted-foreground">
                  {getLabel(props.labels, 'noListsDescription', 'Start by creating a new list to save your items.')}
                </p>
              </div>
              {props.allowFavoriteListCreate !== false ? (
                <button
                  className="propeller-favorite-lists__create-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control text-primary-foreground bg-primary hover:bg-primary/80"
                  onClick={(event) => {
                    setShowCreateModal(true);
                  }}
                >
                  {getLabel(props.labels, 'createFirstList', 'Create your first list')}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      {showCreateModal ? (
        <div className="propeller-favorite-lists__create-modal fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="propeller-favorite-lists__create-modal-content bg-card p-6 rounded-container max-w-md w-full shadow-lg border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="propeller-favorite-lists__create-modal-title text-xl font-bold">{getLabel(props.labels, 'createTitle', 'Create New List')}</h3>
              <button
                className="propeller-favorite-lists__create-modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                onClick={(event) => {
                  closeCreateModal();
                }}
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="propeller-favorite-lists__input-label text-sm font-medium">{getLabel(props.labels, 'nameLabel', 'Name')}</label>
                <input
                  type="text"
                  className="propeller-favorite-lists__input block w-full rounded-control border border-input px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                  value={newListName}
                  onChange={(e) => {
                    setNewListName(e.target.value);
                  }}
                  placeholder={getLabel(props.labels, 'createPlaceholder', 'Enter list name')}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="create-set-default"
                  className="propeller-favorite-lists__checkbox rounded border-input"
                  checked={newSetAsDefault}
                  onChange={(e) => {
                    setNewSetAsDefault(e.target.checked);
                  }}
                />
                <label htmlFor="create-set-default" className="propeller-favorite-lists__checkbox-label text-sm text-muted-foreground">
                  {getLabel(props.labels, 'setAsDefault', 'Set as default favorite list')}
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="propeller-favorite-lists__cancel-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control border border-input text-foreground bg-card hover:bg-surface-hover"
                  onClick={(event) => {
                    closeCreateModal();
                  }}
                >
                  {getLabel(props.labels, 'cancelButton', 'Cancel')}
                </button>
                <button
                  className="propeller-favorite-lists__save-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control text-primary-foreground bg-primary hover:bg-primary/80 disabled:opacity-50"
                  onClick={(event) => handleCreateList()}
                  disabled={!newListName.trim()}
                >
                  {getLabel(props.labels, 'saveButton', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showDeleteModal && listToDelete ? (
        <div className="propeller-favorite-lists__delete-modal fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="propeller-favorite-lists__delete-modal-content bg-card p-6 rounded-container max-w-md w-full shadow-lg border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="propeller-favorite-lists__delete-modal-title text-xl font-bold">
                {getLabel(props.labels, 'deleteTitle', 'Delete Favorite List')}
              </h3>
              <button
                className="propeller-favorite-lists__delete-modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                onClick={(event) => handleCancelDelete()}
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <p className="propeller-favorite-lists__delete-prompt">
                {(() => {
                  // Full-sentence label with a {name} placeholder so the
                  // translation controls word order (Dutch strands the verb at
                  // the end). Split around {name} and bold the name in place.
                  const tpl = getLabel(props.labels, 'deleteConfirm', 'Are you sure you want to delete "{name}"?');
                  const [before, after = ''] = tpl.split('{name}');
                  return (
                    <>
                      {before}
                      <strong>{listToDelete?.name}</strong>
                      {after}
                    </>
                  );
                })()}
              </p>
              <p className="propeller-favorite-lists__delete-warning text-sm text-destructive">
                {getLabel(props.labels, 'deleteWarning', 'This action cannot be undone.')}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button
                className="propeller-favorite-lists__cancel-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control border border-input text-foreground bg-card hover:bg-surface-hover"
                onClick={(event) => handleCancelDelete()}
              >
                {getLabel(props.labels, 'cancelButton', 'Cancel')}
              </button>
              <button
                className="propeller-favorite-lists__confirm-delete-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-control text-destructive-foreground bg-destructive hover:bg-destructive/90"
                onClick={(event) => handleConfirmDelete()}
              >
                {getLabel(props.labels, 'deleteButton', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FavoriteLists;
