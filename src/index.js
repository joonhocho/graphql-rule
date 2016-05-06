import Permissions from 'auth-perm';
import GraphQLPermissions from 'graphql-permissions';
import RoModel from 'romodel';


new GraphQLPermissions({
  permissions: new Permissions({
    admins: ['adminId'],
    defaultLevel: 0,
    authenticatedLevel = 1,
    adminLevel = 10,
  }),
  reject: () => { throw new Error('Unauthorized'); },
  getUserId: (id) => id,
});


const GraphQLNode = RoModel.create(class GraphQLNode {
  get nodeType() {
    return this.constructor.name;
  }
}, {
  fields: {
    id: true,
  },
});


const GraphQLRestricted = RoModel.create(class GraphQLRestricted {
  get nodeType() {
    return this.constructor.name;
  }
}, {
  fields: {
    id: true,
  },
});
