//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Demo bootstrap: install fetch mock + cookie BEFORE the app boots.

import { installFetchMock } from './fetch-mock.js'

installFetchMock()

// indicate to the app that demo mode is active
window.__GARDENER_DEMO__ = true

// eslint-disable-next-line no-console
console.info('[demo] mock layer installed')
