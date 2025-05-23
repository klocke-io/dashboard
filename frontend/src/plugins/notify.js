//
// SPDX-FileCopyrightText: 2023 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

import Notifications from '@kyvg/vue3-notification'

export default {
  install (app) {
    app.use(Notifications)
  },
}
