//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

import {
  projects,
  seeds,
  shoots,
  members,
  subjectRules,
  info,
  kubeconfigData,
  dashboardConfig,
  tickets,
  dashboardCloudProfiles,
  dashboardGardenerExtensions,
  dashboardCredentials,
} from './fixtures.js'
import { buildDemoJwt } from './jwt.js'

// eslint-disable-next-line no-console
const log = (...args) => console.debug('[demo-mock]', ...args)

function jsonResponse (data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data ?? null), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function notFound (resource = 'resource') {
  return jsonResponse({
    code: 404,
    reason: 'NotFound',
    message: `${resource} not found`,
  }, 404)
}

function findShoot (namespace, name) {
  return shoots.find(s => s.metadata.namespace === namespace && s.metadata.name === name)
}

function findProject (name) {
  return projects.find(p => p.metadata.name === name)
}

function listShootsForNamespace (namespace) {
  if (namespace === '_all' || namespace === 'all') {
    return shoots
  }
  return shoots.filter(s => s.metadata.namespace === namespace)
}

function applyShootPatch (shoot, patch) {
  if (!patch || typeof patch !== 'object') {
    return shoot
  }
  // shallow merge spec/metadata sub-objects
  if (patch.metadata) {
    shoot.metadata = { ...shoot.metadata, ...patch.metadata }
    if (patch.metadata.annotations) {
      shoot.metadata.annotations = { ...(shoot.metadata.annotations ?? {}), ...patch.metadata.annotations }
    }
    if (patch.metadata.labels) {
      shoot.metadata.labels = { ...(shoot.metadata.labels ?? {}), ...patch.metadata.labels }
    }
  }
  if (patch.spec) {
    shoot.spec = { ...shoot.spec, ...patch.spec }
  }
  return shoot
}

