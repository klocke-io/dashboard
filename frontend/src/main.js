//
// SPDX-FileCopyrightText: 2023 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

// Components
import { createApp } from 'vue'

import { registerPlugins } from '@/plugins'

import App from './App.vue'

// Demo mode: install fetch mock + auth cookie before mount
if (import.meta.env.VITE_DEMO === 'true') {
  await import('./demo/bootstrap.js')
}

const app = createApp(App)

registerPlugins(app)

app.mount('#app')
