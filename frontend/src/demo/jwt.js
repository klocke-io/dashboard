//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

function base64UrlEncode (obj) {
  const json = JSON.stringify(obj)
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function buildDemoJwt (overrides = {}) {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode({
    id: 'demo@gardener.cloud',
    name: 'Demo User',
    email: 'demo@gardener.cloud',
    isAdmin: true,
    canListShootsAllNamespaces: true,
    iat: now,
    exp: now + 60 * 60 * 24 * 365,
    rti: 'demo-rti',
    refresh_at: now + 60 * 60 * 24 * 30,
    ...overrides,
  })
  return `${header}.${payload}.demo`
}
