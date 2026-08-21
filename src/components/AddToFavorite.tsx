'use client';
/**
 * @rsc-blocked — Client-only component: browser-only APIs (window/document/storage).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */

import { useState, useEffect } from 'react';
import type {
  FavoriteList,
  GraphQLClient,
  Contact,
  Customer,
} from '@propeller-commerce/propeller-sdk-v2';
import { useFavorites } from '../composables/react/useFavorites';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

/** Which way the favorite toggle went — see `onFavoriteChanged`. */
export interface FavoriteChange {
  action: 'added' | 'removed';
  listId?: string | number;
  productId?: number;
  clusterId?: number;
}

export interface AddToFavoriteProps {
  /** The initialized GraphQL Client instance. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The authenticated user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /** Product ID to add/remove from favorites (for products) */
  productId?: number;

  /** Cluster ID to add/remove from favorites (for clusters) */
  clusterId?: number;

  /** Extra CSS class applied to the root button */
  className?: string;

  /** UI string overrides */
  labels?: Record<string, string>;

  /** Called after a favorite list mutation (add/remove) succeeds */
  /**
   * Called after the favorite toggle succeeds, with which way it went.
   *
   * The argument is optional so existing zero-argument callbacks keep working.
   * Without it an add and a removal are indistinguishable, so a host cannot
   * report "added to wishlist" without inventing the direction — and a
   * wishlist metric that also counts removals is worse than none.
   */
  onFavoriteChanged?: (change?: FavoriteChange) => void;
}

/**
 * Favorite toggle button for a product or cluster: opens a modal to add the
 * item to one of the user's favorite lists or remove it from lists it belongs
 * to. Renders nothing when no user is present.
 *
 * @remarks Uses {@link useFavorites} for favorite-list operations.
 */
