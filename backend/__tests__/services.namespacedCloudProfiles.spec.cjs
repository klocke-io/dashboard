//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

jest.mock('../dist/lib/cache', () => {
  const namespacedCloudProfileList = [
    {
      metadata: {
        name: 'custom-cloudprofile-1',
        namespace: 'garden-local',
        uid: 1001,
      },
      spec: {
        parent: {
          kind: 'CloudProfile',
          name: 'local',
        },
      },
      status: {
        cloudProfileSpec: {
          type: 'local',
          kubernetes: {
            versions: [{ version: '1.31.1' }],
          },
        },
      },
    },
    {
      metadata: {
        name: 'custom-cloudprofile-2',
        namespace: 'garden-local',
        uid: 1002,
      },
      spec: {
        parent: {
          kind: 'CloudProfile',
          name: 'infra1-profileName',
        },
      },
      status: {
        cloudProfileSpec: {
          type: 'infra1',
          kubernetes: {
            versions: [{ version: '1.31.1' }],
          },
        },
      },
    },
    {
      metadata: {
        name: 'custom-cloudprofile-3',
        namespace: 'garden-dev',
        uid: 1003,
      },
      spec: {
        parent: {
          kind: 'CloudProfile',
          name: 'infra2-profileName',
        },
      },
      status: {
        cloudProfileSpec: {
          type: 'infra2',
          kubernetes: {
            versions: [{ version: '1.31.1' }],
          },
        },
      },
    },
  ]

  return {
    getNamespacedCloudProfiles: jest.fn((namespace) => {
      if (namespace) {
        return namespacedCloudProfileList.filter(item => item.metadata.namespace === namespace)
      }
      return namespacedCloudProfileList
    }),
  }
})

jest.mock('../dist/lib/services/authorization')

describe('services/namespacedCloudProfiles', () => {
  const { Forbidden } = require('http-errors')
  const namespacedCloudProfiles = require('../dist/lib/services/namespacedCloudProfiles')
  const authorization = require('../dist/lib/services/authorization')

  const createUser = (username) => {
    return {
      id: username,
      type: 'email',
    }
  }

  describe('#listForNamespace', () => {
    it('should return namespaced cloudprofiles for a namespace when user is authorized', async () => {
      const user = createUser('foo@example.org')
      const namespace = 'garden-local'

      authorization.canListNamespacedCloudProfiles.mockResolvedValueOnce(true)

      const result = await namespacedCloudProfiles.listForNamespace({ user, namespace })

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledWith(user, namespace)
      expect(result).toHaveLength(2)
      expect(result[0].metadata.name).toBe('custom-cloudprofile-1')
      expect(result[1].metadata.name).toBe('custom-cloudprofile-2')
    })

    it('should throw Forbidden error when user is not authorized', async () => {
      const user = createUser('foo@example.org')
      const namespace = 'garden-local'

      authorization.canListNamespacedCloudProfiles.mockResolvedValueOnce(false)

      await expect(
        namespacedCloudProfiles.listForNamespace({ user, namespace }),
      ).rejects.toThrow(Forbidden)

      await expect(
        namespacedCloudProfiles.listForNamespace({ user, namespace }),
      ).rejects.toThrow(`You are not allowed to list namespaced cloudprofiles in namespace ${namespace}`)

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledWith(user, namespace)
    })
  })

  describe('#listAllNamespacedCloudProfiles', () => {
    it('should return all namespaced cloudprofiles from authorized namespaces', async () => {
      const user = createUser('foo@example.org')

      // Mock authorization: allow garden-local, deny garden-dev
      authorization.canListNamespacedCloudProfiles
        .mockResolvedValueOnce(true)  // garden-local
        .mockResolvedValueOnce(false) // garden-dev

      const result = await namespacedCloudProfiles.listAllNamespacedCloudProfiles({ user })

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledTimes(2)
      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledWith(user, 'garden-local')
      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledWith(user, 'garden-dev')

      // Should only return profiles from garden-local (authorized)
      expect(result).toHaveLength(2)
      expect(result[0].metadata.name).toBe('custom-cloudprofile-1')
      expect(result[0].metadata.namespace).toBe('garden-local')
      expect(result[1].metadata.name).toBe('custom-cloudprofile-2')
      expect(result[1].metadata.namespace).toBe('garden-local')
    })

    it('should return all namespaced cloudprofiles when user is authorized for all namespaces', async () => {
      const user = createUser('admin@example.org')

      // Mock authorization: allow both namespaces
      authorization.canListNamespacedCloudProfiles
        .mockResolvedValueOnce(true)  // garden-local
        .mockResolvedValueOnce(true)  // garden-dev

      const result = await namespacedCloudProfiles.listAllNamespacedCloudProfiles({ user })

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledTimes(2)

      // Should return all profiles
      expect(result).toHaveLength(3)
      expect(result[0].metadata.namespace).toBe('garden-local')
      expect(result[1].metadata.namespace).toBe('garden-local')
      expect(result[2].metadata.namespace).toBe('garden-dev')
    })

    it('should return empty array when user is not authorized for any namespace', async () => {
      const user = createUser('unauthorized@example.org')

      // Mock authorization: deny all namespaces
      authorization.canListNamespacedCloudProfiles
        .mockResolvedValueOnce(false)  // garden-local
        .mockResolvedValueOnce(false)  // garden-dev

      const result = await namespacedCloudProfiles.listAllNamespacedCloudProfiles({ user })

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(0)
    })

    it('should handle single namespace correctly', async () => {
      // Temporarily modify the mock to return only one namespace
      const cache = require('../dist/lib/cache')

      cache.getNamespacedCloudProfiles.mockImplementationOnce(() => [
        {
          metadata: {
            name: 'custom-cloudprofile-1',
            namespace: 'garden-local',
            uid: 1001,
          },
          spec: {
            parent: {
              kind: 'CloudProfile',
              name: 'local',
            },
          },
          status: {
            cloudProfileSpec: {
              type: 'local',
              kubernetes: {
                versions: [{ version: '1.31.1' }],
              },
            },
          },
        },
      ])

      const user = createUser('foo@example.org')

      authorization.canListNamespacedCloudProfiles.mockResolvedValueOnce(true)

      const result = await namespacedCloudProfiles.listAllNamespacedCloudProfiles({ user })

      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledTimes(1)
      expect(authorization.canListNamespacedCloudProfiles).toHaveBeenCalledWith(user, 'garden-local')
      expect(result).toHaveLength(1)
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})
