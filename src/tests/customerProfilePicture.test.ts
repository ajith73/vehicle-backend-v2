import test from 'node:test';
import assert from 'node:assert/strict';
import { sequelize } from '../config/database';
import {
  createCustomerProfileDefaults,
  getCustomerProfileColumns,
  resetCustomerProfileColumnsCacheForTests,
  sanitizeCustomerProfilePayload
} from '../controllers/helpers/customerController.helpers';

type DescribeTableResult = Record<string, Record<string, unknown>>;
type QueryInterfaceMock = {
  describeTable: (tableName: string) => Promise<DescribeTableResult>;
  addColumn: (tableName: string, columnName: string, definition: Record<string, unknown>) => Promise<void>;
};

const originalGetQueryInterface = sequelize.getQueryInterface.bind(sequelize);

const withMockedQueryInterface = async (
  mockFactory: () => QueryInterfaceMock,
  run: () => Promise<void>
) => {
  resetCustomerProfileColumnsCacheForTests();
  (sequelize as any).getQueryInterface = mockFactory;

  try {
    await run();
  } finally {
    (sequelize as any).getQueryInterface = originalGetQueryInterface;
    resetCustomerProfileColumnsCacheForTests();
  }
};

test('getCustomerProfileColumns adds profilePicture when missing from CustomerProfiles', async () => {
  const addedColumns: string[] = [];
  let describeCount = 0;

  await withMockedQueryInterface(() => {
    let tableState: DescribeTableResult = {
      userId: {},
      displayName: {},
      phone: {},
      lastLoginAt: {}
    };

    return {
      async describeTable() {
        describeCount += 1;
        return tableState;
      },
      async addColumn(_tableName, columnName) {
        addedColumns.push(columnName);
        tableState = {
          ...tableState,
          [columnName]: {}
        };
      }
    };
  }, async () => {
    const columns = await getCustomerProfileColumns();

    assert.equal(columns.has('profilePicture'), true);
    assert.equal(columns.has('savedVehicles'), true);
    assert.equal(columns.has('savedLocations'), true);
    assert.equal(columns.has('prioritySupportEligible'), true);
  });

  assert.deepEqual(
    addedColumns.sort(),
    ['prioritySupportEligible', 'profilePicture', 'savedLocations', 'savedVehicles'].sort()
  );
  assert.ok(describeCount >= 1);
});

test('sanitizeCustomerProfilePayload keeps profilePicture and filters unsupported fields', async () => {
  await withMockedQueryInterface(() => ({
    async describeTable() {
      return {
        userId: {},
        displayName: {},
        phone: {},
        profilePicture: {},
        savedVehicles: {},
        savedLocations: {},
        prioritySupportEligible: {}
      };
    },
    async addColumn() {
      throw new Error('addColumn should not be called when columns already exist');
    }
  }), async () => {
    const sanitized = await sanitizeCustomerProfilePayload({
      displayName: 'Ajith',
      profilePicture: 'data:image/png;base64,abc123',
      savedLocations: [{ id: '1', name: 'Home' }],
      unsupportedField: 'drop-me'
    });

    assert.deepEqual(sanitized, {
      displayName: 'Ajith',
      profilePicture: 'data:image/png;base64,abc123',
      savedLocations: [{ id: '1', name: 'Home' }]
    });
  });
});

test('createCustomerProfileDefaults exposes profilePicture for new customer profiles', async () => {
  await withMockedQueryInterface(() => ({
    async describeTable() {
      return {
        userId: {},
        displayName: {},
        phone: {},
        lastLoginAt: {},
        profilePicture: {},
        savedVehicles: {},
        savedLocations: {},
        prioritySupportEligible: {}
      };
    },
    async addColumn() {
      throw new Error('addColumn should not be called when columns already exist');
    }
  }), async () => {
    const defaults = await createCustomerProfileDefaults(99);

    assert.equal(defaults.userId, 99);
    assert.equal(defaults.profilePicture, null);
    assert.deepEqual(defaults.savedVehicles, []);
    assert.deepEqual(defaults.savedLocations, []);
  });
});