async function readJsonBody (request) {
  if (!request) {
    return null
  }
  try {
    const text = await request.clone().text()
    if (!text) {
      return null
    }
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function handleCloudProviderCredential (body) {
  const { method, params = {} } = body ?? {}
  const namespace = params.namespace
  switch (method) {
    case 'list': {
      const result = {
        infrastructure: {
          credentialsBindings: dashboardCredentials.credentialsBindings ?? [],
          secretBindings: dashboardCredentials.secretBindings ?? [],
          secrets: dashboardCredentials.secrets ?? [],
          quotas: dashboardCredentials.quotas ?? [],
          workloadIdentities: dashboardCredentials.workloadIdentities ?? [],
        },
        dns: {
          secretBindings: [],
          secrets: [],
        },
      }
      // Some clients call list/listInfra/etc. Filter by namespace if given.
      if (namespace) {
        const filterByNamespace = items => items.filter(item => {
          const ns = item?.metadata?.namespace
          return !ns || ns === namespace || ns === 'garden'
        })
        result.infrastructure.credentialsBindings = filterByNamespace(result.infrastructure.credentialsBindings)
        result.infrastructure.secretBindings = filterByNamespace(result.infrastructure.secretBindings)
        result.infrastructure.secrets = filterByNamespace(result.infrastructure.secrets)
        result.infrastructure.workloadIdentities = filterByNamespace(result.infrastructure.workloadIdentities)
      }
      return jsonResponse(result)
    }
    default:
      // generic create/update/delete echoes payload
      return jsonResponse({ ...params })
  }
}

async function handleTerminalCall (body) {
  const { method } = body ?? {}
  switch (method) {
    case 'list':
    case 'listProjectTerminalShortcuts':
      return jsonResponse([])
    case 'config':
      return jsonResponse({ container: { image: 'demo' } })
    case 'heartbeat':
      return jsonResponse({})
    default:
      return jsonResponse({})
  }
}

const ROUTES = [
  // GET endpoints
  { method: 'GET', test: u => u.pathname === '/api/config', handle: () => jsonResponse(dashboardConfig) },
  { method: 'GET', test: u => u.pathname === '/api/info', handle: () => jsonResponse(info) },
  { method: 'GET', test: u => u.pathname === '/api/cloudprofiles', handle: () => jsonResponse(dashboardCloudProfiles) },
  { method: 'GET', test: u => u.pathname === '/api/seeds', handle: () => jsonResponse(seeds) },
  { method: 'GET', test: u => u.pathname === '/api/projects', handle: () => jsonResponse(projects) },
  { method: 'GET', test: u => u.pathname === '/api/gardenerextensions', handle: () => jsonResponse(dashboardGardenerExtensions) },
  { method: 'GET', test: u => u.pathname === '/api/user/kubeconfig', handle: () => jsonResponse(kubeconfigData) },
  { method: 'GET', test: u => u.pathname === '/api/openapi', handle: () => jsonResponse({}) },
  { method: 'GET', test: u => u.pathname === '/api/namespaces/garden/managedseeds', handle: () => jsonResponse([]) },
  { method: 'GET', test: u => u.pathname === '/api/namespaces/garden/managedseed-shoots', handle: () => jsonResponse([]) },

  // namespace-scoped GETs
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots$/.test(u.pathname),
    handle: u => {
      const namespace = decodeURIComponent(u.pathname.split('/')[3])
      const items = listShootsForNamespace(namespace)
      return jsonResponse({ items })
    },
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots\/[^/]+$/.test(u.pathname),
    handle: u => {
      const parts = u.pathname.split('/')
      const namespace = decodeURIComponent(parts[3])
      const name = decodeURIComponent(parts[5])
      const shoot = findShoot(namespace, name)
      return shoot ? jsonResponse(shoot) : notFound('shoot')
    },
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots\/[^/]+\/info$/.test(u.pathname),
    handle: u => {
      const parts = u.pathname.split('/')
      const namespace = decodeURIComponent(parts[3])
      const name = decodeURIComponent(parts[5])
      const shoot = findShoot(namespace, name)
      if (!shoot) {
        return notFound('shoot')
      }
      return jsonResponse({
        ...shoot.info,
        cluster_identity: 'gardener-demo-landscape',
      })
    },
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/tickets$/.test(u.pathname),
    handle: () => jsonResponse({ issues: tickets.issues, comments: tickets.comments }),
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/tickets\/[^/]+$/.test(u.pathname),
    handle: () => jsonResponse({ issues: [], comments: [] }),
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/members$/.test(u.pathname),
    handle: () => jsonResponse(members),
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/members\/[^/]+$/.test(u.pathname),
    handle: u => {
      const parts = u.pathname.split('/')
      const name = decodeURIComponent(parts[5])
      const member = members.find(m => m.name === name || m.username === name)
      if (!member) {
        return notFound('member')
      }
      return jsonResponse({
        kubeconfig: '',
        ...member,
      })
    },
  },
  {
    method: 'GET',
    test: u => /^\/api\/namespaces\/[^/]+\/resourcequotas$/.test(u.pathname),
    handle: () => jsonResponse([]),
  },

  // POST endpoints
  {
    method: 'POST',
    test: u => u.pathname === '/api/cloudprovidercredentials',
    handle: async (u, request) => handleCloudProviderCredential(await readJsonBody(request)),
  },
  {
    method: 'POST',
    test: u => u.pathname === '/api/user/subjectrules',
    handle: () => jsonResponse(subjectRules),
  },
  {
    method: 'POST',
    test: u => u.pathname === '/api/terminals',
    handle: async (u, request) => handleTerminalCall(await readJsonBody(request)),
  },
  {
    method: 'POST',
    test: u => u.pathname === '/auth' || u.pathname === '/auth/token',
    handle: () => {
      // refresh token: rewrite cookie
      setDemoCookie()
      return jsonResponse({ ok: true })
    },
  },

  // mutation echoes
  {
    method: 'POST',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots$/.test(u.pathname),
    handle: async (u, request) => {
      const data = await readJsonBody(request)
      return jsonResponse({
        apiVersion: 'core.gardener.cloud/v1beta1',
        kind: 'Shoot',
        ...data,
        metadata: {
          uid: `shoot-new-${Date.now()}`,
          ...(data?.metadata ?? {}),
        },
        status: { conditions: [] },
      })
    },
  },
  {
    method: 'PUT',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots\/[^/]+/.test(u.pathname),
    handle: async (u, request) => {
      const parts = u.pathname.split('/')
      const namespace = decodeURIComponent(parts[3])
      const name = decodeURIComponent(parts[5])
      const shoot = findShoot(namespace, name)
      const data = await readJsonBody(request)
      if (shoot && data) {
        applyShootPatch(shoot, data)
      }
      return jsonResponse(shoot ?? data ?? {})
    },
  },
  {
    method: 'PATCH',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots\/[^/]+/.test(u.pathname),
    handle: async (u, request) => {
      const parts = u.pathname.split('/')
      const namespace = decodeURIComponent(parts[3])
      const name = decodeURIComponent(parts[5])
      const shoot = findShoot(namespace, name)
      const data = await readJsonBody(request)
      if (shoot && data) {
        applyShootPatch(shoot, data)
      }
      return jsonResponse(shoot ?? data ?? {})
    },
  },
  {
    method: 'DELETE',
    test: u => /^\/api\/namespaces\/[^/]+\/shoots\/[^/]+/.test(u.pathname),
    handle: u => {
      const parts = u.pathname.split('/')
      const namespace = decodeURIComponent(parts[3])
      const name = decodeURIComponent(parts[5])
      const shoot = findShoot(namespace, name)
      if (shoot) {
        shoot.metadata = {
          ...shoot.metadata,
          annotations: {
            ...(shoot.metadata.annotations ?? {}),
            'confirmation.gardener.cloud/deletion': 'true',
          },
          deletionTimestamp: new Date().toISOString(),
        }
      }
      return jsonResponse(shoot ?? {})
    },
  },

  // project mutations
  {
    method: 'POST',
    test: u => u.pathname === '/api/projects',
    handle: async (u, request) => jsonResponse(await readJsonBody(request) ?? {}),
  },
  {
    method: 'PUT',
    test: u => /^\/api\/projects\/[^/]+$/.test(u.pathname),
    handle: async (u, request) => {
      const name = decodeURIComponent(u.pathname.split('/').pop())
      const project = findProject(name)
      const data = await readJsonBody(request)
      if (project && data) {
        Object.assign(project, data)
      }
      return jsonResponse(project ?? data ?? {})
    },
  },
  {
    method: 'PATCH',
    test: u => /^\/api\/projects\/[^/]+$/.test(u.pathname),
    handle: async (u, request) => {
      const name = decodeURIComponent(u.pathname.split('/').pop())
      const project = findProject(name)
      const data = await readJsonBody(request)
      if (project && data) {
        if (data.metadata) {
          project.metadata = { ...project.metadata, ...data.metadata }
        }
        if (data.spec) {
          project.spec = { ...project.spec, ...data.spec }
        }
      }
      return jsonResponse(project ?? data ?? {})
    },
  },
  {
    method: 'DELETE',
    test: u => /^\/api\/projects\/[^/]+$/.test(u.pathname),
    handle: u => {
      const name = decodeURIComponent(u.pathname.split('/').pop())
      const project = projects.find(p => p.metadata.name === name) ?? null
      return jsonResponse(project ?? {})
    },
  },

  // member mutations
  {
    method: 'POST',
    test: u => /^\/api\/namespaces\/[^/]+\/members$/.test(u.pathname),
    handle: async (u, request) => {
      const data = await readJsonBody(request)
      return jsonResponse([...members, data].filter(Boolean))
    },
  },
  {
    method: 'PUT',
    test: u => /^\/api\/namespaces\/[^/]+\/members\/[^/]+$/.test(u.pathname),
    handle: async (u, request) => jsonResponse(await readJsonBody(request) ?? {}),
  },
  {
    method: 'POST',
    test: u => /^\/api\/namespaces\/[^/]+\/members\/[^/]+$/.test(u.pathname),
    handle: () => jsonResponse({}),
  },
  {
    method: 'DELETE',
    test: u => /^\/api\/namespaces\/[^/]+\/members\/[^/]+$/.test(u.pathname),
    handle: () => jsonResponse(members),
  },

  // OIDC login redirect — never used on demo
  {
    method: 'GET',
    test: u => u.pathname === '/auth' || u.pathname === '/login' || u.pathname === '/auth/logout',
    handle: () => jsonResponse({ ok: true }),
  },
]

function setDemoCookie () {
  const token = buildDemoJwt()
  const cookieName = '__Host-gHdrPyl'
  const isHttps = window.location.protocol === 'https:'
  if (isHttps) {
    document.cookie = `${cookieName}=${token}; Path=/; SameSite=Lax; Secure`
    return
  }
  // HTTP fallback: __Host- cookies cannot be set without Secure+HTTPS,
  // so we shim document.cookie so the app reads our value regardless.
  installCookieShim(cookieName, token)
}

function installCookieShim (cookieName, token) {
  if (window.__demoCookieShim) {
    window.__demoCookieShim.token = token
    return
  }
  const shim = { token, cookieName }
  window.__demoCookieShim = shim
  const proto = Object.getPrototypeOf(document)
  // Most browsers expose Document.prototype's cookie accessor.
  // eslint-disable-next-line no-undef
  let descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
  if (!descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(proto, 'cookie')
  }
  if (!descriptor || !descriptor.get || !descriptor.set) {
    // eslint-disable-next-line no-console
    console.warn('[demo-mock] could not install cookie shim')
    return
  }
  const realGet = descriptor.get.bind(document)
  const realSet = descriptor.set.bind(document)
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get () {
      const real = realGet()
      const entry = `${shim.cookieName}=${shim.token}`
      if (!real) {
        return entry
      }
      if (real.includes(`${shim.cookieName}=`)) {
        return real
      }
      return `${real}; ${entry}`
    },
    set (value) {
      // Allow overriding/clearing the demo cookie via document.cookie =
      const match = /^([^=]+)=([^;]*)/.exec(value ?? '')
      if (match && match[1].trim() === shim.cookieName) {
        shim.token = match[2]
      }
      realSet(value)
    },
  })
}

