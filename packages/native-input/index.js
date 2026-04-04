const fs = require('node:fs')
const path = require('node:path')

const REQUIRED_METHODS = [
  'getCursorPosition',
  'moveMouse',
  'mouseDown',
  'mouseUp',
  'click',
  'scroll',
  'keySequence',
  'keyDown',
  'keyUp',
  'typeText',
]

function resolveBindingPath() {
  const override = process.env.COMPUTER_USE_RUST_INPUT_PATH
  if (override) {
    return path.resolve(override)
  }

  const candidates = [
    path.join(__dirname, 'native-input.node'),
    path.join(__dirname, 'target', 'release', 'native-input.node'),
    path.join(__dirname, 'target', 'debug', 'native-input.node'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'Could not locate the native-input addon. Run `npm --prefix packages/native-input run build` or set COMPUTER_USE_RUST_INPUT_PATH.',
  )
}

function loadBinding() {
  const bindingPath = resolveBindingPath()
  const binding = require(bindingPath)

  for (const method of REQUIRED_METHODS) {
    if (typeof binding[method] !== 'function') {
      throw new Error(`Native input addon at ${bindingPath} is missing ${method}().`)
    }
  }

  return binding
}

const binding = loadBinding()

function wrap(method) {
  return (...args) => Promise.resolve().then(() => binding[method](...args))
}

module.exports = {
  getCursorPosition: wrap('getCursorPosition'),
  moveMouse: wrap('moveMouse'),
  mouseDown: wrap('mouseDown'),
  mouseUp: wrap('mouseUp'),
  click: wrap('click'),
  scroll: wrap('scroll'),
  keySequence: wrap('keySequence'),
  keyDown: wrap('keyDown'),
  keyUp: wrap('keyUp'),
  typeText: wrap('typeText'),
}
