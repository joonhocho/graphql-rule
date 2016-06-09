if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}
import {expect} from 'chai';
import {config, create, clear, Model} from '../lib';

describe('graphql-rule', () => {
  beforeEach(() => {
    clear();
    config({
      read: true,
      readFail: null,
    });
  });


  it('no rules', () => {
    const Model = create({
      name: 'Model',
    });

    const m = new Model({a: 1, b: 2});
    expect(m.a).to.be.undefined;
    expect(m.b).to.be.undefined;
  });


  it('basic access rules', () => {
    const Model = create({
      name: 'Model',
      rules: {
        a: true, // always allow
        b: false, // always disallow
        c: () => true, // always allow
        d: () => false, // always disallow
        e: {}, // defaults
        f: {
          read: false, // always disallow
          // uses default readFail
        },
        g: {
          read: false, // always disallow
          readFail: new Error(), // return an error when failed
        },
        h: {
          read: false, // always disallow
          readFail: () => { throw new Error(); }, // throw when fail
        },
        i: {
          read: ({$data}) => $data.i, // allow based on its value
        },
      },
    });

    const m = new Model({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 1});

    expect(m.a).to.equal(1);

    expect(m.b).to.be.null;

    expect(m.c).to.equal(3);

    expect(m.d).to.be.null;

    expect(m.e).to.equal(5);

    expect(m.f).to.be.null;

    expect(m.g).to.be.an.instanceof(Error);

    expect(() => m.h).to.throw(Error);

    // should return its value since its truthy
    expect(m.i).to.equal(1);

    m.$data.i = 0; // change raw value
    expect(m.i).to.equal(1); // cached

    // should return null since its falsy
    delete m.i; // remove cached value
    expect(m.i).to.be.null; // recalculate value

    m.i = 2; // overwrite
    expect(m.i).to.equal(2);
  });


  it('cache', () => {
    let aCount = 0;
    let bCount = 0;

    const Model = create({
      name: 'Model',
      rules: {
        a: {
          read: () => ++aCount,
          cache: true,
        },
        b: {
          read: () => ++bCount,
          cache: false,
        },
      },
    });

    const m = new Model({a: 1, b: 1});

    expect(m.a).to.equal(1);
    expect(m.a).to.equal(1);
    expect(aCount).to.equal(1);

    expect(m.b).to.equal(1);
    expect(m.b).to.equal(1);
    expect(bCount).to.equal(2);
  });


  it('$props', () => {
    let callCount = 0;

    const Model = create({
      name: 'Model',
      props: {
        isAdmin: ({$context}) => Boolean($context.admin),
        isGuest: ({$context}) => !$context.id,
        isAuthenticated: ({$props}) => !$props.isGuest,
        isOwner: ({$props: {authorId, authId}}) => authorId === authId,
        authId: ({$context}) => $context.id,
        authorId: ({$data}) => $data.id,
        callCount: () => ++callCount,
      },
      rules: {
        adminField: ({$props}) => $props.isAdmin,
        authField: ({$props}) => $props.isAuthenticated,
        guestField: ({$props}) => $props.isGuest,
        ownerField: ({$props}) => $props.isOwner,
      },
    });

    const auth = {id: 1, admin: true};


    const m1 = new Model({
      id: 1,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth);

    expect(m1.$props.isAdmin).to.be.true;
    expect(m1.$props.isGuest).to.be.false;
    expect(m1.$props.isAuthenticated).to.be.true;
    expect(m1.$props.isOwner).to.be.true;
    expect(m1.$props.authId).to.equal(1);
    expect(m1.$props.authorId).to.equal(1);

    expect(m1.$props.callCount).to.equal(1); // not cached
    expect(m1.$props.callCount).to.equal(1); // cached

    expect(m1.adminField).to.equal(2);
    expect(m1.authField).to.equal(3);
    expect(m1.guestField).to.be.null;
    expect(m1.ownerField).to.equal(5);


    const m2 = new Model({
      id: 2,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth);

    expect(m2.$props.isAdmin).to.be.true;
    expect(m2.$props.isGuest).to.be.false;
    expect(m2.$props.isAuthenticated).to.be.true;
    expect(m2.$props.isOwner).to.be.false;
    expect(m2.$props.authId).to.equal(1);
    expect(m2.$props.authorId).to.equal(2);
    expect(m2.$props.callCount).to.equal(2); // not cached
    expect(m2.$props.callCount).to.equal(2); // cached

    expect(m2.adminField).to.equal(2);
    expect(m2.authField).to.equal(3);
    expect(m2.guestField).to.be.null;
    expect(m2.ownerField).to.be.null;


    const auth2 = {id: 4, admin: false};
    const m3 = new Model({
      id: 3,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth2);

    expect(m3.$props.isAdmin).to.be.false;
    expect(m3.$props.isGuest).to.be.false;
    expect(m3.$props.isAuthenticated).to.be.true;
    expect(m3.$props.isOwner).to.be.false;
    expect(m3.$props.authId).to.equal(4);
    expect(m3.$props.authorId).to.equal(3);
    expect(m3.$props.callCount).to.equal(3);
    expect(m3.$props.callCount).to.equal(3);

    expect(m3.adminField).to.be.null;
    expect(m3.authField).to.equal(3);
    expect(m3.guestField).to.be.null;
    expect(m3.ownerField).to.be.null;


    const m4 = new Model({
      id: 4,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, {});

    expect(m4.$props.isAdmin).to.be.false;
    expect(m4.$props.isGuest).to.be.true;
    expect(m4.$props.isAuthenticated).to.be.false;
    expect(m4.$props.isOwner).to.be.false;
    expect(m4.$props.authId).to.be.undefined;
    expect(m4.$props.authorId).to.equal(4);
    expect(m4.$props.callCount).to.equal(4);
    expect(m4.$props.callCount).to.equal(4);

    expect(m4.adminField).to.be.null;
    expect(m4.authField).to.be.null;
    expect(m4.guestField).to.equal(4);
    expect(m4.ownerField).to.be.null;
  });


  it('Parent / Child', () => {
    const Parent = create({
      name: 'Parent',
      rules: {
        child: 'Child',
        children: {
          type: '[Child]',
          // type: 'Child', list: true,
          readListItem: ({$data}) => $data.id <= 3,
        },
      },
    });

    const Child = create({
      name: 'Child',
      rules: {
        id: true,
        child: {
          type: 'GrandChild',
        },
      },
    });

    const GrandChild = create({
      name: 'GrandChild',
      rules: {
        id: true,
      },
    });

    const context = {};

    const p = new Parent({
      child: {id: 1, child: {id: 4}},
      children: [{id: 2}, {id: 3}, {id: 5}],
    }, context);

    expect(p.child).to.be.an.instanceof(Child);
    expect(p.child.id).to.equal(1);
    expect(p.child).to.equal(p.child); // cached

    expect(p.child.child).to.be.an.instanceof(GrandChild);
    expect(p.child.child.id).to.equal(4);
    expect(p.child.child).to.equal(p.child.child); // cached

    expect(p.child.child.$parent).to.equal(p.child);
    expect(p.child.child.$parent.$parent).to.equal(p);

    expect(p.child.child.$root).to.equal(p);

    expect(p.child.child.$context).to.equal(context);

    expect(p.child.child.$parentOfType('Child')).to.equal(p.child);
    expect(p.child.child.$parentOfType('Parent')).to.equal(p);
    expect(p.child.child.$parentOfType('GrandChild')).to.be.null;

    expect(p.children.length).to.equal(2);

    expect(p.children[0]).to.be.an.instanceof(Child);
    expect(p.children[0].id).to.equal(2);

    expect(p.children[1]).to.be.an.instanceof(Child);
    expect(p.children[1].id).to.equal(3);

    expect(p.children).to.equal(p.children); // cached
    expect(p.children[0]).to.equal(p.children[0]); // cached

    expect(p.child.$parent).to.equal(p);
    expect(p.children[0].$parent).to.equal(p);
    expect(p.children[0].$root).to.equal(p);

    expect(p.$context).to.equal(context);
    expect(p.child.$context).to.equal(context);
    expect(p.children[0].$context).to.equal(context);
  });


  it('Class extention', () => {
    const Base = create({
      name: 'Base',
      props: {
        prop1: () => 1,
        prop2: () => 2,
      },
      rules: {
        field1: true,
        field2: false,
      },
    });

    const Class = create({
      name: 'Class',
      base: Base,
      props: {
        prop2: () => 3,
        prop3: () => 4,
      },
      rules: {
        field2: true,
        field3: true,
      },
    });

    const u = new Class({
      field1: 1,
      field2: 2,
      field3: 3,
    });

    expect(u).to.be.an.instanceof(Class);
    expect(u).to.be.an.instanceof(Base);
    expect(u).to.be.an.instanceof(Model);

    expect(u.field1).to.equal(1);
    expect(u.field2).to.equal(2); // override
    expect(u.field3).to.equal(3);

    // inherited props
    expect(u.$props.prop1).to.equal(1);
    expect(u.$props.prop2).to.equal(3);
    expect(u.$props.prop3).to.equal(4);
  });


  it('Interfaces', () => {
    const Node = create({
      name: 'Node',
      props: {
        prop1: () => 1,
        prop2: () => 2,
      },
      rules: {
        id: true,
      },
    });

    const User = create({
      name: 'Child',
      interfaces: [Node],
      props: {
        prop2: () => 3,
        prop3: () => 4,
      },
      rules: {
        name: true,
      },
    });

    const u = new User({
      id: 1,
      name: 'hi',
    });

    // inherited rules
    expect(u.id).to.equal(1);

    expect(u.name).to.equal('hi');

    expect(u.$implements(Node)).to.be.true;

    // inherited props
    expect(u.$props.prop1).to.equal(1);
    expect(u.$props.prop2).to.equal(3);
    expect(u.$props.prop3).to.equal(4);
  });


  it('supports promise', (done) => {
    const Child = create({
      name: 'Child',
      rules: {
        v: {
          read: (model, key, value) => value === true,
        },
      },
    });

    const Model = create({
      name: 'Model',
      rules: {
        a: {
          type: 'Child',
          read: (model, key, value) => value instanceof Child,
        },
      },
    });

    const m = new Model({
      a: Promise.resolve({v: Promise.resolve(true)}),
    });

    const m2 = new Model({
      a: Promise.resolve({v: false}),
    });

    const m3 = new Model({
      a: Promise.resolve(null),
    });

    Promise.all([
      m.a.then((a) => a.v).then((v) => expect(v).to.equal(true)),
      m2.a.then((a) => a.v).then((v) => expect(v).to.equal(null)),
      m3.a.then((a) => expect(a).to.equal(null)),
    ]).then(() => done(), done);
  });


  it('supports method with arguments', () => {
    const Model = create({
      name: 'Model',
      rules: {
        getA: {
          read: true,
          method: true,
        },
      },
    });

    const m = new Model({
      getA(add) {
        return this.a + add;
      },
      a: 3,
    });

    expect(m.getA(2)).to.equal(5);
    expect(m.a).to.be.undefined;
  });


  it('supports method whose return value is child type', (done) => {
    const Child = create({
      name: 'Child',
      rules: {
        v: true,
      },
    });

    const Model = create({
      name: 'Model',
      rules: {
        getA: {
          read: true,
          method: true,
          type: 'Child',
        },
      },
    });

    const m = new Model({
      getA(add) {
        return Promise.resolve({v: this.a + add});
      },
      a: 3,
    });

    Promise.all([
      m.getA(2).then((c) => {;
        expect(c).to.be.an.instanceof(Child);
        expect(c.v).to.equal(5);
        expect(m.getA(2)).to.not.equal(m.getA(2));
      }),
      m.getA(4).then((c) => {
        expect(c.v).to.equal(7);
      }),
    ]).then(() => done(), done);
  });


  it('supports preRead', () => {
    const Model = create({
      name: 'Model',
      rules: {
        a: {
          preRead: false,
          cache: false,
        },
        getB: {
          preRead: false,
          method: true,
        },
      },
    });

    let a = 0;
    let b = 0;
    const m = new Model({
      get a() { return ++a; },
      getB() { return ++b; }
    });

    expect(m.a).to.be.null;
    expect(m.a).to.be.null;
    expect(a).to.equal(0);

    expect(m.getB()).to.be.null;
    expect(m.getB()).to.be.null;
    expect(b).to.equal(0);
  });


  it('README without GraphQL', () => {
    // create access control model for your data
    const Model = create({
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
          readFail: () => { throw new Error('Access denied'); },
        },

        conditional: {
          // access raw data via `$data`.
          // conditionally allow access if `conditional` <= 3.
          read: (model) => model.$data.conditional <= 3,

          readFail: (model) => { throw new Error(`${model.$data.conditional} > 3`); },
        },
      },
    });


    // create a wrapped instance of your data.
    const securedData = new Model({
      public: 'public data',
      secret: 'something secret',
      conditional: 5,
    });

    expect(securedData.public).to.equal('public data');

    expect(() => securedData.secret).to.throw('Access denied');

    expect(() => securedData.conditional).to.throw('5 > 3');


    // same access model for different data.
    const securedData2 = new Model({conditional: 1});

    expect(securedData2.conditional).to.equal(1); // 1 since 1 < 3.
  });


  it('README without GraphQL', () => {
    // set default `readFail`
    config({
      readFail: () => { throw new Error('Access denied'); },
    });

    const User = create({
      name: 'User',

      // props are lazily initialized and cached once initialized.
      // accessible via `model.$props`.
      props: {
        isAdmin: (model) => model.$context.admin,

        isAuthenticated: (model) => Boolean(model.$context.userId),

        isOwner: (model) => model.$data.id === model.$context.userId,
      },

      rules: {
        id: true,

        email: {
          // allow access by admin or owner.
          read: (model) => model.$props.isAdmin || model.$props.isOwner,

          // returns null when read denied.
          readFail: null,
        },

        password: false,

        profile: {
          // Use `Profile` Rule for `profile`.
          type: 'Profile',

          // allow access by all authenticated users
          read: (model) => model.$props.isAuthenticated,

          readFail: () => { throw new Error('Login Required'); },
        },
      },
    });

    const Profile = create({
      name: 'Profile',

      rules: {
        name: true,

        phone: {
          // Access `User` model via `$parent`.
          read: (model) => model.$parent.$props.isAdmin || model.$parent.$props.isOwner,

          readFail: () => { throw new Error('Not authorized!'); },
        },
      },
    });


    const session = {
      userId: 'session_user_id',
      admin: false,
    };

    const userData = {
      id: 'user_id',
      email: 'user@example.com',
      password: 'secret',
      profile: {
        name: 'John Doe',
        phone: '123-456-7890',
      },
    };

    // pass `session` as a second param to make it available as `$context`.
    const user = new User(userData, session);

    expect(user.id).to.equal('user_id');

    expect(user.email).to.be.null; // `null` since not admin nor owner.

    expect(() => user.password).to.throw('Access denied');

    // `Profile` instance. accessible since authenticated.
    expect(user.profile).to.be.an.instanceof(Profile);

    expect(user.profile.name).to.equal('John Doe');

    expect(() => user.profile.phone).to.throw('Not authorized!');
  });


  it('README $context', () => {
    const Model = create({
      name: 'Model',
      props: {
        // context.admin
        isAdmin: (model) => Boolean(model.$context.admin),

        // !context.userId
        isGuest: (model) => !model.$context.userId,

        // !props.isGuest
        isAuthenticated: (model) => !model.$props.isGuest,

        // context.userId
        authId: (model) => model.$context.userId,

        // data.authorId
        authorId: (model) => model.$data.authorId,

        // props.authorId === props.authId
        isOwner: (model) => model.$props.authorId === model.$props.authId,
      },
      defaultRule: {
        // read allowed by default
        read: (model) => true,

        // throws an error when read not allowed
        readFail: (model, key) => { throw new Error(`Cannot access '${key}'`); },
      },
      rules: {

        // use defaultRule settings
        authorId: {},

        // above is equivalent to:
        adminField: {
          read: (model) => model.$props.isAdmin,
        },

        // read allowed only if `props.isAuthenticated`
        authField: (model) => model.$props.isAuthenticated,

        // read allowed only if `props.isGuest`
        guestField: (model) => model.$props.isGuest,

        // read allowed only if `props.isOwner`
        ownerField: (model) => model.$props.isOwner,

        notAllowedField: {
          read: (model) => false,
          readFail: (model, key) => { throw new Error('not allowed'); },
        },

        nullField: {
          read: (model) => false,
          readFail: (model) => null,
        },
      },
    });

    const session = {
      userId: 'user_id_1',
      admin: true,
    };

    const model = new Model(
      {
        authorId: 'user_id_1',
        adminField: 'adminFieldValue',
        authField: 'authFieldValue',
        guestField: 'guestFieldValue',
        ownerField: 'ownerFieldValue',
        notAllowedField: 'notAllowedFieldValue',
        nullField: 'nullFieldValue',
        undefinedField: 'undefinedFieldValue',
      }, // passed as $data
      session, // passed as $context
    );

    expect(model.$props.isAdmin).to.equal(true);
    expect(model.$props.isGuest).to.equal(false);
    expect(model.$props.isAuthenticated).to.equal(true);
    expect(model.$props.isOwner).to.equal(true);
    expect(model.$props.authId).to.equal('user_id_1');
    expect(model.$props.authorId).to.equal('user_id_1');

    // allowed to read by defaultRule.read rule
    expect(model.authorId).to.equal('user_id_1');

    // allowed to read since $props.isAdmin
    expect(model.adminField).to.equal('adminFieldValue');

    // allowed to read since $props.isAuthenticated
    expect(model.authField).to.equal('authFieldValue');

    // not allowed to read since !$props.isGuest
    expect(() => model.guestField).to.throw(/guestField/); // throws Error("Cannot access 'guestField'")

    // allowed to read since $props.isOwner
    expect(model.ownerField).to.equal('ownerFieldValue');

    // not allowed to read
    expect(() => model.notAllowedField).to.throw('not allowed'); // throws Error('not allowed')

    // not allowed to read; returns null
    expect(model.nullField).to.equal(null);

    // rule is undefined
    expect(model.undefinedField).to.equal(undefined);
  });
});
