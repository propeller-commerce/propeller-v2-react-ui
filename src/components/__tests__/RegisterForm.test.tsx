/**
 * RegisterForm — the optional password section.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import RegisterForm from '../RegisterForm';

const client = { execute: async () => ({ data: {} }), getConfig: () => ({ headers: {} }), updateConfig: () => {} } as never;

describe('RegisterForm — showPassword', () => {
  it('renders the password section by default', () => {
    const html = renderToString(<RegisterForm graphqlClient={client} showUserType="Customer" />);
    expect(html).toContain('id="register-password"');
    expect(html).toContain('id="register-confirmPassword"');
    expect(html).toContain('>Password</h3>');
  });

  it('leaves the password section out when showPassword is false', () => {
    const html = renderToString(<RegisterForm graphqlClient={client} showUserType="Customer" showPassword={false} />);
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('>Password</h3>');
  });
});
