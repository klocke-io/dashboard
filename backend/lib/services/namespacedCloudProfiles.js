//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

import _ from 'lodash-es'
import httpErrors from 'http-errors'
import * as authorization from './authorization.js'
import cache from '../cache/index.js'
import { simplifyCloudProfile } from '../utils/index.js'
const { Forbidden } = httpErrors
const { getNamespacedCloudProfiles } = cache

export async function listForNamespace ({ user, namespace }) {
  const allowed = await authorization.canListNamespacedCloudProfiles(user, namespace)
  if (!allowed) {
    throw new Forbidden(`You are not allowed to list namespaced cloudprofiles in namespace ${namespace}`)
  }

  return getNamespacedCloudProfiles(namespace).map(simplifyCloudProfile)
}

export async function listAllNamespacedCloudProfiles ({ user }) {
  const allItems = getNamespacedCloudProfiles()

  const namespaces = _.uniq(allItems.map(item => item.metadata.namespace))

  const canListInNamespace = async namespace => [namespace, await authorization.canListNamespacedCloudProfiles(user, namespace)]
  const results = await Promise.all(namespaces.map(canListInNamespace))

  const allowedNamespaces = results
    .filter(([, allowed]) => allowed)
    .map(([namespace]) => namespace)

  return allItems
    .filter(item => allowedNamespaces.includes(item.metadata.namespace))
    .map(simplifyCloudProfile)
}
