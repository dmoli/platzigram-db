'use strict'

const crypto = require('crypto')

// only export the public functions
const utils = {
  extractTags,
  encrypt,
  normalize
}

function extractTags (text) {
  if (text == null) return []
  let matches = text.match(/#(\w+)/g) // g: all the words of string
  if (matches === null) return []
  matches = matches.map(normalize) // foreach element execute normalize
  return matches
}

function encrypt (password) {
  let shasum = crypto.createHash('sha256') // transform pass to sha256
  shasum.update(password) // return binari
  return shasum.digest('hex') // binari to hex
}

function normalize (text) {
  text = text.toLowerCase()
  text = text.replace(/#/g, '')
  return text
}

module.exports = utils
