'use client';
/**
 * @rsc-blocked — Client-only component: takes an onClick handler.
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';
import { User } from 'lucide-react';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface LoginToOrderButtonProps {
  /**
   * Invoked when the button is clicked. The host owns navigation — the package
   * cannot know whether the app routes with a Next `<Link>`, a Vue router or a
   * plain redirect. When omitted the button still renders but does nothing.
   */
  onLoginClick?: () => void;

  /** Translated labels. Key: `loginToOrder`. */
  labels?: Record<string, string>;

  /** Extra classes appended to the button. */
  className?: string;
}

/**
 * Log-in call to action shown in place of add-to-cart.
 *
 * A semi-closed portal hides ordering from anonymous visitors. Rendering
 * nothing in that slot leaves a dead end, so callers swap in this button:
 * it occupies the same position as the add-to-cart control and sends the
 * visitor to the host's login route.
 */
export function LoginToOrderButton(props: LoginToOrderButtonProps) {
  return (
    <button
      type="button"
      className={cn(`propeller-login-to-order inline-flex items-center justify-center gap-2 h-10 px-4 w-full rounded-control bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity ${props.className || ''}`)}
      onClick={() => {
        if (props.onLoginClick) props.onLoginClick();
      }}
    >
      <User className="propeller-login-to-order__icon w-4 h-4" aria-hidden="true" />
      {getLabel(props.labels, 'loginToOrder', 'Log in to order')}
    </button>
  );
}

export default LoginToOrderButton;
