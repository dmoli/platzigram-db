'use strict'

const test = require('ava')
const utils = require('../lib/utils')

test('extracting hashtags from text', t => {
  let tags = utils.extractTags('a #picture with tags #AweSome #Platzi #AVA and #100 ##yes')
  // compare objects, arrays, the keys has the same values
  t.deepEqual(tags, [
    'picture',
    'awesome',
    'platzi',
    'ava',
    '100',
    'yes' // default. Ex: ##hola
  ])

  // text without tags
  tags = utils.extractTags('a picture with no tags')
  t.deepEqual(tags, [])

  // text without text
  tags = utils.extractTags()
  t.deepEqual(tags, [])

  // text with null
  tags = utils.extractTags(null)
  t.deepEqual(tags, [])
})

test('encrypt password', t => {
  let password = 'foo123'
  let encrypted = '02b353bf5358995bc7d193ed1ce9c2eaec2b694b21d2f96232c9d6a0832121d1'

  let result = utils.encrypt(password)
  t.is(result, encrypted)
})
