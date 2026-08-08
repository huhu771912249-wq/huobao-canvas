import assert from 'node:assert/strict'
import { createVisibilityPollingController } from '../src/utils/visibilityPolling.js'

const listeners = new Map()
const documentRef = {
  visibilityState: 'visible',
  addEventListener(name, listener) {
    listeners.set(name, listener)
  },
  removeEventListener(name, listener) {
    if (listeners.get(name) === listener) listeners.delete(name)
  }
}

const calls = []
const controller = createVisibilityPollingController({
  documentRef,
  onHidden: () => calls.push('hidden'),
  onVisible: () => calls.push('visible')
})

controller.start()
assert.equal(listeners.has('visibilitychange'), true)

documentRef.visibilityState = 'hidden'
listeners.get('visibilitychange')()
assert.deepEqual(calls, ['hidden'])

documentRef.visibilityState = 'visible'
listeners.get('visibilitychange')()
assert.deepEqual(calls, ['hidden', 'visible'])

controller.stop()
assert.equal(listeners.has('visibilitychange'), false)

console.log('visibilityPolling.test.mjs passed')
