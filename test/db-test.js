'use strict'

const test = require('ava')
const uuid = require('uuid-base62')
const Db = require('../')
const r = require('rethinkdb')
const fixtures = require('./fixtures')
const utils = require('../lib/utils')

// hooks. Before for each tests
test.beforeEach('setup database', async t => {
  // create a rand name db
  const dbName = `platzigram_${uuid.v4()}`
  const db = new Db({ db: dbName, setup: true })
  // promise method
  await db.connect()
  t.context.db = db
  t.context.dbName = dbName
  // db.connected must be true
  t.true(db.connected, 'should be connected')
})

// hooks. After and always for each tests
test.afterEach.always('cleanup database', async t => {
  let db = t.context.db
  let dbName = t.context.dbName
  // promise method
  await db.disconnect()
  // db.connected must be false
  t.false(db.connected, 'should be disconnected')

  let conn = await r.connect({})
  await r.dbDrop(dbName).run(conn)
})

// test to save image
test('save image', async t => {
  let db = t.context.db
  t.is(typeof db.saveImage, 'function', 'saveImage is function')

  // create rand image
  let image = fixtures.getImage()
  let created = await db.saveImage(image)

  t.is(created.description, image.description)
  t.is(created.url, image.url)
  t.is(created.likes, image.likes)
  t.is(created.liked, image.liked)
  t.deepEqual(created.tags, [ 'awesome', 'platzi', 'tags' ])
  t.is(created.userId, image.userId)
  t.is(typeof created.id, 'string')
  t.is(created.publicId, uuid.encode(created.id))
  t.truthy(created.createdAt)
})

// test to like function
test('like image', async t => {
  let db = t.context.db
  t.is(typeof db.likeImage, 'function', 'likeImage is a function')

  // create rand image
  let image = fixtures.getImage()
  let created = await db.saveImage(image)
  let result = await db.likeImage(created.publicId)

  t.true(result.liked)
  t.is(result.likes, created.likes + 1)
})

// test to get image
test('get image', async t => {
  let db = t.context.db
  t.is(typeof db.getImage, 'function', 'getImage is a function')

  let image = fixtures.getImage()
  let created = await db.saveImage(image)
  let result = await db.getImage(created.publicId)
  t.deepEqual(created, result)
  // throw params (promise or function, error message to controller) if their (promise or function) return an exception or reject error, then i verify if this error is controlled
  t.throws(db.getImage('foo'), /not found/)
})

// list images
test('list all images', async t => {
  let db = t.context.db
  t.is(typeof db.getImages, 'function', 'getImages is a function')

  let images = fixtures.getImages(3)
  // promise array
  let saveImages = images.map(img => db.saveImage(img))
  // show result when all promise are ready
  let created = await Promise.all(saveImages)
  // get image in db
  let result = await db.getImages()

  t.is(created.length, result.length)
  // note: not used deepEqual, because the order of "result" and "created" could be different for their sort algorithm
})

// create user
test('save user', async t => {
  let db = t.context.db
  t.is(typeof db.saveUser, 'function', 'saveUser is a function')

  let user = fixtures.getUser()
  let plainPassword = user.password
  let created = await db.saveUser(user)
  t.is(user.username, created.username)
  t.is(user.email, created.email)
  t.is(user.name, created.name)
  t.is(utils.encrypt(plainPassword), created.password)
  t.is(typeof created.id, 'string')
  t.truthy(created.createdAt)
})

// create user
test('save facebook user', async t => {
  let db = t.context.db
  t.is(typeof db.saveUser, 'function', 'saveUser is a function')

  let user = fixtures.getUser()
  user.facebook = true
  delete user.password
  let created = await db.saveUser(user)
  t.is(user.username, created.username)
  t.is(user.email, created.email)
  t.is(user.name, created.name)
  t.is(user.facebook, created.facebook)
  t.is(typeof created.id, 'string')
  t.truthy(created.createdAt)
})

// getUser
test('get user', async t => {
  let db = t.context.db
  t.is(typeof db.getUser, 'function', 'getUser is a function')

  let user = fixtures.getUser()
  let created = await db.saveUser(user)
  let result = await db.getUser(user.username)
  t.deepEqual(created, result)
  // throw params (promise or function, error message to controller) if their (promise or function) return an exception or reject error, then i verify if this error is controlled
  t.throws(db.getUser('foo'), /not found/)
})

// authenticate
test('authenticate', async t => {
  let db = t.context.db
  t.is(typeof db.authenticate, 'function', 'authenticate is a function')

  let user = fixtures.getUser()
  user.username = 'skumblue5'
  user.password = '1234'
  let plainPassword = user.password
  await db.saveUser(user)

  let success = await db.authenticate(user.username, plainPassword)
  t.true(success)

  let fail = await db.authenticate(user.username, 'foo')
  t.false(fail)

  let failture = await db.authenticate('foo', 'bar')
  t.false(failture)
})

// get images by users
test('get images by users', async t => {
  let db = t.context.db
  t.is(typeof db.getImagesByUser, 'function', 'getImagesByUser is a function')

  let images = fixtures.getImages(10)
  let userId = uuid.uuid()
  let ramdom = Math.round(Math.random() * images.length)

  let saveImages = []
  for (let i = 0; i < images.length; i++) {
    if (i < ramdom) {
      images[i].userId = userId
    }
    // save only promise, bellow will be executed
    saveImages.push(db.saveImage(images[i]))
  }
  // resolve all promise
  await Promise.all(saveImages)

  let result = await db.getImagesByUser(userId)
  t.is(result.length, ramdom)
})

// get images by users
test('list images by tag', async t => {
  let db = t.context.db
  t.is(typeof db.getImagesByTag, 'function', 'getImagesByTag is a function')

  let images = fixtures.getImages(10)
  let tag = '#filterit'
  let ramdom = Math.round(Math.random() * images.length)

  let saveImages = []
  for (let i = 0; i < images.length; i++) {
    if (i < ramdom) {
      images[i].description = tag
    }
    // save only promise, bellow will be executed
    saveImages.push(db.saveImage(images[i]))
  }
  // resolve all promise
  await Promise.all(saveImages)

  let result = await db.getImagesByTag(tag)
  t.is(result.length, ramdom)
})
