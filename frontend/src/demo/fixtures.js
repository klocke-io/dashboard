//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

import cloudprofiles from '../../__fixtures__/cloudprofiles.js'
import gardenerExtensions from '../../__fixtures__/gardenerExtensions.js'
import config from '../../__fixtures__/config.js'
import credentials from '../../__fixtures__/credentials.js'

const PROJECTS = ['garden-demo', 'garden-trial']

function makeProject (name, namespace, opts = {}) {
  const {
    description = `${name} project`,
    purpose = 'demo',
    phase = 'Ready',
    owner = 'demo@gardener.cloud',
    members = [],
    costObject,
  } = opts
  const metadata = { name, resourceVersion: '42', uid: `proj-${name}` }
  if (costObject) {
    metadata.annotations = {
      'billing.gardener.cloud/costObject': costObject,
      'billing.gardener.cloud/costObjectType': 'CO',
    }
  }
  return {
    metadata,
    spec: {
      namespace,
      createdBy: { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: owner },
      owner: { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: owner },
      members: [
        {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'User',
          name: 'demo@gardener.cloud',
          role: 'admin',
          roles: ['owner', 'uam'],
        },
        ...members,
      ],
      purpose,
      description,
    },
    status: { phase },
  }
}

export const projects = [
  makeProject('demo', 'garden-demo', { costObject: '1234567890',
    purpose: 'production',
    members: [
      { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice@example.org', role: 'admin', roles: ['admin'] },
      { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'bob@example.org', role: 'viewer', roles: ['viewer'] },
      { apiGroup: 'rbac.authorization.k8s.io', kind: 'ServiceAccount', namespace: 'garden-demo', name: 'ci-bot', role: 'admin', roles: ['admin'] },
    ] }),
  makeProject('trial', 'garden-trial', { purpose: 'evaluation' }),
]

export const seeds = [
  {
    kind: 'Seed',
    metadata: { name: 'aws-eu-west-1', uid: 'seed-aws-1', labels: { 'seed.gardener.cloud/eu-west-1': 'true' } },
    spec: {
      provider: { type: 'aws', region: 'eu-west-1' },
      ingress: { domain: 'ingress.eu-west-1.aws.example.org' },
      taints: [],
      settings: { scheduling: { visible: true } },
    },
    status: {
      capacity: { shoots: '250' },
      allocatable: { shoots: '250' },
      conditions: [
        { type: 'GardenletReady', status: 'True', message: 'Gardenlet is posting ready status.' },
        { type: 'SeedSystemComponentsHealthy', status: 'True', message: 'All system components are healthy.' },
        { type: 'BackupBucketsReady', status: 'True', message: 'Backup buckets are available.' },
        { type: 'ExtensionsReady', status: 'True', message: 'All extensions are ready.' },
      ],
    },
  },
  {
    kind: 'Seed',
    metadata: { name: 'gcp-europe-west1', uid: 'seed-gcp-1', labels: { 'seed.gardener.cloud/europe-west1': 'true' } },
    spec: {
      provider: { type: 'gcp', region: 'europe-west1' },
      ingress: { domain: 'ingress.europe-west1.gcp.example.org' },
      taints: [],
      settings: { scheduling: { visible: true } },
    },
    status: {
      capacity: { shoots: '250' },
      allocatable: { shoots: '250' },
      conditions: [
        { type: 'GardenletReady', status: 'True', message: 'Gardenlet is healthy.' },
        { type: 'SeedSystemComponentsHealthy', status: 'True', message: 'All seed system components are healthy.' },
      ],
    },
  },
  {
    kind: 'Seed',
    metadata: { name: 'azure-westeurope', uid: 'seed-azure-1', labels: { 'seed.gardener.cloud/westeurope': 'true' } },
    spec: {
      provider: { type: 'azure', region: 'westeurope' },
      ingress: { domain: 'ingress.westeurope.azure.example.org' },
      taints: [],
      settings: { scheduling: { visible: true } },
    },
    status: {
      capacity: { shoots: '150' },
      allocatable: { shoots: '120' },
      conditions: [
        { type: 'GardenletReady', status: 'True', message: 'Gardenlet is ready.' },
        { type: 'SeedSystemComponentsHealthy', status: 'False', message: 'One component is degraded.', reason: 'ComponentsUnhealthy' },
      ],
    },
  },
  {
    kind: 'Seed',
    metadata: { name: 'openstack-eu-de-2', uid: 'seed-openstack-1', labels: { 'seed.gardener.cloud/eu-de-2': 'true' } },
    spec: {
      provider: { type: 'openstack', region: 'eu-de-2' },
      ingress: { domain: 'ingress.eu-de-2.openstack.example.org' },
      taints: [],
      settings: { scheduling: { visible: true } },
    },
    status: {
      capacity: { shoots: '100' },
      allocatable: { shoots: '85' },
      conditions: [
        { type: 'GardenletReady', status: 'True', message: 'Gardenlet is ready.' },
      ],
    },
  },
]

function makeShoot (opts) {
  const {
    uid,
    name,
    namespace,
    project,
    purpose = 'production',
    provider,
    region,
    seed,
    cloudProfile,
    kubernetesVersion = '1.29.2',
    machineImage = { name: 'gardenlinux', version: '1312.3.0' },
    machineType,
    hibernated = false,
    lastOperation = { type: 'Reconcile', state: 'Succeeded', progress: 100, description: 'Cluster has been successfully reconciled.', lastUpdateTime: new Date().toISOString() },
    conditions,
    createdBy = 'demo@gardener.cloud',
    createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  } = opts

  const defaultConditions = [
    { type: 'APIServerAvailable', status: 'True', message: 'API server is healthy.', lastTransitionTime: createdAt },
    { type: 'ControlPlaneHealthy', status: 'True', message: 'All control plane components are healthy.', lastTransitionTime: createdAt },
    { type: 'EveryNodeReady', status: 'True', message: 'All nodes are ready.', lastTransitionTime: createdAt },
    { type: 'SystemComponentsHealthy', status: 'True', message: 'All system components are healthy.', lastTransitionTime: createdAt },
    { type: 'ObservabilityComponentsHealthy', status: 'True', message: 'All observability components are healthy.', lastTransitionTime: createdAt },
  ]

  const minDiskSize = '50Gi'
  return {
    apiVersion: 'core.gardener.cloud/v1beta1',
    kind: 'Shoot',
    metadata: {
      uid,
      name,
      namespace,
      resourceVersion: '42',
      generation: 1,
      creationTimestamp: createdAt,
      annotations: {
        'gardener.cloud/created-by': createdBy,
      },
      labels: {
        'shoot.gardener.cloud/status': lastOperation.state === 'Succeeded' ? 'healthy' : 'unhealthy',
      },
    },
    spec: {
      cloudProfile: { name: cloudProfile, kind: 'CloudProfile' },
      cloudProfileName: cloudProfile,
      region,
      hibernation: { enabled: hibernated },
      provider: {
        type: provider,
        controlPlaneConfig: { apiVersion: `${provider}.provider.extensions.gardener.cloud/v1alpha1`, kind: 'ControlPlaneConfig' },
        infrastructureConfig: { apiVersion: `${provider}.provider.extensions.gardener.cloud/v1alpha1`, kind: 'InfrastructureConfig', networks: { vpc: { cidr: '10.250.0.0/16' } } },
        workers: [
          {
            name: 'worker-pool',
            machine: {
              type: machineType,
              image: machineImage,
              architecture: 'amd64',
            },
            minimum: 1,
            maximum: 3,
            maxSurge: 1,
            maxUnavailable: 0,
            volume: { type: 'standard', size: minDiskSize },
            zones: [`${region}a`, `${region}b`],
          },
        ],
      },
      seedName: seed,
      networking: { type: 'calico', pods: '100.96.0.0/11', nodes: '10.250.0.0/16', services: '100.64.0.0/13' },
      kubernetes: { version: kubernetesVersion, enableStaticTokenKubeconfig: false },
      purpose,
      maintenance: {
        timeWindow: { begin: '220000+0100', end: '230000+0100' },
        autoUpdate: { kubernetesVersion: true, machineImageVersion: true },
      },
      addons: { kubernetesDashboard: { enabled: false }, nginxIngress: { enabled: false } },
      credentialsBindingName: `${provider}-credentialsbinding`,
    },
    status: {
      lastOperation,
      conditions: conditions ?? defaultConditions,
      observedGeneration: 1,
      technicalID: `shoot--${project}--${name}`,
      gardener: { id: 'gardener-controller-manager', name: 'gardener-controller-manager', version: 'v1.95.0' },
      advertisedAddresses: [
        { name: 'external', url: `https://api.${name}.${project}.shoot.example.org` },
      ],
    },
    info: {
      cloudProfile,
      seedShootIngressDomain: `${name}.${project}.shoot.example.org`,
      kubernetesDashboardUrl: undefined,
    },
  }
}

const now = new Date()
const ago = days => new Date(now.getTime() - days * 86400_000).toISOString()

export const shoots = [
  makeShoot({
    uid: 'shoot-aws-prod-1',
    name: 'prod-frontend',
    namespace: 'garden-demo',
    project: 'demo',
    provider: 'aws',
    region: 'eu-west-1',
    seed: 'aws-eu-west-1',
    cloudProfile: 'aws',
    machineType: 'm5.large',
    purpose: 'production',
    createdAt: ago(45),
  }),
  makeShoot({
    uid: 'shoot-aws-prod-2',
    name: 'prod-backend',
    namespace: 'garden-demo',
    project: 'demo',
    provider: 'aws',
    region: 'eu-west-1',
    seed: 'aws-eu-west-1',
    cloudProfile: 'aws',
    machineType: 'm5.xlarge',
    purpose: 'production',
    kubernetesVersion: '1.28.6',
    createdAt: ago(60),
  }),
  makeShoot({
    uid: 'shoot-gcp-staging-1',
    name: 'staging-cluster',
    namespace: 'garden-demo',
    project: 'demo',
    provider: 'gcp',
    region: 'europe-west1',
    seed: 'gcp-europe-west1',
    cloudProfile: 'gcp',
    machineType: 'n1-standard-2',
    purpose: 'evaluation',
    hibernated: true,
    lastOperation: { type: 'Reconcile', state: 'Succeeded', progress: 100, description: 'Cluster is hibernated.', lastUpdateTime: ago(2) },
    createdAt: ago(20),
  }),
  makeShoot({
    uid: 'shoot-azure-dev-1',
    name: 'dev-azure',
    namespace: 'garden-demo',
    project: 'demo',
    provider: 'azure',
    region: 'westeurope',
    seed: 'azure-westeurope',
    cloudProfile: 'az',
    machineType: 'Standard_D2_v3',
    purpose: 'development',
    kubernetesVersion: '1.29.1',
    lastOperation: { type: 'Reconcile', state: 'Processing', progress: 65, description: 'Reconciling cluster components.', lastUpdateTime: ago(0.01) },
    conditions: [
      { type: 'APIServerAvailable', status: 'True', message: 'API server reachable.' },
      { type: 'ControlPlaneHealthy', status: 'True', message: 'Control plane healthy.' },
      { type: 'EveryNodeReady', status: 'False', message: 'Node node-2 not ready.', reason: 'NodeNotReady' },
      { type: 'SystemComponentsHealthy', status: 'True' },
      { type: 'ObservabilityComponentsHealthy', status: 'True' },
    ],
    createdAt: ago(5),
  }),
  makeShoot({
    uid: 'shoot-openstack-prod-1',
    name: 'prod-openstack',
    namespace: 'garden-demo',
    project: 'demo',
    provider: 'openstack',
    region: 'eu-de-2',
    seed: 'openstack-eu-de-2',
    cloudProfile: 'os',
    machineType: 'g_c4_m16',
    purpose: 'production',
    kubernetesVersion: '1.28.6',
    machineImage: { name: 'gardenlinux', version: '1312.3.0' },
    createdAt: ago(120),
  }),
  makeShoot({
    uid: 'shoot-trial-1',
    name: 'sandbox',
    namespace: 'garden-trial',
    project: 'trial',
    provider: 'aws',
    region: 'eu-west-1',
    seed: 'aws-eu-west-1',
    cloudProfile: 'aws',
    machineType: 'm5.large',
    purpose: 'evaluation',
    kubernetesVersion: '1.27.10',
    createdAt: ago(3),
  }),
]

export const members = [
  {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'User',
    username: 'demo@gardener.cloud',
    name: 'demo@gardener.cloud',
    role: 'admin',
    roles: ['owner', 'uam'],
    displayName: 'Demo User',
  },
  {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'User',
    username: 'alice@example.org',
    name: 'alice@example.org',
    role: 'admin',
    roles: ['admin'],
    displayName: 'Alice Doe',
  },
  {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'User',
    username: 'bob@example.org',
    name: 'bob@example.org',
    role: 'viewer',
    roles: ['viewer'],
    displayName: 'Bob Bauer',
  },
  {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'ServiceAccount',
    namespace: 'garden-demo',
    username: 'system:serviceaccount:garden-demo:ci-bot',
    name: 'system:serviceaccount:garden-demo:ci-bot',
    role: 'admin',
    roles: ['admin'],
    displayName: 'CI Bot',
    createdBy: 'demo@gardener.cloud',
    creationTimestamp: ago(10),
  },
]

export const subjectRules = {
  resourceRules: [
    { verbs: ['*'], apiGroups: ['*'], resources: ['*'] },
    { verbs: ['*'], nonResourceURLs: ['*'] },
  ],
  nonResourceRules: [],
  incomplete: false,
}

export const info = {
  user: { name: 'Demo User', email: 'demo@gardener.cloud' },
  gardenerVersion: { gitVersion: 'v1.95.0' },
  version: '1.85.0-demo',
}

export const kubeconfigData = {
  oidc: {
    clientId: 'demo-client',
    usePKCE: true,
    issuerUrl: 'https://oidc.example.org',
  },
  server: 'https://api.gardener.cloud',
  certificateAuthorityData: '',
}

export const dashboardConfig = {
  ...config,
  apiServerUrl: 'https://api.gardener.cloud',
  clusterIdentity: 'gardener-demo-landscape',
  defaultHibernationSchedule: config.defaultHibernationSchedule,
  branding: {
    productName: 'Gardener',
    productSlogan: 'Universal Kubernetes at Scale',
    productTitle: 'Gardener Demo',
  },
  themes: {
    light: {
      primary: '#0b8062',
      'main-navigation-title': 'shades.white',
    },
    dark: {
      primary: '#1ed492',
      'main-navigation-title': 'shades.white',
    },
  },
  features: {
    terminalEnabled: false,
    projectTerminalShortcutsEnabled: false,
  },
  knownConditions: undefined,
  ticket: undefined,
}

export const tickets = { issues: [], comments: [] }

export const dashboardCloudProfiles = cloudprofiles.map(cp => ({
  ...cp,
  apiVersion: 'core.gardener.cloud/v1beta1',
  kind: 'CloudProfile',
}))

export const dashboardGardenerExtensions = gardenerExtensions

export const dashboardCredentials = credentials

export { PROJECTS }