function findRoute (method, url) {
  for (const route of ROUTES) {
    if (route.method !== method) {
      continue
    }
    if (route.test(url)) {
      return route
    }
  }
  return null
}

function urlOfRequest (input) {
  if (typeof input === 'string') {
    try {
      return new URL(input)
    } catch {
      return new URL(input, window.location.origin)
    }
  }
  if (input instanceof URL) {
    return input
  }
  if (input instanceof Request) {
    return new URL(input.url)
  }
  return new URL(String(input), window.location.origin)
}

function methodOf (input, init) {
  if (init?.method) {
    return init.method.toUpperCase()
  }
  if (input instanceof Request) {
    return input.method.toUpperCase()
  }
  return 'GET'
}

export function installFetchMock () {
  setDemoCookie()
  const realFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    let url
    try {
      url = urlOfRequest(input)
    } catch (err) {
      return realFetch(input, init)
    }

    const method = methodOf(input, init)
    const isApiPath = url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')
    const isSameOrigin = url.origin === window.location.origin

    if (!isApiPath || !isSameOrigin) {
      return realFetch(input, init)
    }

    const route = findRoute(method, url)
    if (!route) {
      log('UNHANDLED', method, url.pathname)
      return jsonResponse({
        code: 404,
        reason: 'NotFound',
        message: `Mock route not found: ${method} ${url.pathname}`,
      }, 404)
    }

    try {
      const request = input instanceof Request ? input : new Request(url, init)
      const result = await route.handle(url, request)
      return result
    } catch (err) {
      log('error in mock route', err)
      return jsonResponse({
        code: 500,
        reason: 'InternalError',
        message: err.message,
      }, 500)
    }
  }
}
