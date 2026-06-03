//
// SPDX-FileCopyrightText: 2026 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Stub for socket.io-client used in demo mode. Aliased via vite resolve.alias.
// Mimics enough of the surface used by frontend/src/store/socket/helper.js.

class Emitter {
  constructor () {
    this._listeners = new Map()
  }

  on (event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(fn)
    return this
  }

  off (event, fn) {
    const set = this._listeners.get(event)
    if (set) {
      if (fn) {
        set.delete(fn)
      } else {
        set.clear()
      }
    }
    return this
  }

  emit (event, ...args) {
    const set = this._listeners.get(event)
    if (!set) {
      return
    }
    for (const fn of [...set]) {
      try {
        fn(...args)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[demo-socket] listener error', err)
      }
    }
  }
}

export class Manager extends Emitter {
  open (fn) {
    setTimeout(() => {
      this.emit('open')
      if (typeof fn === 'function') {
        fn()
      }
    }, 0)
  }
}

class FakeSocket extends Emitter {
  constructor () {
    super()
    this.id = `demo-${Math.random().toString(36).slice(2, 10)}`
    this.connected = false
    this.active = false
    this.io = new Manager()
  }

  connect () {
    if (this.connected) {
      return this
    }
    // call manager.open (which the helper has overridden) - it will then call back into us
    const manager = this.io
    const triggerConnect = () => {
      this.connected = true
      this.active = true
      this.emit('connect')
    }
    if (typeof manager.open === 'function') {
      manager.open(triggerConnect)
    } else {
      setTimeout(triggerConnect, 0)
    }
    return this
  }

  disconnect () {
    if (!this.connected) {
      return this
    }
    this.connected = false
    this.active = false
    this.emit('disconnect', 'io client disconnect')
    return this
  }

  timeout () {
    return this
  }

  emit (event, ...args) {
    super.emit(event, ...args)
    return this
  }

  emitWithAck (event, ...args) {
    // Server-style ack responses for our protocol
    if (event === 'subscribe' || event === 'unsubscribe') {
      return Promise.resolve({ statusCode: 200 })
    }
    if (event === 'synchronize') {
      return Promise.resolve({ statusCode: 200, items: [] })
    }
    return Promise.resolve({ statusCode: 200 })
  }
}

export function io () {
  return new FakeSocket()
}

export default io
