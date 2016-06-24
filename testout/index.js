'use strict';

var _chai = require('chai');

var _chai2 = _interopRequireDefault(_chai);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireDefault(_chaiAsPromised);

var _lib = require('../lib');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}

_chai2.default.use(_chaiAsPromised2.default);


describe('graphql-rule', function () {
  beforeEach(function () {
    (0, _lib.clear)();
    (0, _lib.config)({
      read: true,
      readFail: null
    });
  });

  it('no rules', function () {
    var Model = (0, _lib.create)({
      name: 'Model'
    });

    var m = new Model({ a: 1, b: 2 });
    (0, _chai.expect)(m.a).to.be.undefined;
    (0, _chai.expect)(m.b).to.be.undefined;
  });

  it('basic access rules', function () {
    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        a: true, // always allow
        b: false, // always disallow
        c: function c() {
          return true;
        }, // always allow
        d: function d() {
          return false;
        }, // always disallow
        e: {}, // defaults
        f: {
          read: false },
        // always disallow
        // uses default readFail
        g: {
          read: false, // always disallow
          readFail: new Error() },
        // return an error when failed
        h: {
          read: false, // always disallow
          readFail: function readFail() {
            throw new Error();
          } },
        // throw when fail
        i: {
          read: function read(_ref) {
            var $data = _ref.$data;
            return $data.i;
          } }
      }
    });

    // allow based on its value
    var m = new Model({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 1 });

    (0, _chai.expect)(m.a).to.equal(1);

    (0, _chai.expect)(m.b).to.be.null;

    (0, _chai.expect)(m.c).to.equal(3);

    (0, _chai.expect)(m.d).to.be.null;

    (0, _chai.expect)(m.e).to.equal(5);

    (0, _chai.expect)(m.f).to.be.null;

    (0, _chai.expect)(m.g).to.be.an.instanceof(Error);

    (0, _chai.expect)(function () {
      return m.h;
    }).to.throw(Error);

    // should return its value since its truthy
    (0, _chai.expect)(m.i).to.equal(1);

    m.$data.i = 0; // change raw value
    (0, _chai.expect)(m.i).to.equal(1); // cached

    // should return null since its falsy
    delete m.i; // remove cached value
    (0, _chai.expect)(m.i).to.be.null; // recalculate value

    m.i = 2; // overwrite
    (0, _chai.expect)(m.i).to.equal(2);
  });

  it('cache', function () {
    var aCount = 0;
    var bCount = 0;

    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        a: {
          read: function read() {
            return ++aCount;
          },
          cache: true
        },
        b: {
          read: function read() {
            return ++bCount;
          },
          cache: false
        }
      }
    });

    var m = new Model({ a: 1, b: 1 });

    (0, _chai.expect)(m.a).to.equal(1);
    (0, _chai.expect)(m.a).to.equal(1);
    (0, _chai.expect)(aCount).to.equal(1);

    (0, _chai.expect)(m.b).to.equal(1);
    (0, _chai.expect)(m.b).to.equal(1);
    (0, _chai.expect)(bCount).to.equal(2);
  });

  it('$props', function () {
    var _callCount = 0;

    var Model = (0, _lib.create)({
      name: 'Model',
      props: {
        isAdmin: function isAdmin(_ref2) {
          var $context = _ref2.$context;
          return Boolean($context.admin);
        },
        isGuest: function isGuest(_ref3) {
          var $context = _ref3.$context;
          return !$context.id;
        },
        isAuthenticated: function isAuthenticated(_ref4) {
          var $props = _ref4.$props;
          return !$props.isGuest;
        },
        isOwner: function isOwner(_ref5) {
          var _ref5$$props = _ref5.$props;
          var authorId = _ref5$$props.authorId;
          var authId = _ref5$$props.authId;
          return authorId === authId;
        },
        authId: function authId(_ref6) {
          var $context = _ref6.$context;
          return $context.id;
        },
        authorId: function authorId(_ref7) {
          var $data = _ref7.$data;
          return $data.id;
        },
        callCount: function callCount() {
          return ++_callCount;
        }
      },
      rules: {
        adminField: function adminField(_ref8) {
          var $props = _ref8.$props;
          return $props.isAdmin;
        },
        authField: function authField(_ref9) {
          var $props = _ref9.$props;
          return $props.isAuthenticated;
        },
        guestField: function guestField(_ref10) {
          var $props = _ref10.$props;
          return $props.isGuest;
        },
        ownerField: function ownerField(_ref11) {
          var $props = _ref11.$props;
          return $props.isOwner;
        }
      }
    });

    var auth = { id: 1, admin: true };

    var m1 = new Model({
      id: 1,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5
    }, auth);

    (0, _chai.expect)(m1.$props.isAdmin).to.be.true;
    (0, _chai.expect)(m1.$props.isGuest).to.be.false;
    (0, _chai.expect)(m1.$props.isAuthenticated).to.be.true;
    (0, _chai.expect)(m1.$props.isOwner).to.be.true;
    (0, _chai.expect)(m1.$props.authId).to.equal(1);
    (0, _chai.expect)(m1.$props.authorId).to.equal(1);

    (0, _chai.expect)(m1.$props.callCount).to.equal(1); // not cached
    (0, _chai.expect)(m1.$props.callCount).to.equal(1); // cached

    (0, _chai.expect)(m1.adminField).to.equal(2);
    (0, _chai.expect)(m1.authField).to.equal(3);
    (0, _chai.expect)(m1.guestField).to.be.null;
    (0, _chai.expect)(m1.ownerField).to.equal(5);

    var m2 = new Model({
      id: 2,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5
    }, auth);

    (0, _chai.expect)(m2.$props.isAdmin).to.be.true;
    (0, _chai.expect)(m2.$props.isGuest).to.be.false;
    (0, _chai.expect)(m2.$props.isAuthenticated).to.be.true;
    (0, _chai.expect)(m2.$props.isOwner).to.be.false;
    (0, _chai.expect)(m2.$props.authId).to.equal(1);
    (0, _chai.expect)(m2.$props.authorId).to.equal(2);
    (0, _chai.expect)(m2.$props.callCount).to.equal(2); // not cached
    (0, _chai.expect)(m2.$props.callCount).to.equal(2); // cached

    (0, _chai.expect)(m2.adminField).to.equal(2);
    (0, _chai.expect)(m2.authField).to.equal(3);
    (0, _chai.expect)(m2.guestField).to.be.null;
    (0, _chai.expect)(m2.ownerField).to.be.null;

    var auth2 = { id: 4, admin: false };
    var m3 = new Model({
      id: 3,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5
    }, auth2);

    (0, _chai.expect)(m3.$props.isAdmin).to.be.false;
    (0, _chai.expect)(m3.$props.isGuest).to.be.false;
    (0, _chai.expect)(m3.$props.isAuthenticated).to.be.true;
    (0, _chai.expect)(m3.$props.isOwner).to.be.false;
    (0, _chai.expect)(m3.$props.authId).to.equal(4);
    (0, _chai.expect)(m3.$props.authorId).to.equal(3);
    (0, _chai.expect)(m3.$props.callCount).to.equal(3);
    (0, _chai.expect)(m3.$props.callCount).to.equal(3);

    (0, _chai.expect)(m3.adminField).to.be.null;
    (0, _chai.expect)(m3.authField).to.equal(3);
    (0, _chai.expect)(m3.guestField).to.be.null;
    (0, _chai.expect)(m3.ownerField).to.be.null;

    var m4 = new Model({
      id: 4,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5
    }, {});

    (0, _chai.expect)(m4.$props.isAdmin).to.be.false;
    (0, _chai.expect)(m4.$props.isGuest).to.be.true;
    (0, _chai.expect)(m4.$props.isAuthenticated).to.be.false;
    (0, _chai.expect)(m4.$props.isOwner).to.be.false;
    (0, _chai.expect)(m4.$props.authId).to.be.undefined;
    (0, _chai.expect)(m4.$props.authorId).to.equal(4);
    (0, _chai.expect)(m4.$props.callCount).to.equal(4);
    (0, _chai.expect)(m4.$props.callCount).to.equal(4);

    (0, _chai.expect)(m4.adminField).to.be.null;
    (0, _chai.expect)(m4.authField).to.be.null;
    (0, _chai.expect)(m4.guestField).to.equal(4);
    (0, _chai.expect)(m4.ownerField).to.be.null;
  });

  it('Parent / Child', function () {
    var Parent = (0, _lib.create)({
      name: 'Parent',
      rules: {
        child: 'Child',
        children: {
          type: '[Child]',
          // type: 'Child', list: true,
          readListItem: function readListItem(_ref12) {
            var $data = _ref12.$data;
            return $data.id <= 3;
          }
        }
      }
    });

    var Child = (0, _lib.create)({
      name: 'Child',
      rules: {
        id: true,
        child: {
          type: 'GrandChild'
        }
      }
    });

    var GrandChild = (0, _lib.create)({
      name: 'GrandChild',
      rules: {
        id: true
      }
    });

    var context = {};

    var p = new Parent({
      child: { id: 1, child: { id: 4 } },
      children: [{ id: 2 }, { id: 3 }, { id: 5 }]
    }, context);

    (0, _chai.expect)(p.child).to.be.an.instanceof(Child);
    (0, _chai.expect)(p.child.id).to.equal(1);
    (0, _chai.expect)(p.child).to.equal(p.child); // cached

    (0, _chai.expect)(p.child.child).to.be.an.instanceof(GrandChild);
    (0, _chai.expect)(p.child.child.id).to.equal(4);
    (0, _chai.expect)(p.child.child).to.equal(p.child.child); // cached

    (0, _chai.expect)(p.child.child.$parent).to.equal(p.child);
    (0, _chai.expect)(p.child.child.$parent.$parent).to.equal(p);

    (0, _chai.expect)(p.child.child.$root).to.equal(p);

    (0, _chai.expect)(p.child.child.$context).to.equal(context);

    (0, _chai.expect)(p.child.child.$parentOfType('Child')).to.equal(p.child);
    (0, _chai.expect)(p.child.child.$parentOfType('Parent')).to.equal(p);
    (0, _chai.expect)(p.child.child.$parentOfType('GrandChild')).to.be.null;

    (0, _chai.expect)(p.children.length).to.equal(2);

    (0, _chai.expect)(p.children[0]).to.be.an.instanceof(Child);
    (0, _chai.expect)(p.children[0].id).to.equal(2);

    (0, _chai.expect)(p.children[1]).to.be.an.instanceof(Child);
    (0, _chai.expect)(p.children[1].id).to.equal(3);

    (0, _chai.expect)(p.children).to.equal(p.children); // cached
    (0, _chai.expect)(p.children[0]).to.equal(p.children[0]); // cached

    (0, _chai.expect)(p.child.$parent).to.equal(p);
    (0, _chai.expect)(p.children[0].$parent).to.equal(p);
    (0, _chai.expect)(p.children[0].$root).to.equal(p);

    (0, _chai.expect)(p.$context).to.equal(context);
    (0, _chai.expect)(p.child.$context).to.equal(context);
    (0, _chai.expect)(p.children[0].$context).to.equal(context);
  });

  it('Class extention', function () {
    var Base = (0, _lib.create)({
      name: 'Base',
      props: {
        prop1: function prop1() {
          return 1;
        },
        prop2: function prop2() {
          return 2;
        }
      },
      rules: {
        field1: true,
        field2: false
      }
    });

    var Class = (0, _lib.create)({
      name: 'Class',
      base: Base,
      props: {
        prop2: function prop2() {
          return 3;
        },
        prop3: function prop3() {
          return 4;
        }
      },
      rules: {
        field2: true,
        field3: true
      }
    });

    var u = new Class({
      field1: 1,
      field2: 2,
      field3: 3
    });

    (0, _chai.expect)(u).to.be.an.instanceof(Class);
    (0, _chai.expect)(u).to.be.an.instanceof(Base);
    (0, _chai.expect)(u).to.be.an.instanceof(_lib.Model);

    (0, _chai.expect)(u.field1).to.equal(1);
    (0, _chai.expect)(u.field2).to.equal(2); // override
    (0, _chai.expect)(u.field3).to.equal(3);

    // inherited props
    (0, _chai.expect)(u.$props.prop1).to.equal(1);
    (0, _chai.expect)(u.$props.prop2).to.equal(3);
    (0, _chai.expect)(u.$props.prop3).to.equal(4);
  });

  it('Interfaces', function () {
    var Node = (0, _lib.create)({
      name: 'Node',
      props: {
        prop1: function prop1() {
          return 1;
        },
        prop2: function prop2() {
          return 2;
        }
      },
      rules: {
        id: true
      }
    });

    var User = (0, _lib.create)({
      name: 'Child',
      interfaces: [Node],
      props: {
        prop2: function prop2() {
          return 3;
        },
        prop3: function prop3() {
          return 4;
        }
      },
      rules: {
        name: true
      }
    });

    var u = new User({
      id: 1,
      name: 'hi'
    });

    // inherited rules
    (0, _chai.expect)(u.id).to.equal(1);

    (0, _chai.expect)(u.name).to.equal('hi');

    (0, _chai.expect)(u.$implements(Node)).to.be.true;

    // inherited props
    (0, _chai.expect)(u.$props.prop1).to.equal(1);
    (0, _chai.expect)(u.$props.prop2).to.equal(3);
    (0, _chai.expect)(u.$props.prop3).to.equal(4);
  });

  it('supports promise', function (done) {
    var Child = (0, _lib.create)({
      name: 'Child',
      rules: {
        v: {
          read: function read(model, key, value) {
            return value === true;
          }
        }
      }
    });

    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        a: {
          type: 'Child',
          read: function read(model, key, value) {
            return value instanceof Child;
          }
        }
      }
    });

    var m = new Model({
      a: Promise.resolve({ v: Promise.resolve(true) })
    });

    var m2 = new Model({
      a: Promise.resolve({ v: false })
    });

    var m3 = new Model({
      a: Promise.resolve(null)
    });

    Promise.all([m.a.then(function (a) {
      return a.v;
    }).then(function (v) {
      return (0, _chai.expect)(v).to.equal(true);
    }), m2.a.then(function (a) {
      return a.v;
    }).then(function (v) {
      return (0, _chai.expect)(v).to.equal(null);
    }), m3.a.then(function (a) {
      return (0, _chai.expect)(a).to.equal(null);
    })]).then(function () {
      return done();
    }, done);
  });

  it('supports method with arguments', function () {
    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        getA: {
          read: true,
          method: true
        }
      }
    });

    var m = new Model({
      getA: function getA(add) {
        return this.a + add;
      },

      a: 3
    });

    (0, _chai.expect)(m.getA(2)).to.equal(5);
    (0, _chai.expect)(m.a).to.be.undefined;
  });

  it('supports method whose return value is child type', function (done) {
    var Child = (0, _lib.create)({
      name: 'Child',
      rules: {
        v: true
      }
    });

    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        getA: {
          read: true,
          method: true,
          type: 'Child'
        }
      }
    });

    var m = new Model({
      getA: function getA(add) {
        return Promise.resolve({ v: this.a + add });
      },

      a: 3
    });

    Promise.all([m.getA(2).then(function (c) {
      ;
      (0, _chai.expect)(c).to.be.an.instanceof(Child);
      (0, _chai.expect)(c.v).to.equal(5);
      (0, _chai.expect)(m.getA(2)).to.not.equal(m.getA(2));
    }), m.getA(4).then(function (c) {
      (0, _chai.expect)(c.v).to.equal(7);
    })]).then(function () {
      return done();
    }, done);
  });

  it('supports preRead', function () {
    var Model = (0, _lib.create)({
      name: 'Model',
      rules: {
        a: {
          preRead: false,
          cache: false
        },
        getB: {
          preRead: false,
          method: true
        }
      }
    });

    var a = 0;
    var b = 0;
    var m = new Model({
      get a() {
        return ++a;
      },
      getB: function getB() {
        return ++b;
      }
    });

    (0, _chai.expect)(m.a).to.be.null;
    (0, _chai.expect)(m.a).to.be.null;
    (0, _chai.expect)(a).to.equal(0);

    (0, _chai.expect)(m.getB()).to.be.null;
    (0, _chai.expect)(m.getB()).to.be.null;
    (0, _chai.expect)(b).to.equal(0);
  });

  it('README without GraphQL', function () {
    // create access control model for your data
    var Model = (0, _lib.create)({
      // name for this access model
      name: 'Model',

      // define access rules
      rules: {
        // allow access to `public` property.
        public: true,

        secret: {
          // disallow access to `secret` property.
          read: false,

          // throw an error when read is disallowed.
          readFail: function readFail() {
            throw new Error('Access denied');
          }
        },

        conditional: {
          // access raw data via `$data`.
          // conditionally allow access if `conditional` <= 3.
          read: function read(model) {
            return model.$data.conditional <= 3;
          },

          readFail: function readFail(model) {
            throw new Error(model.$data.conditional + ' > 3');
          }
        }
      }
    });

    // create a wrapped instance of your data.
    var securedData = new Model({
      public: 'public data',
      secret: 'something secret',
      conditional: 5
    });

    (0, _chai.expect)(securedData.public).to.equal('public data');

    (0, _chai.expect)(function () {
      return securedData.secret;
    }).to.throw('Access denied');

    (0, _chai.expect)(function () {
      return securedData.conditional;
    }).to.throw('5 > 3');

    // same access model for different data.
    var securedData2 = new Model({ conditional: 1 });

    (0, _chai.expect)(securedData2.conditional).to.equal(1); // 1 since 1 < 3.
  });

  it('README without GraphQL', function () {
    // set default `readFail`
    (0, _lib.config)({
      readFail: function readFail() {
        throw new Error('Access denied');
      }
    });

    var User = (0, _lib.create)({
      name: 'User',

      // props are lazily initialized and cached once initialized.
      // accessible via `model.$props`.
      props: {
        isAdmin: function isAdmin(model) {
          return model.$context.admin;
        },

        isAuthenticated: function isAuthenticated(model) {
          return Boolean(model.$context.userId);
        },

        isOwner: function isOwner(model) {
          return model.$data.id === model.$context.userId;
        }
      },

      rules: {
        id: true,

        email: {
          // allow access by admin or owner.
          read: function read(model) {
            return model.$props.isAdmin || model.$props.isOwner;
          },

          // returns null when read denied.
          readFail: null
        },

        password: false,

        profile: {
          // Use `Profile` Rule for `profile`.
          type: 'Profile',

          // allow access by all authenticated users
          read: function read(model) {
            return model.$props.isAuthenticated;
          },

          readFail: function readFail() {
            throw new Error('Login Required');
          }
        }
      }
    });

    var Profile = (0, _lib.create)({
      name: 'Profile',

      rules: {
        name: true,

        phone: {
          // Access `User` model via `$parent`.
          read: function read(model) {
            return model.$parent.$props.isAdmin || model.$parent.$props.isOwner;
          },

          readFail: function readFail() {
            throw new Error('Not authorized!');
          }
        }
      }
    });

    var session = {
      userId: 'session_user_id',
      admin: false
    };

    var userData = {
      id: 'user_id',
      email: 'user@example.com',
      password: 'secret',
      profile: {
        name: 'John Doe',
        phone: '123-456-7890'
      }
    };

    // pass `session` as a second param to make it available as `$context`.
    var user = new User(userData, session);

    (0, _chai.expect)(user.id).to.equal('user_id');

    (0, _chai.expect)(user.email).to.be.null; // `null` since not admin nor owner.

    (0, _chai.expect)(function () {
      return user.password;
    }).to.throw('Access denied');

    // `Profile` instance. accessible since authenticated.
    (0, _chai.expect)(user.profile).to.be.an.instanceof(Profile);

    (0, _chai.expect)(user.profile.name).to.equal('John Doe');

    (0, _chai.expect)(function () {
      return user.profile.phone;
    }).to.throw('Not authorized!');
  });

  it('README $context', function () {
    var Model = (0, _lib.create)({
      name: 'Model',
      props: {
        // context.admin
        isAdmin: function isAdmin(model) {
          return Boolean(model.$context.admin);
        },

        // !context.userId
        isGuest: function isGuest(model) {
          return !model.$context.userId;
        },

        // !props.isGuest
        isAuthenticated: function isAuthenticated(model) {
          return !model.$props.isGuest;
        },

        // context.userId
        authId: function authId(model) {
          return model.$context.userId;
        },

        // data.authorId
        authorId: function authorId(model) {
          return model.$data.authorId;
        },

        // props.authorId === props.authId
        isOwner: function isOwner(model) {
          return model.$props.authorId === model.$props.authId;
        }
      },
      defaultRule: {
        // read allowed by default
        read: function read(model) {
          return true;
        },

        // throws an error when read not allowed
        readFail: function readFail(model, key) {
          throw new Error('Cannot access \'' + key + '\'');
        }
      },
      rules: {

        // use defaultRule settings
        authorId: {},

        // above is equivalent to:
        adminField: {
          read: function read(model) {
            return model.$props.isAdmin;
          }
        },

        // read allowed only if `props.isAuthenticated`
        authField: function authField(model) {
          return model.$props.isAuthenticated;
        },

        // read allowed only if `props.isGuest`
        guestField: function guestField(model) {
          return model.$props.isGuest;
        },

        // read allowed only if `props.isOwner`
        ownerField: function ownerField(model) {
          return model.$props.isOwner;
        },

        notAllowedField: {
          read: function read(model) {
            return false;
          },
          readFail: function readFail(model, key) {
            throw new Error('not allowed');
          }
        },

        nullField: {
          read: function read(model) {
            return false;
          },
          readFail: function readFail(model) {
            return null;
          }
        }
      }
    });

    var session = {
      userId: 'user_id_1',
      admin: true
    };

    var model = new Model({
      authorId: 'user_id_1',
      adminField: 'adminFieldValue',
      authField: 'authFieldValue',
      guestField: 'guestFieldValue',
      ownerField: 'ownerFieldValue',
      notAllowedField: 'notAllowedFieldValue',
      nullField: 'nullFieldValue',
      undefinedField: 'undefinedFieldValue'
    }, // passed as $data
    session);

    // passed as $context
    (0, _chai.expect)(model.$props.isAdmin).to.equal(true);
    (0, _chai.expect)(model.$props.isGuest).to.equal(false);
    (0, _chai.expect)(model.$props.isAuthenticated).to.equal(true);
    (0, _chai.expect)(model.$props.isOwner).to.equal(true);
    (0, _chai.expect)(model.$props.authId).to.equal('user_id_1');
    (0, _chai.expect)(model.$props.authorId).to.equal('user_id_1');

    // allowed to read by defaultRule.read rule
    (0, _chai.expect)(model.authorId).to.equal('user_id_1');

    // allowed to read since $props.isAdmin
    (0, _chai.expect)(model.adminField).to.equal('adminFieldValue');

    // allowed to read since $props.isAuthenticated
    (0, _chai.expect)(model.authField).to.equal('authFieldValue');

    // not allowed to read since !$props.isGuest
    (0, _chai.expect)(function () {
      return model.guestField;
    }).to.throw(/guestField/); // throws Error("Cannot access 'guestField'")

    // allowed to read since $props.isOwner
    (0, _chai.expect)(model.ownerField).to.equal('ownerFieldValue');

    // not allowed to read
    (0, _chai.expect)(function () {
      return model.notAllowedField;
    }).to.throw('not allowed'); // throws Error('not allowed')

    // not allowed to read; returns null
    (0, _chai.expect)(model.nullField).to.equal(null);

    // rule is undefined
    (0, _chai.expect)(model.undefinedField).to.equal(undefined);
  });
});