# graphql-model
A data model class for wrapping a data object for easier resolving fields in GraphQL.


### Install
```
npm install --save graphql-model
```


### Usage
```javascript
it('User', () => {
  // Create a Node model
  const Node = Model.create(class Node {
    static isNode(obj) { return obj instanceof Node; }
    get type() { return this.constructor.name; }
  }, {
    fields: {
      id: true,
    },
  });

  // Create a InfoInterface model
  const InfoInterface = Model.create(class InfoInterface {}, {
    fields: {
      isPublic: true,
    },
  });

  // Create a InfoBase model
  const InfoBase = Model.create(class InfoBase {
    static isInfo = (obj) => obj instanceof InfoBase
    get user() { return this.$parentOfType('User'); }
    isSharedWith(user) { return this.user.isFriendsWith(user); }
  });

  // Create a Name model
  const NameModel = Model.create(class Name {
    static isName(obj) { return obj instanceof NameModel; }
    getFirstAndLastName() { return [this.firstName, this.lastName]; }
    get shortName() { return `${this.firstName} ${this.lastName}`; }
    get profile() { return this.$parent; }
    get profile2() { return this.$parentOfType(Profile); }
    get profile3() { return this.$parentOfType('Profile'); }
  }, {
    base: InfoBase,
    interfaces: [Node, InfoInterface],
    fields: {
      firstName: true,
      lastName: true,
    },
  });

  // Create a Profile model
  const Profile = Model.create(class Profile {}, {
    fields: {
      names: [NameModel],
    },
  });

  // Create a User model
  const User = Model.create(class User {
    get friends() {
      return this.$field('friendIds').map((id) => ({id}));
    }
    isFriendsWith(user) {
      return this.$field('friendIds').indexOf(user.id) > -1;
    }
  }, {
    interfaces: [Node],
    fields: {
      profile: Profile,
      hiddenField: false,
    },
  });


  // Create a user instance
  const user = new User({
    id: '1',
    profile: {
      names: [{id: 'n1', firstName: 'F', lastName: 'L', isPublic: true}],
    },
    friendIds: ['2', '4'],
    hiddenField: 1,
  });


  // static declared by interface Node
  expect(user.id).to.equal('1');

  // dynamic field defined by interface Node
  expect(user.type).to.equal('User');

  // undeclared field access
  expect(user.friendIds).to.be.undefined;

  // access undeclared field
  expect(user.$field('friendIds')).to.eql(['2', '4']);

  // hidden field access
  expect(user.hiddenField).to.be.undefined;

  // access hidden field
  expect(user.$field('hiddenField')).to.equal(1);

  // set hidden field
  user.hiddenField = 3;
  expect(user.hiddenField).to.be.undefined;
  expect(user.$field('hiddenField')).to.equal(3);

  // constructor
  expect(user.constructor).to.equal(User);

  // instanceof
  expect(user).to.be.an.instanceof(User);

  // $implements
  expect(user.$implements(Node)).to.be.true;

  // dynamic field
  expect(user.friends.map(({id}) => id)).to.eql(user.$data.friendIds);

  // method
  expect(user.isFriendsWith({id: '2'})).to.be.true;
  expect(user.isFriendsWith({id: '1'})).to.be.false;


  // instance field
  const {profile} = user;
  expect(profile).to.be.an.instanceof(Profile);

  // cached
  expect(profile).to.equal(user.profile);


  // instance list field
  const {names: [name]} = profile;
  expect(name.constructor).to.equal(NameModel);
  expect(name).to.be.an.instanceof(NameModel);

  // cached
  expect(name).to.equal(user.profile.names[0]);

  // base class
  expect(name).to.be.an.instanceof(InfoBase);

  // interfaces
  expect(name.$implements(Node)).to.be.true;
  expect(name.$implements(InfoInterface)).to.be.true;

  // field declared by Node
  expect(name.id).to.equal('n1');

  // field declared by Node
  expect(name.type).to.equal('Name');

  // declared field
  expect(name.firstName).to.equal('F');

  // declared field
  expect(name.lastName).to.equal('L');

  // method
  expect(name.getFirstAndLastName()).to.eql(['F', 'L']);

  expect(name.shortName).to.equal('F L');

  // $parent
  expect(name.profile).to.equal(profile);

  // $parentOfType
  expect(name.profile2).to.equal(profile);
  expect(name.profile3).to.equal(profile);

  // $parentOfType declared by InfoBase
  expect(name.user).to.equal(user);

  // $parent
  expect(name.$parent.$parent).to.equal(user);

  // inherited from base
  expect(name.user).to.equal(user);

  // inherited from base
  expect(name.isSharedWith(user)).to.be.false;
  expect(name.isSharedWith({id: '2'})).to.be.true;
  expect(name.isSharedWith({id: '3'})).to.be.false;

  // inherited from InfoInterface
  expect(name.isPublic).to.be.true;

  // static method
  expect(NameModel.isName(name)).to.be.true;
  expect(NameModel.isName(user)).to.be.false;
  expect(NameModel.isInfo(user)).to.be.false;
  expect(NameModel.isInfo(name)).to.be.true;
  expect(NameModel.isInfo).to.equal(InfoBase.isInfo);

  // clear cache
  expect(profile.names[0]).to.equal(name);
  profile.$clearCache('names');
  expect(profile.names[0]).to.not.equal(name);
  expect(profile.names[0].id).to.equal(name.id);

  // destory
  user.$destroy();
  expect(() => user.id).to.throw();
  expect(user.$parent).to.be.undefined;
});


it('can pass down optional context', () => {
  const GrandChild = Model.create(class GrandChild {}, {
    fields: {
      id: true,
    },
  });

  const Child = Model.create(class Child {}, {
    fields: {
      id: true,
      child: GrandChild,
    },
  });

  const Parent = Model.create(class Parent {}, {
    fields: {
      child: Child,
    },
  });

  const context = {};
  const parent = new Parent({child: {child: {}}}, null, null, context);
  expect(parent.$context).to.equal(context);
  expect(parent.child.$context).to.equal(context);
  expect(parent.child.child.$context).to.equal(context);
});


it('passes down a root instance', () => {
  const GrandChild = Model.create(class GrandChild {}, {
    fields: {
      id: true,
    },
  });

  const Child = Model.create(class Child {}, {
    fields: {
      id: true,
      child: GrandChild,
    },
  });

  const Parent = Model.create(class Parent {}, {
    fields: {
      child: Child,
    },
  });

  const parent = new Parent({child: {child: {}}});
  expect(parent.$root).to.equal(parent);
  expect(parent.child.$root).to.equal(parent);
  expect(parent.child.child.$root).to.equal(parent);
});


it('can create a child that is an instance of itself', () => {
  const Selfie = Model.create(class Selfie {}, {
    fields: {
      child: 'Selfie',
    },
  });

  const parent = new Selfie({child: {}});
  expect(parent).to.be.an.instanceof(Selfie);
  expect(parent.child).to.be.an.instanceof(Selfie);
});


it('can create a child of future model class', () => {
  const Present = Model.create(class Present {}, {
    fields: {
      child: 'Future',
    },
  });

  const Future = Model.create(class Future {});

  const parent = new Present({child: {}});
  expect(parent).to.be.an.instanceof(Present);
  expect(parent.child).to.be.an.instanceof(Future);
});
```


### TODO


### LICENSE
```
The MIT License (MIT)

Copyright (c) 2016 Joon Ho Cho

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
