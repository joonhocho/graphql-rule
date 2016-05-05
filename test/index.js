import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
import Model from '../lib';

describe('Model', () => {
  afterEach(() => Model.clear());

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
      get user() { return this.getParentOfType('User'); }
      isSharedWith(user) { return this.user.isFriendsWith(user); }
    });

    // Create a Name model
    const NameModel = Model.create(class Name {
      static isName(obj) { return obj instanceof NameModel; }
      getFirstAndLastName() { return [this.firstName, this.lastName]; }
      get shortName() { return `${this.firstName} ${this.lastName}`; }
      get profile() { return this.getParent(); }
      get profile2() { return this.getParentOfType(Profile); }
      get profile3() { return this.getParentOfType('Profile'); }
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
        return this.getRawValue('friendIds').map((id) => ({id}));
      }
      isFriendsWith(user) {
        return this.getRawValue('friendIds').indexOf(user.id) > -1;
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
    expect(user.getRawValue('friendIds')).to.eql(['2', '4']);

    // hidden field access
    expect(user.hiddenField).to.be.undefined;

    // access hidden field
    expect(user.getRawValue('hiddenField')).to.equal(1);

    // set hidden field
    user.hiddenField = 3;
    expect(user.hiddenField).to.be.undefined;
    expect(user.getRawValue('hiddenField')).to.equal(3);

    // constructor
    expect(user.constructor).to.equal(User);

    // instanceof
    expect(user).to.be.an.instanceof(User);

    // implements
    expect(user.implements(Node)).to.be.true;

    // dynamic field
    expect(user.friends.map(({id}) => id)).to.eql(user.getRawData().friendIds);

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
    expect(name.implements(Node)).to.be.true;
    expect(name.implements(InfoInterface)).to.be.true;

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

    // getParent
    expect(name.profile).to.equal(profile);

    // getParentOfType
    expect(name.profile2).to.equal(profile);
    expect(name.profile3).to.equal(profile);

    // getParentOfType declared by InfoBase
    expect(name.user).to.equal(user);

    // getParent
    expect(name.getParent().getParent()).to.equal(user);

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
    profile.clearCache('names');
    expect(profile.names[0]).to.not.equal(name);
    expect(profile.names[0].id).to.equal(name.id);

    // destory
    user.destroy();
    expect(() => user.id).to.throw();
    expect(user.getParent()).to.be.undefined;
  });


  it('creates a Model without parent access', () => {
    const Child = Model.create(class Child {}, {
      fields: {
        id: true,
      },
      parentAccess: false,
    });

    const Parent = Model.create(class Parent {}, {
      fields: {
        child: Child,
      },
    });

    const parent = new Parent({child: {id: 1}});
    expect(parent.getParent()).to.be.null;
    expect(parent.child.getParent()).to.be.null;
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
    const parent = new Parent({child: {child: {}}}, null, context);
    expect(parent.getContext()).to.equal(context);
    expect(parent.child.getContext()).to.equal(context);
    expect(parent.child.child.getContext()).to.equal(context);
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
});
