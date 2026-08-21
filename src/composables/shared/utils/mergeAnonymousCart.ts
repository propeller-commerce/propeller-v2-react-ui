/**
 * mergeAnonymousCart — copies items from an anonymous cart into a target
 * (authenticated) cart by calling CartService.addItemToCart per item.
 *
 * Framework-agnostic.
 */

import type { Services } from '@propeller-commerce/propeller-v2-core-ui';
import type {
  Cart,
  CartMainItem,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';

/** Configuration object for {@link mergeAnonymousCart}. */
export interface MergeAnonymousCartConfig {
  /**
   * The Services bundle — pass `services` from `usePropellerContext()` / the
   * provider's value object. Replaces the previous `graphqlClient` field.
   */
  services: Services;
  /** The authenticated user's cart that anonymous items will be added to. */
  targetCartId: string;
  /** The anonymous cart from the store/state captured before authentication. */
  anonymousCart: Cart | null;
  /** Language code for the localised cart mutations. */
  language: string;
  /** Image search filters forwarded to each add-item call that hydrates media. */
  imageSearchFilters: MediaImageProductSearchInput;
  /** Image transformation filters forwarded to each add-item call that hydrates media. */
  imageVariantFilters: TransformationsInput;
}

/**
 * Copies every item from an anonymous cart into a target authenticated cart.
 *
 * @param cfg - The merge configuration.
 * @returns The latest cart returned by the final successful add, or `null` when
 *          the anonymous cart is empty, missing, or is itself the target.
 *
 * @remarks
 * Uses the {@link Services.cart} SDK service: each item is copied via a serial
 * `cart.addItemToCart` call (serial because every call returns the full cart,
 * so parallel calls would race). Child items and `notes` are forwarded when
 * present; individual failures are caught and logged without aborting the loop.
 */
export async function mergeAnonymousCart(
  cfg: MergeAnonymousCartConfig,
): Promise<Cart | null> {
  const items = cfg.anonymousCart?.items ?? [];
  if (!items.length) return null;
  // Skip if anonymous cart IS the target — guards against self-merge.
  if (
    cfg.anonymousCart?.cartId &&
    cfg.anonymousCart.cartId === cfg.targetCartId
  ) {
    return null;
  }

  const service = cfg.services.cart;
  let result: Cart | null = null;

  // Serial iteration: each call returns the full cart, so parallel races.
  for (const item of items as CartMainItem[]) {
    if (!item.productId || !item.quantity) continue;

    const childItems = item.childItems
      ?.filter((c: any) => c.productId)
      .map((c: any) => ({
        productId: c.productId,
        quantity: c.quantity ?? item.quantity,
      }));

    try {
      result = await service.addItemToCart({
        id: cfg.targetCartId,
        input: {
          productId: item.productId,
          quantity: item.quantity,
          ...(item.clusterId && { clusterId: item.clusterId }),
          ...(childItems && childItems.length > 0 && { childItems }),
          ...(item.notes && { notes: item.notes }),
        },
        language: cfg.language,
        imageSearchFilters: cfg.imageSearchFilters,
        imageVariantFilters: cfg.imageVariantFilters,
      });
    } catch (e) {
      console.error(
        '[mergeAnonymousCart] addItemToCart failed for productId=' +
        item.productId,
        e,
      );
    }
  }

  return result;
}
