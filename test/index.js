import {expect} from 'chai';

describe('Model', () => {
  it('User', (done) => {
    const InfoInterface = Model.create({
    });

    const InfoBase = Model.create({
      fields: {
        isPublic: Boolean,
      },
    });

    const Name = Model.create({
      extends: InfoBase,
      implements: [Node, InfoInterface],
      fields: {
      },
    });

    const Info = Model.create({
      fields: {
        names: Name,
      },
    });

    const User = Model.create({
      implements: [Node],
      fields: {
        names: Name,
      },
    });

    const user = new User({
      id: '1',
      info: {
        names: [{id: 'n1', firstName: 'F', lastName: 'L'}],
      },
      friendIds: ['2', '4'],
    });

    expect(user.constructor).to.equal(User);
    expect(user instanceof User).to.be.true;

    expect(user.info.name.constructor).to.equal(Name);
    expect(user.info.name instanceof Name).to.be.true;
    expect(user.info.name).to.equal(user.info.name);

    expect(user.info.name.implements(Node)).to.be.true;
    expect(user.info.name.implements(ProfileInfoInterface)).to.be.true;

    expect(user.info.name.shortName).to.equal('F L');
    expect(user.info.name.parent.parent).to.equal(user);
    expect(user.info.name.user).to.equal(user);

    expect(
      user.friends.then(
        (friends) => friends.map(({id}) => id)
      )
    ).to.eventually.equal(user.friendIds).notify(done);
  });
});
