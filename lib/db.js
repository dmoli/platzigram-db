'use strict'

const co = require('co')
const r = require('rethinkdb')
const Promise = require('bluebird')
const utils = require('./utils')
const uuid = require('uuid-base62')

const defaults = {
  host: 'localhost',
  port: 28015,
  db: 'platzigram'
}

class Db {
  constructor (options) {
    options = options || {}
    this.host = options.host || defaults.host
    this.port = options.port || defaults.port
    this.db = options.db || defaults.db
    this.setup = options.setup || false
  }
  // the same of the method "addToArray", but also with a async await inside it
  connect (callback) {
    this.connection = r.connect({
      host: this.host,
      port: this.port
    })
    this.connected = true
    let db = this.db
    let connection = this.connection

    // if i dont want to setup (is faster for production)
    if (!this.setup) {
      return connection
    }

    // return a promise, is similary a async/await
    let setup = co.wrap(function * () { // co.wrap(function * () ~ async
      let conn = yield connection // yield is a promise ~ await

      // create database
      let dbList = yield r.dbList().run(conn)
      // if not exist database
      if (dbList.indexOf(db) === -1) {
        // then create db
        yield r.dbCreate(db).run(conn)
      }

      // create tables
      let dbTables = yield r.db(db).tableList().run(conn)
      // if not exist table
      if (dbTables.indexOf('images') === -1) {
        // then create table
        yield r.db(db).tableCreate('images').run(conn)
        // create a index
        yield r.db(db).table('images').indexCreate('createdAt').run(conn)
        // multi: true, userId can be repeat for a multiple register
        yield r.db(db).table('images').indexCreate('userId', { multi: true }).run(conn)
      }
      // if not exist table
      if (dbTables.indexOf('users') === -1) {
        // then create table
        yield r.db(db).tableCreate('users').run(conn)
        // create a index
        yield r.db(db).table('users').indexCreate('username').run(conn)
      }

      return conn
    })

    // if callback is null, the behavior is like a promise
    // if callback is not null, the behavior is like a callback
    return Promise.resolve(setup()).asCallback(callback)
  }

  disconnect (callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }
    this.connected = false
    // when the connection is resolve, then is closed
    return Promise.resolve(this.connection).then((conn) => conn.close())
  }

  saveImage (image, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db

    // async function
    let task = co.wrap(function * () {
      let conn = yield connection // resolve this function
      image.createdAt = new Date()
      image.tags = utils.extractTags(image.description)
      let result = yield r.db(db).table('images').insert(image).run(conn)

      if (result.errors > 0) {
        return Promise.reject(new Error(result.first_error))
      }

      // add new id
      image.id = result.generated_keys[0]

      // update to generate public id
      yield r.db(db).table('images').get(image.id).update({
        publicId: uuid.encode(image.id)
      }).run(conn)

      // get the image to return it
      let created = yield r.db(db).table('images').get(image.id).run(conn)

      return created
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  likeImage (id, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db
    let getImage = this.getImage.bind(this)

    // async function
    let task = co.wrap(function * () {
      let conn = yield connection // resolve this function
      let image = yield getImage(id)
      yield r.db(db).table('images').get(image.id).update({
        liked: true,
        likes: image.likes + 1
      }).run(conn)
      let created = yield getImage(id)
      return created
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  getImage (id, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db
    // return origin id
    let imageId = uuid.decode(id)

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection
      let image = yield r.db(db).table('images').get(imageId).run(conn)

      if (!image) {
        return Promise.reject(new Error(`image ${imageId} not found`))
      }

      return image
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  getImages (callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection

      // return a cursor
      let images = yield r.db(db).table('images').orderBy({
        index: r.desc('createdAt')
      }).run(conn)

      let result = yield images.toArray()

      return result
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  saveUser (user, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection
      if (!user.facebook) {
        user.password = utils.encrypt(user.password)
      }
      user.createdAt = new Date()
      let result = yield r.db(db).table('users').insert(user).run(conn)
      if (result.errors > 0) {
        return Promise.reject(new Error(result.first_error))
      }

      // add new id
      user.id = result.generated_keys[0]

      let created = yield r.db(db).table('users').get(user.id).run(conn)
      return created
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  getUser (username, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection
      // create the index, take a time, then we need to wait
      yield r.db(db).table('users').indexWait().run(conn)
      let users = yield r.db(db).table('users').getAll(username, {
        index: 'username'
      }).run(conn)

      let result = null

      try {
        result = yield users.next()
      } catch (e) {
        return Promise.reject(new Error(`user ${username} not found`)).asCallback(callback)
      }

      return result
    })

    // resolve async function
    return Promise.resolve(task()).asCallback(callback)
  }

  authenticate (username, password, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connection')).asCallback(callback)
    }

    let getUser = this.getUser.bind(this)

    // async await
    let task = co.wrap(function * () {
      let user = null
      // if not exist user, return false (this is for the user not show "this user not found", cause is dangerous information)
      try {
        user = yield getUser(username)
      } catch (e) {
        return false
      }
      if (user.password === utils.encrypt(password)) {
        return true
      } else {
        return false
      }
    })

    return Promise.resolve(task()).asCallback(callback)
  }

  getImagesByUser (userId, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connection')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection
      // create the index, take a time, then we need to wait
      yield r.db(db).table('images').indexWait().run(conn)
      let images = yield r.db(db).table('images').getAll(userId, {
        index: 'userId'
      }).orderBy(r.desc('createdAt')).run(conn)

      let result = yield images.toArray()

      return result
    })

    return Promise.resolve(task()).asCallback(callback)
  }

  getImagesByTag (tag, callback) {
    if (!this.connected) {
      return Promise.reject(new Error('not connection')).asCallback(callback)
    }

    let connection = this.connection
    let db = this.db
    tag = utils.normalize(tag)

    // async await
    let task = co.wrap(function * () {
      let conn = yield connection
      // create the index, take a time, then we need to wait
      yield r.db(db).table('images').indexWait().run(conn)
      // filter by a img field
      let images = yield r.db(db).table('images').filter((img) => {
        return img('tags').contains(tag)
      }).orderBy(r.desc('createdAt')).run(conn)

      let result = yield images.toArray()

      return result
    })

    return Promise.resolve(task()).asCallback(callback)
  }
}

module.exports = Db