function AddToFavorite(rawProps: AddToFavoriteProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const { lists, addToList, removeFromList } = useFavorites({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
  });

  const [isOpen, setIsOpen] = useState(() => false);
  const [loading, setLoading] = useState(() => false);
  const [_isMounted, set_isMounted] = useState(() => false);
  const [selectedListId, setSelectedListId] = useState(() => '');
  const [memberListIds, setMemberListIds] = useState<Set<string>>(() => new Set<string>());


  function isProduct(): boolean {
    return !!props.productId;
  }

  function itemId(): number {
    return (props.productId || props.clusterId || 0) as number;
  }

  function isFavorited(): boolean {
    return memberListIds.size > 0;
  }

  function getMemberLists(): FavoriteList[] {
    return lists.filter((list: FavoriteList) => memberListIds.has(String(list.id)));
  }

  function getNonMemberLists(): FavoriteList[] {
    return lists.filter((list: FavoriteList) => !memberListIds.has(String(list.id)));
  }

  function toggleModal() {
    if (!props.user) return;
    if (!isOpen) {
      const nonMember = getNonMemberLists();
      if (nonMember.length > 0 && !selectedListId) {
        setSelectedListId(String(nonMember[0].id));
      }
    }
    setIsOpen(!isOpen);
  }

  function closeModal() {
    setIsOpen(false);
  }

  async function handleAddToList() {
    if (!selectedListId || loading) return;
    setLoading(true);
    try {
      await addToList(selectedListId, props.productId, props.clusterId);
      const newMemberIds = new Set(memberListIds);
      newMemberIds.add(String(selectedListId));
      setMemberListIds(newMemberIds);
      setSelectedListId('');
      setIsOpen(false);
      if (props.onFavoriteChanged) {
        props.onFavoriteChanged({
          action: 'added',
          listId: selectedListId,
          productId: props.productId,
          clusterId: props.clusterId,
        });
      }
    } catch (error) {
      console.error('Error adding to favorite list:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveFromList(listId: string) {
    if (loading) return;
    setLoading(true);
    try {
      await removeFromList(listId, props.productId, props.clusterId);
      const newMemberIds = new Set(memberListIds);
      newMemberIds.delete(String(listId));
      setMemberListIds(newMemberIds);
      setSelectedListId('');
      setIsOpen(false);
      if (props.onFavoriteChanged) {
        props.onFavoriteChanged({
          action: 'removed',
          listId,
          productId: props.productId,
          clusterId: props.clusterId,
        });
      }
    } catch (error) {
      console.error('Error removing from favorite list:', error);
    } finally {
      setLoading(false);
    }
  }

  function computeMemberListIds(): Set<string> {
    if (!props.user || !itemId()) return new Set<string>();
    const memberIds = new Set<string>();
    lists.forEach((list: FavoriteList) => {
      const productsRef = list?.products as
        | { items?: { productId?: number; clusterId?: number }[] }
        | undefined;
      const clustersRef = list?.clusters as
        | { items?: { clusterId?: number }[] }
        | undefined;
      if (isProduct()) {
        if (productsRef?.items?.some((item) => item.productId === itemId())) {
          memberIds.add(String(list.id));
        }
      } else {
        const inProducts = productsRef?.items?.some((item) => item.clusterId === itemId());
        const inClusters = clustersRef?.items?.some((item) => item.clusterId === itemId());
        if (inProducts || inClusters) {
          memberIds.add(String(list.id));
        }
      }
    });
    return memberIds;
  }

  useEffect(() => {
    set_isMounted(true);
  }, []);

  useEffect(() => {
    setMemberListIds(computeMemberListIds());
  }, [props.user, props.productId, props.clusterId, lists]);

  // Note: the previous build listened for a global `userLoggedIn` window
  // event and re-read the user from localStorage to refresh membership.
  // That cross-tab listener has been removed (Phase D.3 / D.4): the parent
  // AuthContext propagates user changes via the `user` prop, so the effect
  // above already re-runs and updates membership. A separately-tab login is
  // an edge case the SDK doesn't currently support cleanly anyway.

  return (
    <>
      {props.user ? (
        <>
          <div className="propeller-add-to-favorite relative inline-block" data-favorited={isFavorited() ? 'true' : 'false'}>
            <button
              type="button"
              onClick={(event) => toggleModal()}
              title={
                isFavorited()
                  ? getLabel(props.labels, 'removeFromFavorites', 'Remove from favorites')
                  : getLabel(props.labels, 'addToFavorites', 'Add to favorites')
              }
              className={cn(`propeller-add-to-favorite__btn inline-flex items-center justify-center rounded-control border p-2.5 transition-colors ${isFavorited() ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10' : 'border-border bg-card text-foreground-subtle hover:text-primary hover:border-primary/30 hover:bg-primary/5'} ${props.className || ''}`)}
            >
              {isFavorited() ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              ) : null}
              {!isFavorited() ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              ) : null}
            </button>
            {isOpen && _isMounted ? (
              <div className="propeller-add-to-favorite__modal fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="propeller-add-to-favorite__modal-content bg-card rounded-container max-w-md w-full shadow-lg border border-border">
                  <div className="propeller-add-to-favorite__modal-header flex justify-between items-center p-6 pb-4">
                    <h3 className="propeller-add-to-favorite__modal-title text-xl font-bold">
                      {getLabel(props.labels, 'modalTitle', 'Favorite product?')}
                    </h3>
                    <button
                      type="button"
                      className="propeller-add-to-favorite__modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                      onClick={(event) => closeModal()}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="propeller-add-to-favorite__modal-body px-6 pb-6 space-y-4">
                    {getMemberLists().length > 0 ? (
                      <>
                        <div className="propeller-add-to-favorite__member-lists space-y-2">
                          {getMemberLists()?.map((list) => (
                            <button
                              type="button"
                              className="propeller-add-to-favorite__member-list-item flex items-center gap-2 py-2 w-full text-left hover:bg-surface-hover rounded-control px-1 transition-colors disabled:opacity-50"
                              key={list.id}
                              onClick={(event) => handleRemoveFromList(String(list.id))}
                              disabled={loading}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-primary flex-shrink-0"
                              >
                                <rect width="18" height="18" x="3" y="3" rx="2" />
                                <path d="m9 12 2 2 4-4" />
                              </svg>
                              <span className="text-sm font-medium">{list.name}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            className="propeller-add-to-favorite__submit-btn w-full py-2.5 px-4 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/80 rounded-control transition-colors disabled:opacity-50"
                            onClick={(event) => {
                              const memberLists = getMemberLists();
                              if (memberLists.length > 0) {
                                handleRemoveFromList(String(memberLists[0].id));
                              }
                            }}
                            disabled={loading}
                          >
                            {loading ? (
                              <>{getLabel(props.labels, 'removing', 'Removing...')}</>
                            ) : (
                              <>{getLabel(props.labels, 'removeFromFavorites', 'Remove from favorites')}</>
                            )}
                          </button>
                        </div>
                        <div className="propeller-add-to-favorite__divider border-t border-border" />
                      </>
                    ) : null}
                    {getNonMemberLists().length > 0 ? (
                      <div className="propeller-add-to-favorite__add-form space-y-3">
                        <div className="space-y-1">
                          <label className="propeller-add-to-favorite__select-label text-xs text-muted-foreground">
                            {getLabel(props.labels, 'chooseList', 'Choose a favorites list*')}
                          </label>
                          <select
                            className="propeller-add-to-favorite__select block w-full rounded-control border border-input px-3 py-2.5 text-sm focus:border-primary focus:ring-primary"
                            value={selectedListId}
                            onChange={(e) => {
                              setSelectedListId(e.target.value);
                            }}
                          >
                            {getNonMemberLists()?.map((list) => (
                              <option key={list.id} value={String(list.id)}>
                                {list.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="propeller-add-to-favorite__submit-btn w-full py-2.5 px-4 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/80 rounded-control transition-colors disabled:opacity-50"
                          onClick={(event) => handleAddToList()}
                          disabled={!selectedListId || loading}
                        >
                          {loading ? (
                            <>{getLabel(props.labels, 'adding', 'Adding...')}</>
                          ) : (
                            <>{getLabel(props.labels, 'addToFavorites', 'Add to favorites')}</>
                          )}
                        </button>
                      </div>
                    ) : null}
                    {getMemberLists().length === 0 && getNonMemberLists().length === 0 ? (
                      <div className="propeller-add-to-favorite__empty py-4 text-center text-muted-foreground text-sm">
                        {getLabel(props.labels, 'noLists', 'You have no favorite lists. Create one in your account first.')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

export default AddToFavorite;
