import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
import GraphQLModel from '../lib';

describe('GraphQLModel', () => {
  afterEach(() => GraphQLModel.clear());

  it('Basic', () => {
    const Model = GraphQLModel.create({
      name: 'Info',
      props: {
        isAdmin: ({$context}) => $context.admin,
        isAuthenticated: ({$context}) => $context.id,
        owner: (model) => model.$parentOfType('User'),
        isOwner: ({$context}) => this.owner.id === $context.id,
        isPublic: ({$data}) => $data.isPublic,
        isSharedDirectly: ({$data, $context}) => $data.sharedTo.includes($context.id),
        isSharedViaTag: ({$props, $context, id}) => $props.owner.$data.tags.find(({userIds, infoIds}) =>
          userIds.includes($context.id) &&
          infoIds.includes(id)
        ),
      },
      rules: {
        $default: {
          read: ({$props}) => $props.isAdmin ||
              $props.isOwner ||
              $props.isPublic ||
              $props.isSharedDirectly ||
              $props.isSharedViaTag,
          reject: () => null,
        },
        name: {
          model: 'Model',
          read: () => true,
          reject: () => null,
        },
        isPublic: {
          read: (model) => {
            const {$props, $rules} = model;
            return ($props.isAdmin || $props.isOwner) && $rules.$default.read(model);
          },
          reject: () => throw new Error('Cannot access isPublic'),
        },
        publicField: true,
        authRequiredField: ({$props}) => $props.isAuthenticated,
        ownerField: ({$props}) => $props.isOwner,
        adminField: ({$props}) => $props.isAdmin,
        superSecretField: false,
      },
    });
  });
});
