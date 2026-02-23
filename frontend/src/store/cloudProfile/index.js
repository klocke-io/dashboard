//
// SPDX-FileCopyrightText: 2023 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

import {
  defineStore,
  acceptHMRUpdate,
} from 'pinia'
import {
  ref,
  computed,
} from 'vue'

import { useConfigStore } from '@/store/config'

import { useApi } from '@/composables/useApi'

import { getCloudProfileSpec } from '@/utils'

import filter from 'lodash/filter'
import sortBy from 'lodash/sortBy'
import uniq from 'lodash/uniq'
import map from 'lodash/map'
import find from 'lodash/find'

export const useCloudProfileStore = defineStore('cloudProfile', () => {
  const api = useApi()

  const configStore = useConfigStore()

  const list = ref(null)
  const namespacedList = ref(null)

  const isInitial = computed(() => {
    return list.value === null
  })

  const isNamespacedInitial = computed(() => {
    return namespacedList.value === null
  })

  const cloudProfileList = computed(() => {
    return list.value
  })

  const namespacedCloudProfileList = computed(() => {
    return namespacedList.value
  })

  async function fetchCloudProfiles () {
    const response = await api.getCloudProfiles()
    setCloudProfiles(response.data)
  }

  async function fetchNamespacedCloudProfiles (namespace) {
    // When namespace is provided: fetch profiles for that specific project namespace.
    // When omitted: fetch across all namespaces the user has access to (admin path).
    const response = namespace
      ? await api.getNamespacedCloudProfiles({ namespace })
      : await api.getAllNamespacedCloudProfiles()
    setNamespacedCloudProfiles(response.data)
  }

  function setCloudProfiles (cloudProfiles) {
    list.value = cloudProfiles
  }

  function setNamespacedCloudProfiles (namespacedCloudProfiles) {
    namespacedList.value = namespacedCloudProfiles
  }

  const infraProviderTypesList = computed(() => {
    const regularTypes = map(list.value, 'spec.type')
    const namespacedTypes = map(namespacedList.value ?? [], profile => getCloudProfileSpec(profile).type)
    return uniq([...regularTypes, ...namespacedTypes])
  })

  const sortedInfraProviderTypeList = computed(() => {
    const infraProviderVendors = map(infraProviderTypesList.value, configStore.vendorDetails)
    const sortedVisibleInfraVendors = sortBy(infraProviderVendors, 'weight')
    return map(sortedVisibleInfraVendors, 'name')
  })

  function cloudProfilesByProviderType (providerType) {
    const regularProfiles = filter(list.value, item => item.spec.type === providerType)
    const namespacedProfiles = filter(namespacedList.value ?? [], item =>
      getCloudProfileSpec(item).type === providerType,
    )
    return sortBy([...regularProfiles, ...namespacedProfiles], 'metadata.name')
  }

  /**
   * Resolves a cloudProfileRef to its full cloud profile object.
   *
   * Handles both:
   * - `{ kind: 'CloudProfile', name }` — looks up in the regular CloudProfile list
   * - `{ kind: 'NamespacedCloudProfile', name, namespace }` — looks up in the namespaced list
   *   by both name and namespace. If no namespace is provided in the ref, falls back to
   *   matching by name only (first match across all namespaces).
   *
   * @param {Object|null} cloudProfileRef
   * @returns {Object|null} The matching cloud profile object, or null if not found
   */
  function cloudProfileByRef (cloudProfileRef) {
    if (!cloudProfileRef) {
      return null
    }
    if (cloudProfileRef.kind === 'NamespacedCloudProfile') {
      if (cloudProfileRef.namespace) {
        return find(namespacedList.value, item =>
          item.metadata.name === cloudProfileRef.name &&
          item.metadata.namespace === cloudProfileRef.namespace,
        ) ?? null
      }
      // Fallback: match by name only (no namespace in ref)
      return find(namespacedList.value, ['metadata.name', cloudProfileRef.name]) ?? null
    }
    if (cloudProfileRef.kind === 'CloudProfile') {
      return find(list.value, ['metadata.name', cloudProfileRef.name]) ?? null
    }
    return null
  }

  return {
    list,
    namespacedList,
    isInitial,
    isNamespacedInitial,
    cloudProfileList,
    namespacedCloudProfileList,
    setCloudProfiles,
    setNamespacedCloudProfiles,
    fetchCloudProfiles,
    fetchNamespacedCloudProfiles,
    cloudProfilesByProviderType,
    sortedInfraProviderTypeList,
    cloudProfileByRef,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCloudProfileStore, import.meta.hot))
}
